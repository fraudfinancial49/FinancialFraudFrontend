import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  AssessedTransactionRecord,
  ProfilingRunRecord,
  TransactionAssessRequest,
  TransactionAssessResponse,
  AttackerProfilingResult,
  VaultCaseRecord,
  VaultDecision,
} from "@/types/api";
 
// ---------------------------------------------------------------------------
// SCOPE CHANGE: this store is no longer the admin dashboard's source of
// truth. Real system-wide transactions arrive automatically (bank-side
// ingestion, outside analyst control) and are read from the backend's
// analytics/history endpoints directly in Overview.tsx — not from here.
//
// This context now backs ONLY the Sandbox page (src/pages/Sandbox.tsx),
// giving an analyst an immediate, session-local echo of transactions THEY
// personally submitted for manual testing/demo purposes. It intentionally
// resets on page reload — it was never meant to persist, and should not be
// read anywhere that needs to reflect real bank-wide activity.
// ---------------------------------------------------------------------------
 
interface ActivityContextValue {
  transactions: AssessedTransactionRecord[];
  vaultCases: VaultCaseRecord[];
  profilingRuns: ProfilingRunRecord[];
  recordAssessment: (
    request: TransactionAssessRequest,
    response: TransactionAssessResponse
  ) => void;
  recordVaultMove: (vaultId: string, transactionId: string, reason: string) => void;
  recordVaultOtpVerified: (vaultId: string) => void;
  recordVaultReview: (vaultId: string, decision: VaultDecision) => void;
  recordProfilingRun: (result: AttackerProfilingResult) => void;
}
 
const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);
 
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
 
export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<AssessedTransactionRecord[]>([]);
  const [vaultCases, setVaultCases] = useState<VaultCaseRecord[]>([]);
  const [profilingRuns, setProfilingRuns] = useState<ProfilingRunRecord[]>([]);
 
  const recordAssessment = useCallback(
    (request: TransactionAssessRequest, response: TransactionAssessResponse) => {
      const record: AssessedTransactionRecord = {
        ...response,
        id: genId("tx"),
        timestamp: new Date().toISOString(),
        request,
      };
      setTransactions((prev) => [record, ...prev].slice(0, 500));
 
      if (response.routing_decision === "vault" && response.vault_id) {
        setVaultCases((prev) => [
          {
            vault_id: response.vault_id as string,
            transaction_id: response.transaction_id,
            status: "frozen",
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    },
    []
  );
 
  const recordVaultMove = useCallback((vaultId: string, transactionId: string, reason: string) => {
    setVaultCases((prev) => [
      {
        vault_id: vaultId,
        transaction_id: transactionId,
        status: "frozen",
        reason,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);
 
  const recordVaultOtpVerified = useCallback((vaultId: string) => {
    setVaultCases((prev) =>
      prev.map((v) => (v.vault_id === vaultId ? { ...v, status: "otp_verified" } : v))
    );
  }, []);
 
  const recordVaultReview = useCallback((vaultId: string, decision: VaultDecision) => {
    setVaultCases((prev) =>
      prev.map((v) =>
        v.vault_id === vaultId
          ? { ...v, status: decision === "approve" ? "released" : "rejected" }
          : v
      )
    );
  }, []);
 
  const recordProfilingRun = useCallback((result: AttackerProfilingResult) => {
    setProfilingRuns((prev) => [
      { id: genId("run"), timestamp: new Date().toISOString(), result },
      ...prev,
    ]);
  }, []);
 
  const value = useMemo<ActivityContextValue>(
    () => ({
      transactions,
      vaultCases,
      profilingRuns,
      recordAssessment,
      recordVaultMove,
      recordVaultOtpVerified,
      recordVaultReview,
      recordProfilingRun,
    }),
    [
      transactions,
      vaultCases,
      profilingRuns,
      recordAssessment,
      recordVaultMove,
      recordVaultOtpVerified,
      recordVaultReview,
      recordProfilingRun,
    ]
  );
 
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
};
 
export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) {
    throw new Error("useActivity must be used within an ActivityProvider");
  }
  return ctx;
}
 
