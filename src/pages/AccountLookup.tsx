import React, { useState } from "react";
import { Search, ShieldOff, ShieldCheck as ShieldCheckIcon, Loader2 } from "lucide-react";
import {
  getAccountTransactions,
  getAccountStatus,
  blockAccount,
  unblockAccount,
  explainTransaction,
} from "@/api/client";
import type { AccountTransactionOut, AccountTransactionsResponse } from "@/types/api";

export const AccountLookup: React.FC = () => {
  const [accountId, setAccountId] = useState("");
  const [data, setData] = useState<AccountTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<AccountTransactionOut | null>(null);
  const [shap, setShap] = useState<any>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  async function runSearch() {
    if (!accountId.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedTx(null);
    setShap(null);
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

  async function toggleBlock() {
    if (!data) return;
    if (data.is_blocked) {
      const res = await unblockAccount(data.account_id);
      setData({ ...data, is_blocked: res.is_blocked });
    } else {
      const res = await blockAccount(data.account_id, blockReason || undefined);
      setData({ ...data, is_blocked: res.is_blocked });
    }
  }

  async function openShap(tx: AccountTransactionOut) {
    setSelectedTx(tx);
    setShap(null);
    setShapLoading(true);
    try {
      const res = await explainTransaction(tx.transaction_id);
      setShap(res);
    } catch {
      setShap({ error: "SHAP unavailable for this transaction." });
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
              {!data.is_blocked && (
                <input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="rounded-lg border border-vault-700 bg-vault-950 px-2 py-1 text-sm text-slate-100"
                />
              )}
              <button
                onClick={toggleBlock}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  data.is_blocked ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
              >
                {data.is_blocked ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                {data.is_blocked ? "Unblock Account" : "Block Account"}
              </button>
            </div>
          </div>

          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Timestamp</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Routing</th>
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
                  <td>{tx.routing_decision ?? "—"}</td>
                  <td>{tx.final_risk_score?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedTx && (
            <div className="rounded-lg border border-vault-700 bg-vault-900 p-4">
              <p className="mb-2 font-medium text-slate-200">
                SHAP — transaction {selectedTx.transaction_id.slice(0, 8)}…
              </p>
              {shapLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <pre className="max-h-64 overflow-auto text-xs text-slate-400">
                  {JSON.stringify(shap, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AccountLookup;
