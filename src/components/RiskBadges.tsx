import React from "react";
import { CheckCircle2, Lock, Bug, Ban } from "lucide-react";
import type { RoutingDecision } from "@/types/api";

export function riskTier(score: number): "low" | "moderate" | "high" | "critical" {
  if (score < 30) return "low";
  if (score < 60) return "moderate";
  if (score < 85) return "high";
  return "critical";
}

const TIER_STYLES: Record<string, string> = {
  low: "bg-risk-low/15 text-risk-low",
  moderate: "bg-risk-moderate/15 text-risk-moderate",
  high: "bg-risk-high/15 text-risk-high",
  critical: "bg-risk-critical/20 text-risk-critical",
};

export const RiskScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const tier = riskTier(score);
  return (
    <span className={`badge ${TIER_STYLES[tier]}`}>{score.toFixed(1)} · {tier}</span>
  );
};

const ROUTING_STYLES: Record<RoutingDecision, { label: string; className: string; icon: React.ReactNode }> = {
  approve: {
    label: "Approved",
    className: "bg-risk-low/15 text-risk-low",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  otp_verification: {
    label: "Safe Vault",
    className: "bg-risk-moderate/15 text-risk-moderate",
    icon: <Lock className="h-3 w-3" />,
  },
  honeypot: {
    label: "Honeypot",
    className: "bg-risk-high/15 text-risk-high",
    icon: <Bug className="h-3 w-3" />,
  },
  auto_reject: {
    label: "Auto Rejected",
    className: "bg-risk-critical/20 text-risk-critical",
    icon: <Ban className="h-3 w-3" />,
  }
};

const UNKNOWN_STYLE = {
  label: "Unknown",
  className: "bg-vault-800 text-slate-400",
  icon: null as React.ReactNode,
};

export const RoutingBadge: React.FC<{ decision: string }> = ({ decision }) => {
  // Falls back instead of throwing if the backend ever sends a routing_decision
  // string outside the known set (e.g. a not-yet-updated deployment still using
  // an old tier name) -- a bad/unmapped value should degrade gracefully, not
  // take down the whole page.
  const style = ROUTING_STYLES[decision as RoutingDecision] ?? { ...UNKNOWN_STYLE, label: decision || "Unknown" };
  return (
    <span className={`badge ${style.className}`}>
      {style.icon}
      {style.label}
    </span>
  );
};