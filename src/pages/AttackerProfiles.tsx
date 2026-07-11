import React, { useMemo, useState } from "react";
import { Users, PlayCircle, Loader2, AlertCircle, Info } from "lucide-react";
import apiClient from "@/api/client";
import { useActivity } from "@/store/ActivityContext";
import type { AttackerProfilingResult, GenericStatus } from "@/types/api";

const CLUSTER_LABELS = ["Automated Bot", "Slow Prober", "Credential Stuffer", "Opportunistic Tester"];

export const AttackerProfiles: React.FC = () => {
  const { profilingRuns, recordProfilingRun } = useActivity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestRun = profilingRuns[0] ?? null;

  const runProfiling = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post<GenericStatus<AttackerProfilingResult>>(
        "/admin/run-attacker-profiling"
      );
      const result = (data.data ?? { status: data.status, n_profiles_updated: 0 }) as AttackerProfilingResult;
      recordProfilingRun(result);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to trigger the attacker profiling job.");
    } finally {
      setBusy(false);
    }
  };

  const statusStyle = useMemo(() => {
    if (!latestRun) return "bg-vault-800 text-slate-400";
    return latestRun.result.status === "completed"
      ? "bg-risk-low/15 text-risk-low"
      : "bg-risk-moderate/15 text-risk-moderate";
  }, [latestRun]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-50">Attacker Profiles</h1>
          <p className="text-sm text-slate-500">
            Batch K-Means clustering over honeypot telemetry (session count, average session
            duration, average events per session) to classify captured attacker fingerprints.
          </p>
        </div>
        <button onClick={runProfiling} disabled={busy} className="btn-primary shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {busy ? "Running…" : "Run Attacker Profiling"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Latest Job Status</span>
          <span className={`badge w-fit ${statusStyle}`}>
            {latestRun ? latestRun.result.status.replace(/_/g, " ") : "not run yet"}
          </span>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Profiles Updated</span>
          <span className="text-2xl font-bold text-slate-50">
            {latestRun ? latestRun.result.n_profiles_updated : "—"}
          </span>
        </div>
        <div className="kpi-card">
          <span className="text-xs uppercase tracking-wide text-slate-500">Clusters (k)</span>
          <span className="text-2xl font-bold text-slate-50">
            {latestRun?.result.n_clusters ?? "—"}
          </span>
        </div>
      </div>

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
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-vault-700 bg-vault-850 px-3 py-2 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-teal" />
          <span>
            Cluster labels are assigned by ranking K-Means clusters on mean events-per-session
            (descending) and mapping them onto this fixed four-label taxonomy, exactly as
            implemented in <code className="text-slate-400">threat_intel.run_attacker_profiling</code>.
            The current backend does not expose a GET endpoint to list individual attacker
            profile records, so this panel reflects job-level results returned by each run —
            wiring a `/admin/attacker-profiles` list endpoint is a recommended follow-up.
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-slate-200">Job History (session)</h2>
        </div>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-vault-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Profiles Updated</th>
                <th className="px-4 py-2">Clusters</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {profilingRuns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No profiling jobs triggered this session yet.
                  </td>
                </tr>
              )}
              {profilingRuns.map((run) => (
                <tr key={run.id} className="border-t border-vault-700/60">
                  <td className="px-4 py-2 capitalize text-slate-300">
                    {run.result.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{run.result.n_profiles_updated}</td>
                  <td className="px-4 py-2 text-slate-300">{run.result.n_clusters ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(run.timestamp).toLocaleTimeString()}
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

function clusterDescription(label: string): string {
  switch (label) {
    case "Automated Bot":
      return "High event rate, minimal think-time between actions — scripted or headless traffic.";
    case "Slow Prober":
      return "Long session duration, low event density — deliberate, manual reconnaissance.";
    case "Credential Stuffer":
      return "Repeated sessions across many fingerprints — bulk credential testing pattern.";
    case "Opportunistic Tester":
      return "Sparse, low-signal sessions — the default label until enough honeypot history accrues.";
    default:
      return "";
  }
}

export default AttackerProfiles;
