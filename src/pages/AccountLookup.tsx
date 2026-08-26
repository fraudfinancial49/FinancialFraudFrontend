import React, { useState } from "react";
import { Search, ShieldOff, ShieldCheck as ShieldCheckIcon, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getAccountTransactions,
  blockAccount,
  unblockAccount,
  explainTransaction,
} from "@/api/client";
import { RoutingBadge } from "@/components/RiskBadges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { AccountTransactionOut, AccountTransactionsResponse } from "@/types/api";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-risk-low/15 text-risk-low",
  pending_otp: "bg-risk-moderate/15 text-risk-moderate",
  otp_verified: "bg-accent-teal/15 text-accent-teal",
  released: "bg-risk-low/15 text-risk-low",
  cancelled: "bg-risk-high/15 text-risk-high",
  auto_rejected: "bg-risk-critical/15 text-risk-critical",
  flagged_honeypot: "bg-risk-critical/15 text-risk-critical",
  blocked: "bg-risk-critical/15 text-risk-critical",
  pending: "bg-vault-800 text-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending_otp: "Pending OTP",
  otp_verified: "OTP Verified",
  released: "Admin Released",
  cancelled: "Cancelled",
  auto_rejected: "Auto-Rejected",
  flagged_honeypot: "Honeypot",
  blocked: "Blocked",
  pending: "Pending",
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status || "unknown";
  return (
    <span className={`badge inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[key] || "bg-vault-800 text-slate-400"}`}>
      {STATUS_LABELS[key] || (status ? status : "Unknown")}
    </span>
  );
}

interface ShapContribution {
  feature: string;
  impact: number;
}

export const AccountLookup: React.FC = () => {
  const [accountId, setAccountId] = useState("");
  const [data, setData] = useState<AccountTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<AccountTransactionOut | null>(null);
  const [shapData, setShapData] = useState<ShapContribution[] | null>(null);
  const [shapError, setShapError] = useState<string | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [unblockReason, setUnblockReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | "block" | "unblock">(null);

  async function runSearch() {
    if (!accountId.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedTx(null);
    setShapData(null);
    setShapError(null);
    try {
      const res = await getAccountTransactions(accountId.trim());
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Account lookup failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function requestToggleBlock() {
    if (!data) return;
    setActionError(null);
    if (data.is_blocked) {
      if (!unblockReason.trim()) {
        setActionError("A justification is required to unblock this account.");
        return;
      }
      setConfirmAction("unblock");
    } else {
      if (!blockReason.trim()) {
        setActionError("A justification is required to block this account.");
        return;
      }
      setConfirmAction("block");
    }
  }

  async function confirmToggleBlock() {
    if (!data || !confirmAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (confirmAction === "unblock") {
        const res = await unblockAccount(data.account_id, unblockReason.trim());
        setData({ ...data, is_blocked: res.is_blocked });
        setUnblockReason("");
      } else {
        const res = await blockAccount(data.account_id, blockReason.trim());
        setData({ ...data, is_blocked: res.is_blocked });
        setBlockReason("");
      }
      setConfirmAction(null);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail ?? `Failed to ${confirmAction} account.`);
    } finally {
      setActionBusy(false);
    }
  }

  async function openShap(tx: AccountTransactionOut) {
    setSelectedTx(tx);
    setShapData(null);
    setShapError(null);
    setShapLoading(true);
    try {
      const res = await explainTransaction(tx.transaction_id);
      const contributions: Record<string, number> = res?.contributions || {};
      const rows = Object.entries(contributions)
        .map(([feature, impact]) => ({ feature, impact: Number(impact) }))
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 8);
      setShapData(rows);
    } catch {
      setShapError("SHAP explanation unavailable for this transaction.");
    } finally {
      setShapLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-50">Account Lookup</h1>

      <div className="flex gap-2">
        <input
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Account ID (e.g. C1231006815)"
          className="flex-1 rounded-lg border border-vault-700 bg-vault-900 px-3 py-2 text-slate-100"
        />
        <button onClick={runSearch} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {data && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-vault-700 bg-vault-900 p-4">
            <div>
              <p className="text-slate-200 font-medium">{data.account_id}</p>
              <p className="text-sm text-slate-500">{data.total} transaction(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={data.is_blocked ? unblockReason : blockReason}
                onChange={(e) =>
                  data.is_blocked ? setUnblockReason(e.target.value) : setBlockReason(e.target.value)
                }
                placeholder={data.is_blocked ? "Reason for unblocking (required)" : "Reason for blocking (required)"}
                className="rounded-lg border border-vault-700 bg-vault-950 px-2 py-1 text-sm text-slate-100"
              />
              <button
                onClick={requestToggleBlock}
                disabled={actionBusy || (data.is_blocked ? !unblockReason.trim() : !blockReason.trim())}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  data.is_blocked ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
              >
                {actionBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : data.is_blocked ? (
                  <ShieldCheckIcon className="h-4 w-4" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                {data.is_blocked ? "Unblock Account" : "Block Account"}
              </button>
            </div>
          </div>

          {actionError && <p className="text-red-400 text-sm">{actionError}</p>}

          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Timestamp</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Routing</th>
                <th>Status</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <tr
                  key={tx.transaction_id}
                  onClick={() => openShap(tx)}
                  className={`cursor-pointer border-t border-vault-800 hover:bg-vault-900 ${
                    selectedTx?.transaction_id === tx.transaction_id ? "bg-vault-900" : ""
                  }`}
                >
                  <td className="py-2">{new Date(tx.timestamp).toLocaleString()}</td>
                  <td>{tx.type}</td>
                  <td>{tx.amount.toLocaleString()}</td>
                  <td>{tx.routing_decision ? <RoutingBadge decision={tx.routing_decision} /> : "—"}</td>
                  <td><StatusBadge status={tx.status} /></td>
                  <td>{tx.final_risk_score?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedTx && (
            <div className="rounded-lg border border-vault-700 bg-vault-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-slate-200">
                  SHAP Feature Influence — transaction {selectedTx.transaction_id.slice(0, 8)}…
                </p>
                <StatusBadge status={selectedTx.status} />
              </div>
              <div className="h-72">
                {shapLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : shapError ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">{shapError}</div>
                ) : shapData && shapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shapData} layout="vertical" margin={{ left: 30, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" />
                      <XAxis type="number" stroke="#64748b" fontSize={10} />
                      <YAxis type="category" dataKey="feature" stroke="#64748b" fontSize={10} width={110} />
                      <Tooltip contentStyle={{ background: "#0e1424", border: "1px solid #1c2540", fontSize: "12px" }} />
                      <Bar dataKey="impact" fill="#12b3a8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">No SHAP data available.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        variant="danger"
        title={confirmAction === "unblock" ? "Unblock this account?" : "Block this account?"}
        message={
          data
            ? `${confirmAction === "unblock" ? "Unblock" : "Block"} account ${data.account_id}? This action will be logged to the audit trail.`
            : ""
        }
        confirmLabel={confirmAction === "unblock" ? "Unblock Account" : "Block Account"}
        busy={actionBusy}
        onConfirm={confirmToggleBlock}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default AccountLookup;
