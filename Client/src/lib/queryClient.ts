import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  me: ["me"] as const,
  assets: (filters?: Record<string, unknown>) => ["assets", filters ?? {}] as const,
  asset: (rfid: string) => ["assets", rfid] as const,
  assetHistory: (rfid: string) => ["assets", rfid, "history"] as const,
  tickets: (filters?: Record<string, unknown>) => ["tickets", filters ?? {}] as const,
  ticket: (id: string) => ["tickets", id] as const,
  adminUsers: (filters?: Record<string, unknown>) => ["admin", "users", filters ?? {}] as const,
  adminUser: (id: string) => ["admin", "users", id] as const,
  adminScanners: ["admin", "scanners"] as const,
  adminAuditLog: (filters?: Record<string, unknown>) =>
    ["admin", "audit-log", filters ?? {}] as const,
};
