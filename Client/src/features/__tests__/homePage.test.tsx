import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext, type AuthContextValue } from "@/auth/AuthProvider";
import { HomePage } from "@/features/home/HomePage";
import type { UserProfile } from "@/types/auth";

function renderHome(user: UserProfile | null = null) {
  const value: AuthContextValue = {
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

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("HomePage 3D RFID stage & interactive sections", () => {
  it("renders hero, 3D ESP32 reader, and all key landing sections", () => {
    renderHome(null);

    expect(
      screen.getByRole("heading", {
        name: /Every fault is one tap away from its full history\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("ESP32 · MFRC522")).toBeInTheDocument();
    expect(screen.getByText("TAP A TAG...")).toBeInTheDocument();
    expect(screen.getByText(/From fault to fixed in three moves\./i)).toBeInTheDocument();
    expect(screen.getByText(/The right ticket on top, always\./i)).toBeInTheDocument();
    expect(screen.getByText(/Every device remembers\./i)).toBeInTheDocument();
    expect(screen.getByText(/Cut the downtime\. Keep the history\./i)).toBeInTheDocument();
  });

  it("steps through idle -> start -> closeout -> resolved on RFID reader tap", async () => {
    const user = userEvent.setup();
    renderHome(null);

    // Tap 1: Start
    await user.click(screen.getByRole("button", { name: /Simulate RFID tap/i }));
    expect(screen.getByText("TAP OK: START")).toBeInTheDocument();
    expect(screen.getByText("Conveyor motor M-02")).toBeInTheDocument();

    // Tap 2: Close-out
    await user.click(screen.getByRole("button", { name: /Tap again \(Close-out\)/i }));
    expect(screen.getByText("TAP 2: CLOSEOUT")).toBeInTheDocument();

    // Tap 3: Resolve
    await user.click(screen.getByRole("button", { name: /Confirm & Resolve/i }));
    expect(screen.getByText("RESOLVED OK")).toBeInTheDocument();
  });

  it("updates How It Works tabs and Smart Triage interactive score", async () => {
    const user = userEvent.setup();
    renderHome(null);

    await user.click(screen.getByRole("button", { name: /02\s+Tap/i }));
    expect(await screen.findByText("Tap the tag")).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();

    // Default score = 5*6 + 45 + 10 + 5 = 90
    expect(screen.getByText("Score 90 / 100")).toBeInTheDocument();
    // Toggle Safety Keyword off -> 90 - 45 + 16 = 61
    await user.click(screen.getByRole("button", { name: /Safety Keyword \(\+45\)/i }));
    expect(screen.getByText("Score 61 / 100")).toBeInTheDocument();
  });

  it("shows Open Workspace CTA when user is authenticated", () => {
    renderHome({
      id: "user-tech-1",
      email: "arjun@lab.deamfods.io",
      full_name: "Arjun Mehta",
      role: "technician",
      is_active: true,
      created_at: "2026-11-26T00:00:00Z",
    });

    expect(
      screen.getAllByRole("link", { name: /Open Workspace/i }).length,
    ).toBeGreaterThan(0);
  });
});
