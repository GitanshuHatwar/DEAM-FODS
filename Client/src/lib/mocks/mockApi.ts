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
  Scanner,
  ScannerCreateInput,
  ScannerKeyResponse,
  ScannerUpdateInput,
} from "@/types/admin";
import type { UserProfile } from "@/types/auth";
import type { TapAssetSummary, TapPayload, TapTicketSummary } from "@/types/tap";
import type { CreateTicketInput, ResolveTicketInput, Ticket } from "@/types/ticket";
import { computeEffectivePriority, evaluateRuleBasedTriage } from "@/lib/priority";
import { isValidRfidFormat, normalizeRfid } from "@/lib/rfid";
import {
  fileToDataUrl,
  getMockCurrentUser,
  getMockDb,
  saveMockDb,
  throwApiError,
  type MockApiTransport,
} from "./mockDb";
import { mockTapBus } from "./mockTapBus";

const sleep = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

function requireActiveUser(): AdminUser {
  const current = getMockCurrentUser();
  if (!current) {
    throwApiError(401, "invalid_token", "Authentication required.");
  }
  if (!current.is_active) {
    throwApiError(
      403,
      "inactive_user",
      "Your account has been deactivated by an administrator.",
    );
  }
  return current;
}

function requireRole(allowed: Array<UserProfile["role"]>): AdminUser {
  const user = requireActiveUser();
  if (!allowed.includes(user.role)) {
    throwApiError(403, "forbidden", "You do not have permission for this action.");
  }
  return user;
}

function enrichAsset(asset: Asset): Asset {
  const db = getMockDb();
  const recent_incidents = db.incidents
    .filter((i) => i.asset_rfid === asset.rfid_uid)
    .sort((a, b) => new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime())
    .slice(0, 5);

  const recent_maintenance = db.maintenanceLogs
    .filter((m) => m.asset_rfid === asset.rfid_uid)
    .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
    .slice(0, 5);

  return {
    ...asset,
    recent_incidents,
    recent_maintenance,
  };
}

function toTapTicketSummary(ticket: Ticket): TapTicketSummary {
  return {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    title: ticket.title,
    description: ticket.description,
    occurred_at: ticket.occurred_at,
    created_at: ticket.created_at,
    status: ticket.status,
    raised_by: { full_name: ticket.raised_by_name },
    workstation: ticket.workstation,
    images: ticket.images,
    severity: ticket.severity,
    priority_score: ticket.priority_score,
    priority_override: ticket.priority_override,
    priority: computeEffectivePriority(ticket),
    triage: ticket.triage,
  };
}

function toTapAssetSummary(asset: Asset): TapAssetSummary {
  const enriched = enrichAsset(asset);
  return {
    rfid_uid: enriched.rfid_uid,
    name: enriched.name,
    model: enriched.model,
    serial_no: enriched.serial_no,
    location: enriched.location,
    criticality: enriched.criticality,
    status: enriched.status,
    install_date: enriched.install_date,
    warranty_expiry: enriched.warranty_expiry,
    last_service_date: enriched.last_service_date,
    next_service_due: enriched.next_service_due,
    notes: enriched.notes,
    specs: enriched.specs,
    archived_at: enriched.archived_at,
    images: enriched.images.map((i) => i.url),
    recent_incidents: enriched.recent_incidents ?? [],
    recent_maintenance: enriched.recent_maintenance ?? [],
  };
}

function appendAudit(
  actor: AdminUser,
  action: string,
  target_type: "user" | "device" | "scanner" | "ticket",
  target_id: string,
  details: Record<string, unknown>,
) {
  const db = getMockDb();
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_email: actor.email,
    action,
    target_type,
    target_id,
    details,
    created_at: new Date().toISOString(),
  });
  saveMockDb(db);
}

/**
 * Simulates an ESP32 hardware tap (POST /rfid/tap) and broadcasts SSE payload to MockTapBus.
 */
