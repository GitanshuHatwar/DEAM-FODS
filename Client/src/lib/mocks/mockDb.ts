import type {
  Asset,
  AssetCreateInput,
  AssetHistoryItem,
  AssetImage,
  AssetUpdateInput,
  MaintenanceLog,
  MaintenanceLogInput,
} from "@/types/asset";
import type {
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  ApiErrorEnvelope,
  AuditLogResponse,
  Scanner,
  ScannerCreateInput,
  ScannerKeyResponse,
  ScannerUpdateInput,
} from "@/types/admin";
import type { UserProfile } from "@/types/auth";
import type { TapPayload } from "@/types/tap";
import type {
  CreateTicketInput,
  ResolveTicketInput,
  Ticket,
} from "@/types/ticket";

const svgPlaceholder = (title: string, subtitle: string, accent = "#2E5D4B") => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#F8F6F3"/>
        <stop offset="100%" stop-color="#E8F3EF"/>
      </linearGradient>
    </defs>
    <rect width="800" height="520" fill="url(#bg)"/>
    <rect x="40" y="40" width="720" height="440" rx="24" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>
    <circle cx="110" cy="110" r="28" fill="${accent}" opacity="0.14"/>
    <rect x="94" y="94" width="32" height="32" rx="8" fill="${accent}"/>
    <text x="160" y="106" font-family="Inter, sans-serif" font-size="24" font-weight="700" fill="#0F172A">${title}</text>
    <text x="160" y="136" font-family="monospace" font-size="16" fill="#6B7280">${subtitle}</text>
    <rect x="90" y="185" width="620" height="220" rx="16" fill="#F4ECE1" opacity="0.65" stroke="#E5E7EB"/>
    <path d="M160 345 L285 245 L395 320 L485 260 L640 345 Z" fill="${accent}" opacity="0.22"/>
    <circle cx="240" cy="240" r="22" fill="#D99A45" opacity="0.5"/>
    <text x="400" y="390" text-anchor="middle" font-family="monospace" font-size="14" fill="#2E5D4B">DEAM-FODS · Diagnostic Visual Snapshot</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export interface MockDbState {
  users: AdminUser[];
  assets: Asset[];
  tickets: Ticket[];
  incidents: import("@/types/asset").Incident[];
  maintenanceLogs: MaintenanceLog[];
  scanners: Scanner[];
  auditLogs: import("@/types/admin").AuditLogEntry[];
  latestTap: TapPayload | null;
  lastTapByKey: Record<string, number>;
  nextTicketSeq: number;
}

