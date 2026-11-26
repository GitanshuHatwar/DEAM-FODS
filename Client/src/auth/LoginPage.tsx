import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  Radio,
  RotateCcw,
  Shield,
  User,
  UserX,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { isMockMode } from "@/lib/supabase";
import { getHomeRouteForRole, useAuth } from "./AuthProvider";

export function LoginPage() {
  const { loginWithPassword, quickLoginAs, resetDemoWorkspace } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter both your email address and password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await loginWithPassword(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (
    userId: string,
    targetRoute: string,
  ) => {
    await quickLoginAs(userId);
    navigate(targetRoute, { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F6F3] px-4 py-10 flex flex-col items-center justify-center">
      {/* Subtle organic sage ambient shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#E8F3EF] blur-3xl opacity-80" />
        <div className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-[#F4ECE1] blur-3xl opacity-90" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white/80 px-3 py-1 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Brand header */}
        <div className="text-center">
          <Link
            to="/"
            className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2E5D4B] text-white shadow-md hover:bg-[#3F7A64] transition-colors"
          >
            <Radio className="h-6 w-6" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#0F172A]">
            DEAM-FODS
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            RFID-Based Smart Lab Maintenance &amp; Ticketing
          </p>
        </div>

        <GlassPanel padding="lg" className="bg-white/85">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A]">Sign in</h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                Access your workspace portal based on your assigned role.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 px-3.5 py-2.5 text-xs font-medium text-[#b94444]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#6B7280]" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@lab.deamfods.io"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#6B7280]" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-5 border-t border-[#E5E7EB] pt-4 text-center text-xs text-[#6B7280]">
            New lab member or operator?{" "}
            <Link
              to="/signup"
              className="font-semibold text-[#2E5D4B] hover:text-[#3F7A64] underline-offset-4 hover:underline"
            >
              Create a customer account
            </Link>
          </div>
        </GlassPanel>

        {isMockMode && (
          <GlassPanel padding="md" className="bg-[#F4ECE1]/75 border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
                  Quick Demo Access (Mock Mode)
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  Switch roles instantaneously against seeded equipment &amp; tickets
                </p>
              </div>
              <button
                type="button"
                onClick={resetDemoWorkspace}
                title="Reset mock database to initial seed"
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#6B7280] hover:text-[#2E5D4B]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleDemoLogin("user-customer-1", getHomeRouteForRole("customer"))
                }
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-center transition hover:border-[#2E5D4B]/40 hover:bg-[#E8F3EF]/60"
              >
                <User className="h-4 w-4 text-[#648DAA]" />
                <span className="text-xs font-semibold text-[#0F172A]">User</span>
                <span className="text-[10px] text-[#6B7280]">Maya Lin</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDemoLogin("user-tech-1", getHomeRouteForRole("technician"))
                }
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-center transition hover:border-[#2E5D4B]/40 hover:bg-[#E8F3EF]/60"
              >
                <Wrench className="h-4 w-4 text-[#2E5D4B]" />
                <span className="text-xs font-semibold text-[#0F172A]">Technician</span>
                <span className="text-[10px] text-[#6B7280]">Arjun Mehta</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDemoLogin("user-admin-1", getHomeRouteForRole("admin"))
                }
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-center transition hover:border-[#2E5D4B]/40 hover:bg-[#E8F3EF]/60"
              >
                <Shield className="h-4 w-4 text-[#2E5D4B]" />
                <span className="text-xs font-semibold text-[#0F172A]">Admin</span>
                <span className="text-[10px] text-[#6B7280]">Elena Rostova</span>
              </button>
            </div>

            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => handleDemoLogin("user-inactive-1", "/deactivated")}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280] hover:text-[#DC6464]"
              >
                <UserX className="h-3 w-3" />
                Test Deactivated Account Guard
              </button>
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
