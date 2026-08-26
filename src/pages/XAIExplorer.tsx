import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  BrainCircuit,
  RefreshCw,
  Loader2,
  AlertCircle,
  MousePointerClick,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import apiClient, { explainTransactionNarrative } from "@/api/client";
import type {
  ShapFeatureContribution,
  TransactionListResponse,
  TransactionListItem,
} from "@/types/api";
import { RoutingBadge } from "@/components/RiskBadges";

type RoutingFilter = "all" | "approve" | "otp_verification" | "auto_reject" | "honeypot";

const PAGE_SIZE = 50;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  // A silent 7-day default (the backend's fallback when no dates are passed)
  // was the actual bug behind "the transaction list doesn't show anything" --
  // transactions older than a week vanished with no indication why. This page
  // always passes an EXPLICIT range instead of relying on that fallback, and
  // defaults to a much wider 90-day window so a quiet transaction history
  // isn't mistaken for a broken page.
  start.setDate(start.getDate() - 90);
  return { start: isoDate(start), end: isoDate(end) };
}

export const XAIExplorer: React.FC = () => {
  const initialRange = defaultDateRange();

  // -- Transactions (backend-backed) table state ------------------
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [routingFilter, setRoutingFilter] = useState<RoutingFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  // -- Explainability panel state --------------------------------------
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionListItem | null>(null);
  const [shapData, setShapData] = useState<ShapFeatureContribution[] | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [shapError, setShapError] = useState<string | null>(null);

  // -- AI-powered natural-language explanation --------------------------
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const explainabilityPanelRef = useRef<HTMLDivElement | null>(null);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
        start_date: startDate,
        end_date: endDate,
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
  }, [page, routingFilter, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Changing any filter resets to page 1 in the SAME state update (not a
  // separate effect) -- avoids the old double-fetch race where a filter
  // change fired one request with the stale page, then another once the
  // page-reset effect caught up.
  function updateRoutingFilter(value: RoutingFilter) {
    setRoutingFilter(value);
    setPage(1);
  }
  function updateStartDate(value: string) {
    setStartDate(value);
    setPage(1);
  }
  function updateEndDate(value: string) {
    setEndDate(value);
    setPage(1);
  }

  // Live SHAP fetch — fires whenever an analyst clicks a transaction row
  useEffect(() => {
    if (!selectedTxId) return;
    let cancelled = false;

    const fetchExplanation = async () => {
      setShapLoading(true);
      setShapError(null);
      setNarrative(null);
      setNarrativeError(null);
      try {
        const { data } = await apiClient.post<any>(`/api/v1/transactions/${selectedTxId}/explain`);
        if (cancelled) return;

        const rawFeatures = data?.contributions || {};
        const rows: ShapFeatureContribution[] = Object.entries(rawFeatures)
          .map(([feature, impact]) => ({ feature, impact: Number(impact) }))
          .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

        setShapData(rows);
      } catch (err: any) {
        if (cancelled) return;
        setShapData(null);
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

  async function generateNarrative() {
    if (!selectedTxId || !selectedTx || !shapData) return;
    setNarrativeLoading(true);
    setNarrativeError(null);
    setNarrative(null);
    try {
      const contributions: Record<string, number> = {};
      shapData.forEach((row) => {
        contributions[row.feature] = row.impact;
      });
      const res = await explainTransactionNarrative(selectedTxId, {
        final_risk_score: selectedTx.final_risk_score,
        routing_decision: selectedTx.routing_decision,
        contributions,
      });
      setNarrative(res.narrative);
    } catch (err: any) {
      setNarrativeError(
        err?.response?.data?.detail || "AI explanation is temporarily unavailable — the visual SHAP chart above is unaffected."
      );
    } finally {
      setNarrativeLoading(false);
    }
  }

  function selectTransaction(tx: TransactionListItem) {
    setSelectedTx(tx);
    setSelectedTxId(tx.transaction_id);
    explainabilityPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
          <h1 className="text-xl font-bold text-slate-50">XAI Explorer</h1>
          <p className="text-sm text-slate-500">
            Browse real, backend-scored transactions and drill into their live SHAP breakdown,
            with an AI-generated plain-English explanation alongside the chart.
          </p>
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
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => updateStartDate(e.target.value)}
              className="rounded-lg border border-vault-700 bg-vault-850 px-2 py-1.5 text-xs text-slate-200 focus:border-accent-indigo focus:outline-none"
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => updateEndDate(e.target.value)}
              className="rounded-lg border border-vault-700 bg-vault-850 px-2 py-1.5 text-xs text-slate-200 focus:border-accent-indigo focus:outline-none"
            />
            <select
              value={routingFilter}
              onChange={(e) => updateRoutingFilter(e.target.value as RoutingFilter)}
              className="rounded-lg border border-vault-700 bg-vault-850 px-3 py-1.5 text-xs text-slate-200 focus:border-accent-indigo focus:outline-none"
            >
              <option value="all">All</option>
              <option value="approve">Approve</option>
              <option value="otp_verification">Safe Vault (OTP)</option>
              <option value="auto_reject">Auto-Reject</option>
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
                    No transactions found in this date range.
                  </td>
                </tr>
              )}
              {!txLoading &&
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.transaction_id}
                    onClick={() => selectTransaction(tx)}
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
                      <RoutingBadge decision={tx.routing_decision} />
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

      <div ref={explainabilityPanelRef} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BrainCircuit className="h-4 w-4 text-accent-teal" />
            Live SHAP Feature Influence
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
                  Fetching live SHAP explanation…
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

        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Sparkles className="h-4 w-4 text-accent-indigo" />
              AI-Generated Explanation
            </div>
            {selectedTxId && shapData && (
              <button
                onClick={generateNarrative}
                disabled={narrativeLoading}
                className="btn-secondary py-1 px-2 text-xs"
              >
                {narrativeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {narrative ? "Regenerate" : "Generate Explanation"}
              </button>
            )}
          </div>

          {!selectedTxId && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <MousePointerClick className="h-5 w-5" />
              Select a transaction to enable an AI-generated explanation.
            </div>
          )}

          {selectedTxId && !shapData && !shapLoading && (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              Waiting on the SHAP breakdown before an explanation can be generated.
            </div>
          )}

          {selectedTxId && shapData && !narrative && !narrativeLoading && !narrativeError && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <Sparkles className="h-5 w-5" />
              Click "Generate Explanation" for a plain-English summary of the SHAP result above.
            </div>
          )}

          {narrativeLoading && (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Asking the language model…
            </div>
          )}

          {narrativeError && !narrativeLoading && (
            <div className="flex items-start gap-2 rounded-lg border border-risk-moderate/40 bg-risk-moderate/10 px-3 py-2 text-sm text-risk-moderate">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{narrativeError}</span>
            </div>
          )}

          {narrative && !narrativeLoading && (
            <div className="rounded-lg border border-vault-700 bg-vault-850 p-4 text-sm leading-relaxed text-slate-300">
              {narrative}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default XAIExplorer;
