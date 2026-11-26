import type { Ticket, TicketSeverity, TriageMetadata } from "@/types/ticket";
import type { Asset } from "@/types/asset";

export interface PriorityQueuePartition {
  pinnedActive: Ticket[];
  waitingQueue: Ticket[];
  resolvedTickets: Ticket[];
}

/**
 * Computes hours elapsed since ticket creation (clamped >= 0).
 */
export function getHoursOpen(createdAt: string, nowMs = Date.now()): number {
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return 0;
  return Math.max(0, (nowMs - createdMs) / 3_600_000);
}

/**
 * Computes effective priority matching backend specification:
 * COALESCE(priority_override, LEAST(100, priority_score) + LEAST(10, hours_open * 0.1))
 */
export function computeEffectivePriority(
  ticket: Pick<Ticket, "priority_score" | "priority_override" | "created_at">,
  nowMs = Date.now(),
): number {
  if (ticket.priority_override !== null && ticket.priority_override !== undefined) {
    return Number(ticket.priority_override.toFixed(1));
  }
  const base = Math.min(100, Math.max(0, ticket.priority_score));
  const agingBonus = Math.min(10, getHoursOpen(ticket.created_at, nowMs) * 0.1);
  return Number((base + agingBonus).toFixed(1));
}

export function deriveSeverityFromScore(score: number): TicketSeverity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/**
 * Deterministic Phase 1 Rule-Based Triage Engine.
 * Used in mock engine and frontend breakdown preview.
 */
export function evaluateRuleBasedTriage(params: {
  title: string;
  description: string;
  workstation?: string;
  asset: Pick<Asset, "criticality" | "next_service_due">;
  hasImages: boolean;
  nowMs?: number;
}): { score: number; severity: TicketSeverity; triage: TriageMetadata } {
  const nowMs = params.nowMs ?? Date.now();
  const text = `${params.title} ${params.description} ${params.workstation ?? ""}`.toLowerCase();
  const factors: { label: string; points: number }[] = [];

  const criticalityPts = params.asset.criticality * 6;
  factors.push({
    label: `Device Criticality (${params.asset.criticality}/5 × 6)`,
    points: criticalityPts,
  });

  const safetyKeywords = ["smoke", "burning", "spark", "shock", "leak", "overheat", "fire", "short circuit"];
  const outageKeywords = ["offline", "not turning on", "dead", "blank", "jam", "stopped", "unresponsive", "failed"];
  const degradedKeywords = ["slow", "flicker", "noise", "intermittent", "error", "warning"];

  let safetyRisk = false;
  let faultPts = 12;
  let faultLabel = "General Fault Baseline";

  if (safetyKeywords.some((kw) => text.includes(kw))) {
    safetyRisk = true;
    faultPts = 45;
    faultLabel = "Safety / Hazard Keyword Boost";
  } else if (outageKeywords.some((kw) => text.includes(kw))) {
    faultPts = 32;
    faultLabel = "Complete Stoppage / Offline Impact";
  } else if (degradedKeywords.some((kw) => text.includes(kw))) {
    faultPts = 20;
    faultLabel = "Degraded Performance Indicator";
  }
  factors.push({ label: faultLabel, points: faultPts });

  const sharedImpactKeywords = ["lab", "printer", "server", "cnc", "laser", "shared", "bench", "network"];
  let impactPts = 0;
  if (sharedImpactKeywords.some((kw) => text.includes(kw))) {
    impactPts = 10;
    factors.push({ label: "Shared Lab / Operational Impact", points: impactPts });
  }

  let photoPts = 0;
  if (params.hasImages) {
    photoPts = 5;
    factors.push({ label: "Diagnostic Photo Attached", points: photoPts });
  }

  let overduePts = 0;
  if (params.asset.next_service_due) {
    const dueMs = new Date(params.asset.next_service_due).getTime();
    if (!Number.isNaN(dueMs) && dueMs < nowMs) {
      overduePts = 5;
      factors.push({ label: "Maintenance Service Overdue", points: overduePts });
    }
  }

  const rawScore = criticalityPts + faultPts + impactPts + photoPts + overduePts;
  const score = Math.min(100, Math.max(0, rawScore));
  const severity = deriveSeverityFromScore(score);

  return {
    score,
    severity,
    triage: {
      mode: "rule_based",
      ai_status: "done",
      severity,
      base_score: score,
      safety_risk: safetyRisk,
      probable_cause: safetyRisk
        ? "Potential thermal or electrical hazard requiring immediate isolation."
        : null,
      summary: `${severity.toUpperCase()} priority assigned via deterministic rule engine (${factors.length} signals).`,
      factors,
    },
  };
}

/**
 * Enforces the Non-Preemptive Priority Queue Invariant:
 * 1. Tier 1 (`under_review`) stays pinned above Tier 2 (`pending_review`),
 *    even when a waiting ticket has a higher effective priority.
 * 2. Tier 2 (`pending_review`) is strictly sorted by descending effective priority,
 *    tie-broken by oldest `created_at`.
 * 3. Tier 3 (`resolved`) is sorted by most recent `resolved_at` descending.
 */
export function partitionAndSortQueue(
  tickets: Ticket[],
  nowMs = Date.now(),
): PriorityQueuePartition {
  const pinnedActive = tickets
    .filter((t) => t.status === "under_review")
    .sort((a, b) => {
      const aStarted = new Date(a.started_at ?? a.created_at).getTime();
      const bStarted = new Date(b.started_at ?? b.created_at).getTime();
      return aStarted - bStarted;
    });

  const waitingQueue = tickets
    .filter((t) => t.status === "pending_review")
    .sort((a, b) => {
      const diff =
        computeEffectivePriority(b, nowMs) - computeEffectivePriority(a, nowMs);
      if (Math.abs(diff) > 0.001) return diff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const resolvedTickets = tickets
    .filter((t) => t.status === "resolved")
    .sort((a, b) => {
      const aResolved = new Date(a.resolved_at ?? a.created_at).getTime();
      const bResolved = new Date(b.resolved_at ?? b.created_at).getTime();
      return bResolved - aResolved;
    });

  return { pinnedActive, waitingQueue, resolvedTickets };
}
