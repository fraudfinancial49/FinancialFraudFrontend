import React, { useEffect, useState } from "react";
import {
  Search,
  ShieldOff,
  ShieldCheck as ShieldCheckIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
  Activity,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
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
  getBehavioralAnomalies,
} from "@/api/client";
import { RoutingBadge } from "@/components/RiskBadges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { AccountTransactionOut, AccountTransactionsResponse, BehavioralAnomalyOut } from "@/types/api";

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

// ---------------------------------------------------------------------------
// Right-column panel: accounts whose most recent transaction broke sharply
// from their own historical baseline (a previously-safe account that just
// triggered a riskier tier, and/or a sudden multi-x amount spike). Fully
// independent of the left column's account search -- fetches its own
// account-agnostic scan on mount.
// ---------------------------------------------------------------------------

// Colors follow the same severity ordering as the risk router's own tiers
// (approve < otp_verification < auto_reject < honeypot), using this app's
// existing risk-* / accent-* design tokens (tailwind.config.js) as literal
// hex values -- Recharts renders raw SVG and can't consume Tailwind classes.
const ROUTING_SHIFT_COLORS: Record<string, string> = {
  otp_verification: "#f5b942", // risk-moderate
  auto_reject: "#f2545b",      // risk-high
  honeypot: "#c0203a",         // risk-critical
};
const AMOUNT_SPIKE_COLOR = "#12b3a8"; // accent-teal
const FALLBACK_COLOR = "#5b6df8";     // accent-indigo

function colorForAnomaly(row: BehavioralAnomalyOut): string {
  if (row.anomaly_type === "amount_spike") return AMOUNT_SPIKE_COLOR;
  return ROUTING_SHIFT_COLORS[row.recent_routing] ?? FALLBACK_COLOR;
}

const ANOMALY_LEGEND = [
  { color: ROUTING_SHIFT_COLORS.otp_verification, label: "Shifted to OTP" },
  { color: ROUTING_SHIFT_COLORS.auto_reject, label: "Shifted to Auto-Reject" },
  { color: ROUTING_SHIFT_COLORS.honeypot, label: "Shifted to Honeypot" },
  { color: AMOUNT_SPIKE_COLOR, label: "Amount spike" },
];