export async function simulateRfidTap(
  rawRfid: string,
  scannerCode = "SCN-001",
): Promise<TapPayload> {
  await sleep(160);
  const actor = requireRole(["technician", "admin"]);
  const db = getMockDb();
  const rfid = normalizeRfid(rawRfid);
  const nowIso = new Date().toISOString();

  // 3-second debounce check
  const debounceKey = `${scannerCode}:${rfid}`;
  const lastTapMs = db.lastTapByKey[debounceKey];
  if (lastTapMs && Date.now() - lastTapMs < 3000) {
    throwApiError(429, "validation_error", "Duplicate RFID tap within 3-second debounce window.");
  }
  db.lastTapByKey[debounceKey] = Date.now();

  const scanner = db.scanners.find((s) => s.scanner_code === scannerCode);
  if (scanner) {
    scanner.last_seen_at = nowIso;
  }

  const asset = db.assets.find((a) => a.rfid_uid === rfid);

  // Rule 1: Unknown tag
  if (!asset) {
    const payload: TapPayload = {
      mode: "unknown_tag",
      rfid_uid: rfid,
      tapped_at: nowIso,
      scanner_code: scannerCode,
      ticket: null,
      other_open_tickets: [],
      asset: null,
    };
    db.latestTap = payload;
    saveMockDb(db);
    mockTapBus.emit(payload);
    return payload;
  }

  // Rule 2: Archived tag
  if (asset.archived_at) {
    const payload: TapPayload = {
      mode: "archived_tag",
      rfid_uid: rfid,
      tapped_at: nowIso,
      scanner_code: scannerCode,
      ticket: null,
      other_open_tickets: [],
      asset: toTapAssetSummary(asset),
    };
    db.latestTap = payload;
    saveMockDb(db);
    mockTapBus.emit(payload);
    return payload;
  }

  const openTickets = db.tickets.filter(
    (t) => t.asset_rfid === rfid && t.status !== "resolved",
  );
  const inProgress = openTickets.find((t) => t.status === "under_review");

  // Rule 3: Active under_review ticket -> closeout mode
  if (inProgress) {
    const others = openTickets
      .filter((t) => t.id !== inProgress.id)
      .map(toTapTicketSummary);
    const payload: TapPayload = {
      mode: "closeout",
      rfid_uid: rfid,
      tapped_at: nowIso,
      scanner_code: scannerCode,
      ticket: toTapTicketSummary(inProgress),
      other_open_tickets: others,
      asset: toTapAssetSummary(asset),
    };
    db.latestTap = payload;
    saveMockDb(db);
    mockTapBus.emit(payload);
    return payload;
  }

  // Rule 4: Pending ticket(s) -> start highest priority ticket atomically
  const pending = openTickets
    .filter((t) => t.status === "pending_review")
    .sort((a, b) => computeEffectivePriority(b) - computeEffectivePriority(a));

  if (pending.length > 0) {
    const target = pending[0];
    target.status = "under_review";
    target.started_at = nowIso;
    target.started_by = actor.id;
    target.started_by_name = actor.full_name;
    target.status_history = [
      ...(target.status_history ?? []),
      {
        id: `sh-${Date.now()}`,
        ticket_id: target.id,
        from_status: "pending_review",
        to_status: "under_review",
        changed_by: actor.id,
        changed_by_name: actor.full_name,
        via: "tap",
        changed_at: nowIso,
      },
    ];

    const others = pending.slice(1).map(toTapTicketSummary);
    const payload: TapPayload = {
      mode: "start",
      rfid_uid: rfid,
      tapped_at: nowIso,
      scanner_code: scannerCode,
      ticket: toTapTicketSummary(target),
      other_open_tickets: others,
      asset: toTapAssetSummary(asset),
    };
    db.latestTap = payload;
    saveMockDb(db);
    mockTapBus.emit(payload);
    return payload;
  }

  // Rule 5: Healthy asset with zero open tickets
  const payload: TapPayload = {
    mode: "asset_only",
    rfid_uid: rfid,
    tapped_at: nowIso,
    scanner_code: scannerCode,
    ticket: null,
    other_open_tickets: [],
    asset: toTapAssetSummary(asset),
  };
  db.latestTap = payload;
  saveMockDb(db);
  mockTapBus.emit(payload);
  return payload;
}

