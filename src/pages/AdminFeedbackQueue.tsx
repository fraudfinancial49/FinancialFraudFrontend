import React, { useState } from "react";
import { ListChecks, Loader2, Sparkles, AlertCircle } from "lucide-react";
import apiClient from "@/api/client";
import { useActivity } from "@/store/ActivityContext";
import { useToast } from "@/components/Toast";
import type { ConfirmedOutcome, FeedbackSubmitRequest, RetrainTriggerResponse } from "@/types/api";

// Admin-only Feedback Queue / Review panel. Lets an analyst confirm the real
// outcome of a session-assessed transaction (feeding the label-collection
// loop) and lets an admin trigger a full backend retrain + cache flush.
export const AdminFeedbackQueue: React.FC = () => {
  const { transactions } = useActivity();
  const { pushToast, updateToast } = useToast();

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, ConfirmedOutcome>>({});
  const [retraining, setRetraining] = useState(false);

  const submitFeedback = async (transactionId: string, outcome: ConfirmedOutcome) => {
    setSubmittingId(transactionId);
    try {
      const payload: FeedbackSubmitRequest = {
        transaction_id: transactionId,
        confirmed_outcome: outcome,
      };
      await apiClient.post("/api/v1/feedback", payload);
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
    const toastId = pushToast("loading", "Retraining model pipeline & flushing cached scores…");
    try {
      await apiClient.post<RetrainTriggerResponse>("/api/v1/admin/retrain");
      updateToast(toastId, "success", "Model Pipeline Retrained & Cached Scores Flushed Successfully!");
    } catch (err: any) {
      updateToast(
        toastId,
        "error",
        err?.response?.data?.detail || "Retrain request failed. Confirm /api/v1/admin/retrain is deployed."
      );
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
        <div className="panel-header">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ListChecks className="h-4 w-4 text-accent-indigo" />
            Reviewed Transactions ({transactions.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Transaction</th>
                <th className="px-4 py-2">Risk Score</th>
                <th className="px-4 py-2">Routing</th>
                <th className="px-4 py-2">Confirm Outcome</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No assessed transactions yet this session — run some assessments on the Overview
                    page first.
                  </td>
                </tr>
              )}
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-vault-700/60">
                  <td className="px-4 py-2 font-mono text-xs text-slate-300">{tx.transaction_id}</td>
                  <td className="px-4 py-2 text-slate-300">{tx.final_risk_score.toFixed(1)}</td>
                  <td className="px-4 py-2 text-slate-300">{tx.routing_decision}</td>
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
                          className="btn-secondary"
                        >
                          {submittingId === tx.transaction_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Fraud
                        </button>
                        <button
                          onClick={() => submitFeedback(tx.transaction_id, "legitimate")}
                          disabled={submittingId === tx.transaction_id}
                          className="btn-secondary"
                        >
                          {submittingId === tx.transaction_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Legitimate
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-vault-700 bg-vault-850 px-3 py-2 text-xs text-slate-500">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-teal" />
        <span>
          This panel calls real backend routes (<code className="text-slate-400">POST /api/v1/feedback</code>{" "}
          and <code className="text-slate-400">POST /api/v1/admin/retrain</code>). If your Phase 4 service
          does not yet expose them, these actions will surface the backend's actual error response via the
          toast rather than pretending to succeed.
        </span>
      </div>
    </div>
  );
};

export default AdminFeedbackQueue;
