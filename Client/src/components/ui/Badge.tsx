import React from "react";
import { Cpu, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetStatus } from "@/types/asset";
import type { Role } from "@/types/auth";
import type { TicketSeverity, TicketStatus } from "@/types/ticket";

export type BadgeTone =
  | "primary"
  | "mint"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "beige";

const toneClasses: Record<BadgeTone, string> = {
  primary: "bg-[#2E5D4B] text-white border-[#2E5D4B]",
  mint: "bg-[#E8F3EF] text-[#2E5D4B] border-[#2E5D4B]/20",
  success: "bg-[#16A36A]/10 text-[#16A36A] border-[#16A36A]/25",
  warning: "bg-[#D99A45]/12 text-[#b87a24] border-[#D99A45]/30",
  error: "bg-[#DC6464]/12 text-[#b94444] border-[#DC6464]/30",
  info: "bg-[#648DAA]/12 text-[#476d88] border-[#648DAA]/30",
  neutral: "bg-[#F8F6F3] text-[#6B7280] border-[#E5E7EB]",
  beige: "bg-[#F4ECE1] text-[#0F172A] border-[#E5E7EB]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: TicketSeverity }) {
  const map: Record<TicketSeverity, { label: string; tone: BadgeTone; dot: string }> = {
    critical: { label: "Critical", tone: "error", dot: "bg-[#DC6464]" },
    high: { label: "High", tone: "warning", dot: "bg-[#D99A45]" },
    medium: { label: "Medium", tone: "mint", dot: "bg-[#2E5D4B]" },
    low: { label: "Low", tone: "info", dot: "bg-[#648DAA]" },
  };
  const cfg = map[severity];
  return (
    <Badge tone={cfg.tone}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </Badge>
  );
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
    pending_review: { label: "Pending Review", tone: "neutral" },
    under_review: { label: "Under Review", tone: "warning" },
    resolved: { label: "Resolved", tone: "success" },
  };
  const cfg = map[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function AssetStatusBadge({
  status,
  archived,
}: {
  status: AssetStatus;
  archived?: boolean;
}) {
  if (archived) {
    return <Badge tone="warning">Archived</Badge>;
  }
  const map: Record<AssetStatus, { label: string; tone: BadgeTone }> = {
    active: { label: "Active", tone: "success" },
    under_maintenance: { label: "Under Maintenance", tone: "warning" },
    retired: { label: "Retired", tone: "neutral" },
  };
  const cfg = map[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, { label: string; tone: BadgeTone }> = {
    customer: { label: "User", tone: "info" },
    technician: { label: "Technician", tone: "mint" },
    admin: { label: "Admin", tone: "primary" },
  };
  const cfg = map[role];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function RfidChip({
  uid,
  className,
}: {
  uid: string;
  className?: string;
}) {
  return (
    <span className={cn("rfid-chip", className)} title={`RFID UID: ${uid}`}>
      <Radio className="h-3 w-3 shrink-0" />
      <span>{uid}</span>
    </span>
  );
}

export function ScannerChip({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  return (
    <span className={cn("warm-chip", className)}>
      <Cpu className="h-3 w-3 text-[#2E5D4B] shrink-0" />
      <span>{code}</span>
    </span>
  );
}
