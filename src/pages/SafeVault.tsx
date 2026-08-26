import React, { useState, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import apiClient from "@/api/client";

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
  name_orig: string | null;
  name_dest: string | null;
  type: string | null;
  amount: number | null;
  final_risk_score: number | null;
  timestamp: string | null;
}

export const SafeVault: React.FC = () => {
  // --- Production Persistent State ---
  const [vaultLogs, setVaultLogs] = useState<VaultCase[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Focused case (set by "Look Up ID" — restricts the UI to just this case's
  // details + Vault ID). This is a READ-ONLY view: resolving a frozen case is
  // handled entirely by the account holder's own step-up OTP flow on the
  // customer portal — admins can look up and confirm a case's status here,
  // but cannot manually generate/verify OTPs or override the outcome.
  const [focusedVaultId, setFocusedVaultId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const focusedCase = vaultLogs.find((v) => v.vault_id === focusedVaultId) ?? null;

  const handleLookUp = (vault: VaultCase) => {
    setFocusedVaultId(vault.vault_id);
    setCopied(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToAllCases = () => {
    setFocusedVaultId(null);
    setCopied(false);
  };

  const handleCopyVaultId = () => {
    if (!focusedVaultId) return;
    navigator.clipboard.writeText(focusedVaultId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">Safe Vault Manager</h1>
        <p className="text-sm text-slate-500">
          Look up a frozen transaction by Vault ID and review its details and current status.
          Step-up OTP verification is handled entirely by the account holder on their own
          portal — this view is read-only.
        </p>
      </div>

      {focusedCase ? (
        /* --- Focused Case View: transaction details + Vault ID only --- */
        <div className="panel space-y-4 p-5">
          <button
            onClick={handleBackToAllCases}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-accent-indigo"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all cases
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vault-700/60 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Vault ID</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-lg text-slate-100">{focusedCase.vault_id}</span>
                <button
                  onClick={handleCopyVaultId}
                  className="rounded p-1 text-slate-500 transition hover:bg-vault-800 hover:text-slate-200"
                  title="Copy Vault ID"
                >
                  {copied ? <Check className="h-4 w-4 text-risk-low" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <span className={`badge ${STATUS_STYLES[focusedCase.status] || "bg-slate-800 text-slate-300"}`}>
              {STATUS_DISPLAY[focusedCase.status] || focusedCase.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <DetailField label="From" value={focusedCase.name_orig} mono />
            <DetailField label="To" value={focusedCase.name_dest} mono />
            <DetailField label="Type" value={focusedCase.type} />
            <DetailField
              label="Amount"
              value={focusedCase.amount != null ? `$${focusedCase.amount.toLocaleString()}` : null}
            />
            <DetailField
              label="Risk Score"
              value={focusedCase.final_risk_score != null ? focusedCase.final_risk_score.toFixed(1) : null}
            />
            <DetailField
              label="Submitted"
              value={focusedCase.timestamp ? new Date(focusedCase.timestamp).toLocaleString() : null}
            />
            {focusedCase.reason && <DetailField label="Admin Note" value={focusedCase.reason} />}
          </div>
        </div>
      ) : (
        /* --- Production Database Table --- */
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
                      <td className="px-4 py-2 text-slate-400">{new Date(v.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleLookUp(v)}
                          className="inline-flex items-center gap-1 rounded border border-vault-600 bg-vault-800 px-2 py-1 text-xs font-medium text-slate-300 transition hover:border-accent-indigo hover:bg-accent-indigo/20 hover:text-accent-indigo"
                          title="Look up this case's details and Vault ID"
                        >
                          <Search className="h-3 w-3" />
                          Look Up ID
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: string | null; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-0.5 text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
  </div>
);

export default SafeVault;