function truncateAccountId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 12)}…` : id;
}

// Plain-HTML equivalent of the chart's CopyableYAxisTick (below), for account
// IDs shown in ordinary table cells rather than inside an SVG chart. Click
// copies the full id, with a brief green "copied" flash for confirmation.
function CopyableAccountId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick(e: React.MouseEvent) {
    // Table rows this sits in are themselves clickable (row click opens the
    // SHAP panel) -- without this, copying an id would also trigger that.
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <span
      onClick={handleClick}
      title={copied ? "Copied!" : `Click to copy ${id}`}
      className={`cursor-pointer font-mono text-xs transition-colors ${
        copied ? "text-risk-low" : "text-slate-300 hover:text-accent-indigo"
      }`}
    >
      {truncateAccountId(id)}
    </span>
  );
}

interface AnomalyChartRow extends BehavioralAnomalyOut {
  label: string;
}

function AnomalyTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AnomalyChartRow }> }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-vault-700 bg-vault-850 px-3 py-2 text-xs shadow-panel">
      <p className="font-mono font-semibold text-slate-100">{row.account_id}</p>
      <div className="mt-1.5 space-y-1 text-slate-400">
        <p>
          Baseline: <RoutingBadge decision={row.baseline_routing} />{" "}
          <span className="text-slate-500">({(row.baseline_approve_ratio * 100).toFixed(0)}% approved historically)</span>
        </p>
        <p>
          Most recent: <RoutingBadge decision={row.recent_routing} />
        </p>
        {row.anomaly_type !== "routing_shift" && (
          <p>
            Amount: <span className="text-slate-200">{row.historical_avg_amount.toLocaleString()}</span> avg →{" "}
            <span className="font-semibold text-slate-100">{row.recent_amount.toLocaleString()}</span>{" "}
            <span className="text-accent-teal">({row.spike_ratio.toFixed(1)}×)</span>
          </p>
        )}
        <p className="text-slate-500">
          {row.transaction_count} transactions · {new Date(row.last_transaction_at).toLocaleString()}
        </p>
      </div>
      <p className="mt-1.5 border-t border-vault-700/60 pt-1.5 font-semibold text-accent-indigo">
        Severity {row.severity_score.toFixed(0)}/100
      </p>
    </div>
  );
}

// Y-axis tick for the chart's account labels -- hovering shows a native
// browser tooltip with the full account ID (via <title>) and a color change
// as a click affordance; clicking copies the FULL id (not the truncated
// label) to the clipboard, with a brief green flash for confirmation. Uses
// Recharts' `index` (the row's position within the chart's data array,
// which Recharts always passes to a custom tick) to look up the full row --
// avoids any ambiguity from two different account IDs truncating to the same
// visible label.
function CopyableYAxisTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
  index?: number;
  chartData: AnomalyChartRow[];
  onCopied: (id: string) => void;
}) {
  const { x = 0, y = 0, payload, index, chartData, onCopied } = props;
  const [hovering, setHovering] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const row = index !== undefined ? chartData[index] : undefined;
  const fullId = row?.account_id ?? payload?.value ?? "";

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!fullId) return;
    navigator.clipboard.writeText(fullId).then(() => {
      setJustCopied(true);
      onCopied(fullId);
      window.setTimeout(() => setJustCopied(false), 1200);
    });
  }

  const fillColor = justCopied ? "#2fd97f" : hovering ? "#5b6df8" : "#64748b";

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handleClick}
      style={{ cursor: fullId ? "pointer" : "default" }}
    >
      <title>{fullId ? (justCopied ? "Copied!" : `Click to copy ${fullId}`) : ""}</title>
      <text x={0} y={0} dy={4} textAnchor="end" fontSize={10} fill={fillColor}>
        {payload?.value}
      </text>
    </g>
  );
}

function BehavioralAnomaliesPanel() {
  const [rows, setRows] = useState<BehavioralAnomalyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopied(id: string) {
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getBehavioralAnomalies(15);
      setRows(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not load behavioral anomalies.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const chartData: AnomalyChartRow[] = rows.map((r) => ({ ...r, label: truncateAccountId(r.account_id) }));
  const chartHeight = Math.max(240, chartData.length * 40);

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Activity className="h-4 w-4 text-accent-indigo" />
            Behavioral Anomalies
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Accounts whose latest transaction broke sharply from their own history
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary shrink-0 py-1 px-2 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </button>
      </div>

      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {ANOMALY_LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
          {chartData.length > 0 && (
            <span className="ml-auto text-xs text-slate-600">
              {copiedId ? (
                <span className="text-risk-low">Copied {copiedId}</span>
              ) : (
                "Hover an account label to copy its ID"
              )}
            </span>
          )}
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <CheckCircle2 className="h-5 w-5 text-risk-low" />
            No unusual behavioral shifts detected right now.
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2540" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={10} />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={10}
                  width={90}
                  tick={<CopyableYAxisTick chartData={chartData} onCopied={handleCopied} />}
                />
                <Tooltip content={<AnomalyTooltip />} cursor={{ fill: "rgba(91, 109, 248, 0.06)" }} />
                <Bar dataKey="severity_score" radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((row) => (
                    <Cell key={row.account_id} fill={colorForAnomaly(row)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
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
    } catch (e: any) {
      setActionError(e?.response?.data?.detail ?? `Failed to ${confirmAction} account.`);
    } finally {
      // Always close, success or failure -- on failure this surfaces the
      // actionError banner underneath, which the dialog's overlay would
      // otherwise hide, making a real failure look like a silent no-op.
      setConfirmAction(null);
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
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-slate-50">Account Lookup</h1>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Left half: existing account lookup and details -- unchanged. */}
        <div className="space-y-6">
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
                <th>To</th>
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
                  <td>
                    <CopyableAccountId id={tx.name_dest} />
                  </td>
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
        </div>

        {/* Right half: behavioral anomaly scan, independent of the search above. */}
        <div>
          <BehavioralAnomaliesPanel />
        </div>
      </div>

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
