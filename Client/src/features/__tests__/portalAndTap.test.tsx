import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthContext, type AuthContextValue } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { LiveTapDrawer } from "@/features/tap/LiveTapDrawer";
import { ScannerKeyOnceDialog } from "@/features/admin/ScannerKeyOnceDialog";
import { TechQueuePage } from "@/features/tech/TechQueuePage";
import { setMockCurrentUserId } from "@/lib/mocks/mockDb";
import type { Role, UserProfile } from "@/types/auth";
import type { TapPayload } from "@/types/tap";

// Mock ResizeObserver for Recharts ResponsiveContainer in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

function makeAuth(role: Role): AuthContextValue {
  const user: UserProfile = {
    id: role === "admin" ? "user-admin-1" : "user-tech-1",
    email: `${role}@lab.deamfods.io`,
    full_name: role === "admin" ? "Elena Rostova" : "Arjun Mehta",
    role,
    is_active: true,
    created_at: "2026-11-26T00:00:00Z",
  };
  return {
    user,
    isLoading: false,
    isDeactivated: false,
    authError: null,
    loginWithPassword: vi.fn(),
    signupCustomer: vi.fn(),
    quickLoginAs: vi.fn(),
    resetDemoWorkspace: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  };
}

function renderWithProviders(ui: React.ReactNode, role: Role = "technician") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthContext.Provider value={makeAuth(role)}>
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Technician Queue & Live RFID Tap Drawer UI", () => {
  it("renders Tier 1 pinned active ticket above higher-scoring Tier 2 waiting ticket", async () => {
    setMockCurrentUserId("user-tech-1");
    renderWithProviders(<TechQueuePage />, "technician");

    await waitFor(() => {
      expect(screen.getByText(/Extruder stepper clicking on toolhead 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Spindle overheating and burning smell under load/i)).toBeInTheDocument();
    });

    const activeEl = screen.getByText(/Extruder stepper clicking on toolhead 2/i);
    const waitingEl = screen.getByText(/Spindle overheating and burning smell under load/i);

    // Tier 1 active ticket appears before Tier 2 waiting ticket in DOM order
    expect(
      activeEl.compareDocumentPosition(waitingEl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders all 5 RFID tap modes and enforces admin-only restore in archived_tag mode", () => {
    const baseAsset = {
      rfid_uid: "04A3B2C1",
      name: "Lab LaserJet Printer 04",
      model: "HP-M404dn",
      location: "Lab B · Desk 4",
      criticality: 4,
      status: "active" as const,
      install_date: "2024-03-01",
      warranty_expiry: "2027-03-01",
      last_service_date: "2026-08-10",
      next_service_due: "2026-11-10",
      images: [],
      recent_incidents: [],
      recent_maintenance: [],
    };

    const ticket = {
      id: "tkt-105",
      ticket_number: "#105",
      title: "Printer offline at Desk 4",
      description: "Blinking amber fault LED",
      occurred_at: "2026-11-26T09:30:00Z",
      status: "under_review" as const,
      raised_by: { full_name: "Maya Lin" },
      images: [],
      severity: "high" as const,
      priority_score: 76,
      priority: 78.4,
    };

    const modes: Array<{ payload: TapPayload; expectedText: RegExp }> = [
      {
        payload: {
          mode: "start",
          rfid_uid: "04A3B2C1",
          tapped_at: new Date().toISOString(),
          scanner_code: "SCN-001",
          ticket,
          asset: baseAsset,
        },
        expectedText: /Work Started via RFID Tap/i,
      },
      {
        payload: {
          mode: "closeout",
          rfid_uid: "04A3B2C1",
          tapped_at: new Date().toISOString(),
          scanner_code: "SCN-001",
          ticket,
          asset: baseAsset,
        },
        expectedText: /Submit Atomic Close-Out & Resolve Ticket/i,
      },
      {
        payload: {
          mode: "asset_only",
          rfid_uid: "0488C1D0",
          tapped_at: new Date().toISOString(),
          scanner_code: "SCN-001",
          asset: { ...baseAsset, rfid_uid: "0488C1D0" },
        },
        expectedText: /Equipment Inspection \(No Open Tickets\)/i,
      },
      {
        payload: {
          mode: "unknown_tag",
          rfid_uid: "04DEAD99",
          tapped_at: new Date().toISOString(),
          scanner_code: "SCN-001",
        },
        expectedText: /Add Device with RFID 04DEAD99/i,
      },
    ];

    modes.forEach(({ payload, expectedText }) => {
      const { unmount } = renderWithProviders(
        <LiveTapDrawer
          open
          payload={payload}
          onClose={vi.fn()}
          onResolved={vi.fn()}
        />,
        "technician",
      );
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    });

    // Archived tag hides Restore for Technician, shows Restore for Admin
    const archivedPayload: TapPayload = {
      mode: "archived_tag",
      rfid_uid: "04AA1122",
      tapped_at: new Date().toISOString(),
      scanner_code: "SCN-001",
      asset: {
        ...baseAsset,
        rfid_uid: "04AA1122",
        name: "Legacy Solder Fume Extractor",
        archived_at: "2026-09-14T08:00:00Z",
      },
    };

    const techView = renderWithProviders(
      <LiveTapDrawer
        open
        payload={archivedPayload}
        onClose={vi.fn()}
        onResolved={vi.fn()}
      />,
      "technician",
    );
    expect(
      screen.queryByRole("button", { name: /Restore Archived Device/i }),
    ).not.toBeInTheDocument();
    techView.unmount();

    renderWithProviders(
      <LiveTapDrawer
        open
        payload={archivedPayload}
        onClose={vi.fn()}
        onResolved={vi.fn()}
      />,
      "admin",
    );
    expect(
      screen.getByRole("button", { name: /Restore Archived Device/i }),
    ).toBeInTheDocument();
  });

  it("displays scanner plaintext key once with warning in ScannerKeyOnceDialog", () => {
    renderWithProviders(
      <ScannerKeyOnceDialog
        data={{
          scanner: {
            id: "scn-4",
            scanner_code: "SCN-004",
            location: "Lab C",
            is_active: true,
            last_seen_at: null,
            created_at: new Date().toISOString(),
          },
          device_key: "deam_scn_secret_12345",
        }}
        onClose={vi.fn()}
      />,
      "admin",
    );
    expect(screen.getByText("deam_scn_secret_12345")).toBeInTheDocument();
    expect(screen.getByText(/One-Time Display/i)).toBeInTheDocument();
  });
});
