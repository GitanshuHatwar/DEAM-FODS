import type { Role, UserProfile } from "./auth";

export interface AdminUser extends UserProfile {
  created_by?: string | null;
  ticket_count?: number;
}

export interface AdminUserCreateInput {
  email: string;
  full_name: string;
  role: Role;
  password: string;
}

export interface AdminUserUpdateInput {
  full_name?: string;
  role?: Role;
}

export interface Scanner {
  id: string;
  scanner_code: string;
  location: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface ScannerCreateInput {
  scanner_code: string;
  location: string;
}

export interface ScannerUpdateInput {
  location?: string;
  is_active?: boolean;
}

export interface ScannerKeyResponse {
  scanner: Scanner;
  device_key: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_email?: string;
  action: string;
  target_type: "user" | "device" | "scanner" | "ticket";
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export type ApiErrorCode =
  | "invalid_token"
  | "inactive_user"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "invalid_transition"
  | "invalid_device"
  | "unknown_asset"
  | "archived_asset"
  | "duplicate_rfid"
  | "duplicate_email"
  | "file_too_large"
  | "too_many_images"
  | "unsupported_file_type"
  | "has_linked_records"
  | "last_admin"
  | "self_action_not_allowed"
  | "network_error"
  | "unknown_error";

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode | string;
    message: string;
  };
}
