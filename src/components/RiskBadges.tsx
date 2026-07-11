import React from "react";
import { CheckCircle2, Lock, Bug } from "lucide-react";
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
  vault: {
    label: "Safe Vault",
    className: "bg-risk-moderate/15 text-risk-moderate",
    icon: <Lock className="h-3 w-3" />,
  },
  honeypot: {
    label: "Honeypot",
    className: "bg-risk-high/15 text-risk-high",
    icon: <Bug className="h-3 w-3" />,
  },
};

export const RoutingBadge: React.FC<{ decision: RoutingDecision }> = ({ decision }) => {
  const style = ROUTING_STYLES[decision];
  return (
    <span className={`badge ${style.className}`}>
      {style.icon}
      {style.label}
    </span>
  );
};
