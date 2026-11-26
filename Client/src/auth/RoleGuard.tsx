import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Role } from "@/types/auth";
import { getHomeRouteForRole, useAuth } from "./AuthProvider";

export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children?: React.ReactNode;
}) {
  const { user, isLoading, isDeactivated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F6F3] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-card">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isDeactivated || (user && !user.is_active)) {
    return <Navigate to="/deactivated" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isDeactivated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F6F3] flex items-center justify-center p-6">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (isDeactivated) {
    return <Navigate to="/deactivated" replace />;
  }

  if (user) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
