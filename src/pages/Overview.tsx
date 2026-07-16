import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  DollarSign,
  Gauge,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  BrainCircuit,
  X,
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
import apiClient, { fetchAnalyticsSummary, fetchAnalyticsTimeseries, fetchTransactions } from "@/api/client";
import { RiskScoreBadge, RoutingBadge } from "@/components/RiskBadges";
import type {
  TransactionAnalyticsSummary,
  TransactionTimeseriesPoint,
  TransactionListItem,
} from "@/types/api";

type PresetKey = "today" | "7d" | "30d" | "90d";

const PRESETS: { key: PresetKey; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(days: number): { start_date: string; end_date: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start_date: isoDate(start), end_date: isoDate(end) };
}

const ROUTING_COLORS: Record<string, string> = {
  approve_count: "#2fd97f",
  vault_count: "#f5b942",
  honeypot_count: "#f2545b",
};

export const Overview: React.FC = () => {
  const [activePreset, setActivePreset] = useState<PresetKey>("7d");
  const [startDate, setStartDate] = useState(() => rangeForPreset(7).start_date);
  const [endDate, setEndDate] = useState(() => rangeForPreset(7).end_date);

  const [summary, setSummary] = useState<TransactionAnalyticsSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TransactionTimeseriesPoint[]>([]);
  const [recent, setRecent] = useState<TransactionListItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Inline SHAP Modal State ---
  const [shapTxId, setShapTxId] = useState<string | null>(null);
  const [shapData, setShapData] = useState<any[] | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [shapError, setShapError] = useState<string | null>(null);

  const applyPreset = (preset: PresetKey, days: number) => {
    setActivePreset(preset);
    const { start_date, end_date } = rangeForPreset(days);
    setStartDate(start_date);
    setEndDate(end_date);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = { start_date: startDate, end_date: endDate };
      const [summaryRes, timeseriesRes, recentRes] = await Promise.all([
        fetchAnalyticsSummary(range),
        fetchAnalyticsTimeseries({ ...range, interval: "day" }),
        fetchTransactions({ ...range, page: 1, page_size: 15 }),
      ]);
      setSummary(summaryRes);
      setTimeseries(timeseriesRes);
      setRecent(recentRes.items);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Could not load live analytics. Confirm the backend's analytics/transactions endpoints are deployed.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
      setSummary(null);
      setTimeseries([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // --- Fetch Inline SHAP Data ---
  const fetchExplanation = async (txId: string) => {
    setShapTxId(txId);
    setShapLoading(true);
    setShapError(null);
    setShapData(null);
    try {
      // Use the bulletproof parser we built for the Model page
      const { data } = await apiClient.post<any>(`/api/v1/transactions/${txId}/explain`);
      
      const targetPayload = data?.explanation || data;
      const rawFeatures = targetPayload?.contributions || targetPayload?.features || {};
      const baseValue = typeof targetPayload?.base_value === "number" ? targetPayload.base_value : 0;

      const rows = [
        { feature: "base_value", impact: baseValue },
        ...Object.entries(rawFeatures).map(([feature, impact]) => ({
          feature,
          impact: Number(impact),
        })),
      ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
      
      setShapData(rows);
    } catch (err: any) {
      setShapError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Could not load SHAP explanation for this transaction."
      );
    } finally {
      setShapLoading(false);
    }
  };

  const fraudRatePct = useMemo(
    () => (summary ? (summary.fraud_rate * 100).toFixed(2) : "—"),
    [summary]
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Live Fraud Monitoring</h1>
          <p className="text-sm text-slate-500">
            Bank-wide transactions, scored and routed automatically. Date-range analytics below.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="btn-secondary"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 panel p-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key, p.days)}
            className={`badge cursor-pointer ${
              activePreset === p.key
                ? "bg-accent-indigo/20 text-accent-indigo"
                : "bg-vault-800 text-slate-400"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <label className="flex items-center gap-1">
            From
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => {
                setActivePreset("30d");
                setStartDate(e.target.value);
              }}
              className="input-field"
            />
          </label>
          <label className="flex items-center gap-1">
            To
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={isoDate(new Date())}
              onChange={(e) => {
                setActivePreset("30d");
                setEndDate(e.target.value);
              }}
              className="input-field"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 p-4 text-sm text-risk-high">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Live analytics unavailable</p>
            <p className="text-risk-high/80">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Total Transactions</span>
            <Activity className="h-4 w-4 text-accent-indigo" />
          </div>
          <span className="text-2xl font-bold text-slate-50">
            {summary ? summary.total_transactions.toLocaleString() : "—"}
          </span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Flagged (Vault + Honeypot)</span>
            <ShieldAlert className="h-4 w-4 text-risk-high" />
          </div>
          <span className="text-2xl font-bold text-slate-50">
            {summary ? summary.flagged_count.toLocaleString() : "—"}
          </span>
          <span className="text-xs text-slate-500">{fraudRatePct}% of total</span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Total Volume</span>
            <DollarSign className="h-4 w-4 text-accent-teal" />
          </div>
          <span className="text-2xl font-bold text-slate-50">
            {summary ? summary.total_volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
          </span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Avg Risk Score</span>
            <Gauge className="h-4 w-4 text-accent-indigo" />
          </div>
          <span className="text-2xl font-bold text-slate-50">
            {summary ? summary.avg_risk_score.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Transactions by Day</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
              <XAxis dataKey="date" stroke="#8892b0" fontSize={12} />
              <YAxis stroke="#8892b0" fontSize={12} />
              <Tooltip
                contentStyle={{ background: "#151a2e", border: "1px solid #2a2f45" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend />
              <Bar dataKey="approve_count" stackId="a" name="Approved" fill={ROUTING_COLORS.approve_count} />
              <Bar dataKey="vault_count" stackId="a" name="Safe Vault" fill={ROUTING_COLORS.vault_count} />
              <Bar dataKey="honeypot_count" stackId="a" name="Honeypot" fill={ROUTING_COLORS.honeypot_count} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-vault-700/60 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2 pr-4">Routing</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    No transactions in this date range.
                  </td>
                </tr>
              )}
              {recent.map((tx) => (
                <tr key={tx.transaction_id} className="border-b border-vault-800/60 hover:bg-vault-800/30">
                  <td className="py-2 pr-4 text-slate-400">
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-slate-300">{tx.name_orig}</td>
                  <td className="py-2 pr-4 text-slate-300">{tx.name_dest}</td>
                  <td className="py-2 pr-4 text-slate-400">{tx.type}</td>
                  <td className="py-2 pr-4 text-slate-300">
                    {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-4">
                    <RiskScoreBadge score={tx.final_risk_score} />
                  </td>
                  <td className="py-2 pr-4">
                    <RoutingBadge decision={tx.routing_decision} />
                  </td>
                  <td className="py-2 pr-4">
                    <span className="badge bg-vault-800 text-slate-400">
                      {tx.source === "manual_sandbox" ? "Sandbox" : "Auto"}
                    </span>
                  </td>
                  <td className="py-2 pl-4 text-right whitespace-nowrap">
                    {/* NEW Analyze Button */}
                    <button
                      onClick={() => fetchExplanation(tx.transaction_id)}
                      className="inline-flex items-center gap-1 rounded border border-accent-indigo/50 bg-accent-indigo/10 px-2 py-1 text-xs font-medium text-accent-indigo transition hover:bg-accent-indigo/20 mr-2"
                      title="Analyze AI Decision"
                    >
                      <BrainCircuit className="h-3 w-3" />
                      Analyze
                    </button>

                    {tx.routing_decision === "approve" && (
                      <button
                        onClick={() => window.location.href = `/safe-vault?escalate_tx=${tx.transaction_id}`}
                        className="inline-flex items-center gap-1 rounded border border-risk-high/50 bg-risk-high/10 px-2 py-1 text-xs font-medium text-risk-high transition hover:bg-risk-high/20"
                        title="Manually Escalate to Vault"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Escalate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- INLINE SHAP MODAL --- */}
      {shapTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-xl border border-vault-700 bg-[#0e1424] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-vault-700/60 bg-vault-850 px-5 py-4">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-accent-teal" />
                AI Explainability Breakdown
                <span className="font-mono text-xs text-slate-500 font-normal ml-2 bg-vault-900 px-2 py-1 rounded">
                  {shapTxId}
                </span>
              </h3>
              <button onClick={() => setShapTxId(null)} className="text-slate-400 hover:text-slate-200 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="p-6 h-[400px]">
              {shapLoading && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-teal" />
                  Generating live SHAP contributions...
                </div>
              )}

              {!shapLoading && shapError && (
                <div className="flex h-full items-center justify-center">
                  <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-4 py-3 text-sm text-risk-high max-w-lg">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{shapError}</span>
                  </div>
                </div>
              )}

              {!shapLoading && !shapError && shapData && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapData} layout="vertical" margin={{ left: 50, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis type="category" dataKey="feature" stroke="#64748b" fontSize={11} width={200} />
                    <Tooltip contentStyle={{ background: "#0e1424", border: "1px solid #1c2540" }} />
                    <Bar dataKey="impact" radius={[0, 3, 3, 0]} fill="#12b3a8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end border-t border-vault-700/60 bg-vault-850 px-5 py-4 gap-3">
              <button onClick={() => setShapTxId(null)} className="btn-secondary px-4">
                Close
              </button>
              {/* Allow them to instantly escalate from right inside the popup! */}
              <button
                onClick={() => window.location.href = `/safe-vault?escalate_tx=${shapTxId}`}
                className="btn-danger px-4"
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Escalate to Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
