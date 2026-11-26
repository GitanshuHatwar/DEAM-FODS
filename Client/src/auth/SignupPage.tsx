import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Info, Lock, Mail, Radio, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAuth } from "./AuthProvider";

export function SignupPage() {
  const { signupCustomer } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError("Provide your full name, valid email, and a password (6+ characters).");
      return;
    }
    setIsSubmitting(true);
    try {
      await signupCustomer(fullName, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F8F6F3] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white/80 px-3 py-1 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2E5D4B] text-white shadow-md hover:bg-[#3F7A64] transition-colors"
          >
            <Radio className="h-6 w-6" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#0F172A]">
            Create User Account
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Report equipment faults and follow live repair progress
          </p>
        </div>

        <GlassPanel padding="lg" className="bg-white/85">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 px-3.5 py-2.5 text-xs font-medium text-[#b94444]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#6B7280]" />
                <input
                  id="signup-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Lee"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Work / Lab Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#6B7280]" />
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jordan@lab.deamfods.io"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#6B7280]" />
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#F4ECE1]/65 p-3 text-xs text-[#6B7280]">
              <Info className="h-4 w-4 shrink-0 text-[#2E5D4B] mt-0.5" />
              <span>
                Public registration creates a standard <strong>User (Customer)</strong> account.
                Technician and Admin accounts are provisioned exclusively by system administrators.
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-5 border-t border-[#E5E7EB] pt-4 text-center text-xs text-[#6B7280]">
            Already registered?{" "}
            <Link
              to="/login"
              className="font-semibold text-[#2E5D4B] hover:text-[#3F7A64] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
