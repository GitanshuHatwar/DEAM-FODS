import type { PartReplaced } from "./asset";

export type TicketStatus = "pending_review" | "under_review" | "resolved";

export type TicketSeverity = "critical" | "high" | "medium" | "low";

export type TriageMode = "rule_based" | "gemini" | "fallback";

export interface TicketStatusHistoryEntry {
  id: string;
  ticket_id: string;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  changed_by: string;
  changed_by_name?: string;
  via: "tap" | "form" | "system";
  changed_at: string;
}

export interface TriageFactor {
  label: string;
  points: number;
}

export interface TriageMetadata {
  mode: TriageMode;
  ai_status: "pending" | "done" | "fallback";
  severity: TicketSeverity;
  base_score: number;
  safety_risk: boolean;
  probable_cause?: string | null;
  summary?: string | null;
  factors: TriageFactor[];
}

export interface TicketResolution {
  root_cause: string;
  resolution: string;
  parts_replaced: PartReplaced[];
  resolved_at: string;
  resolved_by_name?: string;
  report?: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  asset_rfid: string;
  asset_name: string;
  asset_location: string;
  asset_model?: string;
  asset_criticality?: number;
  raised_by: string;
  raised_by_name: string;
  workstation?: string | null;
  title: string;
  description: string;
  occurred_at: string;
  status: TicketStatus;
  images: string[];
  priority_score: number;
  priority_override: number | null;
  severity: TicketSeverity;
  triage: TriageMetadata;
  started_at: string | null;
  started_by: string | null;
  started_by_name?: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution?: TicketResolution | null;
  status_history?: TicketStatusHistoryEntry[];
  created_at: string;
}

export interface CreateTicketInput {
  asset_rfid: string;
  title: string;
  description: string;
  occurred_at: string;
  workstation?: string;
  images: File[];
}

export interface ResolveTicketInput {
  root_cause: string;
  resolution: string;
  parts_replaced: PartReplaced[];
  asset_updates: {
    status: "active" | "under_maintenance" | "retired";
    next_service_due: string | null;
    notes: string | null;
  };
  report?: string;
}
