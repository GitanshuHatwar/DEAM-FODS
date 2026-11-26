export type AssetStatus = "active" | "under_maintenance" | "retired";

export type MaintenanceType = "preventive" | "corrective" | "inspection";

export interface PartReplaced {
  name: string;
  qty: number;
}

export interface AssetImage {
  id: string;
  asset_rfid: string;
  url: string;
  storage_path?: string;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface Incident {
  id: string;
  asset_rfid: string;
  ticket_id: string;
  summary: string;
  root_cause: string;
  resolution: string;
  parts_replaced: PartReplaced[];
  occurred_at: string;
  resolved_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface MaintenanceLog {
  id: string;
  asset_rfid: string;
  ticket_id: string | null;
  type: MaintenanceType;
  report: string;
  parts_replaced: PartReplaced[];
  performed_by: string;
  performed_by_name?: string;
  performed_at: string;
  next_due_date: string | null;
}

export type AssetHistoryItem =
  | {
      kind: "incident";
      id: string;
      timestamp: string;
      data: Incident;
    }
  | {
      kind: "maintenance";
      id: string;
      timestamp: string;
      data: MaintenanceLog;
    };

export interface Asset {
  rfid_uid: string;
  name: string;
  model: string;
  serial_no: string;
  location: string;
  criticality: 1 | 2 | 3 | 4 | 5;
  status: AssetStatus;
  install_date: string | null;
  warranty_expiry: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  notes: string | null;
  specs: Record<string, string>;
  archived_at: string | null;
  archived_by: string | null;
  images: AssetImage[];
  recent_incidents?: Incident[];
  recent_maintenance?: MaintenanceLog[];
}

export interface AssetCreateInput {
  rfid_uid: string;
  name: string;
  model: string;
  serial_no: string;
  location: string;
  criticality: 1 | 2 | 3 | 4 | 5;
  status: AssetStatus;
  install_date: string | null;
  warranty_expiry: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  notes: string | null;
  specs: Record<string, string>;
}

export type AssetUpdateInput = Omit<AssetCreateInput, "rfid_uid">;

export interface MaintenanceLogInput {
  type: MaintenanceType;
  report: string;
  parts_replaced: PartReplaced[];
  next_due_date: string | null;
}
