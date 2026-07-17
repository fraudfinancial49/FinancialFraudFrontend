import React, { useState, useEffect } from "react";
import { Bug, PlayCircle, ArrowRightCircle, StopCircle, Loader2, AlertCircle, RefreshCw, ArrowUpRight } from "lucide-react";
import apiClient from "@/api/client";
import type {
  GenericStatus,
  HoneypotAdvanceRequest,
  HoneypotCloseRequest,
  HoneypotStartRequest,
} from "@/types/api";

interface DBHoneypotSession {
  session_id: string;
  simulated_ip: string;
  browser_fingerprint: string;
  stage: string;
  started_at: string;
  closed_at: string | null;
  events_count: number;
}

export const ThreatIntelligence: React.FC = () => {
  // --- Persistent DB State ---
  const [dbSessions, setDbSessions] = useState<DBHoneypotSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Start
  const [startTxId, setStartTxId] = useState("");
  const [simulatedIp, setSimulatedIp] = useState("198.51.100.23");
  const [userAgent, setUserAgent] = useState("Mozilla/5.0 (X11; Linux x86_64)");
  const [fingerprint, setFingerprint] = useState("");
  const [riskAtEntry, setRiskAtEntry] = useState(72.5);
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Advance & Close
  const [sessionId, setSessionId] = useState("");
  const [eventType, setEventType] = useState("view_balance");
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<DBHoneypotSession[]>("/api/v1/honeypot/sessions");
      setDbSessions(data);
    } catch (err) {
      console.error("Failed to load honeypot sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

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
      const { data } = await apiClient.post<GenericStatus>("/api/v1/honeypot/start", payload);
      const newSessionId = (data.data?.session_id as string) ?? "";
      if (newSessionId) setSessionId(newSessionId);
      await fetchSessions(); // Refresh DB view
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
      await apiClient.post<GenericStatus>("/api/v1/honeypot/advance", payload);
      await fetchSessions(); // Refresh DB view
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
      await apiClient.post<GenericStatus>("/api/v1/honeypot/close", payload);
      setSessionId(""); // Clear selection
      await fetchSessions(); // Refresh DB view
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
        {/* START FORM */}
        <form onSubmit={handleStart} className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <PlayCircle className="h-4 w-4 text-accent-teal" /> Start Session
          </div>
          {startError && <InlineError message={startError} />}
          <div>
            <label className="field-label">Simulated IP</label>
            <input className="input-field" value={simulatedIp} onChange={(e) => setSimulatedIp(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Browser fingerprint</label>
            <input className="input-field" value={fingerprint} onChange={(e) => setFingerprint(e.target.value)} placeholder="fp_…" />
          </div>
          <button type="submit" disabled={startBusy} className="btn-primary w-full justify-center">
            {startBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Start
          </button>
        </form>

        {/* ADVANCE FORM */}
        <form onSubmit={handleAdvance} className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ArrowRightCircle className="h-4 w-4 text-accent-indigo" /> Advance Session
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
              <option value="password_reset_attempt">password_reset_attempt</option>
            </select>
          </div>
          <button type="submit" disabled={advanceBusy || !sessionId} className="btn-secondary w-full justify-center">
            {advanceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />} Record Event
          </button>
        </form>

        {/* CLOSE FORM */}
        <div className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <StopCircle className="h-4 w-4 text-risk-high" /> Close Session
          </div>
          {closeError && <InlineError message={closeError} />}
          <p className="text-xs text-slate-500">
            Closes session <span className="font-mono text-slate-300">{sessionId || "(none)"}</span>.
          </p>
          <button type="button" disabled={closeBusy || !sessionId} onClick={handleClose} className="btn-danger w-full justify-center">
            {closeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />} Close Session
          </button>
        </div>
      </div>

      {/* REAL DATABASE TABLE */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Bug className="h-4 w-4 text-risk-high" /> Persistent Honeypot Logs
          </h2>
          <button onClick={fetchSessions} disabled={loading} className="btn-secondary py-1 px-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh DB
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Session ID</th>
                <th className="px-4 py-2">Fingerprint</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Events</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {dbSessions.map((s) => (
                <tr key={s.session_id} className="border-t border-vault-700/60">
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">{s.session_id.slice(0, 12)}…</td>
                  <td className="px-4 py-2 text-slate-300">{s.browser_fingerprint || "—"}</td>
                  <td className="px-4 py-2 capitalize text-slate-300">{s.stage}</td>
                  <td className="px-4 py-2 text-slate-300">{s.events_count}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(s.started_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    {s.stage !== "closed" && (
                      <button onClick={() => { setSessionId(s.session_id); window.scrollTo(0,0); }} className="text-accent-indigo hover:text-white text-xs inline-flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> Load
                      </button>
                    )}
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