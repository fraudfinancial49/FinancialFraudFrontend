import React, { useState, useEffect } from "react";
import { Lock, KeyRound, CheckCircle2, XCircle, PlusCircle, Loader2, AlertCircle, RefreshCw, ArrowUpRight, Send } from "lucide-react";
import apiClient from "@/api/client";
import { useActivity } from "@/store/ActivityContext";
import type {
  GenericStatus,
  VaultAdminReviewRequest,
  VaultDecision,
  VaultMoveRequest,
  VaultOTPVerifyRequest,
} from "@/types/api";

const STATUS_STYLES: Record<string, string> = {
  frozen: "bg-risk-moderate/15 text-risk-moderate border border-risk-moderate/20",
  otp_verified: "bg-accent-teal/15 text-accent-teal border border-accent-teal/20",
  released: "bg-risk-low/15 text-risk-low border border-risk-low/20",
  rejected: "bg-risk-high/15 text-risk-high border border-risk-high/20",
};

// Map backend statuses to beautiful frontend display labels
const STATUS_DISPLAY: Record<string, string> = {
  frozen: "Frozen",
  otp_verified: "OTP Verified & Released",
  released: "Admin Released",
  rejected: "Admin Rejected",
};

interface VaultCase {
  vault_id: string;
  transaction_id: string;
  status: string;
  reason: string | null;
  created_at: string;
}

