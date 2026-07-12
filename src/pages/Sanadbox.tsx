import React, { useMemo, useState } from "react";
import { Gauge, Timer, Send, Loader2, AlertCircle, FlaskConical } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import apiClient from "@/api/client";
import { useActivity } from "@/store/ActivityContext";
import { RiskScoreBadge, RoutingBadge } from "@/components/RiskBadges";
import type {
  TransactionAssessRequest,
  TransactionAssessResponse,
  TransactionType,
} from "@/types/api";
 
// ---------------------------------------------------------------------------
// Manual testing / demo tool. Nothing submitted here reflects real bank
// traffic — it exists so an analyst or developer can hand-build a single
// transaction and see exactly how the pipeline scores and routes it. Results
// shown on this page are session-local only (see ActivityContext) and are
// intentionally separate from the bank-wide Overview dashboard.
// ---------------------------------------------------------------------------
 
const TX_TYPES: TransactionType[] = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"];
 
const DEFAULT_FORM: TransactionAssessRequest = {
  nameOrig: "C1231006815",
  nameDest: "M1979787155",
  type: "TRANSFER",
  amount: 181.0,
  oldbalanceOrg: 181.0,
  newbalanceOrig: 0.0,
  oldbalanceDest: 0.0,
  newbalanceDest: 0.0,
  step: 1,
  simulated_ip: "203.0.113.42",
  user_agent: "Mozilla/5.0",
  browser_fingerprint: "",
};
 
const ROUTING_COLORS: Record<string, string> = {
  approve: "#2fd97f",
  vault: "#f5b942",
  honeypot: "#f2545b",
};
 
