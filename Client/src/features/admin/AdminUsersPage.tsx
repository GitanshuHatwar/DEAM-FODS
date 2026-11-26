import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Eye,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { api, ApiClientError } from "@/lib/api";
import { formatLocalDate } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import type { AdminUser } from "@/types/admin";

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminUsers({
      role: roleFilter,
      active: activeFilter,
      q: search,
    }),
    queryFn: () =>
      api.admin.listUsers({
        role: roleFilter,
        active: activeFilter,
        q: search,
      }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (target: AdminUser) =>
      target.is_active
        ? api.admin.deactivateUser(target.id)
        : api.admin.reactivateUser(target.id),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success(
        updated.is_active ? "Account reactivated" : "Account deactivated",
        `${updated.full_name} (${updated.email})`,
      );
      setDeleteTarget(null);
      setBlockedMsg(null);
    },
    onError: (err) => {
      toast.error(
        "Update failed",
        err instanceof Error ? err.message : "Action rejected.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success("User deleted permanently");
      setDeleteTarget(null);
      setBlockedMsg(null);
    },
    onError: (err) => {
      if (
        err instanceof ApiClientError &&
        err.code === "has_linked_records"
      ) {
        setBlockedMsg(err.message);
      } else {
        toast.error(
          "Delete failed",
          err instanceof Error ? err.message : "Could not delete user.",
        );
        setDeleteTarget(null);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            Identity &amp; Access
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
            Users &amp; Technicians
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Provision technicians, manage roles, suspend accounts, and preserve linked history.
          </p>
        </div>

        <Link to="/admin/users/new">
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            Create User / Tech
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by full name or email…"
              className="input-field py-2 pl-10 text-xs"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
              className="input-field py-2 text-xs"
            >
              <option value="all">All Roles</option>
              <option value="customer">Users (Customer)</option>
              <option value="technician">Technicians</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              aria-label="Filter by account status"
              className="input-field py-2 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Deactivated Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Could not load users."}
          onRetry={() => refetch()}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E7EB] bg-[#F8F6F3] text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-[#F8F6F3]/65"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#0F172A]">
                            {u.full_name}
                          </span>
                          {isSelf && <Badge tone="mint">You</Badge>}
                        </div>
                        <p className="text-xs text-[#6B7280]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3.5">
                        {u.is_active ? (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="warning">Deactivated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                        {formatLocalDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/admin/users/${u.id}`}>
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<Eye className="h-3.5 w-3.5" />}
                            >
                              Manage
                            </Button>
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf || toggleActiveMutation.isPending}
                            title={
                              isSelf
                                ? "Self-protection: you cannot deactivate your own account"
                                : u.is_active
                                  ? "Deactivate account"
                                  : "Reactivate account"
                            }
                            onClick={() => toggleActiveMutation.mutate(u)}
                          >
                            {u.is_active ? (
                              <UserX className="h-4 w-4 text-[#D99A45]" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-[#16A36A]" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "Self-protection: you cannot delete your own account"
                                : "Delete user"
                            }
                            onClick={() => {
                              setBlockedMsg(null);
                              setDeleteTarget(u);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-[#DC6464]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setBlockedMsg(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title={`Delete ${deleteTarget?.full_name ?? "User"}?`}
        description="Permanent deletion removes this account completely. If the user has linked tickets or maintenance history, deletion will be blocked to protect audit integrity."
        confirmLabel="Delete Permanently"
        isLoading={deleteMutation.isPending}
        blockedMessage={blockedMsg}
        fallbackAction={
          deleteTarget?.is_active
            ? {
                label: "Deactivate Account Instead",
                isLoading: toggleActiveMutation.isPending,
                onClick: () => {
                  if (deleteTarget) toggleActiveMutation.mutate(deleteTarget);
                },
              }
            : undefined
        }
      />
    </div>
  );
}
