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
import apiClient, { explainTransaction } from "@/api/client";
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
  otp_verification: "#f5b942",
  auto_reject: "#c0203a",
  honeypot: "#f2545b",
};

export const Sandbox: React.FC = () => {
  const { transactions, recordAssessment } = useActivity();
  const [form, setForm] = useState<TransactionAssessRequest>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TransactionAssessResponse | null>(null);
  
  // --- XAI State for Professor Demo ---
  const [shapData, setShapData] = useState<any[] | null>(null);
  const [shapLoading, setShapLoading] = useState(false);

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
    const counts: Record<string, number> = { approve: 0, otp_verification: 0, honeypot: 0, auto_reject: 0 };
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
    const isNumeric = ["amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest", "step"].includes(field);
    setForm((prev) => ({ ...prev, [field]: isNumeric ? Number(raw) : raw }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAssessError(null);
    setShapData(null);
    
    try {
      const payload: TransactionAssessRequest = {
        ...form,
        browser_fingerprint: form.browser_fingerprint || undefined,
      };
      
      const response = await apiClient.post<TransactionAssessResponse>("/api/v1/transactions/assess", payload);
      setLastResult(response.data);
      recordAssessment(payload, response.data);

      // Automatically fetch SHAP explanation for the UI
      setShapLoading(true);
      try {
        const shapRes = await explainTransaction(response.data.transaction_id);
        const targetPayload = shapRes?.explanation || shapRes;
        const rawFeatures = targetPayload?.contributions || targetPayload?.features || {};
        const rows = Object.entries(rawFeatures)
          .map(([feature, impact]) => ({ feature, impact: Number(impact) }))
          .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
          .slice(0, 8); // Show top 8 features
        setShapData(rows);
      } catch (err) {
        console.error("SHAP explanation failed", err);
      } finally {
        setShapLoading(false);
      }

    } catch (err: any) {
      setAssessError(err?.response?.data?.detail || "Assessment failed.");
    } finally {
      setSubmitting(false);
    }
  };

// --- Individual Model Scores data ---
// Temporarily disabled along with Separate Model Predictions chart

/*
const individualScoresData = useMemo(() => {
  if (!lastResult?.individual_scores) return [];

  return Object.entries(lastResult.individual_scores).map(
    ([name, score]) => ({
      name: name.replace(/_/g, " "),
      score: score * 100, // Convert probability to 0-100 scale
    })
  );
}, [lastResult]);
*/

  const fusionWeightsData = useMemo(() => {
    if (!lastResult?.fusion_weights) return [];
    return Object.entries(lastResult.fusion_weights).map(([name, weight]) => ({
      name: name.replace(/_/g, " "),
      weight: weight * 100, // Convert to percentage
    }));
  }, [lastResult]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-accent-teal" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">Evaluation Dashboard</h1>
          <p className="text-sm text-slate-500">
            Submit a transaction to instantly view its hybrid routing decision, ensemble weights, individual model predictions, and SHAP feature influence.
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
        {/* Transaction Entry Form */}
        <div className="panel lg:col-span-2">
          <div className="panel-header"><h2 className="text-sm font-semibold text-slate-200">Transaction Input</h2></div>
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            {assessError && (
              <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{assessError}</span>
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
                  {TX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Step</label>
                <input type="number" className="input-field" value={form.step} onChange={handleChange("step")} min={0} required />
              </div>
            </div>
            
            <div>
              <label className="field-label">Amount</label>
              <input type="number" step="0.01" className="input-field" value={form.amount} onChange={handleChange("amount")} min={0.01} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Old Balance Orig</label>
                <input type="number" step="0.01" className="input-field" value={form.oldbalanceOrg} onChange={handleChange("oldbalanceOrg")} min={0} required />
              </div>
              <div>
                <label className="field-label">New Balance Orig</label>
                <input type="number" step="0.01" className="input-field" value={form.newbalanceOrig} onChange={handleChange("newbalanceOrig")} min={0} required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Old Balance Dest</label>
                <input type="number" step="0.01" className="input-field" value={form.oldbalanceDest} onChange={handleChange("oldbalanceDest")} min={0} required />
              </div>
              <div>
                <label className="field-label">New Balance Dest</label>
                <input type="number" step="0.01" className="input-field" value={form.newbalanceDest} onChange={handleChange("newbalanceDest")} min={0} required />
              </div>
            </div>

            <div>
              <label className="field-label">Browser Fingerprint (optional)</label>
              <input className="input-field" value={form.browser_fingerprint} onChange={handleChange("browser_fingerprint")} placeholder="fp_xyz..." />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center mt-4">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Assessing…" : "Run Risk Assessment"}
            </button>

            {lastResult && (
              <div className="mt-4 space-y-2 rounded-lg border border-vault-700 bg-vault-850 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Routing</span><RoutingBadge decision={lastResult.routing_decision} /></div>
                <div className="flex justify-between"><span className="text-slate-400">Risk Score</span><RiskScoreBadge score={lastResult.final_risk_score} /></div>
                <div className="flex justify-between"><span className="text-slate-400">Latency</span><span className="font-mono text-xs text-slate-300">{lastResult.latency_ms.toFixed(1)} ms</span></div>
              </div>
            )}
          </form>
        </div>

        {/* XAI Defense Panels */}
        <div className="space-y-6 lg:col-span-3">
          {lastResult ? (
            <div className="grid grid-cols-1 gap-6">
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* 1. Ensemble Weights */}
                <div className="panel flex flex-col">
                  <div className="panel-header"><h2 className="text-sm font-semibold text-slate-200">1. Ensemble Weights</h2></div>
                  <div className="h-[280px] p-2">
                    <ResponsiveContainer width="100%" height="100%">
<PieChart>
  <Pie
    data={fusionWeightsData}
    dataKey="weight"
    nameKey="name"
    innerRadius={40}
    outerRadius={70}
    paddingAngle={2}
  >
    {fusionWeightsData.map((e, i) => (
      <Cell
        key={i}
        fill={[
          "#5b6df8",
          "#12b3a8",
          "#f5b942",
          "#f2545b",
          "#9b51e0",
          "#ff8a65",
          "#4CAF50",
          "#FF9800",
          "#9E9E9E",
        ][i % 9]}
      />
    ))}
  </Pie>

  <Tooltip
    contentStyle={{
      backgroundColor: "#0e1424",
      border: "1px solid #1c2540",
      color: "#ffffff",
    }}
    labelStyle={{ color: "#ffffff" }}
    itemStyle={{ color: "#ffffff" }}
    formatter={(value: number) => `${value.toFixed(1)}%`}
  />

  <Legend wrapperStyle={{ fontSize: "11px" }} />
</PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

{/* 
  ============================================================
  2. SEPARATE MODEL PREDICTIONS — TEMPORARILY DISABLED
  ============================================================

  <div className="panel flex flex-col">
    <div className="panel-header">
      <h2 className="text-sm font-semibold text-slate-200">
        2. Separate Model Predictions
      </h2>
    </div>

    <div className="h-[280px] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={individualScoresData}
          layout="vertical"
          margin={{ left: 25, right: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
          <XAxis
            type="number"
            domain={[0, 100]}
            stroke="#64748b"
            fontSize={10}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748b"
            fontSize={10}
            width={70}
          />
          <Tooltip
            contentStyle={{
              background: "#0e1424",
              border: "1px solid #1c2540",
              fontSize: "12px",
            }}
            formatter={(value: number) => value.toFixed(1)}
          />
          <Bar
            dataKey="score"
            fill="#5b6df8"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
*/}

              {/* 3. SHAP Feature Influence */}
              <div className="panel flex flex-col">
                <div className="panel-header"><h2 className="text-sm font-semibold text-slate-200">3. SHAP Feature Influence</h2></div>
                <div className="h-[280px] p-2">
                  {shapLoading ? (
                     <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
                  ) : shapData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shapData} layout="vertical" margin={{ left: 30, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
                        <XAxis type="number" stroke="#64748b" fontSize={10} />
                        <YAxis type="category" dataKey="feature" stroke="#64748b" fontSize={10} width={80} />
                        <Tooltip contentStyle={{ background: "#0e1424", border: "1px solid #1c2540", fontSize: "12px" }} />
                        <Bar dataKey="impact" fill="#12b3a8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                     <div className="flex h-full items-center justify-center text-xs text-slate-500">Failed to load SHAP</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-vault-700/50 bg-vault-900/20 text-slate-500">
              Submit a transaction to generate the Explainable AI (XAI) dashboard.
            </div>
          )}
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

export default Sandbox;