const STORAGE_KEY = "deam_fods_mock_db_v1";

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysFromNowDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function createSeedState(): MockDbState {
  const users: AdminUser[] = [
    {
      id: "user-customer-1",
      email: "maya.lin@lab.deamfods.io",
      full_name: "Maya Lin",
      role: "customer",
      is_active: true,
      created_at: hoursAgoIso(24 * 60),
      ticket_count: 3,
    },
    {
      id: "user-customer-2",
      email: "alex.rivera@lab.deamfods.io",
      full_name: "Alex Rivera",
      role: "customer",
      is_active: true,
      created_at: hoursAgoIso(24 * 45),
      ticket_count: 3,
    },
    {
      id: "user-tech-1",
      email: "arjun.mehta@lab.deamfods.io",
      full_name: "Arjun Mehta",
      role: "technician",
      is_active: true,
      created_at: hoursAgoIso(24 * 90),
      created_by: "user-admin-1",
      ticket_count: 0,
    },
    {
      id: "user-admin-1",
      email: "elena.rostova@lab.deamfods.io",
      full_name: "Elena Rostova",
      role: "admin",
      is_active: true,
      created_at: hoursAgoIso(24 * 120),
      ticket_count: 0,
    },
    {
      id: "user-inactive-1",
      email: "sam.carter@lab.deamfods.io",
      full_name: "Sam Carter",
      role: "customer",
      is_active: false,
      created_at: hoursAgoIso(24 * 80),
      created_by: "user-admin-1",
      ticket_count: 0,
    },
  ];

  const assets: Asset[] = [
    {
      rfid_uid: "04A3B2C1",
      name: "Lab LaserJet Printer 04",
      model: "HP-M404dn",
      serial_no: "SN-HP-404-019",
      location: "Lab B · Desk 4",
      criticality: 4,
      status: "active",
      install_date: "2024-03-01",
      warranty_expiry: "2027-03-01",
      last_service_date: daysFromNowDate(-105),
      next_service_due: daysFromNowDate(-16), // overdue!
      notes: "Shared monochrome workgroup printer for Lab B workstations.",
      specs: {
        "IP Address": "10.4.2.18",
        Voltage: "220V AC",
        "Toner Cartridge": "CF258A",
        "Print Speed": "40 ppm",
      },
      archived_at: null,
      archived_by: null,
      images: [
        {
          id: "img-asset-04A3B2C1-1",
          asset_rfid: "04A3B2C1",
          url: svgPlaceholder("Lab LaserJet Printer 04", "RFID: 04A3B2C1 · HP-M404dn"),
          uploaded_at: hoursAgoIso(24 * 30),
        },
      ],
    },
    {
      rfid_uid: "04E719A2",
      name: "Prusa XL 5-Head 3D Printer",
      model: "Prusa-XL-5T",
      serial_no: "SN-PRX-2025-88",
      location: "Fabrication Bay · Bench 2",
      criticality: 5,
      status: "under_maintenance",
      install_date: "2025-01-14",
      warranty_expiry: "2028-01-14",
      last_service_date: daysFromNowDate(-40),
      next_service_due: daysFromNowDate(20),
      notes: "Toolhead 2 filament sensor calibrated during last quarterly check.",
      specs: {
        "Nozzle Diameter": "0.4 mm Hardened",
        "Build Volume": "360 × 360 × 360 mm",
        Power: "350W / 24V",
        Firmware: "6.1.3",
      },
      archived_at: null,
      archived_by: null,
      images: [
        {
          id: "img-asset-04E719A2-1",
          asset_rfid: "04E719A2",
          url: svgPlaceholder("Prusa XL 5-Head 3D Printer", "RFID: 04E719A2 · Toolhead 2 Inspection", "#D99A45"),
          uploaded_at: hoursAgoIso(24 * 12),
        },
      ],
    },
    {
      rfid_uid: "0488C1D0",
      name: "Keysight Digital Oscilloscope",
      model: "DSOX1204G",
      serial_no: "SN-KY-1204-44",
      location: "Electronics Lab · Station 1",
      criticality: 5,
      status: "active",
      install_date: "2024-07-22",
      warranty_expiry: "2027-07-22",
      last_service_date: daysFromNowDate(-22),
      next_service_due: daysFromNowDate(158),
      notes: "Primary 4-channel scope; calibrated for signal integrity lab.",
      specs: {
        Bandwidth: "200 MHz",
        Channels: "4 Analog + WaveGen",
        "Sample Rate": "2 GSa/s",
        Calibration: "ISO-17025 Valid",
      },
      archived_at: null,
      archived_by: null,
      images: [
        {
          id: "img-asset-0488C1D0-1",
          asset_rfid: "0488C1D0",
          url: svgPlaceholder("Keysight Oscilloscope", "RFID: 0488C1D0 · DSOX1204G", "#648DAA"),
          uploaded_at: hoursAgoIso(24 * 22),
        },
      ],
    },
    {
      rfid_uid: "04F19B33",
      name: "Haas Desktop CNC Mill",
      model: "OM-1A",
      serial_no: "SN-HS-019-7",
      location: "Machining Bay · Cell 3",
      criticality: 5,
      status: "active",
      install_date: "2023-11-10",
      warranty_expiry: "2026-12-30",
      last_service_date: daysFromNowDate(-95),
      next_service_due: daysFromNowDate(-5), // overdue!
      notes: "High-speed spindle assembly; requires coolant mist verification.",
      specs: {
        "Max Spindle": "30,000 RPM",
        "Power Supply": "1.5 kW / 230V",
        Coolant: "Air / Mist",
        Controller: "Haas NGC",
      },
      archived_at: null,
      archived_by: null,
      images: [
        {
          id: "img-asset-04F19B33-1",
          asset_rfid: "04F19B33",
          url: svgPlaceholder("Haas Desktop CNC Mill", "RFID: 04F19B33 · Machining Bay", "#DC6464"),
          uploaded_at: hoursAgoIso(24 * 60),
        },
      ],
    },
    {
      rfid_uid: "04D45590",
      name: 'Dell UltraSharp 27" Monitor',
      model: "U2723QE",
      serial_no: "SN-DL-2723-112",
      location: "Lab A · Desk 7",
      criticality: 2,
      status: "active",
      install_date: "2025-02-05",
      warranty_expiry: "2028-02-05",
      last_service_date: daysFromNowDate(-30),
      next_service_due: daysFromNowDate(150),
      notes: "Workstation display with integrated 90W USB-C dock.",
      specs: {
        Resolution: "3840 × 2160 (4K)",
        Panel: "IPS Black",
        "Power Delivery": "90W USB-C",
      },
      archived_at: null,
      archived_by: null,
      images: [],
    },
    {
      rfid_uid: "04AA1122",
      name: "Legacy Solder Fume Extractor",
      model: "BOFA-AD350",
      serial_no: "SN-BF-350-09",
      location: "Storage Vault · Shelf B",
      criticality: 2,
      status: "retired",
      install_date: "2020-05-12",
      warranty_expiry: "2023-05-12",
      last_service_date: "2026-06-01",
      next_service_due: null,
      notes: "Decommissioned and replaced by dual-stage filtration unit.",
      specs: {
        Airflow: "380 m³/h",
        Filter: "HEPA + Carbon",
      },
      archived_at: hoursAgoIso(24 * 35),
      archived_by: "user-admin-1",
      images: [],
    },
  ];

  const incidents: import("@/types/asset").Incident[] = [
    {
      id: "inc-098",
      asset_rfid: "04A3B2C1",
      ticket_id: "tkt-098",
      summary: "Paper feed roller slipping on tray 2",
      root_cause: "Worn pickup rubber rollers causing misfeeds on heavyweight paper.",
      resolution: "Replaced tray 2 pickup & separation roller assembly and cleaned sensors.",
      parts_replaced: [{ name: "RM2-5452 Pickup Roller Kit", qty: 1 }],
      occurred_at: hoursAgoIso(24 * 14),
      resolved_at: hoursAgoIso(24 * 13),
      created_by: "user-tech-1",
      created_by_name: "Arjun Mehta",
    },
    {
      id: "inc-097",
      asset_rfid: "0488C1D0",
      ticket_id: "tkt-097",
      summary: "Probe channel 3 compensation drift",
      root_cause: "Loose BNC collar and uncalibrated passive probe trimmer capacitor.",
      resolution: "Re-seated probe collar and calibrated 1kHz square wave compensation.",
      parts_replaced: [],
      occurred_at: hoursAgoIso(24 * 24),
      resolved_at: hoursAgoIso(24 * 23),
      created_by: "user-tech-1",
      created_by_name: "Arjun Mehta",
    },
  ];

  const maintenanceLogs: MaintenanceLog[] = [
    {
      id: "mnt-101",
      asset_rfid: "04A3B2C1",
      ticket_id: "tkt-098",
      type: "corrective",
      report: "Installed new pickup roller kit and ran 30-page tray 2 stress test.",
      parts_replaced: [{ name: "RM2-5452 Pickup Roller Kit", qty: 1 }],
      performed_by: "user-tech-1",
      performed_by_name: "Arjun Mehta",
      performed_at: hoursAgoIso(24 * 13),
      next_due_date: daysFromNowDate(-16),
    },
    {
      id: "mnt-102",
      asset_rfid: "0488C1D0",
      ticket_id: null,
      type: "preventive",
      report: "Quarterly calibration verification across all 4 analog channels. Passed within ±0.5%.",
      parts_replaced: [],
      performed_by: "user-tech-1",
      performed_by_name: "Arjun Mehta",
      performed_at: hoursAgoIso(24 * 22),
      next_due_date: daysFromNowDate(158),
    },
    {
      id: "mnt-103",
      asset_rfid: "04E719A2",
      ticket_id: null,
      type: "inspection",
      report: "Checked belt tension and lubricated linear rails on X/Y gantry.",
      parts_replaced: [{ name: "PTFE Linear Lubricant Tube", qty: 1 }],
      performed_by: "user-tech-1",
      performed_by_name: "Arjun Mehta",
      performed_at: hoursAgoIso(24 * 40),
      next_due_date: daysFromNowDate(20),
    },
  ];

  const tickets: Ticket[] = [
    {
      id: "tkt-101",
      ticket_number: "#101",
      asset_rfid: "04E719A2",
      asset_name: "Prusa XL 5-Head 3D Printer",
      asset_location: "Fabrication Bay · Bench 2",
      asset_model: "Prusa-XL-5T",
      asset_criticality: 5,
      raised_by: "user-customer-1",
      raised_by_name: "Maya Lin",
      workstation: "Bench 2 · Toolhead Bay",
      title: "Extruder stepper clicking on toolhead 2",
      description:
        "Midway through PETG calibration print, toolhead 2 started clicking loudly and under-extruding layers. Filament feed stalls above 15 mm/s.",
      occurred_at: hoursAgoIso(5.2),
      status: "under_review",
      images: [
        svgPlaceholder("Toolhead 2 Under-Extrusion", "Ticket #101 · Fault Evidence", "#D99A45"),
      ],
      priority_score: 68,
      priority_override: null,
      severity: "high",
      triage: {
        mode: "rule_based",
        ai_status: "done",
        severity: "high",
        base_score: 68,
        safety_risk: false,
        probable_cause: "Partial nozzle clog or idler tension drift on Nextruder gear.",
        summary: "HIGH priority: criticality 5 asset with active print stoppage.",
        factors: [
          { label: "Device Criticality (5/5 × 6)", points: 30 },
          { label: "Complete Stoppage / Feed Stall", points: 23 },
          { label: "Shared Lab / Operational Impact", points: 10 },
          { label: "Diagnostic Photo Attached", points: 5 },
        ],
      },
      started_at: hoursAgoIso(1.4),
      started_by: "user-tech-1",
      started_by_name: "Arjun Mehta",
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      status_history: [
        {
          id: "sh-101-1",
          ticket_id: "tkt-101",
          from_status: null,
          to_status: "pending_review",
          changed_by: "user-customer-1",
          changed_by_name: "Maya Lin",
          via: "form",
          changed_at: hoursAgoIso(5),
        },
        {
          id: "sh-101-2",
          ticket_id: "tkt-101",
          from_status: "pending_review",
          to_status: "under_review",
          changed_by: "user-tech-1",
          changed_by_name: "Arjun Mehta",
          via: "tap",
          changed_at: hoursAgoIso(1.4),
        },
      ],
      created_at: hoursAgoIso(5),
    },
    {
      id: "tkt-102",
      ticket_number: "#102",
      asset_rfid: "04F19B33",
      asset_name: "Haas Desktop CNC Mill",
      asset_location: "Machining Bay · Cell 3",
      asset_model: "OM-1A",
      asset_criticality: 5,
      raised_by: "user-customer-2",
      raised_by_name: "Alex Rivera",
      workstation: "Cell 3 · Aluminum Fixture",
      title: "Spindle overheating and burning smell under load",
      description:
        "During 18,000 RPM finishing pass on aluminum bracket, spindle housing grew hot to touch and emitted a faint burning odor. Stopped cycle immediately via E-stop.",
      occurred_at: hoursAgoIso(2.3),
      status: "pending_review",
      images: [
        svgPlaceholder("CNC Spindle Thermal Alert", "Ticket #102 · Safety Hazard Flagged", "#DC6464"),
      ],
      priority_score: 95,
      priority_override: null,
      severity: "critical",
      triage: {
        mode: "rule_based",
        ai_status: "done",
        severity: "critical",
        base_score: 95,
        safety_risk: true,
        probable_cause: "Potential spindle bearing seizure or cooling fan failure.",
        summary: "CRITICAL safety hazard detected (overheating + burning odor).",
        factors: [
          { label: "Device Criticality (5/5 × 6)", points: 30 },
          { label: "Safety / Hazard Keyword Boost", points: 45 },
          { label: "Shared Lab / Operational Impact", points: 10 },
          { label: "Diagnostic Photo Attached", points: 5 },
          { label: "Maintenance Service Overdue", points: 5 },
        ],
      },
      started_at: null,
      started_by: null,
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      status_history: [
        {
          id: "sh-102-1",
          ticket_id: "tkt-102",
          from_status: null,
          to_status: "pending_review",
          changed_by: "user-customer-2",
          changed_by_name: "Alex Rivera",
          via: "form",
          changed_at: hoursAgoIso(2),
        },
      ],
      created_at: hoursAgoIso(2),
    },
    {
      id: "tkt-105",
      ticket_number: "#105",
      asset_rfid: "04A3B2C1",
      asset_name: "Lab LaserJet Printer 04",
      asset_location: "Lab B · Desk 4",
      asset_model: "HP-M404dn",
      asset_criticality: 4,
      raised_by: "user-customer-1",
      raised_by_name: "Maya Lin",
      workstation: "Desk 4 · Shared Print Queue",
      title: "Printer offline at Desk 4 — amber warning LED",
      description:
        "Power indicator blinking amber; jobs stuck in spooler across all Lab B machines. Power cycling did not clear the fuser error.",
      occurred_at: hoursAgoIso(3.5),
      status: "pending_review",
      images: [
        svgPlaceholder("Amber Fault LED on M404dn", "Ticket #105 · Lab B Desk 4", "#2E5D4B"),
      ],
      priority_score: 76,
      priority_override: null,
      severity: "high",
      triage: {
        mode: "rule_based",
        ai_status: "done",
        severity: "high",
        base_score: 76,
        safety_risk: false,
        probable_cause: "Fuser thermistor fault or network interface drop.",
        summary: "HIGH priority: shared Lab B printer offline with overdue service.",
        factors: [
          { label: "Device Criticality (4/5 × 6)", points: 24 },
          { label: "Complete Stoppage / Offline Impact", points: 32 },
          { label: "Shared Lab / Operational Impact", points: 10 },
          { label: "Diagnostic Photo Attached", points: 5 },
          { label: "Maintenance Service Overdue", points: 5 },
        ],
      },
      started_at: null,
      started_by: null,
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      status_history: [
        {
          id: "sh-105-1",
          ticket_id: "tkt-105",
          from_status: null,
          to_status: "pending_review",
          changed_by: "user-customer-1",
          changed_by_name: "Maya Lin",
          via: "form",
          changed_at: hoursAgoIso(3),
        },
      ],
      created_at: hoursAgoIso(3),
    },
    {
      id: "tkt-104",
      ticket_number: "#104",
      asset_rfid: "04D45590",
      asset_name: 'Dell UltraSharp 27" Monitor',
      asset_location: "Lab A · Desk 7",
      asset_model: "U2723QE",
      asset_criticality: 2,
      raised_by: "user-customer-2",
      raised_by_name: "Alex Rivera",
      workstation: "Desk 7",
      title: "USB-C downstream keyboard port intermittent",
      description:
        "Display output works fine over DisplayPort, but the built-in USB-A hub drops mouse/keyboard every 20 minutes.",
      occurred_at: hoursAgoIso(8.5),
      status: "pending_review",
      images: [],
      priority_score: 32,
      priority_override: null,
      severity: "low",
      triage: {
        mode: "rule_based",
        ai_status: "done",
        severity: "low",
        base_score: 32,
        safety_risk: false,
        probable_cause: "USB-C upstream cable strain or hub sleep firmware setting.",
        summary: "LOW priority: secondary peripheral port issue; display remains usable.",
        factors: [
          { label: "Device Criticality (2/5 × 6)", points: 12 },
          { label: "Degraded Performance Indicator", points: 20 },
        ],
      },
      started_at: null,
      started_by: null,
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      status_history: [
        {
          id: "sh-104-1",
          ticket_id: "tkt-104",
          from_status: null,
          to_status: "pending_review",
          changed_by: "user-customer-2",
          changed_by_name: "Alex Rivera",
          via: "form",
          changed_at: hoursAgoIso(8),
        },
      ],
      created_at: hoursAgoIso(8),
    },
    {
      id: "tkt-098",
      ticket_number: "#098",
      asset_rfid: "04A3B2C1",
      asset_name: "Lab LaserJet Printer 04",
      asset_location: "Lab B · Desk 4",
      asset_model: "HP-M404dn",
      asset_criticality: 4,
      raised_by: "user-customer-1",
      raised_by_name: "Maya Lin",
      workstation: "Desk 4",
      title: "Paper feed roller slipping on tray 2",
      description: "Tray 2 fails to pull cardstock and jams after 2–3 sheets.",
      occurred_at: hoursAgoIso(24 * 14),
      status: "resolved",
      images: [],
      priority_score: 64,
      priority_override: null,
      severity: "high",
      triage: {
        mode: "rule_based",
        ai_status: "done",
        severity: "high",
        base_score: 64,
        safety_risk: false,
        summary: "HIGH priority resolved via physical tap close-out.",
        factors: [
          { label: "Device Criticality (4/5 × 6)", points: 24 },
          { label: "Complete Stoppage / Jam", points: 30 },
          { label: "Shared Lab / Operational Impact", points: 10 },
        ],
      },
      started_at: hoursAgoIso(24 * 13.5),
      started_by: "user-tech-1",
      started_by_name: "Arjun Mehta",
      resolved_at: hoursAgoIso(24 * 13),
      resolved_by: "user-tech-1",
      resolution: {
        root_cause: "Worn pickup rubber rollers causing misfeeds on heavyweight paper.",
        resolution: "Replaced tray 2 pickup & separation roller assembly and cleaned sensors.",
        parts_replaced: [{ name: "RM2-5452 Pickup Roller Kit", qty: 1 }],
        resolved_at: hoursAgoIso(24 * 13),
        resolved_by_name: "Arjun Mehta",
        report: "Installed new pickup roller kit and ran 30-page tray 2 stress test.",
      },
      status_history: [
        {
          id: "sh-098-1",
          ticket_id: "tkt-098",
          from_status: null,
          to_status: "pending_review",
          changed_by: "user-customer-1",
          changed_by_name: "Maya Lin",
          via: "form",
          changed_at: hoursAgoIso(24 * 14),
        },
        {
          id: "sh-098-2",
          ticket_id: "tkt-098",
          from_status: "pending_review",
          to_status: "under_review",
          changed_by: "user-tech-1",
          changed_by_name: "Arjun Mehta",
          via: "tap",
          changed_at: hoursAgoIso(24 * 13.5),
        },
        {
          id: "sh-098-3",
          ticket_id: "tkt-098",
          from_status: "under_review",
          to_status: "resolved",
          changed_by: "user-tech-1",
          changed_by_name: "Arjun Mehta",
          via: "form",
          changed_at: hoursAgoIso(24 * 13),
        },
      ],
      created_at: hoursAgoIso(24 * 14),
    },
    {
      id: "tkt-097",
      ticket_number: "#097",
      asset_rfid: "0488C1D0",
      asset_name: "Keysight Digital Oscilloscope",
      asset_location: "Electronics Lab · Station 1",
      asset_model: "DSOX1204G",
      asset_criticality: 5,
      raised_by: "user-customer-2",
      raised_by_name: "Alex Rivera",
      workstation: "Station 1",
      title: "Probe channel 3 compensation drift",
      description: "1 kHz reference square wave shows noticeable overshoot on CH3.",
      occurred_at: hoursAgoIso(24 * 24),
      status: "resolved",
      images: [],
      priority_score: 52,
      priority_override: null,
      severity: "medium",
      triage: {
        mode: "rule_based",
        ai_status: "done",
        severity: "medium",
        base_score: 52,
        safety_risk: false,
        summary: "MEDIUM priority calibration resolved.",
        factors: [
          { label: "Device Criticality (5/5 × 6)", points: 30 },
          { label: "Degraded Performance Indicator", points: 22 },
        ],
      },
      started_at: hoursAgoIso(24 * 23.5),
      started_by: "user-tech-1",
      started_by_name: "Arjun Mehta",
      resolved_at: hoursAgoIso(24 * 23),
      resolved_by: "user-tech-1",
      resolution: {
        root_cause: "Loose BNC collar and uncalibrated passive probe trimmer capacitor.",
        resolution: "Re-seated probe collar and calibrated 1kHz square wave compensation.",
        parts_replaced: [],
        resolved_at: hoursAgoIso(24 * 23),
        resolved_by_name: "Arjun Mehta",
      },
      created_at: hoursAgoIso(24 * 24),
    },
  ];

  const scanners: Scanner[] = [
    {
      id: "scn-1",
      scanner_code: "SCN-001",
      location: "Lab B · Main Bench",
      is_active: true,
      last_seen_at: new Date(Date.now() - 2 * 60_000).toISOString(),
      created_at: hoursAgoIso(24 * 60),
      created_by: "user-admin-1",
    },
    {
      id: "scn-2",
      scanner_code: "SCN-002",
      location: "Fabrication Bay · Handheld",
      is_active: true,
      last_seen_at: new Date(Date.now() - 18 * 60_000).toISOString(),
      created_at: hoursAgoIso(24 * 45),
      created_by: "user-admin-1",
    },
    {
      id: "scn-3",
      scanner_code: "SCN-003",
      location: "Storage Vault · Desk",
      is_active: false,
      last_seen_at: hoursAgoIso(24 * 4),
      created_at: hoursAgoIso(24 * 30),
      created_by: "user-admin-1",
    },
  ];

  const auditLogs: import("@/types/admin").AuditLogEntry[] = [
    {
      id: "aud-1",
      actor_id: "user-admin-1",
      actor_name: "Elena Rostova",
      actor_email: "elena.rostova@lab.deamfods.io",
      action: "device.archived",
      target_type: "device",
      target_id: "04AA1122",
      details: {
        from: { archived_at: null, status: "active" },
        to: { archived_at: hoursAgoIso(24 * 35), status: "retired" },
      },
      created_at: hoursAgoIso(24 * 35),
    },
    {
      id: "aud-2",
      actor_id: "user-admin-1",
      actor_name: "Elena Rostova",
      actor_email: "elena.rostova@lab.deamfods.io",
      action: "scanner.created",
      target_type: "scanner",
      target_id: "SCN-002",
      details: {
        to: { scanner_code: "SCN-002", location: "Fabrication Bay · Handheld", is_active: true },
      },
      created_at: hoursAgoIso(24 * 45),
    },
    {
      id: "aud-3",
      actor_id: "user-admin-1",
      actor_name: "Elena Rostova",
      actor_email: "elena.rostova@lab.deamfods.io",
      action: "user.deactivated",
      target_type: "user",
      target_id: "user-inactive-1",
      details: {
        from: { is_active: true },
        to: { is_active: false },
      },
      created_at: hoursAgoIso(24 * 12),
    },
  ];

  return {
    users,
    assets,
    tickets,
    incidents,
    maintenanceLogs,
    scanners,
    auditLogs,
    latestTap: null,
    lastTapByKey: {},
    nextTicketSeq: 106,
  };
}

