import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  KeyRound,
  Save,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { api, ApiClientError } from "@/lib/api";
import { formatLocalDateTime } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import type { Role } from "@/types/auth";

export function AdminUserDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const {
    data: target,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminUser(id),
    queryFn: () => api.admin.getUser(id),
    enabled: Boolean(id),
  });

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("customer");
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setFullName(target.full_name);
    setRole(target.role);
  }, [target]);

  const isSelf = target?.id === currentUser?.id;

  const updateMutation = useMutation({
    mutationFn: () => api.admin.updateUser(id, { full_name: fullName, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success("Profile updated");
    },
    onError: (err) => {
      toast.error(
        "Update rejected",
        err instanceof Error ? err.message : "Could not update user.",
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      target?.is_active
        ? api.admin.deactivateUser(id)
        : api.admin.reactivateUser(id),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success(
        updated.is_active ? "User reactivated" : "User deactivated",
      );
      setDeleteOpen(false);
      setBlockedMsg(null);
    },
    onError: (err) => {
      toast.error(
        "Status update failed",
        err instanceof Error ? err.message : "Action blocked.",
      );
    },
  });

  const resetPwdMutation = useMutation({
    mutationFn: () => api.admin.resetPassword(id, newPassword),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success("Password reset", "Temporary password applied.");
      setNewPassword("");
      setResetOpen(false);
    },
    onError: (err) => {
      toast.error(
        "Password reset failed",
        err instanceof Error ? err.message : "Error",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.admin.deleteUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success("User deleted");
      navigate("/admin/users");
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
          err instanceof Error ? err.message : "Blocked",
        );
        setDeleteOpen(false);
      }
    },
  });

  if (isLoading) return <CardListSkeleton count={2} />;
  if (isError || !target) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "User not found."}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </Link>
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <RoleBadge role={target.role} />
              <Badge tone={target.is_active ? "success" : "warning"}>
                {target.is_active ? "Active" : "Deactivated"}
              </Badge>
              {isSelf && <Badge tone="mint">Current Session</Badge>}
            </div>
            <h1 className="mt-2 text-xl font-bold text-[#0F172A]">
              {target.full_name}
            </h1>
            <p className="text-xs text-[#6B7280]">
              {target.email} · Created {formatLocalDateTime(target.created_at)}
            </p>
          </div>
        </div>

        {isSelf && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#2E5D4B]/20 bg-[#E8F3EF]/80 p-3 text-xs text-[#2E5D4B]">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Self-Protection Guard:</strong> You cannot demote, deactivate, or delete your own active administrator session.
            </span>
          </div>
        )}

        <form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4 border-t border-[#E5E7EB] pt-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field mt-1.5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Role
            </label>
            <select
              value={role}
              disabled={isSelf}
              onChange={(e) => setRole(e.target.value as Role)}
              className="input-field mt-1.5"
            >
              <option value="customer">User (Customer)</option>
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Save Profile
            </Button>
          </div>
        </form>
      </Card>

      {/* Account Security Actions */}
      <Card variant="warm" padding="lg" className="space-y-3">
        <h2 className="text-sm font-bold text-[#0F172A]">
          Security &amp; Lifecycle Actions
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<KeyRound className="h-4 w-4" />}
            onClick={() => setResetOpen(true)}
          >
            Reset Password
          </Button>

          <Button
            variant={target.is_active ? "warning" : "mint"}
            size="sm"
            disabled={isSelf}
            isLoading={toggleMutation.isPending}
            leftIcon={
              target.is_active ? (
                <UserX className="h-4 w-4" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )
            }
            onClick={() => toggleMutation.mutate()}
          >
            {target.is_active ? "Deactivate Account" : "Reactivate Account"}
          </Button>

          <Button
            variant="danger"
            size="sm"
            disabled={isSelf}
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              setBlockedMsg(null);
              setDeleteOpen(true);
            }}
          >
            Delete User
          </Button>
        </div>
      </Card>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset User Password"
        description={`Set a new login password for ${target.email}.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 6) return;
            resetPwdMutation.mutate();
          }}
          className="space-y-4"
        >
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (6+ characters)"
            className="input-field"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={newPassword.length < 6}
              isLoading={resetPwdMutation.isPending}
            >
              Set New Password
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setBlockedMsg(null);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title={`Delete ${target.full_name}?`}
        description="Permanent deletion is only permitted when the user has zero linked tickets or repair logs."
        confirmLabel="Delete Permanently"
        isLoading={deleteMutation.isPending}
        blockedMessage={blockedMsg}
        fallbackAction={
          target.is_active
            ? {
                label: "Deactivate Account Instead",
                isLoading: toggleMutation.isPending,
                onClick: () => toggleMutation.mutate(),
              }
            : undefined
        }
      />
    </div>
  );
}
