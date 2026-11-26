import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Cpu,
  ExternalLink,
  History,
  MapPin,
  Radio,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDate, formatLocalDateTime, isDateOverdue } from "@/lib/date";
import { simulateRfidTap } from "@/lib/mocks/mockApi";
import { computeEffectivePriority } from "@/lib/priority";
import { queryKeys } from "@/lib/queryClient";
import { isMockMode } from "@/lib/supabase";
import {
  AssetStatusBadge,
  Badge,
  RfidChip,
  SeverityBadge,
  TicketStatusBadge,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { TicketStepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/ToastProvider";
import { PriorityOverrideModal } from "./PriorityOverrideModal";

export function TechTicketDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [simulatingTap, setSimulatingTap] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const {
    data: ticket,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: () => api.tickets.get(id),
    enabled: Boolean(id),
  });

  const { data: asset } = useQuery({
    queryKey: queryKeys.asset(ticket?.asset_rfid ?? ""),
    queryFn: () => api.assets.get(ticket!.asset_rfid),
    enabled: Boolean(ticket?.asset_rfid),
  });

  if (isLoading) return <CardListSkeleton count={3} />;

  if (isError || !ticket) {
    return (
      <ErrorState
        title="Unable to load ticket"
        message={error instanceof Error ? error.message : "Ticket not found."}
        onRetry={() => refetch()}
      />
    );
  }

  const effectiveScore = computeEffectivePriority(ticket);

  const handleSimulateAssetTap = async () => {
    setSimulatingTap(true);
    try {
      await simulateRfidTap(ticket.asset_rfid, "SCN-001");
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      void qc.invalidateQueries({ queryKey: ["tickets", ticket.id] });
    } catch (err) {
      toast.error(
        "Tap simulation blocked",
        err instanceof Error ? err.message : "Try again in 3 seconds.",
      );
    } finally {
      setSimulatingTap(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/tech"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Priority Queue
        </Link>
      </div>

      {/* Tap-First Workflow Clarity Banner */}
      {ticket.status !== "resolved" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#2E5D4B]/25 bg-[#E8F3EF]/85 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2E5D4B] text-white">
              <Radio className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {ticket.status === "pending_review"
                  ? "Tap the physical RFID tag at the equipment to start work"
                  : "Repair in progress — tap the equipment RFID tag again to open Close-Out"}
              </p>
              <p className="text-xs text-[#6B7280]">
                Tap 1 transitions <span className="font-mono">pending_review → under_review</span>. Tap 2 opens the atomic close-out &amp; maintenance form without auto-resolving.
              </p>
            </div>
          </div>

          {isMockMode && (
            <Button
              variant="primary"
              size="sm"
              isLoading={simulatingTap}
              onClick={handleSimulateAssetTap}
              leftIcon={<Radio className="h-3.5 w-3.5" />}
            >
              Simulate Tap ({ticket.asset_rfid})
            </Button>
          )}
        </div>
      )}

      {/* Header */}
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#2E5D4B]">
                {ticket.ticket_number}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <SeverityBadge severity={ticket.severity} />
              {ticket.triage.safety_risk && (
                <Badge tone="error">
                  <AlertTriangle className="h-3 w-3" />
                  Safety Hazard
                </Badge>
              )}
              <RfidChip uid={ticket.asset_rfid} />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] sm:text-2xl">
              {ticket.title}
            </h1>
            <p className="text-xs text-[#6B7280]">
              Reported by <strong className="text-[#0F172A]">{ticket.raised_by_name}</strong> on{" "}
              {formatLocalDateTime(ticket.created_at)} · Fault occurred{" "}
              {formatLocalDateTime(ticket.occurred_at)}
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            onClick={() => setOverrideOpen(true)}
            disabled={ticket.status === "resolved"}
          >
            Override Priority
          </Button>
        </div>

        <div className="mt-6 border-t border-[#E5E7EB] pt-6">
          <TicketStepper status={ticket.status} />
        </div>
      </Card>

      {/* Two-Column Detail Body */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column */}
        <div className="space-y-5 lg:col-span-7">
          <Card padding="lg" className="space-y-4">
            <h2 className="text-base font-semibold text-[#0F172A]">
              Customer Fault Complaint
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#0F172A]">
              {ticket.description}
            </p>
            {ticket.workstation && (
              <p className="text-xs text-[#6B7280]">
                Workstation context:{" "}
                <strong className="text-[#0F172A]">{ticket.workstation}</strong>
              </p>
            )}

            <div className="pt-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Fault Evidence Photos ({ticket.images.length})
              </h3>
              <ImageGallery images={ticket.images} />
            </div>
          </Card>

          {/* Triage Breakdown */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2E5D4B]" />
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Triage Scoring Breakdown
                </h2>
              </div>
              <Badge tone="mint">
                {ticket.triage.mode === "gemini"
                  ? "Gemini AI Triage"
                  : "Rule-Based Engine"}
              </Badge>
            </div>

            {ticket.triage.summary && (
              <p className="rounded-xl bg-[#F8F6F3] px-3.5 py-2.5 text-xs text-[#0F172A] border border-[#E5E7EB]">
                {ticket.triage.summary}
              </p>
            )}

            <div className="space-y-2">
              {ticket.triage.factors.map((factor, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs"
                >
                  <span className="text-[#0F172A]">{factor.label}</span>
                  <span className="font-mono font-semibold text-[#2E5D4B]">
                    +{factor.points} pts
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Status History */}
          {ticket.status_history && ticket.status_history.length > 0 && (
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#2E5D4B]" />
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Ticket Transition Audit
                </h2>
              </div>
              <div className="space-y-2.5">
                {ticket.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F6F3]/80 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#2E5D4B]">
                        {entry.from_status ?? "created"} → {entry.to_status}
                      </span>
                      <Badge tone="beige">via {entry.via}</Badge>
                    </div>
                    <span className="text-[#6B7280]">
                      {entry.changed_by_name ?? entry.changed_by} ·{" "}
                      {formatLocalDateTime(entry.changed_at)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5 lg:col-span-5">
          {/* Effective Priority */}
          <Card variant="beige" padding="lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Effective Queue Score
              </span>
              {ticket.priority_override !== null && (
                <Badge tone="warning">Manual Override Active</Badge>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-4xl font-bold text-[#0F172A]">
                {effectiveScore.toFixed(1)}
              </span>
              <span className="text-xs text-[#6B7280]">
                Base rule score: <strong className="font-mono">{ticket.priority_score}</strong>
              </span>
            </div>
          </Card>

          {/* Linked Device Biodata */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4.5 w-4.5 text-[#2E5D4B]" />
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Linked Equipment Biodata
                </h2>
              </div>
              <Link
                to={`/tech/devices/${ticket.asset_rfid}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                Full Biodata
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {asset ? (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {asset.name}
                    </p>
                    <p className="text-[#6B7280]">
                      {asset.model} · SN: <span className="font-mono">{asset.serial_no}</span>
                    </p>
                  </div>
                  <AssetStatusBadge
                    status={asset.status}
                    archived={Boolean(asset.archived_at)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#F8F6F3] p-3 border border-[#E5E7EB]">
                  <div>
                    <p className="text-[10px] uppercase text-[#6B7280]">Location</p>
                    <p className="mt-0.5 font-medium text-[#0F172A] flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#2E5D4B]" />
                      {asset.location}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#6B7280]">Criticality</p>
                    <p className="mt-0.5 font-mono font-semibold text-[#0F172A]">
                      Tier {asset.criticality} / 5
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#6B7280]">Warranty</p>
                    <p className="mt-0.5 font-medium text-[#0F172A] flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#6B7280]" />
                      {formatLocalDate(asset.warranty_expiry)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#6B7280]">Next Service</p>
                    <p
                      className={
                        isDateOverdue(asset.next_service_due)
                          ? "mt-0.5 font-semibold text-[#D99A45]"
                          : "mt-0.5 font-medium text-[#0F172A]"
                      }
                    >
                      {formatLocalDate(asset.next_service_due)}
                      {isDateOverdue(asset.next_service_due) ? " (Overdue)" : ""}
                    </p>
                  </div>
                </div>

                {/* Recent Incidents Preview */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Recent Past Incidents ({asset.recent_incidents?.length ?? 0})
                  </p>
                  {asset.recent_incidents && asset.recent_incidents.length > 0 ? (
                    <div className="space-y-2">
                      {asset.recent_incidents.slice(0, 5).map((inc) => (
                        <div
                          key={inc.id}
                          className="rounded-xl border border-[#E5E7EB] bg-white p-2.5"
                        >
                          <p className="font-medium text-[#0F172A]">
                            {inc.summary}
                          </p>
                          <p className="mt-0.5 text-[#6B7280]">
                            Fix: {inc.resolution}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#6B7280]">No past incidents logged.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#6B7280]">Loading device biodata…</p>
            )}

            {ticket.started_by_name && (
              <div className="border-t border-[#E5E7EB] pt-3 flex items-center gap-2 text-xs text-[#6B7280]">
                <User className="h-3.5 w-3.5 text-[#2E5D4B]" />
                <span>
                  Started by <strong className="text-[#0F172A]">{ticket.started_by_name}</strong>
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>

      <PriorityOverrideModal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        ticket={ticket}
      />
    </div>
  );
}
