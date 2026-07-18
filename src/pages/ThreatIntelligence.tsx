import React, { useState, useEffect } from "react";
import { Bug, StopCircle, Loader2, AlertCircle, RefreshCw, Activity } from "lucide-react";
import apiClient from "@/api/client";
import type { GenericStatus, HoneypotCloseRequest } from "@/types/api";
import { useToast } from "@/components/Toast";

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
  const { pushToast } = useToast();
  const [dbSessions, setDbSessions] = useState<DBHoneypotSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);

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
    // Auto-refresh the telemetry every 10 seconds in production
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleForceClose = async (sessionId: string) => {
    setClosingId(sessionId);
    try {
      const payload: HoneypotCloseRequest = { session_id: sessionId };
      await apiClient.post<GenericStatus>("/api/v1/honeypot/close", payload);
      pushToast("success", `Honeypot connection ${sessionId.slice(0,8)} forcefully terminated.`);
      await fetchSessions();
    } catch (err: any) {
      pushToast("error", err?.response?.data?.detail || "Failed to terminate session.");
    } finally {
      setClosingId(null);
    }
  };

  const activeSessions = dbSessions.filter(s => s.stage !== "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Threat Intelligence Network</h1>
          <p className="text-sm text-slate-500">
            Live telemetry from automated honeypots. Attackers are automatically routed here by the 
            transaction engine and monitored in real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="kpi-card border-accent-teal/30">
          <span className="text-xs uppercase tracking-wide text-slate-500">Active Traps (Live)</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-accent-teal">{activeSessions}</span>
            {activeSessions > 0 && <Activity className="h-4 w-4 text-accent-teal animate-pulse" />}
          </div>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Total Sessions Logged</span>
          <span className="text-2xl font-bold text-slate-50">{dbSessions.length}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Bug className="h-4 w-4 text-risk-high" /> Live Telemetry Feed
          </h2>
          <button onClick={fetchSessions} disabled={loading} className="btn-secondary py-1 px-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync
          </button>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Session ID</th>
                <th className="px-4 py-3">Fingerprint</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions Captured</th>
                <th className="px-4 py-3">Started At</th>
                <th className="px-4 py-3 text-right">Emergency Control</th>
              </tr>
            </thead>
            <tbody>
              {dbSessions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No honeypot telemetry available. Waiting for backend to trap attackers...
                  </td>
                </tr>
              )}
              {dbSessions.map((s) => {
                const isActive = s.stage !== "closed";
                return (
                  <tr key={s.session_id} className={`border-t border-vault-700/60 ${isActive ? 'bg-risk-high/5' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{s.session_id.slice(0, 12)}…</td>
                    <td className="px-4 py-3 text-slate-300">{s.browser_fingerprint || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${isActive ? 'bg-risk-high/20 text-risk-high animate-pulse' : 'bg-vault-800 text-slate-500'}`}>
                        {isActive ? 'LIVE / ' + s.stage : 'Closed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{s.events_count} events</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(s.started_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {isActive && (
                        <button 
                          onClick={() => handleForceClose(s.session_id)}
                          disabled={closingId === s.session_id}
                          className="inline-flex items-center gap-1 rounded border border-risk-high/50 bg-risk-high/10 px-2 py-1 text-xs font-medium text-risk-high transition hover:bg-risk-high/20"
                        >
                          {closingId === s.session_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
                          Kill Session
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ThreatIntelligence;