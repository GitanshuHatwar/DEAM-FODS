import type { AssetStatus, Incident, MaintenanceLog } from "./asset";
import type { TicketSeverity, TicketStatus, TriageMetadata } from "./ticket";

export type TapMode =
  | "start"
  | "closeout"
  | "asset_only"
  | "unknown_tag"
  | "archived_tag";

export type SSEConnectionState = "connected" | "reconnecting" | "offline";

export interface TapTicketSummary {
  id: string;
  ticket_number?: string;
  title: string;
  description: string;
  occurred_at: string;
  created_at?: string;
  status: TicketStatus;
  raised_by: {
    full_name: string;
  };
  workstation?: string | null;
  images: string[];
  severity: TicketSeverity;
  priority_score: number;
  priority_override?: number | null;
  priority: number;
  triage?: TriageMetadata;
}

export interface TapAssetSummary {
  rfid_uid: string;
  name: string;
  model: string;
  serial_no?: string;
  location: string;
  criticality: number;
  status: AssetStatus;
  install_date: string | null;
  warranty_expiry: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  notes?: string | null;
  specs?: Record<string, string>;
  archived_at?: string | null;
  images: string[];
  recent_incidents: Incident[];
  recent_maintenance: MaintenanceLog[];
}

export interface TapPayload {
  mode: TapMode;
  rfid_uid: string;
  tapped_at: string;
  scanner_code: string;
  ticket?: TapTicketSummary | null;
  other_open_tickets?: TapTicketSummary[];
  asset?: TapAssetSummary | null;
}
