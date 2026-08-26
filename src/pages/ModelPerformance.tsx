import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, RefreshCw, Loader2, AlertCircle } from "lucide-react";
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
import type { ModelInfoResponse, ModelMetricRow } from "@/types/api";

const METRIC_KEYS: { key: string; label: string }[] = [
  { key: "roc_auc", label: "ROC AUC" },
  { key: "average_precision", label: "Avg Precision (PR-AUC)" },
  { key: "f1_score", label: "F1 Score" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "mcc", label: "MCC" },
];

export const ModelPerformance: React.FC = () => {
  const [info, setInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModelInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ModelInfoResponse>("/api/v1/model-info");
      setInfo(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Could not reach /api/v1/model-info. Confirm the backend is running and reachable."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelInfo();
  }, []);

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
          <h1 className="text-xl font-bold text-slate-50">Model Performance</h1>
          <p className="text-sm text-slate-500">
            Cross-engine comparison metrics from the frozen model registry.
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
    </div>
  );
};

export default ModelPerformance;
