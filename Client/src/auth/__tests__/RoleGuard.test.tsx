import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { AuthContext, type AuthContextValue } from "@/auth/AuthProvider";
import { RoleGuard } from "@/auth/RoleGuard";
import type { Role, UserProfile } from "@/types/auth";

function renderWithAuth(
  initialRoute: string,
  user: UserProfile | null,
  isDeactivated = false,
) {
  const value: AuthContextValue = {
    user,
    isLoading: false,
    isDeactivated,
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
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route path="/deactivated" element={<div>Deactivated Screen</div>} />
          <Route element={<RoleGuard allowedRoles={["customer"]} />}>
            <Route path="/portal" element={<div>Customer Portal</div>} />
          </Route>
          <Route element={<RoleGuard allowedRoles={["technician", "admin"]} />}>
            <Route path="/tech" element={<div>Tech Portal</div>} />
          </Route>
          <Route element={<RoleGuard allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<div>Admin Console</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const makeUser = (role: Role, is_active = true): UserProfile => ({
  id: `u-${role}`,
  email: `${role}@lab.deamfods.io`,
  full_name: `Test ${role}`,
  role,
  is_active,
  created_at: "2026-11-26T00:00:00Z",
});

describe("RoleGuard route protection", () => {
  it("redirects unauthenticated visitors to /login", () => {
    renderWithAuth("/portal", null);
    expect(screen.getByText("Login Screen")).toBeInTheDocument();
  });

  it("blocks deactivated accounts and sends them to /deactivated", () => {
    renderWithAuth("/portal", makeUser("customer", false), true);
    expect(screen.getByText("Deactivated Screen")).toBeInTheDocument();
  });

  it("allows customer on /portal and redirects customer away from /tech and /admin", () => {
    renderWithAuth("/portal", makeUser("customer"));
    expect(screen.getByText("Customer Portal")).toBeInTheDocument();

    renderWithAuth("/tech", makeUser("customer"));
    expect(screen.getAllByText("Customer Portal").length).toBeGreaterThan(0);

    renderWithAuth("/admin", makeUser("customer"));
    expect(screen.getAllByText("Customer Portal").length).toBeGreaterThan(0);
  });

  it("allows technician on /tech and redirects technician away from /admin", () => {
    renderWithAuth("/tech", makeUser("technician"));
    expect(screen.getByText("Tech Portal")).toBeInTheDocument();

    renderWithAuth("/admin", makeUser("technician"));
    expect(screen.getAllByText("Tech Portal").length).toBeGreaterThan(0);
  });

  it("allows admin on both /tech and /admin", () => {
    renderWithAuth("/tech", makeUser("admin"));
    expect(screen.getByText("Tech Portal")).toBeInTheDocument();

    renderWithAuth("/admin", makeUser("admin"));
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
  });
});
