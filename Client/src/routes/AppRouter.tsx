import { Navigate, Route, Routes } from "react-router-dom";
import { DeactivatedAccountPage } from "@/auth/DeactivatedAccountPage";
import { LoginPage } from "@/auth/LoginPage";
import { PublicOnlyRoute, RoleGuard } from "@/auth/RoleGuard";
import { SignupPage } from "@/auth/SignupPage";
import { AppShell } from "@/components/layout/AppShell";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AdminAuditLogPage } from "@/features/admin/AdminAuditLogPage";
import { AdminDevicesPage } from "@/features/admin/AdminDevicesPage";
import { AdminOverviewPage } from "@/features/admin/AdminOverviewPage";
import { AdminScannersPage } from "@/features/admin/AdminScannersPage";
import { AdminUserDetailPage } from "@/features/admin/AdminUserDetailPage";
import { AdminUserFormPage } from "@/features/admin/AdminUserFormPage";
import { AdminUsersPage } from "@/features/admin/AdminUsersPage";
import { DeviceDetailPage } from "@/features/devices/DeviceDetailPage";
import { DeviceFormPage } from "@/features/devices/DeviceFormPage";
import { DeviceListPage } from "@/features/devices/DeviceListPage";
import { HomePage } from "@/features/home/HomePage";
import { CustomerTicketDetailPage } from "@/features/portal/CustomerTicketDetailPage";
import { MyTicketsPage } from "@/features/portal/MyTicketsPage";
import { RaiseTicketPage } from "@/features/portal/RaiseTicketPage";
import { TechQueuePage } from "@/features/tech/TechQueuePage";
import { TechTicketDetailPage } from "@/features/tech/TechTicketDetailPage";

export function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <SignupPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/deactivated" element={<DeactivatedAccountPage />} />

        {/* Customer Portal */}
        <Route element={<RoleGuard allowedRoles={["customer"]} />}>
          <Route path="/portal" element={<AppShell />}>
            <Route index element={<MyTicketsPage />} />
            <Route path="new" element={<RaiseTicketPage />} />
            <Route path="tickets/:id" element={<CustomerTicketDetailPage />} />
          </Route>
        </Route>

        {/* Technician & Admin Shared Portal */}
        <Route element={<RoleGuard allowedRoles={["technician", "admin"]} />}>
          <Route path="/tech" element={<AppShell />}>
            <Route index element={<TechQueuePage />} />
            <Route path="tickets/:id" element={<TechTicketDetailPage />} />
            <Route path="devices" element={<DeviceListPage />} />
            <Route path="devices/new" element={<DeviceFormPage />} />
            <Route path="devices/:rfid" element={<DeviceDetailPage />} />
            <Route path="devices/:rfid/edit" element={<DeviceFormPage />} />
          </Route>
        </Route>

        {/* Admin Super-Console */}
        <Route element={<RoleGuard allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AppShell />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/new" element={<AdminUserFormPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="devices" element={<AdminDevicesPage />} />
            <Route path="scanners" element={<AdminScannersPage />} />
            <Route path="audit-log" element={<AdminAuditLogPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
