import React, { useState, useEffect } from "react";
import { ListChecks, Loader2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import apiClient, { fetchTransactions } from "@/api/client";
import { useToast } from "@/components/Toast";
import type { ConfirmedOutcome, FeedbackSubmitRequest, RetrainTriggerResponse, TransactionListItem } from "@/types/api";

export const AdminFeedbackQueue: React.FC = () => {
  const { pushToast, updateToast } = useToast();

  // --- Production Persistent State ---
  const [queueLogs, setQueueLogs] = useState<TransactionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, ConfirmedOutcome>>({});
  const [retraining, setRetraining] = useState(false);

  // Fetch real transactions directly from the database
  const loadQueue = async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30); // Grab the last 30 days of data

      const res = await fetchTransactions({
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        page: 1,
        page_size: 50, // Fetch 50 transactions to review
      });
      setQueueLogs(res.items);
    } catch (err) {
      pushToast("error", "Failed to load transactions from the database.");
    } finally {
      setLoading(false);
    }
  };

  // Load immediately on mount
  useEffect(() => {
    loadQueue();
  }, []);

  const submitFeedback = async (transactionId: string, outcome: ConfirmedOutcome) => {
    setSubmittingId(transactionId);
    try {
      const payload: FeedbackSubmitRequest = {
        transaction_id: transactionId,
        confirmed_outcome: outcome,
      };
      await apiClient.post("/api/v1/admin/feedback", payload);
      setSubmitted((prev) => ({ ...prev, [transactionId]: outcome }));
      pushToast("success", `Feedback recorded for ${transactionId.slice(0, 10)}…`);
    } catch (err: any) {
      pushToast(
        "error",
        err?.response?.data?.detail || "Could not submit feedback. Confirm the backend route is deployed."
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRetrain = async () => {
    setRetraining(true);
    const toastId = pushToast("loading", "Evaluating metrics & retraining model pipeline...");
    try {
      const { data } = await apiClient.post<RetrainTriggerResponse>("/api/v1/admin/retrain");
      // FIX: Add safety check and fallback string to satisfy strict TypeScript
      if (toastId) {
        updateToast(toastId, "success", data.message || "Model Pipeline Retrained Successfully!");
      }
    } catch (err: any) {
      if (toastId) {
        updateToast(
          toastId,
          "error",
          err?.response?.data?.detail || "Retrain request failed. Confirm /api/v1/admin/retrain is deployed."
        );
      }
    } finally {
      setRetraining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Admin Feedback Queue</h1>
          <p className="text-sm text-slate-500">
            Confirm analyst-reviewed outcomes, then trigger a full model pipeline retrain once enough
            fresh labels have accumulated.
          </p>
        </div>
        <button onClick={handleRetrain} disabled={retraining} className="btn-primary shrink-0">
          {retraining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Optimize Models &amp; Flush Cache
        </button>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ListChecks className="h-4 w-4 text-accent-indigo" />
            Unreviewed Transactions ({queueLogs.length})
          </h2>
          <button onClick={loadQueue} disabled={loading} className="btn-secondary py-1 px-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh DB
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-vault-900 text-xs uppercase tracking-wide text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2">Transaction ID</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Risk Score</th>
                <th className="px-4 py-2">Routing</th>
                <th className="px-4 py-2">Confirm Outcome</th>
              </tr>
            </thead>
            <tbody>
              {loading && queueLogs.length === 0 ? (
                 <tr>
                 <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                   <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                   Querying database...
                 </td>
               </tr>
              ) : queueLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No recent transactions found in the database.
                  </td>
                </tr>
              ) : (
                queueLogs.map((tx) => (
                  <tr key={tx.transaction_id} className="border-t border-vault-700/60 hover:bg-vault-800/30">
                    <td className="px-4 py-2 font-mono text-xs text-slate-300" title={tx.transaction_id}>
                      {tx.transaction_id.slice(0, 14)}…
                    </td>
                    <td className="px-4 py-2 text-slate-400">{tx.type}</td>
                    <td className="px-4 py-2 text-slate-300">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${tx.final_risk_score > 70 ? 'bg-risk-high/20 text-risk-high' : tx.final_risk_score > 40 ? 'bg-risk-moderate/20 text-risk-moderate' : 'bg-risk-low/20 text-risk-low'}`}>
                        {tx.final_risk_score.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">{tx.routing_decision}</td>
                    <td className="px-4 py-2">
                      {submitted[tx.transaction_id] ? (
                        <span className="badge bg-vault-800 text-slate-400">
                          Confirmed: {submitted[tx.transaction_id]}
                        </span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitFeedback(tx.transaction_id, "fraud")}
                            disabled={submittingId === tx.transaction_id}
                            className="btn-secondary text-xs px-2 py-1 border-risk-high/30 hover:bg-risk-high/10 hover:text-risk-high"
                          >
                            {submittingId === tx.transaction_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Fraud
                          </button>
                          <button
                            onClick={() => submitFeedback(tx.transaction_id, "legitimate")}
                            disabled={submittingId === tx.transaction_id}
                            className="btn-secondary text-xs px-2 py-1 border-risk-low/30 hover:bg-risk-low/10 hover:text-risk-low"
                          >
                            {submittingId === tx.transaction_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Legit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-vault-700 bg-vault-850 px-3 py-2 text-xs text-slate-500">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-teal" />
        <span>
          This panel calls real backend routes (<code className="text-slate-400">POST /api/v1/admin/feedback</code>{" "}
          and <code className="text-slate-400">POST /api/v1/admin/retrain</code>). This creates a complete end-to-end continuous learning loop.
        </span>
      </div>
    </div>
  );
};

export default AdminFeedbackQueue;