export const SafeVault: React.FC = () => {
  const { recordVaultMove, recordVaultOtpVerified, recordVaultReview } = useActivity();

  // --- Production Persistent State ---
  const [vaultLogs, setVaultLogs] = useState<VaultCase[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  // OTP panel
  const [otpVaultId, setOtpVaultId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpActionType, setOtpActionType] = useState<"generating" | "verifying" | null>(null);
  const [otpMessage, setOtpMessage] = useState<GenericStatus | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Admin review panel
  const [reviewVaultId, setReviewVaultId] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState<VaultDecision | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Manual escalation panel
  const [escalateTxId, setEscalateTxId] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateBusy, setEscalateBusy] = useState(false);
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [escalateResult, setEscalateResult] = useState<GenericStatus | null>(null);

  // --- NEW: URL Parameter "Sticky Note" Listener ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txToEscalate = params.get("escalate_tx");
    
    if (txToEscalate) {
      // 1. Drop the ID into the escalation box
      setEscalateTxId(txToEscalate);
      
      // 2. Silently scrub the URL clean so it doesn't stay there forever
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // 3. Optional: Smoothly scroll down so the admin sees the form is filled out
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, []);

  // --- Real-time DB Fetching ---
  const fetchVaultLogs = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const { data } = await apiClient.get<VaultCase[]>("/api/v1/vault/cases");
      setVaultLogs(data);
    } catch (err: any) {
      setLogsError("Failed to load historical vault logs from the database.");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultLogs();
  }, []);

  // --- UX Helper: Auto-fill forms from table ---
  const handleLoadVault = (vaultId: string) => {
    setOtpVaultId(vaultId);
    setReviewVaultId(vaultId);
    setOtpCode(""); // Reset OTP field for a fresh attempt
    setOtpMessage(null);
    setOtpError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- 2-Step OTP Workflow ---
  const generateOtp = async () => {
    if (!otpVaultId) {
      setOtpError("Please enter a Vault ID first.");
      return;
    }
    setOtpBusy(true);
    setOtpActionType("generating");
    setOtpError(null);
    setOtpMessage(null);
    try {
      const payload: VaultOTPVerifyRequest = { vault_id: otpVaultId, otp_code: "" };
      const { data } = await apiClient.post<GenericStatus>("/api/v1/vault/otp", payload);
      setOtpMessage(data);
    } catch (err: any) {
      setOtpError(err?.response?.data?.detail || "Failed to generate OTP.");
    } finally {
      setOtpBusy(false);
      setOtpActionType(null);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setOtpError("Please enter the 6-digit OTP code.");
      return;
    }
    setOtpBusy(true);
    setOtpActionType("verifying");
    setOtpError(null);
    setOtpMessage(null);
    try {
      const payload: VaultOTPVerifyRequest = { vault_id: otpVaultId, otp_code: otpCode };
      const { data } = await apiClient.post<GenericStatus>("/api/v1/vault/otp", payload);
      setOtpMessage(data);
      if (data.status === "otp_verified") {
        recordVaultOtpVerified(otpVaultId);
        setOtpCode(""); // Clear the input on success
        await fetchVaultLogs(); 
      }
    } catch (err: any) {
      setOtpError(err?.response?.data?.detail || "OTP verification failed.");
    } finally {
      setOtpBusy(false);
      setOtpActionType(null);
    }
  };

  const submitReview = async (decision: VaultDecision) => {
    setReviewBusy(decision);
    setReviewError(null);
    try {
      const payload: VaultAdminReviewRequest = {
        vault_id: reviewVaultId,
        decision,
        reason: reviewReason || undefined,
      };
      await apiClient.post<GenericStatus>("/api/v1/vault/review", payload);
      recordVaultReview(reviewVaultId, decision);
      setReviewReason("");
      await fetchVaultLogs(); 
    } catch (err: any) {
      setReviewError(err?.response?.data?.detail || "Admin review failed.");
    } finally {
      setReviewBusy(null);
    }
  };

  const submitEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    setEscalateBusy(true);
    setEscalateError(null);
    setEscalateResult(null);
    try {
      const payload: VaultMoveRequest = { transaction_id: escalateTxId, reason: escalateReason };
      const { data } = await apiClient.post<GenericStatus>("/api/v1/vault/move-to-vault", payload);
      setEscalateResult(data);
      const vaultId = (data.data?.vault_id as string) ?? "";
      if (vaultId) {
        recordVaultMove(vaultId, escalateTxId, escalateReason);
        await fetchVaultLogs(); 
      }
      setEscalateTxId("");
      setEscalateReason("");
    } catch (err: any) {
      setEscalateError(err?.response?.data?.detail || "Manual escalation failed.");
    } finally {
      setEscalateBusy(false);
    }
  };

  // --- Dynamic Panel Locking Logic ---
  const activeReviewCase = vaultLogs.find(v => v.vault_id === reviewVaultId);
  const isOtpResolved = activeReviewCase?.status === "otp_verified";
  const isAdminResolved = activeReviewCase?.status === "released" || activeReviewCase?.status === "rejected";
  const isPanelLocked = isOtpResolved || isAdminResolved;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">Safe Vault Manager</h1>
        <p className="text-sm text-slate-500">
          Review frozen transactions, verify step-up OTP codes, and apply administrative
          overrides with a documented justification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Step-Up OTP Panel */}
        <form onSubmit={verifyOtp} className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-accent-teal" />
            2-Step OTP Verification
          </div>
          {otpError && <InlineError message={otpError} />}
          
          <div>
            <label className="field-label">Vault ID</label>
            <input
              className="input-field"
              value={otpVaultId}
              onChange={(e) => setOtpVaultId(e.target.value)}
              placeholder="vault_…"
              required
            />
          </div>

          {/* Generate OTP Button */}
          <button 
            type="button" 
            onClick={generateOtp} 
            disabled={otpBusy || !otpVaultId} 
            className="btn-secondary w-full justify-center"
          >
            {otpBusy && otpActionType === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {otpBusy && otpActionType === "generating" ? "Generating..." : "Step 1: Generate OTP"}
          </button>

          <div className="pt-2">
            <label className="field-label">6-digit OTP code</label>
            <input
              className="input-field font-mono tracking-widest"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
            />
          </div>

          <button type="submit" disabled={otpBusy || !otpCode} className="btn-primary w-full justify-center">
            {otpBusy && otpActionType === "verifying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {otpBusy && otpActionType === "verifying" ? "Verifying…" : "Step 2: Verify OTP"}
          </button>
          
          {otpMessage && (
            <div className="rounded-lg border border-vault-700 bg-vault-850 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">{otpMessage.status}</p>
              <p className="text-slate-500">{otpMessage.message}</p>
              {otpMessage.data?.otp_code ? (
                <p className="mt-1 font-mono text-accent-teal">
                  Issued code (dev/demo only): {String(otpMessage.data.otp_code)}
                </p>
              ) : null}
            </div>
          )}
        </form>

        {/* Review Panel */}
        <div className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Lock className="h-4 w-4 text-risk-moderate" />
            Admin Override
          </div>
          {reviewError && <InlineError message={reviewError} />}
          <div>
            <label className="field-label">Vault ID</label>
            <input
              className="input-field"
              value={reviewVaultId}
              onChange={(e) => setReviewVaultId(e.target.value)}
              placeholder="vault_…"
              required
            />
          </div>

          {/* Dynamic Locking UI */}
          {isOtpResolved ? (
            <div className="rounded-lg border border-accent-teal/30 bg-accent-teal/10 p-4 text-sm text-accent-teal">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                OTP Verified & Released
              </div>
              <p className="mt-1 text-xs text-accent-teal/80">
                This transaction has already been securely released by the account holder. Admin override is no longer required.
              </p>
            </div>
          ) : isAdminResolved ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-400">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Already Reviewed
              </div>
              <p className="mt-1 text-xs">
                This transaction has already been processed by an administrator.
              </p>
            </div>
          ) : (
            <div>
              <label className="field-label">Justification note</label>
              <textarea
                className="input-field min-h-[84px] resize-none"
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="Explain the basis for release or rejection…"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reviewVaultId || reviewBusy !== null || isPanelLocked}
              onClick={() => submitReview("approve")}
              className="btn-success flex-1 justify-center"
            >
              {reviewBusy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Release
            </button>
            <button
              type="button"
              disabled={!reviewVaultId || reviewBusy !== null || isPanelLocked}
              onClick={() => submitReview("reject")}
              className="btn-danger flex-1 justify-center"
            >
              {reviewBusy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject
            </button>
          </div>
        </div>

        {/* Escalation Panel */}
        <form onSubmit={submitEscalation} className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <PlusCircle className="h-4 w-4 text-accent-indigo" />
            Manual Escalation
          </div>
          {escalateError && <InlineError message={escalateError} />}
          <div>
            <label className="field-label">Transaction ID</label>
            <input
              className="input-field"
              value={escalateTxId}
              onChange={(e) => setEscalateTxId(e.target.value)}
              placeholder="tx_…"
              required
            />
          </div>
          <div>
            <label className="field-label">Reason</label>
            <textarea
              className="input-field min-h-[84px] resize-none"
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="Why is this transaction being escalated to the vault?"
              required
            />
          </div>
          <button type="submit" disabled={escalateBusy} className="btn-secondary w-full justify-center">
            {escalateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {escalateBusy ? "Escalating…" : "Move to Vault"}
          </button>
          {escalateResult && (
            <div className="rounded-lg border border-vault-700 bg-vault-850 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">{escalateResult.status}</p>
              <p className="text-slate-500">{escalateResult.message}</p>
            </div>
          )}
        </form>
      </div>

      {/* Production Database Table */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Vault Case Log (Persistent Database)</h2>
          <button onClick={fetchVaultLogs} disabled={logsLoading} className="btn-secondary py-1 px-2 text-xs">
            {logsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
        
        {logsError && (
          <div className="p-4 border-b border-risk-high/40 bg-risk-high/10 text-xs text-risk-high flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {logsError}
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500 shadow-sm z-10">
              <tr>
                <th className="px-4 py-2">Vault ID</th>
                <th className="px-4 py-2">Transaction ID</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading && vaultLogs.length === 0 ? (
                 <tr>
                 <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                   <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                   Querying database...
                 </td>
               </tr>
              ) : vaultLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No Safe Vault cases exist in the database yet.
                  </td>
                </tr>
              ) : (
                vaultLogs.map((v) => (
                  <tr key={v.vault_id} className="border-t border-vault-700/60 hover:bg-vault-800/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-slate-300" title={v.vault_id}>
                      {v.vault_id.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-300" title={v.transaction_id}>
                      {v.transaction_id.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2">
                      <span className={`badge ${STATUS_STYLES[v.status] || "bg-slate-800 text-slate-300"}`}>
                        {STATUS_DISPLAY[v.status] || v.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">{v.reason ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {v.status === "frozen" && (
                        <button
                          onClick={() => handleLoadVault(v.vault_id)}
                          className="inline-flex items-center gap-1 rounded border border-vault-600 bg-vault-800 px-2 py-1 text-xs font-medium text-slate-300 transition hover:border-accent-indigo hover:bg-accent-indigo/20 hover:text-accent-indigo"
                          title="Load ID into forms"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const InlineError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>{message}</span>
  </div>
);

export default SafeVault;
