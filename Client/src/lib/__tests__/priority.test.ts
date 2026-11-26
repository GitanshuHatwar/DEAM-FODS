import { describe, expect, it } from "vitest";
import {
  computeEffectivePriority,
  evaluateRuleBasedTriage,
  partitionAndSortQueue,
} from "@/lib/priority";
import type { Ticket } from "@/types/ticket";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "tkt-1",
  ticket_number: "#1",
  asset_rfid: "04A3B2C1",
  asset_name: "Test Printer",
  asset_location: "Lab B",
  raised_by: "user-1",
  raised_by_name: "Maya Lin",
  title: "Fault",
  description: "Detailed description of issue",
  occurred_at: "2026-11-26T09:00:00Z",
  status: "pending_review",
  images: [],
  priority_score: 50,
  priority_override: null,
  severity: "medium",
  triage: {
    mode: "rule_based",
    ai_status: "done",
    severity: "medium",
    base_score: 50,
    safety_risk: false,
    factors: [],
  },
  started_at: null,
  started_by: null,
  resolved_at: null,
  resolved_by: null,
  created_at: "2026-11-26T10:00:00Z",
  ...overrides,
});

describe("Priority Queue & Non-Preemptive Invariant", () => {
  const nowMs = new Date("2026-11-26T12:00:00Z").getTime();

  it("caps aging bonus at +10 points regardless of age", () => {
    const ancientTicket = makeTicket({
      priority_score: 60,
      created_at: "2026-10-01T00:00:00Z", // > 1000 hours open
    });
    expect(computeEffectivePriority(ancientTicket, nowMs)).toBe(70);
  });

  it("gives priority_override strict precedence over computed score and aging", () => {
    const overridden = makeTicket({
      priority_score: 40,
      priority_override: 88,
      created_at: "2026-10-01T00:00:00Z",
    });
    expect(computeEffectivePriority(overridden, nowMs)).toBe(88);
  });

  it("keeps lower-scoring under_review ticket pinned above higher-scoring pending_review tickets", () => {
    const activeLow = makeTicket({
      id: "tkt-active",
      status: "under_review",
      priority_score: 65,
      started_at: "2026-11-26T11:00:00Z",
      created_at: "2026-11-26T10:00:00Z",
    });
    const pendingHigh = makeTicket({
      id: "tkt-urgent",
      status: "pending_review",
      priority_score: 95,
      severity: "critical",
      created_at: "2026-11-26T11:50:00Z",
    });
    const pendingMid = makeTicket({
      id: "tkt-mid",
      status: "pending_review",
      priority_score: 72,
      created_at: "2026-11-26T11:00:00Z",
    });

    const result = partitionAndSortQueue(
      [pendingMid, pendingHigh, activeLow],
      nowMs,
    );

    expect(result.pinnedActive.map((t) => t.id)).toEqual(["tkt-active"]);
    expect(result.waitingQueue.map((t) => t.id)).toEqual([
      "tkt-urgent",
      "tkt-mid",
    ]);
  });

  it("flags safety keywords and clamps deterministic triage score within 0-100", () => {
    const res = evaluateRuleBasedTriage({
      title: "Spindle burning and smoke detected",
      description: "Electrical spark near CNC power supply",
      asset: { criticality: 5, next_service_due: "2026-01-01" },
      hasImages: true,
      nowMs,
    });
    expect(res.triage.safety_risk).toBe(true);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.severity).toBe("critical");
  });
});
