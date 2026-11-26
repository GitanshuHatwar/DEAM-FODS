import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  ExternalLink,
  MapPin,
  Radio,
  Wrench,
} from "lucide-react";
import { formatLocalDate, formatLocalDateTime, isDateOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  AssetStatusBadge,
  Badge,
  RfidChip,
  ScannerChip,
  SeverityBadge,
} from "@/components/ui/Badge";
import { ImageGallery } from "@/components/ui/ImageGallery";
import type { TapPayload, TapTicketSummary } from "@/types/tap";

export function TapStartMode({
  payload,
  onNavigateAway,
}: {
  payload: TapPayload;
  onNavigateAway: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"complaint" | "biodata">("complaint");
  const allTickets: TapTicketSummary[] = [
    ...(payload.ticket ? [payload.ticket] : []),
    ...(payload.other_open_tickets ?? []),
  ];
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    payload.ticket?.id ?? "",
  );

  const currentTicket =
    allTickets.find((t) => t.id === selectedTicketId) ?? payload.ticket;
  const asset = payload.asset;

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="rounded-2xl border border-[#16A36A]/30 bg-[#E8F3EF] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#16A36A]" />
            <span className="text-sm font-bold text-[#2E5D4B]">
              Work Started via RFID Tap
            </span>
          </div>
          <ScannerChip code={payload.scanner_code} />
        </div>
        <p className="mt-1.5 text-xs text-[#0F172A]">
          Ticket transitioned to <span className="font-mono font-semibold">under_review</span> and pinned to Tier 1 at{" "}
          {formatLocalDateTime(payload.tapped_at)}.
        </p>
      </div>

      {/* Other open tickets switcher if multiple open tickets on this asset */}
      {allTickets.length > 1 && (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            Open Tickets on this Equipment ({allTickets.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allTickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTicketId(t.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                  t.id === currentTicket?.id
                    ? "border-[#2E5D4B] bg-[#2E5D4B] text-white"
                    : "border-[#E5E7EB] bg-white text-[#0F172A] hover:border-[#2E5D4B]/40",
                )}
              >
                {t.ticket_number ?? t.id.slice(0, 8)} · {t.title.slice(0, 26)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary / Secondary Tabs */}
      <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("complaint")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
            activeTab === "complaint"
              ? "bg-white text-[#2E5D4B] shadow-card"
              : "text-[#6B7280] hover:text-[#0F172A]",
          )}
        >
          Fault Complaint
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("biodata")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
            activeTab === "biodata"
              ? "bg-white text-[#2E5D4B] shadow-card"
              : "text-[#6B7280] hover:text-[#0F172A]",
          )}
        >
          Device Biodata &amp; History
        </button>
      </div>

      {activeTab === "complaint" && currentTicket ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {currentTicket.ticket_number && (
                  <span className="font-mono text-xs font-bold text-[#2E5D4B]">
                    {currentTicket.ticket_number}
                  </span>
                )}
                <SeverityBadge severity={currentTicket.severity} />
                {currentTicket.triage?.safety_risk && (
                  <Badge tone="error">
                    <AlertTriangle className="h-3 w-3" />
                    Safety Risk
                  </Badge>
                )}
              </div>
              <span className="font-mono text-xs font-semibold text-[#0F172A]">
                Score {currentTicket.priority.toFixed(1)}
              </span>
            </div>

            <h3 className="text-base font-bold text-[#0F172A]">
              {currentTicket.title}
            </h3>
            <p className="whitespace-pre-line text-sm text-[#0F172A] leading-relaxed">
              {currentTicket.description}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280] pt-1">
              <span>Reporter: {currentTicket.raised_by.full_name}</span>
              <span>Occurred: {formatLocalDateTime(currentTicket.occurred_at)}</span>
              {currentTicket.workstation && (
                <span>Workstation: {currentTicket.workstation}</span>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Fault Photos ({currentTicket.images.length})
            </p>
            <ImageGallery images={currentTicket.images} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F4ECE1]/65 px-4 py-3 text-xs">
            <span className="text-[#0F172A]">
              When repairs are complete, tap the asset RFID tag again to open Close-Out.
            </span>
            <Link
              to={`/tech/tickets/${currentTicket.id}`}
              onClick={onNavigateAway}
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#2E5D4B] hover:underline ml-3"
            >
              Open Ticket
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : asset ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-[#2E5D4B]" />
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {asset.name}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  {asset.model}
                  {asset.serial_no ? ` · SN ${asset.serial_no}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AssetStatusBadge status={asset.status} />
                <RfidChip uid={asset.rfid_uid} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#F8F6F3] p-3 text-xs border border-[#E5E7EB]">
              <div>
                <span className="text-[#6B7280] block">Location</span>
                <span className="font-medium text-[#0F172A] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-[#2E5D4B]" />
                  {asset.location}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Criticality</span>
                <span className="font-mono font-semibold text-[#0F172A] mt-0.5 block">
                  Tier {asset.criticality} / 5
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Warranty</span>
                <span className="font-medium text-[#0F172A] mt-0.5 block">
                  {formatLocalDate(asset.warranty_expiry)}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Next Service</span>
                <span
                  className={cn(
                    "font-medium mt-0.5 block",
                    isDateOverdue(asset.next_service_due)
                      ? "text-[#D99A45] font-semibold"
                      : "text-[#0F172A]",
                  )}
                >
                  {formatLocalDate(asset.next_service_due)}
                </span>
              </div>
            </div>

            {asset.specs && Object.keys(asset.specs).length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Technical Specifications
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(asset.specs).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg border border-[#E5E7EB] bg-[#F8F6F3]/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-[#6B7280]">{k}: </span>
                      <span className="font-medium text-[#0F172A]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Recent Incidents &amp; Maintenance
              </p>
              <Link
                to={`/tech/devices/${asset.rfid_uid}`}
                onClick={onNavigateAway}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E5D4B] hover:underline"
              >
                Full History
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            {asset.recent_incidents.length === 0 &&
            asset.recent_maintenance.length === 0 ? (
              <p className="text-xs text-[#6B7280]">
                No prior incidents or maintenance records.
              </p>
            ) : (
              <div className="space-y-2">
                {asset.recent_incidents.slice(0, 3).map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-2.5 text-xs"
                  >
                    <p className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                      <Radio className="h-3 w-3 text-[#D99A45]" />
                      {inc.summary}
                    </p>
                    <p className="mt-0.5 text-[#6B7280]">{inc.resolution}</p>
                  </div>
                ))}
                {asset.recent_maintenance.slice(0, 3).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-xs"
                  >
                    <p className="font-semibold text-[#2E5D4B] flex items-center gap-1.5 capitalize">
                      <Wrench className="h-3 w-3" />
                      {log.type} Maintenance ·{" "}
                      <Calendar className="h-3 w-3 text-[#6B7280]" />
                      {formatLocalDate(log.performed_at)}
                    </p>
                    <p className="mt-0.5 text-[#6B7280]">{log.report}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
