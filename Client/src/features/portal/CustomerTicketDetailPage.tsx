import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDateTime } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import {
  RfidChip,
  SeverityBadge,
  TicketStatusBadge,
} from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { TicketStepper } from "@/components/ui/Stepper";

export function CustomerTicketDetailPage() {
  const { id = "" } = useParams<{ id: string }>();

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

  if (isLoading) {
    return <CardListSkeleton count={2} />;
  }

  if (isError || !ticket) {
    return (
      <ErrorState
        title="Unable to load ticket"
        message={error instanceof Error ? error.message : "Ticket not found."}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to My Tickets
        </Link>
      </div>

      {/* Header Card */}
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#2E5D4B]">
                {ticket.ticket_number}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <SeverityBadge severity={ticket.severity} />
              <RfidChip uid={ticket.asset_rfid} />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] sm:text-2xl">
              {ticket.title}
            </h1>
          </div>
        </div>

        <div className="mt-6 border-t border-[#E5E7EB] pt-6">
          <TicketStepper status={ticket.status} />
        </div>
      </Card>

      {/* Resolution Card when resolved */}
      {ticket.status === "resolved" && ticket.resolution && (
        <Card variant="beige" padding="lg" className="border-[#16A36A]/35">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16A36A]/15 text-[#16A36A]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Resolution Summary
                </h2>
                <span className="text-xs text-[#6B7280]">
                  Resolved {formatLocalDateTime(ticket.resolution.resolved_at)}
                  {ticket.resolution.resolved_by_name
                    ? ` by ${ticket.resolution.resolved_by_name}`
                    : ""}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E5E7EB] bg-white/90 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Root Cause
                  </p>
                  <p className="mt-1 text-sm text-[#0F172A]">
                    {ticket.resolution.root_cause}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white/90 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Action &amp; Fix Taken
                  </p>
                  <p className="mt-1 text-sm text-[#0F172A]">
                    {ticket.resolution.resolution}
                  </p>
                </div>
              </div>

              {ticket.resolution.parts_replaced.length > 0 && (
                <div className="rounded-xl border border-[#E5E7EB] bg-white/90 p-3.5">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    <Package className="h-3.5 w-3.5 text-[#2E5D4B]" />
                    Parts Replaced
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.resolution.parts_replaced.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F8F6F3] px-2.5 py-1 text-xs font-medium text-[#0F172A]"
                      >
                        <span>{p.name}</span>
                        <span className="font-mono text-[#2E5D4B]">×{p.qty}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Fault Details + Equipment Metadata */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card padding="lg" className="md:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Reported Fault Details
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#0F172A]">
            {ticket.description}
          </p>

          <div className="pt-2">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Attached Photos ({ticket.images.length})
            </h3>
            <ImageGallery
              images={ticket.images}
              emptyLabel="No photos were attached to this fault report."
            />
          </div>
        </Card>

        <Card variant="warm" padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Equipment &amp; Context
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Equipment
              </p>
              <p className="mt-0.5 font-semibold text-[#0F172A]">
                {ticket.asset_name}
              </p>
              {ticket.asset_model && (
                <p className="text-xs text-[#6B7280]">{ticket.asset_model}</p>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-[#6B7280]">
              <MapPin className="h-4 w-4 shrink-0 text-[#2E5D4B]" />
              <div>
                <p className="font-medium text-[#0F172A]">
                  {ticket.asset_location}
                </p>
                {ticket.workstation && <p>Workstation: {ticket.workstation}</p>}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-[#6B7280]">
              <Calendar className="h-4 w-4 shrink-0 text-[#2E5D4B]" />
              <div>
                <p>Occurred: {formatLocalDateTime(ticket.occurred_at)}</p>
                <p>Submitted: {formatLocalDateTime(ticket.created_at)}</p>
              </div>
            </div>

            {ticket.started_by_name && (
              <div className="flex items-start gap-2 text-xs text-[#6B7280]">
                <User className="h-4 w-4 shrink-0 text-[#2E5D4B]" />
                <div>
                  <p>Assigned Technician</p>
                  <p className="font-medium text-[#0F172A]">
                    {ticket.started_by_name}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
