import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  BrainCircuit,
  RefreshCw,
  Loader2,
  AlertCircle,
  MousePointerClick,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import type {
  ModelInfoResponse,
  ModelMetricRow,
  ShapFeatureContribution,
  TransactionListResponse,
  TransactionListItem,
} from "@/types/api";

const METRIC_KEYS: { key: string; label: string }[] = [
  { key: "roc_auc", label: "ROC AUC" },
  { key: "average_precision", label: "Avg Precision (PR-AUC)" },
  { key: "f1_score", label: "F1 Score" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "mcc", label: "MCC" },
];

type RoutingFilter = "all" | "approve" | "vault" | "honeypot";

const PAGE_SIZE = 15;

export const ModelPerformance: React.FC = () => {
  const [info, setInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -- Transactions (backend-backed) admin table state ------------------
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [routingFilter, setRoutingFilter] = useState<RoutingFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // -- Explainability panel state --------------------------------------
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [shapData, setShapData] = useState<ShapFeatureContribution[] | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [shapError, setShapError] = useState<string | null>(null);

  const fetchModelInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      // FIXED: Pointing to the new prefixed backend route
      const { data } = await apiClient.get<ModelInfoResponse>("/api/v1/model-info");
      setInfo(data);
    } catch (err: any) {
      // FIXED: Added checks for custom backend "message" keys
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Could not reach /api/v1/model-info. Confirm the backend is running and reachable."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
      };
      if (routingFilter !== "all") {
        params.routing_decision = routingFilter;
      }
      const { data } = await apiClient.get<TransactionListResponse>("/api/v1/transactions", {
        params,
      });
      setTransactions(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setTxError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Could not reach /api/v1/transactions. Confirm the backend is running and reachable."
      );
      setTransactions([]);
      setTotal(0);
    } finally {
      setTxLoading(false);
    }
  }, [page, routingFilter]);

  useEffect(() => {
    fetchModelInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset to page 1 whenever the routing filter changes
  useEffect(() => {
    setPage(1);
  }, [routingFilter]);

  // Live SHAP fetch — fires whenever an analyst clicks a transaction row
  useEffect(() => {
    if (!selectedTxId) return;
    let cancelled = false;

    const fetchExplanation = async () => {
      setShapLoading(true);
      setShapError(null);
      try {
        // Swapped to <any> to allow the dynamic parser to inspect the payload safely
        const { data } = await apiClient.post<any>(
          `/api/v1/transactions/${selectedTxId}/explain`
        );
        if (cancelled) return;

        // BULLETPROOF PARSER: Read the exact keys your Python backend is sending
        const targetPayload = data?.explanation || data;
        const rawFeatures = targetPayload?.contributions || targetPayload?.features || {};
        const baseValue = typeof targetPayload?.base_value === "number" ? targetPayload.base_value : 0;

        const rows: ShapFeatureContribution[] = [
          { feature: "base_value", impact: baseValue },
          ...Object.entries(rawFeatures).map(([feature, impact]) => ({
            feature,
            impact: Number(impact),
          })),
        ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

        setShapData(rows);
      } catch (err: any) {
        if (cancelled) return;
        setShapData(null);
        // FIXED: Allows the true FastAPI exception message to render on the dashboard
        setShapError(
          err?.response?.data?.detail ||
            err?.response?.data?.message ||
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

  // Search filters only the currently loaded page
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((tx) => {
      return (
        tx.transaction_id?.toLowerCase().includes(q) ||
        tx.name_orig?.toLowerCase().includes(q) ||
        tx.name_dest?.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const routingBadgeClass = (decision: string) => {
    switch (decision) {
      case "approve":
        return "border-risk-low/40 bg-risk-low/10 text-risk-low";
      case "vault":
        return "border-accent-indigo/40 bg-accent-indigo/10 text-accent-indigo";
      case "honeypot":
        return "border-risk-high/40 bg-risk-high/10 text-risk-high";
      default:
        return "border-vault-700 bg-vault-850 text-slate-400";
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

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

      <div className="panel">
        <div className="panel-header flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-200">All Transactions (Backend)</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search this page…"
                className="w-56 rounded-lg border border-vault-700 bg-vault-850 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-accent-indigo focus:outline-none"
              />
            </div>
            <select
              value={routingFilter}
              onChange={(e) => setRoutingFilter(e.target.value as RoutingFilter)}
              className="rounded-lg border border-vault-700 bg-vault-850 px-3 py-1.5 text-xs text-slate-200 focus:border-accent-indigo focus:outline-none"
            >
              <option value="all">All</option>
              <option value="approve">Approve</option>
              <option value="vault">Vault</option>
              <option value="honeypot">Honeypot</option>
            </select>
            <button onClick={fetchTransactions} disabled={txLoading} className="btn-secondary shrink-0">
              {txLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        {txError && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{txError}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Transaction ID</th>
                <th className="px-4 py-2">Sender</th>
                <th className="px-4 py-2">Receiver</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Risk Score</th>
                <th className="px-4 py-2">Routing Decision</th>
                <th className="px-4 py-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {txLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading transactions…
                    </span>
                  </td>
                </tr>
              )}
              {!txLoading && filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              )}
              {!txLoading &&
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.transaction_id}
                    onClick={() => setSelectedTxId(tx.transaction_id)}
                    className={`cursor-pointer border-t border-vault-700/60 transition ${
                      selectedTxId === tx.transaction_id
                        ? "bg-accent-indigo/10"
                        : "hover:bg-vault-800/60"
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-slate-300">
                      {tx.transaction_id}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{tx.name_orig}</td>
                    <td className="px-4 py-2 text-slate-300">{tx.name_dest}</td>
                    <td className="px-4 py-2 text-slate-300">
                      {typeof tx.amount === "number" ? tx.amount.toLocaleString() : tx.amount}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {typeof tx.final_risk_score === "number"
                        ? tx.final_risk_score.toFixed(0)
                        : tx.final_risk_score}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium capitalize ${routingBadgeClass(
                          tx.routing_decision
                        )}`}
                      >
                        {tx.routing_decision}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {formatTimestamp(tx.timestamp)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-vault-700/60 px-4 py-3 text-xs text-slate-400">
          <span>
            Page {page} of {totalPages} · {total} total transaction{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || txLoading}
              className="btn-secondary px-2 py-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || txLoading}
              className="btn-secondary px-2 py-1"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <BrainCircuit className="h-4 w-4 text-accent-teal" />
          Explainability Panel — Per-Transaction SHAP Breakdown
        </div>

        {!selectedTxId && (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <MousePointerClick className="h-5 w-5" />
            Select a transaction row above to load its live SHAP breakdown.
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