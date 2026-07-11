import React, { useState } from "react";
import { Bug, PlayCircle, ArrowRightCircle, StopCircle, Loader2, AlertCircle } from "lucide-react";
import apiClient from "@/api/client";
import type {
  GenericStatus,
  HoneypotAdvanceRequest,
  HoneypotCloseRequest,
  HoneypotStartRequest,
} from "@/types/api";

interface SessionLogEntry {
  id: string;
  timestamp: string;
  action: "start" | "advance" | "close";
  status: string;
  message?: string;
  sessionId?: string;
}

export const ThreatIntelligence: React.FC = () => {
  const [log, setLog] = useState<SessionLogEntry[]>([]);

  // Start
  const [startTxId, setStartTxId] = useState("");
  const [simulatedIp, setSimulatedIp] = useState("198.51.100.23");
  const [userAgent, setUserAgent] = useState("Mozilla/5.0 (X11; Linux x86_64)");
  const [fingerprint, setFingerprint] = useState("");
  const [riskAtEntry, setRiskAtEntry] = useState(72.5);
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Advance
  const [sessionId, setSessionId] = useState("");
  const [eventType, setEventType] = useState("view_balance");
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  // Close
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const pushLog = (entry: Omit<SessionLogEntry, "id" | "timestamp">) => {
    setLog((prev) => [
      { ...entry, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartBusy(true);
    setStartError(null);
    try {
      const payload: HoneypotStartRequest = {
        transaction_id: startTxId || undefined,
        simulated_ip: simulatedIp || undefined,
        user_agent: userAgent || undefined,
        browser_fingerprint: fingerprint || undefined,
        risk_score_at_entry: riskAtEntry,
      };
      const { data } = await apiClient.post<GenericStatus>("/honeypot/start", payload);
      const newSessionId = (data.data?.session_id as string) ?? "";
      if (newSessionId) setSessionId(newSessionId);
      pushLog({ action: "start", status: data.status, message: data.message, sessionId: newSessionId });
    } catch (err: any) {
      setStartError(err?.response?.data?.detail || "Failed to start honeypot session.");
    } finally {
      setStartBusy(false);
    }
  };

  const handleAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvanceBusy(true);
    setAdvanceError(null);
    try {
      const payload: HoneypotAdvanceRequest = { session_id: sessionId, event_type: eventType };
      const { data } = await apiClient.post<GenericStatus>("/honeypot/advance", payload);
      pushLog({ action: "advance", status: data.status, message: data.message, sessionId });
    } catch (err: any) {
      setAdvanceError(err?.response?.data?.detail || "Failed to advance honeypot session.");
    } finally {
      setAdvanceBusy(false);
    }
  };

  const handleClose = async () => {
    setCloseBusy(true);
    setCloseError(null);
    try {
      const payload: HoneypotCloseRequest = { session_id: sessionId };
      const { data } = await apiClient.post<GenericStatus>("/honeypot/close", payload);
      pushLog({ action: "close", status: data.status, message: data.message, sessionId });
    } catch (err: any) {
      setCloseError(err?.response?.data?.detail || "Failed to close honeypot session.");
    } finally {
      setCloseBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">Threat Intelligence &amp; Honeypot Control</h1>
        <p className="text-sm text-slate-500">
          Operate the fake banking sandbox that engages suspected attackers while telemetry is
          captured for offline attacker profiling.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleStart} className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <PlayCircle className="h-4 w-4 text-accent-teal" />
            Start Session
          </div>
          {startError && <InlineError message={startError} />}
          <div>
            <label className="field-label">Transaction ID (optional)</label>
            <input className="input-field" value={startTxId} onChange={(e) => setStartTxId(e.target.value)} placeholder="tx_…" />
          </div>
          <div>
            <label className="field-label">Simulated IP</label>
            <input className="input-field" value={simulatedIp} onChange={(e) => setSimulatedIp(e.target.value)} />
          </div>
          <div>
            <label className="field-label">User agent</label>
            <input className="input-field" value={userAgent} onChange={(e) => setUserAgent(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Browser fingerprint (optional)</label>
            <input className="input-field" value={fingerprint} onChange={(e) => setFingerprint(e.target.value)} placeholder="fp_…" />
          </div>
          <div>
            <label className="field-label">Risk score at entry</label>
            <input
              type="number"
              step="0.1"
              className="input-field"
              value={riskAtEntry}
              onChange={(e) => setRiskAtEntry(Number(e.target.value))}
            />
          </div>
          <button type="submit" disabled={startBusy} className="btn-primary w-full justify-center">
            {startBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Start
          </button>
        </form>

        <form onSubmit={handleAdvance} className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ArrowRightCircle className="h-4 w-4 text-accent-indigo" />
            Advance Session
          </div>
          {advanceError && <InlineError message={advanceError} />}
          <div>
            <label className="field-label">Session ID</label>
            <input className="input-field" value={sessionId} onChange={(e) => setSessionId(e.target.value)} required placeholder="session_…" />
          </div>
          <div>
            <label className="field-label">Event type</label>
            <select className="input-field" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="view_balance">view_balance</option>
              <option value="attempt_transfer">attempt_transfer</option>
              <option value="view_statement">view_statement</option>
              <option value="password_reset_attempt">password_reset_attempt</option>
              <option value="page_navigation">page_navigation</option>
            </select>
          </div>
          <button type="submit" disabled={advanceBusy} className="btn-secondary w-full justify-center">
            {advanceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />}
            Record Event
          </button>
        </form>

        <div className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <StopCircle className="h-4 w-4 text-risk-high" />
            Close Session
          </div>
          {closeError && <InlineError message={closeError} />}
          <p className="text-xs text-slate-500">
            Closes session <span className="font-mono text-slate-300">{sessionId || "(none selected)"}</span> and
            finalizes its captured event trail for the batch attacker-profiling job.
          </p>
          <button
            type="button"
            disabled={closeBusy || !sessionId}
            onClick={handleClose}
            className="btn-danger w-full justify-center"
          >
            {closeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
            Close Session
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Bug className="h-4 w-4 text-risk-high" />
            Honeypot Activity Log (session)
          </h2>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Session ID</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Message</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No honeypot lifecycle actions recorded this session yet.
                  </td>
                </tr>
              )}
              {log.map((entry) => (
                <tr key={entry.id} className="border-t border-vault-700/60">
                  <td className="px-4 py-2 capitalize text-slate-300">{entry.action}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">
                    {entry.sessionId ? `${entry.sessionId.slice(0, 12)}…` : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{entry.status}</td>
                  <td className="px-4 py-2 text-slate-500">{entry.message ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(entry.timestamp).toLocaleTimeString()}
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

const InlineError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>{message}</span>
  </div>
);

export default ThreatIntelligence;
