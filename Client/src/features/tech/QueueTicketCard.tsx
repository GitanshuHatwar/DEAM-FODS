import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPin,
  Pin,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { computeEffectivePriority } from "@/lib/priority";
import { formatRelativeAge } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  Badge,
  RfidChip,
  SeverityBadge,
  TicketStatusBadge,
} from "@/components/ui/Badge";
import type { Ticket } from "@/types/ticket";

export function QueueTicketCard({
  ticket,
  rank,
  pinned = false,
}: {
  ticket: Ticket;
  rank?: number;
  pinned?: boolean;
}) {
  const effectiveScore = computeEffectivePriority(ticket);

  return (
    <Link to={`/tech/tickets/${ticket.id}`} className="block group">
      <div
        className={cn(
          "relative rounded-2xl border bg-white p-4 sm:p-5 shadow-card transition-all duration-150 group-hover:shadow-md",
          pinned
            ? "border-[#D99A45]/55 bg-gradient-to-r from-[#FFFDF9] to-white ring-1 ring-[#D99A45]/20"
            : "border-[#E5E7EB] group-hover:border-[#2E5D4B]/45",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {pinned ? (
                <Badge tone="warning">
                  <Pin className="h-3 w-3" />
                  Pinned Active Work
                </Badge>
              ) : (
                rank !== undefined && (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-[#F8F6F3] border border-[#E5E7EB] px-1.5 font-mono text-xs font-bold text-[#0F172A]">
                    #{rank}
                  </span>
                )
              )}

              <span className="font-mono text-xs font-semibold text-[#2E5D4B]">
                {ticket.ticket_number}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <SeverityBadge severity={ticket.severity} />

              {ticket.triage.safety_risk && (
                <Badge tone="error">
                  <AlertTriangle className="h-3 w-3" />
                  Safety Risk
                </Badge>
              )}

              <Badge tone="neutral">
                <Sparkles className="h-3 w-3 text-[#2E5D4B]" />
                {ticket.triage.mode === "gemini" ? "AI Triage" : "Rule-Based"}
              </Badge>
            </div>

            <h3 className="text-base font-semibold text-[#0F172A] group-hover:text-[#2E5D4B] transition-colors">
              {ticket.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6B7280]">
              <span className="font-medium text-[#0F172A]">
                {ticket.asset_name}
              </span>
              <RfidChip uid={ticket.asset_rfid} />
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {ticket.asset_location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatRelativeAge(ticket.created_at)} open
              </span>
              <span>by {ticket.raised_by_name}</span>
            </div>
          </div>

          {/* Priority Score Pillar */}
          <div className="flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-3 sm:border-t-0 sm:pt-0 sm:justify-end">
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Effective Priority
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 sm:justify-end">
                <span className="font-mono text-xl font-bold text-[#0F172A]">
                  {effectiveScore.toFixed(1)}
                </span>
                {ticket.priority_override !== null && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-[#F4ECE1] px-1.5 py-0.5 text-[10px] font-semibold text-[#926018]"
                    title="Manual technician priority override active"
                  >
                    <SlidersHorizontal className="h-2.5 w-2.5" />
                    Override
                  </span>
                )}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] text-[#2E5D4B] transition-colors group-hover:bg-[#2E5D4B] group-hover:text-white">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
