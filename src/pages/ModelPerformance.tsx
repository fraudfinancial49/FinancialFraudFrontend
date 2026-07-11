import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, RefreshCw, Loader2, AlertCircle, MousePointerClick } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import apiClient from "@/api/client";
import { useActivity } from "@/store/ActivityContext";
import type { ModelInfoResponse, ModelMetricRow, ShapExplanationResponse, ShapFeatureContribution } from "@/types/api";

const METRIC_KEYS: { key: string; label: string }[] = [
  { key: "roc_auc", label: "ROC AUC" },
  { key: "average_precision", label: "Avg Precision (PR-AUC)" },
  { key: "f1_score", label: "F1 Score" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "mcc", label: "MCC" },
];

export const ModelPerformance: React.FC = () => {
  const { transactions } = useActivity();

  const [info, setInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -- Explainability panel state --------------------------------------
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [shapData, setShapData] = useState<ShapFeatureContribution[] | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [shapError, setShapError] = useState<string | null>(null);

  const fetchModelInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ModelInfoResponse>("/model-info");
      setInfo(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Could not reach /model-info. Confirm the backend is running and reachable."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live SHAP fetch — fires whenever an analyst clicks a transaction row
  // below. Hits the real backend explainability route for that specific
  // transaction_id; no client-side fabrication of feature impacts.
  useEffect(() => {
    if (!selectedTxId) return;
    let cancelled = false;

    const fetchExplanation = async () => {
      setShapLoading(true);
      setShapError(null);
      try {
        const { data } = await apiClient.get<ShapExplanationResponse>(
          `/api/v1/transactions/${selectedTxId}/explain`
        );
        if (cancelled) return;
        const rows: ShapFeatureContribution[] = [
          { feature: "base_value", impact: data.base_value },
          ...Object.entries(data.features).map(([feature, impact]) => ({
            feature,
            impact: Number(impact),
          })),
        ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
        setShapData(rows);
      } catch (err: any) {
        if (cancelled) return;
        setShapData(null);
        setShapError(
          err?.response?.data?.detail ||
            "Could not reach /api/v1/transactions/{id}/explain. Confirm the backend explainability route is deployed."
        );
      } finally {
        if (!cancelled) setShapLoading(false);
      }
    };

    fetchExplanation();
    return () => {
      cancelled = true;
    };
  }, [selectedTxId]);

  const chartData = useMemo(() => {
    const rows: ModelMetricRow[] = info?.model_metrics ?? [];
    return rows.map((row) => {
      const modelName = (row.model as string) ?? (row.model_name as string) ?? "unknown";
      const entry: Record<string, number | string> = { model: modelName };
      METRIC_KEYS.forEach(({ key }) => {
        const v = row[key];
        entry[key] = typeof v === "number" ? Number((v as number).toFixed(4)) : 0;
      });
      return entry;
    });
  }, [info]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Model Infrastructure &amp; XAI</h1>
          <p className="text-sm text-slate-500">
            Cross-engine comparison metrics from the frozen model registry, plus explainability
            breakdowns for security audits.
          </p>
        </div>
        <button onClick={fetchModelInfo} disabled={loading} className="btn-secondary shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Best Model</span>
          <span className="text-lg font-bold text-slate-50">{info?.best_model ?? "—"}</span>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Engines Loaded</span>
          <span className="text-lg font-bold text-slate-50">
            {info?.engines_loaded?.length ?? 0}
          </span>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Tree Feature Count</span>
          <span className="text-lg font-bold text-slate-50">{info?.tree_feature_count ?? "—"}</span>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Deep Feature Count</span>
          <span className="text-lg font-bold text-slate-50">{info?.deep_feature_count ?? "—"}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BrainCircuit className="h-4 w-4 text-accent-indigo" />
            Cross-Model Comparison
          </h2>
        </div>
        <div className="h-80 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
                <XAxis dataKey="model" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: "#0e1424", border: "1px solid #1c2540" }} />
                <Legend />
                <Bar dataKey="roc_auc" name="ROC AUC" fill="#5b6df8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="average_precision" name="Avg Precision" fill="#12b3a8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="f1_score" name="F1" fill="#f5b942" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {loading ? "Loading model metrics…" : "No model metrics available — is the registry loaded?"}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-slate-200">Full Metric Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Model</th>
                {METRIC_KEYS.map((m) => (
                  <th key={m.key} className="px-4 py-2">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.length === 0 && (
                <tr>
                  <td colSpan={METRIC_KEYS.length + 1} className="px-4 py-6 text-center text-slate-500">
                    No metrics to display.
                  </td>
                </tr>
              )}
              {chartData.map((row) => (
                <tr key={row.model as string} className="border-t border-vault-700/60">
                  <td className="px-4 py-2 font-medium text-slate-200">{row.model}</td>
                  {METRIC_KEYS.map((m) => (
                    <td key={m.key} className="px-4 py-2 text-slate-300">
                      {row[m.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <BrainCircuit className="h-4 w-4 text-accent-teal" />
          Explainability Panel — Per-Transaction SHAP Breakdown
        </div>

        {transactions.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-vault-700 bg-vault-850 px-3 py-2 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-teal" />
            <span>
              No assessed transactions yet this session. Run an assessment on the Overview page, then
              select it below to fetch its live SHAP explanation.
            </span>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            {transactions.slice(0, 12).map((tx) => (
              <button
                key={tx.id}
                onClick={() => setSelectedTxId(tx.transaction_id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  selectedTxId === tx.transaction_id
                    ? "border-accent-indigo bg-accent-indigo/20 text-accent-indigo"
                    : "border-vault-700 bg-vault-850 text-slate-400 hover:bg-vault-800"
                }`}
              >
                <span className="font-mono">{tx.transaction_id.slice(0, 10)}…</span>{" "}
                <span className="text-slate-500">({tx.final_risk_score.toFixed(0)})</span>
              </button>
            ))}
          </div>
        )}

        {!selectedTxId && transactions.length > 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <MousePointerClick className="h-5 w-5" />
            Select a transaction above to load its live SHAP breakdown.
          </div>
        )}

        {selectedTxId && (
          <>
            {shapLoading && (
              <div className="flex h-72 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching live SHAP explanation for {selectedTxId}…
              </div>
            )}

            {!shapLoading && shapError && (
              <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{shapError}</span>
              </div>
            )}

            {!shapLoading && !shapError && shapData && (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis type="category" dataKey="feature" stroke="#64748b" fontSize={11} width={180} />
                    <Tooltip contentStyle={{ background: "#0e1424", border: "1px solid #1c2540" }} />
                    <Bar dataKey="impact" radius={[0, 3, 3, 0]} fill="#12b3a8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ModelPerformance;