export const Sandbox: React.FC = () => {
  const { transactions, recordAssessment } = useActivity();
  const [form, setForm] = useState<TransactionAssessRequest>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TransactionAssessResponse | null>(null);
 
  const kpis = useMemo(() => {
    const total = transactions.length;
    const totalVolume = transactions.reduce((sum, t) => sum + t.request.amount, 0);
    const avgLatency =
      total > 0 ? transactions.reduce((sum, t) => sum + t.latency_ms, 0) / total : 0;
    const avgRisk =
      total > 0 ? transactions.reduce((sum, t) => sum + t.final_risk_score, 0) / total : 0;
    return { total, totalVolume, avgLatency, avgRisk };
  }, [transactions]);
 
  const routingBreakdown = useMemo(() => {
    const counts: Record<string, number> = { approve: 0, vault: 0, honeypot: 0 };
    transactions.forEach((t) => {
      counts[t.routing_decision] = (counts[t.routing_decision] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [transactions]);
 
  const riskTimeline = useMemo(
    () =>
      transactions
        .slice(0, 12)
        .reverse()
        .map((t, idx) => ({
          index: idx + 1,
          risk: Number(t.final_risk_score.toFixed(2)),
        })),
    [transactions]
  );
 
  const handleChange = (
    field: keyof TransactionAssessRequest
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value;
    const isNumeric = ["amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest", "step"].includes(
      field
    );
    setForm((prev) => ({
      ...prev,
      [field]: isNumeric ? Number(raw) : raw,
    }));
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAssessError(null);
    try {
      const payload: TransactionAssessRequest = {
        ...form,
        browser_fingerprint: form.browser_fingerprint || undefined,
      };
      const response = await apiClient.post<TransactionAssessResponse>(
        "/api/v1/transactions/assess",
        payload
      );
      setLastResult(response.data);
      recordAssessment(payload, response.data);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Assessment request failed. Confirm the backend is running and the model registry is loaded.";
      setAssessError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };
 
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-accent-teal" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">Sandbox — Manual Transaction Test</h1>
          <p className="text-sm text-slate-500">
            Hand-build a transaction and see how the pipeline scores it. Session-local only —
            this does not represent real bank traffic. See the Overview page for live monitoring.
          </p>
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Session Assessments</span>
          <span className="text-2xl font-bold text-slate-50">{kpis.total}</span>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Session Volume</span>
          <span className="text-2xl font-bold text-slate-50">
            ${kpis.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Avg Final Risk</span>
            <Gauge className="h-4 w-4 text-risk-moderate" />
          </div>
          <span className="text-2xl font-bold text-slate-50">{kpis.avgRisk.toFixed(1)}</span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Avg Latency</span>
            <Timer className="h-4 w-4 text-accent-indigo" />
          </div>
          <span className="text-2xl font-bold text-slate-50">{kpis.avgLatency.toFixed(0)} ms</span>
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-slate-200">Assess a Transaction</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            {assessError && (
              <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{assessError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Name Orig</label>
                <input className="input-field" value={form.nameOrig} onChange={handleChange("nameOrig")} required />
              </div>
              <div>
                <label className="field-label">Name Dest</label>
                <input className="input-field" value={form.nameDest} onChange={handleChange("nameDest")} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Type</label>
                <select className="input-field" value={form.type} onChange={handleChange("type")}>
                  {TX_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Step</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.step}
                  onChange={handleChange("step")}
                  min={0}
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">Amount</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={form.amount}
                onChange={handleChange("amount")}
                min={0.01}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Old Balance Orig</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.oldbalanceOrg}
                  onChange={handleChange("oldbalanceOrg")}
                  min={0}
                  required
                />
              </div>
              <div>
                <label className="field-label">New Balance Orig</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.newbalanceOrig}
                  onChange={handleChange("newbalanceOrig")}
                  min={0}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Old Balance Dest</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.oldbalanceDest}
                  onChange={handleChange("oldbalanceDest")}
                  min={0}
                  required
                />
              </div>
              <div>
                <label className="field-label">New Balance Dest</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.newbalanceDest}
                  onChange={handleChange("newbalanceDest")}
                  min={0}
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">Browser Fingerprint (optional)</label>
              <input
                className="input-field"
                value={form.browser_fingerprint}
                onChange={handleChange("browser_fingerprint")}
                placeholder="fp_9f3a2c…"
              />
            </div>
 
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Assessing…" : "Run Risk Assessment"}
            </button>
 
            {lastResult && (
              <div className="mt-2 space-y-2 rounded-lg border border-vault-700 bg-vault-850 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Routing</span>
                  <RoutingBadge decision={lastResult.routing_decision} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Risk score</span>
                  <RiskScoreBadge score={lastResult.final_risk_score} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Latency</span>
                  <span className="font-mono text-xs text-slate-300">
                    {lastResult.latency_ms.toFixed(1)} ms
                  </span>
                </div>
                <p className="text-xs text-slate-500">{lastResult.message}</p>
                {lastResult.vault_id && (
                  <p className="font-mono text-[11px] text-risk-moderate">
                    vault_id: {lastResult.vault_id}
                  </p>
                )}
                {lastResult.honeypot_session_id && (
                  <p className="font-mono text-[11px] text-risk-high">
                    honeypot_session_id: {lastResult.honeypot_session_id}
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
 
        <div className="space-y-6 lg:col-span-3">
          <div className="panel">
            <div className="panel-header">
              <h2 className="text-sm font-semibold text-slate-200">Routing Decisions (session)</h2>
            </div>
            <div className="h-64 p-4">
              {routingBreakdown.some((r) => r.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={routingBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {routingBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={ROUTING_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      contentStyle={{ background: "#0e1424", border: "1px solid #1c2540" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState label="Run an assessment to populate routing analytics." />
              )}
            </div>
          </div>
 
          <div className="panel">
            <div className="panel-header">
              <h2 className="text-sm font-semibold text-slate-200">Recent Risk Scores</h2>
            </div>
            <div className="h-64 p-4">
              {riskTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
                    <XAxis dataKey="index" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "#0e1424", border: "1px solid #1c2540" }} />
                    <Bar dataKey="risk" fill="#5b6df8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState label="No assessments yet this session." />
              )}
            </div>
          </div>
        </div>
      </div>
 
      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-slate-200">Sandbox Transaction Log (session)</h2>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Tx ID</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Risk</th>
                <th className="px-4 py-2">Routing</th>
                <th className="px-4 py-2">Latency</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No transactions assessed yet this session.
                  </td>
                </tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-vault-700/60">
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">
                    {t.transaction_id.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-2 text-slate-300">{t.request.type}</td>
                  <td className="px-4 py-2 text-slate-300">${t.request.amount.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <RiskScoreBadge score={t.final_risk_score} />
                  </td>
                  <td className="px-4 py-2">
                    <RoutingBadge decision={t.routing_decision} />
                  </td>
                  <td className="px-4 py-2 text-slate-400">{t.latency_ms.toFixed(1)} ms</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
 
const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
    {label}
  </div>
);
 
export default Sandbox;
