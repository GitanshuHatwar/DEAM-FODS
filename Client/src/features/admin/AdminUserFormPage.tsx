import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import type { Role } from "@/types/auth";

export function AdminUserFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("technician");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const strength =
    password.length >= 12
      ? { label: "Strong", color: "bg-[#16A36A]", width: "w-full" }
      : password.length >= 8
        ? { label: "Good", color: "bg-[#2E5D4B]", width: "w-2/3" }
        : password.length > 0
          ? { label: "Weak (8+ chars recommended)", color: "bg-[#D99A45]", width: "w-1/3" }
          : null;

  const createMutation = useMutation({
    mutationFn: () =>
      api.admin.createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        password,
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success(
        "User provisioned",
        `${created.full_name} created with role ${created.role}.`,
      );
      navigate("/admin/users");
    },
    onError: (err) => {
      setFormError(
        err instanceof Error ? err.message : "Failed to create user.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setFormError("Full name, valid email, and password (6+ chars) are required.");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">
          Provision User or Technician
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Create customer, technician, or administrator accounts. Action is recorded in the audit log.
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-3 text-xs font-medium text-[#b94444]">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="input-field mt-1.5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@lab.deamfods.io"
              className="input-field mt-1.5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Assigned Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="input-field mt-1.5"
            >
              <option value="technician">Technician (Queue, Devices, RFID Tap)</option>
              <option value="customer">User / Customer (Report &amp; Track Tickets)</option>
              <option value="admin">Administrator (Full System Control)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Initial Password *
            </label>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-2.5 text-[#6B7280] hover:text-[#0F172A]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {strength && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div
                    className={`h-full transition-all ${strength.color} ${strength.width}`}
                  />
                </div>
                <p className="text-[11px] text-[#6B7280]">{strength.label}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              onClick={() => navigate("/admin/users")}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