let inMemoryDb: MockDbState | null = null;

export function getMockDb(): MockDbState {
  if (inMemoryDb) return inMemoryDb;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryDb = JSON.parse(raw) as MockDbState;
      return inMemoryDb;
    }
  } catch {
    // Fallback to seed if storage unavailable
  }
  inMemoryDb = createSeedState();
  saveMockDb(inMemoryDb);
  return inMemoryDb;
}

export function saveMockDb(db: MockDbState): void {
  inMemoryDb = db;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors in mock mode
  }
}

export function resetMockDb(): MockDbState {
  const seed = createSeedState();
  saveMockDb(seed);
  return seed;
}

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export function throwApiError(
  status: number,
  code: ApiErrorEnvelope["error"]["code"],
  message: string,
): never {
  throw new ApiClientError(status, code, message);
}

export type MockSessionStore = {
  currentUserId: string | null;
};

const SESSION_KEY = "deam_fods_mock_session_v1";

export function getMockCurrentUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setMockCurrentUserId(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function getMockCurrentUser(): UserProfile | null {
  const userId = getMockCurrentUserId();
  if (!userId) return null;
  const db = getMockDb();
  return db.users.find((u) => u.id === userId) ?? null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export type MockApiTransport = {
  getMe: () => Promise<UserProfile>;
  listAssets: (params?: {
    include_archived?: boolean;
    q?: string;
    status?: string;
    criticality?: number;
  }) => Promise<Asset[]>;
  lookupAsset: (rfid: string) => Promise<Asset>;
  getAsset: (rfid: string) => Promise<Asset>;
  createAsset: (input: AssetCreateInput) => Promise<Asset>;
  updateAsset: (rfid: string, input: AssetUpdateInput) => Promise<Asset>;
  uploadAssetImage: (rfid: string, file: File) => Promise<AssetImage>;
  deleteAssetImage: (rfid: string, imageId: string) => Promise<void>;
  getAssetHistory: (rfid: string) => Promise<AssetHistoryItem[]>;
  addMaintenanceLog: (rfid: string, input: MaintenanceLogInput) => Promise<MaintenanceLog>;
  archiveAsset: (rfid: string) => Promise<Asset>;
  restoreAsset: (rfid: string) => Promise<Asset>;
  rekeyAsset: (rfid: string, newRfid: string) => Promise<Asset>;
  deleteAsset: (rfid: string) => Promise<void>;
  listTickets: (params?: { status?: string }) => Promise<Ticket[]>;
  getTicket: (id: string) => Promise<Ticket>;
  createTicket: (input: CreateTicketInput) => Promise<Ticket>;
  overrideTicketPriority: (
    id: string,
    priorityOverride: number | null,
  ) => Promise<Ticket>;
  resolveTicket: (id: string, input: ResolveTicketInput) => Promise<Ticket>;
  getLatestTap: () => Promise<TapPayload | null>;
  adminListUsers: (params?: {
    role?: string;
    active?: string;
    q?: string;
  }) => Promise<AdminUser[]>;
  adminGetUser: (id: string) => Promise<AdminUser>;
  adminCreateUser: (input: AdminUserCreateInput) => Promise<AdminUser>;
  adminUpdateUser: (id: string, input: AdminUserUpdateInput) => Promise<AdminUser>;
  adminDeactivateUser: (id: string) => Promise<AdminUser>;
  adminReactivateUser: (id: string) => Promise<AdminUser>;
  adminResetPassword: (id: string, password: string) => Promise<{ ok: true }>;
  adminDeleteUser: (id: string) => Promise<void>;
  adminListScanners: () => Promise<Scanner[]>;
  adminCreateScanner: (input: ScannerCreateInput) => Promise<ScannerKeyResponse>;
  adminUpdateScanner: (id: string, input: ScannerUpdateInput) => Promise<Scanner>;
  adminRotateScannerKey: (id: string) => Promise<ScannerKeyResponse>;
  adminListAuditLogs: (params?: {
    actor?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
  }) => Promise<AuditLogResponse>;
};
