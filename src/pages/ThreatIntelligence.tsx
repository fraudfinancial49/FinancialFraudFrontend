import React, { useState, useEffect } from "react";
import { Bug, StopCircle, Loader2, RefreshCw, Activity, ArrowRightCircle } from "lucide-react";
import apiClient, { getHoneypotEvents } from "@/api/client";
import type { GenericStatus, HoneypotAdvanceRequest, HoneypotCloseRequest } from "@/types/api";
import { useToast } from "@/components/Toast";

interface DBHoneypotSession {
  session_id: string;
  simulated_ip: string;
  actual_ip: string | null;
  location: string | null;
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
  
  // Simulator State
  const [simulatorSessionId, setSimulatorSessionId] = useState("");
  const [eventType, setEventType] = useState("view_balance");
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Timeline State
  const [selectedEvents, setSelectedEvents] = useState<any[]>([]);
  const [viewingTimelineId, setViewingTimelineId] = useState<string | null>(null);

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

  // --- ATTACKER SIMULATOR (No Hardcoding) ---
  const handleAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvanceBusy(true);
    try {
      const payload: HoneypotAdvanceRequest = { session_id: simulatorSessionId, event_type: eventType };
      await apiClient.post<GenericStatus>("/api/v1/honeypot/advance", payload);
      pushToast("success", `Event '${eventType}' recorded for session ${simulatorSessionId.slice(0,6)}...`);
      await fetchSessions(); 
      if (viewingTimelineId === simulatorSessionId) {
        handleViewTimeline(simulatorSessionId, true); // Refresh timeline silently
      }
    } catch (err: any) {
      pushToast("error", err?.response?.data?.detail || "Failed to record event.");
    } finally {
      setAdvanceBusy(false);
    }
  };

  const handleForceClose = async (sessionId: string) => {
    setClosingId(sessionId);
    try {
      const payload: HoneypotCloseRequest = { session_id: sessionId };
      await apiClient.post<GenericStatus>("/api/v1/honeypot/close", payload);
      pushToast("success", `Honeypot session finalized.`);
      if (simulatorSessionId === sessionId) setSimulatorSessionId("");
      await fetchSessions();
    } catch (err: any) {
      pushToast("error", err?.response?.data?.detail || "Failed to terminate session.");
    } finally {
      setClosingId(null);
    }
  };

  const handleViewTimeline = async (sessionId: string, silentRefresh = false) => {
    if (viewingTimelineId === sessionId && !silentRefresh) {
      setViewingTimelineId(null);
      setSelectedEvents([]);
      return;
    }
    try {
      const data = await getHoneypotEvents(sessionId);
      setSelectedEvents(data);
      setViewingTimelineId(sessionId);
    } catch (err) {
      if (!silentRefresh) pushToast("error", "Failed to load event timeline.");
    }
  };

  const activeSessions = dbSessions.filter(s => s.stage !== "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Threat Intelligence & Simulator</h1>
          <p className="text-sm text-slate-500">
            Live telemetry from the routing engine. Use the simulator below to organically generate 
            attacker events for the K-Means clustering model.
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
        
        {/* MANUAL ATTACKER SIMULATOR PANEL */}
        <form onSubmit={handleAdvance} className="sm:col-span-2 panel space-y-3 p-5 border-accent-indigo/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-indigo">
            <ArrowRightCircle className="h-4 w-4" /> Organic Attacker Simulator
          </div>
          <p className="text-xs text-slate-400">Select a live Session ID from the table below to manually inject telemetry events. This replaces the need for synthetic data scripts.</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="field-label">Target Session ID</label>
              <input className="input-field font-mono text-sm" value={simulatorSessionId} onChange={(e) => setSimulatorSessionId(e.target.value)} required placeholder="Select from table..." />
            </div>
            <div className="flex-1">
              <label className="field-label">Simulate Action</label>
              <select className="input-field" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="view_balance">View Balance (Recon)</option>
                <option value="attempt_transfer">Attempt Transfer (Theft)</option>
                <option value="password_reset_attempt">Password Reset (Takeover)</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={advanceBusy || !simulatorSessionId} className="btn-secondary w-full justify-center">
            {advanceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />} Inject Organic Event
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Bug className="h-4 w-4 text-risk-high" /> Live Telemetry Feed
          </h2>
          <button onClick={fetchSessions} disabled={loading} className="btn-secondary py-1 px-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync Database
          </button>
        </div>
        <div className="max-h-[700px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Session ID</th>
                <th className="px-4 py-3">Fingerprint</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Events Logged</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dbSessions.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No honeypot telemetry available. Send a high-risk transaction through the Sandbox first.
                  </td>
                </tr>
              )}
              {dbSessions.map((s) => {
                const isActive = s.stage !== "closed";
                return (
                  <React.Fragment key={s.session_id}>
                    <tr className={`border-t border-vault-700/60 ${isActive ? 'bg-risk-high/5' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {isActive ? (
                          <button onClick={() => { setSimulatorSessionId(s.session_id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-accent-indigo hover:underline" title="Load into Simulator">
                            {s.session_id.slice(0, 12)}…
                          </button>
                        ) : (
                          s.session_id.slice(0, 12) + "…"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.browser_fingerprint || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${isActive ? 'bg-risk-high/20 text-risk-high' : 'bg-vault-800 text-slate-500'}`}>
                          {isActive ? 'LIVE' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono">{s.events_count}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => handleViewTimeline(s.session_id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                        >
                          {viewingTimelineId === s.session_id ? "Hide" : "Timeline"}
                        </button>
                        {isActive && (
                          <>
                            <button 
                              onClick={() => { setSimulatorSessionId(s.session_id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="inline-flex items-center gap-1 rounded border border-accent-indigo/50 bg-accent-indigo/10 px-2 py-1 text-xs font-medium text-accent-indigo transition hover:bg-accent-indigo/20"
                            >
                              Select
                            </button>
                            <button 
                              onClick={() => handleForceClose(s.session_id)}
                              disabled={closingId === s.session_id}
                              className="inline-flex items-center gap-1 rounded border border-risk-high/50 bg-risk-high/10 px-2 py-1 text-xs font-medium text-risk-high transition hover:bg-risk-high/20"
                            >
                              {closingId === s.session_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
                              Kill
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expandable Timeline View */}
                    {viewingTimelineId === s.session_id && (
                      <tr>
                        <td colSpan={5} className="bg-vault-950 p-4 border-b border-vault-700/60">
                          <div className="mb-4 grid grid-cols-2 gap-4 rounded bg-vault-900 p-3 border border-vault-700">
                             <div>
                                <span className="text-xs text-slate-500 block">Actual Network IP</span>
                                <span className="text-sm text-risk-high font-mono">{s.actual_ip || "Capturing..."}</span>
                             </div>
                             <div>
                                <span className="text-xs text-slate-500 block">Geo-Location</span>
                                <span className="text-sm text-slate-200">{s.location || "Unknown"}</span>
                             </div>
                          </div>

                          <h4 className="text-sm font-semibold text-accent-indigo mb-3">Activity Timeline</h4>
                          {selectedEvents.length === 0 ? (
                            <p className="text-xs text-slate-500">No detailed events logged yet.</p>
                          ) : (
                            <ul className="space-y-3 border-l-2 border-vault-700 ml-2 pl-4 max-h-64 overflow-y-auto">
                              {selectedEvents.map((ev) => (
                                <li key={ev.event_id} className="relative">
                                  <div className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${ev.stage === 'micro_interaction' ? 'bg-slate-600' : 'bg-accent-indigo'}`}></div>
                                  <p className={`text-xs font-mono ${ev.stage === 'micro_interaction' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {new Date(ev.occurred_at).toLocaleTimeString()} — 
                                    <span className="font-semibold ml-1">{ev.stage === 'micro_interaction' ? 'Click Event' : ev.stage}</span>
                                  </p>
                                  <p className={`text-xs mt-0.5 ${ev.stage === 'micro_interaction' ? 'text-slate-400' : 'text-slate-200 text-sm'}`}>
                                    {ev.detail}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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