export const mockApi: MockApiTransport = {
  async getMe(): Promise<UserProfile> {
    await sleep(60);
    const current = getMockCurrentUser();
    if (!current) {
      throwApiError(401, "invalid_token", "Not authenticated.");
    }
    if (!current.is_active) {
      throwApiError(
        403,
        "inactive_user",
        "Your account has been deactivated by an administrator.",
      );
    }
    return current;
  },

  async listAssets(params) {
    await sleep(100);
    const user = requireActiveUser();
    const db = getMockDb();
    let list = [...db.assets];

    const includeArchived =
      params?.include_archived && user.role === "admin";
    if (!includeArchived) {
      list = list.filter((a) => !a.archived_at);
    }

    if (params?.status && params.status !== "all") {
      list = list.filter((a) => a.status === params.status);
    }
    if (params?.criticality) {
      list = list.filter((a) => a.criticality === params.criticality);
    }
    if (params?.q?.trim()) {
      const q = params.q.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.rfid_uid.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          a.serial_no.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q),
      );
    }

    return list.map(enrichAsset);
  },

  async lookupAsset(rfidRaw) {
    await sleep(90);
    requireActiveUser();
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const found = db.assets.find((a) => a.rfid_uid === rfid && !a.archived_at);
    if (!found) {
      throwApiError(
        404,
        "unknown_asset",
        `No active equipment found with RFID "${rfid}".`,
      );
    }
    return enrichAsset(found);
  },

  async getAsset(rfidRaw) {
    await sleep(90);
    requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const found = db.assets.find((a) => a.rfid_uid === rfid);
    if (!found) {
      throwApiError(404, "not_found", `Equipment "${rfid}" not found.`);
    }
    return enrichAsset(found);
  },

  async createAsset(input: AssetCreateInput) {
    await sleep(140);
    const actor = requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(input.rfid_uid);
    if (!isValidRfidFormat(rfid)) {
      throwApiError(400, "validation_error", "RFID UID must be 4–32 alphanumeric characters.");
    }
    const db = getMockDb();
    if (db.assets.some((a) => a.rfid_uid === rfid)) {
      throwApiError(409, "duplicate_rfid", `An asset with RFID "${rfid}" already exists.`);
    }
    const created: Asset = {
      ...input,
      rfid_uid: rfid,
      archived_at: null,
      archived_by: null,
      images: [],
    };
    db.assets.unshift(created);
    saveMockDb(db);
    appendAudit(actor, "device.created", "device", rfid, {
      to: { name: created.name, model: created.model, location: created.location },
    });
    return enrichAsset(created);
  },

  async updateAsset(rfidRaw: string, input: AssetUpdateInput) {
    await sleep(120);
    const actor = requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const idx = db.assets.findIndex((a) => a.rfid_uid === rfid);
    if (idx === -1) {
      throwApiError(404, "not_found", "Equipment not found.");
    }
    const prev = db.assets[idx];
    const updated: Asset = {
      ...prev,
      ...input,
      rfid_uid: prev.rfid_uid,
    };
    db.assets[idx] = updated;

    // Keep linked ticket names/locations synced
    db.tickets.forEach((t) => {
      if (t.asset_rfid === rfid) {
        t.asset_name = updated.name;
        t.asset_location = updated.location;
        t.asset_model = updated.model;
        t.asset_criticality = updated.criticality;
      }
    });
    saveMockDb(db);
    appendAudit(actor, "device.updated", "device", rfid, {
      from: { name: prev.name, status: prev.status, criticality: prev.criticality },
      to: { name: updated.name, status: updated.status, criticality: updated.criticality },
    });
    return enrichAsset(updated);
  },

  async uploadAssetImage(rfidRaw: string, file: File) {
    await sleep(150);
    const actor = requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === rfid);
    if (!asset) throwApiError(404, "not_found", "Equipment not found.");
    if (asset.images.length >= 3) {
      throwApiError(400, "too_many_images", "Maximum 3 photos allowed per device.");
    }
    const url = await fileToDataUrl(file);
    const img: AssetImage = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      asset_rfid: rfid,
      url,
      uploaded_by: actor.id,
      uploaded_at: new Date().toISOString(),
    };
    asset.images.push(img);
    saveMockDb(db);
    return img;
  },

  async deleteAssetImage(rfidRaw: string, imageId: string) {
    await sleep(90);
    requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === rfid);
    if (!asset) throwApiError(404, "not_found", "Equipment not found.");
    asset.images = asset.images.filter((img) => img.id !== imageId);
    saveMockDb(db);
  },

  async getAssetHistory(rfidRaw: string): Promise<AssetHistoryItem[]> {
    await sleep(90);
    requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    if (!db.assets.some((a) => a.rfid_uid === rfid)) {
      throwApiError(404, "not_found", "Equipment not found.");
    }
    const items: AssetHistoryItem[] = [
      ...db.incidents
        .filter((i) => i.asset_rfid === rfid)
        .map((i) => ({
          kind: "incident" as const,
          id: i.id,
          timestamp: i.resolved_at,
          data: i,
        })),
      ...db.maintenanceLogs
        .filter((m) => m.asset_rfid === rfid)
        .map((m) => ({
          kind: "maintenance" as const,
          id: m.id,
          timestamp: m.performed_at,
          data: m,
        })),
    ];
    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  async addMaintenanceLog(rfidRaw: string, input: MaintenanceLogInput) {
    await sleep(120);
    const actor = requireRole(["technician", "admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === rfid);
    if (!asset) throwApiError(404, "not_found", "Equipment not found.");

    const nowIso = new Date().toISOString();
    const log: MaintenanceLog = {
      id: `mnt-${Date.now()}`,
      asset_rfid: rfid,
      ticket_id: null,
      type: input.type,
      report: input.report,
      parts_replaced: input.parts_replaced,
      performed_by: actor.id,
      performed_by_name: actor.full_name,
      performed_at: nowIso,
      next_due_date: input.next_due_date,
    };
    db.maintenanceLogs.unshift(log);
    asset.last_service_date = nowIso.slice(0, 10);
    if (input.next_due_date) {
      asset.next_service_due = input.next_due_date;
    }
    saveMockDb(db);
    return log;
  },

  async archiveAsset(rfidRaw: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === rfid);
    if (!asset) throwApiError(404, "not_found", "Equipment not found.");
    const nowIso = new Date().toISOString();
    asset.archived_at = nowIso;
    asset.archived_by = actor.id;
    saveMockDb(db);
    appendAudit(actor, "device.archived", "device", rfid, {
      from: { archived_at: null },
      to: { archived_at: nowIso },
    });
    return enrichAsset(asset);
  },

  async restoreAsset(rfidRaw: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === rfid);
    if (!asset) throwApiError(404, "not_found", "Equipment not found.");
    const prevArchived = asset.archived_at;
    asset.archived_at = null;
    asset.archived_by = null;
    saveMockDb(db);
    appendAudit(actor, "device.restored", "device", rfid, {
      from: { archived_at: prevArchived },
      to: { archived_at: null },
    });
    return enrichAsset(asset);
  },

  async rekeyAsset(rfidRaw: string, newRfidRaw: string) {
    await sleep(150);
    const actor = requireRole(["admin"]);
    const oldRfid = normalizeRfid(rfidRaw);
    const newRfid = normalizeRfid(newRfidRaw);
    if (!isValidRfidFormat(newRfid)) {
      throwApiError(400, "validation_error", "New RFID UID must be 4–32 alphanumeric characters.");
    }
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === oldRfid);
    if (!asset) throwApiError(404, "not_found", "Equipment not found.");
    if (oldRfid !== newRfid && db.assets.some((a) => a.rfid_uid === newRfid)) {
      throwApiError(409, "duplicate_rfid", `RFID "${newRfid}" is already assigned to another asset.`);
    }

    // Cascade across all foreign-key references (matching ON UPDATE CASCADE)
    asset.rfid_uid = newRfid;
    asset.images.forEach((img) => {
      img.asset_rfid = newRfid;
    });
    db.tickets.forEach((t) => {
      if (t.asset_rfid === oldRfid) t.asset_rfid = newRfid;
    });
    db.incidents.forEach((inc) => {
      if (inc.asset_rfid === oldRfid) inc.asset_rfid = newRfid;
    });
    db.maintenanceLogs.forEach((log) => {
      if (log.asset_rfid === oldRfid) log.asset_rfid = newRfid;
    });
    saveMockDb(db);
    appendAudit(actor, "device.rekeyed", "device", newRfid, {
      from: { rfid_uid: oldRfid },
      to: { rfid_uid: newRfid },
    });
    return enrichAsset(asset);
  },

  async deleteAsset(rfidRaw: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const rfid = normalizeRfid(rfidRaw);
    const db = getMockDb();
    const idx = db.assets.findIndex((a) => a.rfid_uid === rfid);
    if (idx === -1) throwApiError(404, "not_found", "Equipment not found.");

    const hasRecords =
      db.tickets.some((t) => t.asset_rfid === rfid) ||
      db.incidents.some((i) => i.asset_rfid === rfid) ||
      db.maintenanceLogs.some((m) => m.asset_rfid === rfid);

    if (hasRecords) {
      throwApiError(
        409,
        "has_linked_records",
        "This device has linked tickets, incidents, or maintenance logs. Archive the device instead.",
      );
    }

    const removed = db.assets[idx];
    db.assets.splice(idx, 1);
    saveMockDb(db);
    appendAudit(actor, "device.deleted", "device", rfid, {
      from: { rfid_uid: rfid, name: removed.name },
    });
  },

  async listTickets(params) {
    await sleep(100);
    const user = requireActiveUser();
    const db = getMockDb();
    let list = [...db.tickets];
    if (user.role === "customer") {
      list = list.filter((t) => t.raised_by === user.id);
    }
    if (params?.status && params.status !== "all") {
      list = list.filter((t) => t.status === params.status);
    }
    return list;
  },

  async getTicket(id: string) {
    await sleep(80);
    const user = requireActiveUser();
    const db = getMockDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throwApiError(404, "not_found", "Ticket not found.");
    if (user.role === "customer" && ticket.raised_by !== user.id) {
      throwApiError(403, "forbidden", "You can only inspect your own tickets.");
    }
    return ticket;
  },

  async createTicket(input: CreateTicketInput) {
    await sleep(160);
    const user = requireRole(["customer"]);
    const rfid = normalizeRfid(input.asset_rfid);
    const db = getMockDb();
    const asset = db.assets.find((a) => a.rfid_uid === rfid && !a.archived_at);
    if (!asset) {
      throwApiError(
        404,
        "unknown_asset",
        `Equipment with RFID "${rfid}" was not found or is archived.`,
      );
    }
    if (input.images.length > 2) {
      throwApiError(400, "too_many_images", "Maximum 2 fault photos allowed.");
    }

    const imageDataUrls = await Promise.all(input.images.map(fileToDataUrl));
    const { score, severity, triage } = evaluateRuleBasedTriage({
      title: input.title,
      description: input.description,
      workstation: input.workstation,
      asset,
      hasImages: imageDataUrls.length > 0,
    });

    const seq = db.nextTicketSeq++;
    const nowIso = new Date().toISOString();
    const ticketId = `tkt-${seq}`;
    const created: Ticket = {
      id: ticketId,
      ticket_number: `#${seq}`,
      asset_rfid: asset.rfid_uid,
      asset_name: asset.name,
      asset_location: asset.location,
      asset_model: asset.model,
      asset_criticality: asset.criticality,
      raised_by: user.id,
      raised_by_name: user.full_name,
      workstation: input.workstation || null,
      title: input.title.trim(),
      description: input.description.trim(),
      occurred_at: input.occurred_at,
      status: "pending_review",
      images: imageDataUrls,
      priority_score: score,
      priority_override: null,
      severity,
      triage,
      started_at: null,
      started_by: null,
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      status_history: [
        {
          id: `sh-${Date.now()}`,
          ticket_id: ticketId,
          from_status: null,
          to_status: "pending_review",
          changed_by: user.id,
          changed_by_name: user.full_name,
          via: "form",
          changed_at: nowIso,
        },
      ],
      created_at: nowIso,
    };

    db.tickets.unshift(created);
    saveMockDb(db);
    return created;
  },

  async overrideTicketPriority(id: string, priorityOverride: number | null) {
    await sleep(100);
    requireRole(["technician", "admin"]);
    const db = getMockDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throwApiError(404, "not_found", "Ticket not found.");
    if (priorityOverride !== null && (priorityOverride < 0 || priorityOverride > 100)) {
      throwApiError(400, "validation_error", "Override priority must be between 0 and 100.");
    }
    ticket.priority_override = priorityOverride;
    saveMockDb(db);
    return ticket;
  },

  async resolveTicket(id: string, input: ResolveTicketInput) {
    await sleep(180);
    const actor = requireRole(["technician", "admin"]);
    const db = getMockDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throwApiError(404, "not_found", "Ticket not found.");
    if (ticket.status !== "under_review") {
      throwApiError(
        409,
        "invalid_transition",
        `Ticket must be in 'under_review' state before closing out (current: '${ticket.status}').`,
      );
    }

    const asset = db.assets.find((a) => a.rfid_uid === ticket.asset_rfid);
    if (!asset) throwApiError(404, "not_found", "Linked device not found.");

    const nowIso = new Date().toISOString();

    // Atomic close-out simulation (6 steps matching resolve_ticket_atomic RPC)
    ticket.status = "resolved";
    ticket.resolved_at = nowIso;
    ticket.resolved_by = actor.id;
    ticket.resolution = {
      root_cause: input.root_cause.trim(),
      resolution: input.resolution.trim(),
      parts_replaced: input.parts_replaced,
      resolved_at: nowIso,
      resolved_by_name: actor.full_name,
      report: input.report?.trim(),
    };
    ticket.status_history = [
      ...(ticket.status_history ?? []),
      {
        id: `sh-${Date.now()}`,
        ticket_id: ticket.id,
        from_status: "under_review",
        to_status: "resolved",
        changed_by: actor.id,
        changed_by_name: actor.full_name,
        via: "form",
        changed_at: nowIso,
      },
    ];

    db.incidents.unshift({
      id: `inc-${Date.now()}`,
      asset_rfid: asset.rfid_uid,
      ticket_id: ticket.id,
      summary: ticket.title,
      root_cause: input.root_cause.trim(),
      resolution: input.resolution.trim(),
      parts_replaced: input.parts_replaced,
      occurred_at: ticket.occurred_at,
      resolved_at: nowIso,
      created_by: actor.id,
      created_by_name: actor.full_name,
    });

    db.maintenanceLogs.unshift({
      id: `mnt-${Date.now()}`,
      asset_rfid: asset.rfid_uid,
      ticket_id: ticket.id,
      type: "corrective",
      report: input.report?.trim() || input.resolution.trim(),
      parts_replaced: input.parts_replaced,
      performed_by: actor.id,
      performed_by_name: actor.full_name,
      performed_at: nowIso,
      next_due_date: input.asset_updates.next_service_due,
    });

    asset.status = input.asset_updates.status;
    asset.last_service_date = nowIso.slice(0, 10);
    if (input.asset_updates.next_service_due) {
      asset.next_service_due = input.asset_updates.next_service_due;
    }
    if (input.asset_updates.notes !== null && input.asset_updates.notes !== undefined) {
      asset.notes = input.asset_updates.notes;
    }

    saveMockDb(db);
    return ticket;
  },

  async getLatestTap() {
    await sleep(60);
    requireRole(["technician", "admin"]);
    return getMockDb().latestTap;
  },

  async adminListUsers(params) {
    await sleep(90);
    requireRole(["admin"]);
    const db = getMockDb();
    let list = db.users.map((u) => ({
      ...u,
      ticket_count: db.tickets.filter((t) => t.raised_by === u.id).length,
    }));
    if (params?.role && params.role !== "all") {
      list = list.filter((u) => u.role === params.role);
    }
    if (params?.active === "active") {
      list = list.filter((u) => u.is_active);
    } else if (params?.active === "inactive") {
      list = list.filter((u) => !u.is_active);
    }
    if (params?.q?.trim()) {
      const q = params.q.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    return list;
  },

  async adminGetUser(id: string) {
    await sleep(70);
    requireRole(["admin"]);
    const db = getMockDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) throwApiError(404, "not_found", "User not found.");
    return {
      ...user,
      ticket_count: db.tickets.filter((t) => t.raised_by === user.id).length,
    };
  },

  async adminCreateUser(input: AdminUserCreateInput) {
    await sleep(140);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throwApiError(409, "duplicate_email", `A user with email "${email}" already exists.`);
    }
    const created: AdminUser = {
      id: `user-${Date.now()}`,
      email,
      full_name: input.full_name.trim(),
      role: input.role,
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: actor.id,
      ticket_count: 0,
    };
    db.users.unshift(created);
    saveMockDb(db);
    appendAudit(actor, "user.created", "user", created.id, {
      to: { email: created.email, full_name: created.full_name, role: created.role },
    });
    return created;
  },

  async adminUpdateUser(id: string, input: AdminUserUpdateInput) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) throwApiError(404, "not_found", "User not found.");

    if (target.id === actor.id && input.role && input.role !== target.role) {
      throwApiError(400, "self_action_not_allowed", "You cannot change your own role.");
    }
    if (target.role === "admin" && input.role && input.role !== "admin") {
      const activeAdmins = db.users.filter((u) => u.role === "admin" && u.is_active);
      if (activeAdmins.length <= 1 && target.is_active) {
        throwApiError(409, "last_admin", "Cannot demote the last active administrator.");
      }
    }

    const prev = { full_name: target.full_name, role: target.role };
    if (input.full_name !== undefined) target.full_name = input.full_name.trim();
    if (input.role !== undefined) target.role = input.role;
    saveMockDb(db);
    appendAudit(actor, "user.updated", "user", target.id, {
      from: prev,
      to: { full_name: target.full_name, role: target.role },
    });
    return target;
  },

  async adminDeactivateUser(id: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) throwApiError(404, "not_found", "User not found.");
    if (target.id === actor.id) {
      throwApiError(400, "self_action_not_allowed", "You cannot deactivate your own account.");
    }
    if (target.role === "admin" && target.is_active) {
      const activeAdmins = db.users.filter((u) => u.role === "admin" && u.is_active);
      if (activeAdmins.length <= 1) {
        throwApiError(409, "last_admin", "Cannot deactivate the last active administrator.");
      }
    }
    target.is_active = false;
    saveMockDb(db);
    appendAudit(actor, "user.deactivated", "user", target.id, {
      from: { is_active: true },
      to: { is_active: false },
    });
    return target;
  },

  async adminReactivateUser(id: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) throwApiError(404, "not_found", "User not found.");
    target.is_active = true;
    saveMockDb(db);
    appendAudit(actor, "user.reactivated", "user", target.id, {
      from: { is_active: false },
      to: { is_active: true },
    });
    return target;
  },

  async adminResetPassword(id: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const target = db.users.find((u) => u.id === id);
    if (!target) throwApiError(404, "not_found", "User not found.");
    appendAudit(actor, "user.password_reset", "user", target.id, {
      to: { email: target.email, reset: true },
    });
    return { ok: true };
  },

  async adminDeleteUser(id: string) {
    await sleep(120);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) throwApiError(404, "not_found", "User not found.");
    const target = db.users[idx];

    if (target.id === actor.id) {
      throwApiError(400, "self_action_not_allowed", "You cannot delete your own account.");
    }
    if (target.role === "admin" && target.is_active) {
      const activeAdmins = db.users.filter((u) => u.role === "admin" && u.is_active);
      if (activeAdmins.length <= 1) {
        throwApiError(409, "last_admin", "Cannot delete the last active administrator.");
      }
    }

    const hasLinked =
      db.tickets.some(
        (t) => t.raised_by === target.id || t.started_by === target.id || t.resolved_by === target.id,
      ) ||
      db.maintenanceLogs.some((m) => m.performed_by === target.id) ||
      db.incidents.some((i) => i.created_by === target.id);

    if (hasLinked) {
      throwApiError(
        409,
        "has_linked_records",
        "This user has tickets or maintenance history. Deactivate the account instead.",
      );
    }

    db.users.splice(idx, 1);
    saveMockDb(db);
    appendAudit(actor, "user.deleted", "user", target.id, {
      from: { email: target.email, role: target.role },
    });
  },

  async adminListScanners() {
    await sleep(90);
    requireRole(["admin"]);
    return [...getMockDb().scanners];
  },

  async adminCreateScanner(input: ScannerCreateInput): Promise<ScannerKeyResponse> {
    await sleep(130);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const code = input.scanner_code.trim().toUpperCase();
    if (db.scanners.some((s) => s.scanner_code === code)) {
      throwApiError(409, "validation_error", `Scanner "${code}" already exists.`);
    }
    const scanner: Scanner = {
      id: `scn-${Date.now()}`,
      scanner_code: code,
      location: input.location.trim(),
      is_active: true,
      last_seen_at: null,
      created_at: new Date().toISOString(),
      created_by: actor.id,
    };
    const device_key = `deam_scn_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    db.scanners.unshift(scanner);
    saveMockDb(db);
    appendAudit(actor, "scanner.created", "scanner", scanner.scanner_code, {
      to: { scanner_code: scanner.scanner_code, location: scanner.location },
    });
    return { scanner, device_key };
  },

  async adminUpdateScanner(id: string, input: ScannerUpdateInput) {
    await sleep(100);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const scanner = db.scanners.find((s) => s.id === id);
    if (!scanner) throwApiError(404, "not_found", "Scanner not found.");
    const prev = { location: scanner.location, is_active: scanner.is_active };
    if (input.location !== undefined) scanner.location = input.location.trim();
    if (input.is_active !== undefined) scanner.is_active = input.is_active;
    saveMockDb(db);
    appendAudit(actor, "scanner.updated", "scanner", scanner.scanner_code, {
      from: prev,
      to: { location: scanner.location, is_active: scanner.is_active },
    });
    return scanner;
  },

  async adminRotateScannerKey(id: string): Promise<ScannerKeyResponse> {
    await sleep(130);
    const actor = requireRole(["admin"]);
    const db = getMockDb();
    const scanner = db.scanners.find((s) => s.id === id);
    if (!scanner) throwApiError(404, "not_found", "Scanner not found.");
    const device_key = `deam_scn_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    appendAudit(actor, "scanner.key_rotated", "scanner", scanner.scanner_code, {
      to: { rotated_at: new Date().toISOString() },
    });
    return { scanner, device_key };
  },

  async adminListAuditLogs(params) {
    await sleep(90);
    requireRole(["admin"]);
    let items = [...getMockDb().auditLogs];
    if (params?.actor?.trim()) {
      const q = params.actor.trim().toLowerCase();
      items = items.filter(
        (e) =>
          e.actor_name.toLowerCase().includes(q) ||
          (e.actor_email ?? "").toLowerCase().includes(q),
      );
    }
    if (params?.action && params.action !== "all") {
      items = items.filter((e) => e.action.startsWith(params.action!));
    }
    if (params?.from) {
      const fromMs = new Date(params.from).getTime();
      if (!Number.isNaN(fromMs)) {
        items = items.filter((e) => new Date(e.created_at).getTime() >= fromMs);
      }
    }
    if (params?.to) {
      const toMs = new Date(params.to).getTime() + 86_400_000;
      if (!Number.isNaN(toMs)) {
        items = items.filter((e) => new Date(e.created_at).getTime() <= toMs);
      }
    }
    const page = params?.page ?? 1;
    const page_size = params?.page_size ?? 15;
    const total = items.length;
    const sliced = items.slice((page - 1) * page_size, page * page_size);
    return { items: sliced, total, page, page_size };
  },
};
