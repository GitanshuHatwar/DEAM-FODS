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
import type { CreateTicketInput, ResolveTicketInput, Ticket } from "@/types/ticket";
import { getSupabaseClient, isMockMode } from "./supabase";
import { normalizeRfid } from "./rfid";
import { mockApi } from "./mocks/mockApi";
import { ApiClientError } from "./mocks/mockDb";

export { ApiClientError };

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "http://localhost:8000";

type UnauthorizedHandler = () => void;
type DeactivatedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;
let onDeactivated: DeactivatedHandler | null = null;

export function registerAuthHandlers(handlers: {
  onUnauthorized?: UnauthorizedHandler;
  onDeactivated?: DeactivatedHandler;
}) {
  onUnauthorized = handlers.onUnauthorized ?? null;
  onDeactivated = handlers.onDeactivated ?? null;
}

export async function getAccessToken(): Promise<string | null> {
  if (isMockMode) {
    return "mock-access-token";
  }
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiClientError(
      0,
      "network_error",
      err instanceof Error ? err.message : "Network request failed.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const errEnv = body as ApiErrorEnvelope | null;
    const code = errEnv?.error?.code ?? "unknown_error";
    const message =
      errEnv?.error?.message ?? `Request failed with status ${response.status}`;

    if (response.status === 401) {
      onUnauthorized?.();
    } else if (response.status === 403 && code === "inactive_user") {
      onDeactivated?.();
    }

    throw new ApiClientError(response.status, code, message);
  }

  return body as T;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return "";
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "all") {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const api = {
  auth: {
    me: (): Promise<UserProfile> =>
      isMockMode ? mockApi.getMe() : request<UserProfile>("/me"),
  },

  assets: {
    list: (params?: {
      include_archived?: boolean;
      q?: string;
      status?: string;
      criticality?: number;
    }): Promise<Asset[]> =>
      isMockMode
        ? mockApi.listAssets(params)
        : request<Asset[]>(`/assets${buildQuery(params)}`),

    lookup: (rfid: string): Promise<Asset> =>
      isMockMode
        ? mockApi.lookupAsset(rfid)
        : request<Asset>(
            `/assets/lookup${buildQuery({ rfid: normalizeRfid(rfid) })}`,
          ),

    get: (rfid: string): Promise<Asset> =>
      isMockMode
        ? mockApi.getAsset(rfid)
        : request<Asset>(`/assets/${encodeURIComponent(normalizeRfid(rfid))}`),

    create: (input: AssetCreateInput): Promise<Asset> =>
      isMockMode
        ? mockApi.createAsset(input)
        : request<Asset>("/assets", {
            method: "POST",
            body: JSON.stringify({
              ...input,
              rfid_uid: normalizeRfid(input.rfid_uid),
            }),
          }),

    update: (rfid: string, input: AssetUpdateInput): Promise<Asset> =>
      isMockMode
        ? mockApi.updateAsset(rfid, input)
        : request<Asset>(`/assets/${encodeURIComponent(normalizeRfid(rfid))}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          }),

    uploadImage: (rfid: string, file: File): Promise<AssetImage> => {
      if (isMockMode) return mockApi.uploadAssetImage(rfid, file);
      const fd = new FormData();
      fd.append("file", file);
      return request<AssetImage>(
        `/assets/${encodeURIComponent(normalizeRfid(rfid))}/images`,
        { method: "POST", body: fd },
      );
    },

    deleteImage: (rfid: string, imageId: string): Promise<void> =>
      isMockMode
        ? mockApi.deleteAssetImage(rfid, imageId)
        : request<void>(
            `/assets/${encodeURIComponent(normalizeRfid(rfid))}/images/${encodeURIComponent(imageId)}`,
            { method: "DELETE" },
          ),

    history: (rfid: string): Promise<AssetHistoryItem[]> =>
      isMockMode
        ? mockApi.getAssetHistory(rfid)
        : request<AssetHistoryItem[]>(
            `/assets/${encodeURIComponent(normalizeRfid(rfid))}/history`,
          ),

    addMaintenance: (
      rfid: string,
      input: MaintenanceLogInput,
    ): Promise<MaintenanceLog> =>
      isMockMode
        ? mockApi.addMaintenanceLog(rfid, input)
        : request<MaintenanceLog>(
            `/assets/${encodeURIComponent(normalizeRfid(rfid))}/maintenance`,
            { method: "POST", body: JSON.stringify(input) },
          ),

    archive: (rfid: string): Promise<Asset> =>
      isMockMode
        ? mockApi.archiveAsset(rfid)
        : request<Asset>(
            `/assets/${encodeURIComponent(normalizeRfid(rfid))}/archive`,
            { method: "POST" },
          ),

    restore: (rfid: string): Promise<Asset> =>
      isMockMode
        ? mockApi.restoreAsset(rfid)
        : request<Asset>(
            `/assets/${encodeURIComponent(normalizeRfid(rfid))}/restore`,
            { method: "POST" },
          ),

    rekey: (rfid: string, newRfid: string): Promise<Asset> =>
      isMockMode
        ? mockApi.rekeyAsset(rfid, newRfid)
        : request<Asset>(
            `/assets/${encodeURIComponent(normalizeRfid(rfid))}/rekey`,
            {
              method: "POST",
              body: JSON.stringify({ new_rfid_uid: normalizeRfid(newRfid) }),
            },
          ),

    remove: (rfid: string): Promise<void> =>
      isMockMode
        ? mockApi.deleteAsset(rfid)
        : request<void>(`/assets/${encodeURIComponent(normalizeRfid(rfid))}`, {
            method: "DELETE",
          }),
  },

  tickets: {
    list: (params?: { status?: string }): Promise<Ticket[]> =>
      isMockMode
        ? mockApi.listTickets(params)
        : request<Ticket[]>(`/tickets${buildQuery(params)}`),

    get: (id: string): Promise<Ticket> =>
      isMockMode
        ? mockApi.getTicket(id)
        : request<Ticket>(`/tickets/${encodeURIComponent(id)}`),

    create: (input: CreateTicketInput): Promise<Ticket> => {
      if (isMockMode) return mockApi.createTicket(input);
      const fd = new FormData();
      fd.append("asset_rfid", normalizeRfid(input.asset_rfid));
      fd.append("title", input.title);
      fd.append("description", input.description);
      fd.append("occurred_at", input.occurred_at);
      if (input.workstation) fd.append("workstation", input.workstation);
      input.images.forEach((file) => fd.append("images", file));
      return request<Ticket>("/tickets", { method: "POST", body: fd });
    },

    overridePriority: (
      id: string,
      priorityOverride: number | null,
    ): Promise<Ticket> =>
      isMockMode
        ? mockApi.overrideTicketPriority(id, priorityOverride)
        : request<Ticket>(`/tickets/${encodeURIComponent(id)}/priority`, {
            method: "PATCH",
            body: JSON.stringify({ priority_override: priorityOverride }),
          }),

    resolve: (id: string, input: ResolveTicketInput): Promise<Ticket> =>
      isMockMode
        ? mockApi.resolveTicket(id, input)
        : request<Ticket>(`/tickets/${encodeURIComponent(id)}/resolve`, {
            method: "POST",
            body: JSON.stringify(input),
          }),
  },

  rfid: {
    latest: (): Promise<TapPayload | null> =>
      isMockMode ? mockApi.getLatestTap() : request<TapPayload | null>("/rfid/latest"),
  },

  admin: {
    listUsers: (params?: {
      role?: string;
      active?: string;
      q?: string;
    }): Promise<AdminUser[]> =>
      isMockMode
        ? mockApi.adminListUsers(params)
        : request<AdminUser[]>(`/admin/users${buildQuery(params)}`),

    getUser: (id: string): Promise<AdminUser> =>
      isMockMode
        ? mockApi.adminGetUser(id)
        : request<AdminUser>(`/admin/users/${encodeURIComponent(id)}`),

    createUser: (input: AdminUserCreateInput): Promise<AdminUser> =>
      isMockMode
        ? mockApi.adminCreateUser(input)
        : request<AdminUser>("/admin/users", {
            method: "POST",
            body: JSON.stringify(input),
          }),

    updateUser: (id: string, input: AdminUserUpdateInput): Promise<AdminUser> =>
      isMockMode
        ? mockApi.adminUpdateUser(id, input)
        : request<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          }),

    deactivateUser: (id: string): Promise<AdminUser> =>
      isMockMode
        ? mockApi.adminDeactivateUser(id)
        : request<AdminUser>(
            `/admin/users/${encodeURIComponent(id)}/deactivate`,
            { method: "POST" },
          ),

    reactivateUser: (id: string): Promise<AdminUser> =>
      isMockMode
        ? mockApi.adminReactivateUser(id)
        : request<AdminUser>(
            `/admin/users/${encodeURIComponent(id)}/reactivate`,
            { method: "POST" },
          ),

    resetPassword: (id: string, password: string): Promise<{ ok: true }> =>
      isMockMode
        ? mockApi.adminResetPassword(id, password)
        : request<{ ok: true }>(
            `/admin/users/${encodeURIComponent(id)}/reset-password`,
            { method: "POST", body: JSON.stringify({ password }) },
          ),

    deleteUser: (id: string): Promise<void> =>
      isMockMode
        ? mockApi.adminDeleteUser(id)
        : request<void>(`/admin/users/${encodeURIComponent(id)}`, {
            method: "DELETE",
          }),

    listScanners: (): Promise<Scanner[]> =>
      isMockMode
        ? mockApi.adminListScanners()
        : request<Scanner[]>("/admin/scanners"),

    createScanner: (input: ScannerCreateInput): Promise<ScannerKeyResponse> =>
      isMockMode
        ? mockApi.adminCreateScanner(input)
        : request<ScannerKeyResponse>("/admin/scanners", {
            method: "POST",
            body: JSON.stringify(input),
          }),

    updateScanner: (id: string, input: ScannerUpdateInput): Promise<Scanner> =>
      isMockMode
        ? mockApi.adminUpdateScanner(id, input)
        : request<Scanner>(`/admin/scanners/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          }),

    rotateScannerKey: (id: string): Promise<ScannerKeyResponse> =>
      isMockMode
        ? mockApi.adminRotateScannerKey(id)
        : request<ScannerKeyResponse>(
            `/admin/scanners/${encodeURIComponent(id)}/rotate-key`,
            { method: "POST" },
          ),

    listAuditLogs: (params?: {
      actor?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
      page_size?: number;
    }): Promise<AuditLogResponse> =>
      isMockMode
        ? mockApi.adminListAuditLogs(params)
        : request<AuditLogResponse>(`/admin/audit-log${buildQuery(params)}`),
  },
};
