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
// Phase 4 exposes no GET list endpoints for transactions, vault cases, or
// attacker profiles — only action endpoints (/assess, /vault/*,
// /admin/run-attacker-profiling) that return a single result each call.
// This store accumulates those real responses into an in-memory, session-
// scoped feed so the dashboard panels have something faithful to render.
// It resets on page reload by design; wiring it to persistent backend list
// endpoints (recommended next step) would replace this entirely.
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
