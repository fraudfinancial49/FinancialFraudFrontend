import React, { useState, useEffect } from "react";
import { Users, PlayCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import apiClient from "@/api/client";
import { useToast } from "@/components/Toast";
import type { AttackerProfilingResult, GenericStatus } from "@/types/api";

const CLUSTER_LABELS = ["Automated Bot", "Slow Prober", "Credential Stuffer", "Opportunistic Tester"];

interface DBAttackerProfile {
  browser_fingerprint: string;
  simulated_ip: string | null;
  total_sessions: number;
  avg_session_duration_seconds: number;
  avg_events_per_session: number;
  cluster_label: string;
  threat_score: number;
  last_seen_at: string;
}

export const AttackerProfiles: React.FC = () => {
  const { pushToast } = useToast();
  
  const [profiles, setProfiles] = useState<DBAttackerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<DBAttackerProfile[]>("/api/v1/admin/attacker-profiles");
      setProfiles(data);
    } catch (err) {
      console.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const runProfiling = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post<GenericStatus<AttackerProfilingResult>>(
        "/api/v1/admin/run-attacker-profiling"
      );
      pushToast("success", data.message || "Attacker profiling job completed.");
      await fetchProfiles(); // Refresh the table with new clusters
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to trigger the attacker profiling job.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Attacker Profiles</h1>
          <p className="text-sm text-slate-500">
            Batch K-Means clustering over honeypot telemetry to classify captured attacker fingerprints.
          </p>
        </div>
        <button onClick={runProfiling} disabled={busy} className="btn-primary shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {busy ? "Running Job…" : "Run Attacker Profiling"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="panel p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Users className="h-4 w-4 text-accent-indigo" />
          Cluster Taxonomy
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CLUSTER_LABELS.map((label) => (
            <div key={label} className="rounded-lg border border-vault-700 bg-vault-850 p-3">
              <p className="text-sm font-medium text-slate-200">{label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {clusterDescription(label)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Identified Attacker Database</h2>
          <button onClick={fetchProfiles} disabled={loading} className="btn-secondary py-1 px-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh DB
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Fingerprint</th>
                <th className="px-4 py-2">Classification</th>
                <th className="px-4 py-2">Threat Score</th>
                <th className="px-4 py-2">Sessions</th>
                <th className="px-4 py-2">Events/Session</th>
                <th className="px-4 py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {loading && profiles.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
              ) : profiles.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No attacker profiles mapped yet. Trigger a run above.</td></tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.browser_fingerprint} className="border-t border-vault-700/60 hover:bg-vault-800/30">
                    <td className="px-4 py-2 font-mono text-slate-300">{p.browser_fingerprint.slice(0, 16)}…</td>
                    <td className="px-4 py-2">
                      <span className="badge bg-vault-800 text-slate-400">{p.cluster_label}</span>
                    </td>
                    <td className="px-4 py-2 text-risk-high font-bold">{p.threat_score.toFixed(1)}</td>
                    <td className="px-4 py-2 text-slate-400">{p.total_sessions}</td>
                    <td className="px-4 py-2 text-slate-400">{p.avg_events_per_session.toFixed(1)}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(p.last_seen_at).toLocaleDateString()}</td>
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

function clusterDescription(label: string): string {
  switch (label) {
    case "Automated Bot": return "High event rate, minimal think-time between actions.";
    case "Slow Prober": return "Long session duration, low event density — manual reconnaissance.";
    case "Credential Stuffer": return "Repeated sessions across many fingerprints — bulk testing.";
    case "Opportunistic Tester": return "Sparse, low-signal sessions — default prior to enough history.";
    default: return "";
  }
}

export default AttackerProfiles;