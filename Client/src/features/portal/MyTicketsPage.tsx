import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Plus, Search, Wrench } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import { formatLocalDateTime, formatRelativeAge } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { RfidChip, TicketStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { TicketStepper } from "@/components/ui/Stepper";
import type { TicketStatus } from "@/types/ticket";

type FilterValue = "all" | TicketStatus;

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending Review" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved", label: "Resolved" },
];

export function MyTicketsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  const {
    data: tickets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.tickets({ scope: "customer" }),
    queryFn: () => api.tickets.list(),
    refetchInterval: 20_000,
  });

  const counts = {
    all: tickets.length,
    pending_review: tickets.filter((t) => t.status === "pending_review").length,
    under_review: tickets.filter((t) => t.status === "under_review").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  const visibleTickets = tickets
    .filter((t) => (filter === "all" ? true : t.status === filter))
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.asset_name.toLowerCase().includes(q) ||
        t.asset_rfid.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <GlassPanel padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            User Maintenance Portal
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A]">
            Welcome back, {user?.full_name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Track your equipment fault reports through review and hardware repair completion.
          </p>
        </div>

        <Link to="/portal/new" className="shrink-0">
          <Button variant="primary" size="lg" leftIcon={<Plus className="h-4 w-4" />}>
            Report Equipment Fault
          </Button>
        </Link>
      </GlassPanel>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                filter === f.value
                  ? "border-[#2E5D4B] bg-[#E8F3EF] text-[#2E5D4B] font-semibold"
                  : "border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#0F172A]",
              )}
            >
              <span>{f.label}</span>
              <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-[#0F172A]">
                {counts[f.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#6B7280]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets or RFID…"
            className="input-field py-2 pl-10 text-xs"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Could not load your tickets."}
          onRetry={() => refetch()}
        />
      ) : visibleTickets.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={tickets.length === 0 ? "No fault reports yet" : "No matching tickets"}
          description={
            tickets.length === 0
              ? "When an equipment fault occurs at your bench or workstation, report it here for immediate prioritization."
              : "Try clearing your search or switching status filters."
          }
          action={
            tickets.length === 0 ? (
              <Link to="/portal/new">
                <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                  Submit First Ticket
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleTickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/portal/tickets/${ticket.id}`}
              className="block group"
            >
              <Card
                padding="md"
                className="transition-all duration-150 group-hover:border-[#2E5D4B]/40 group-hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#2E5D4B]">
                        {ticket.ticket_number}
                      </span>
                      <TicketStatusBadge status={ticket.status} />
                      <RfidChip uid={ticket.asset_rfid} />
                    </div>

                    <h2 className="text-base font-semibold text-[#0F172A] group-hover:text-[#2E5D4B] transition-colors">
                      {ticket.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280]">
                      <span className="font-medium text-[#0F172A]">
                        {ticket.asset_name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {ticket.asset_location}
                      </span>
                      <span>
                        Reported {formatLocalDateTime(ticket.created_at)} (
                        {formatRelativeAge(ticket.created_at)} ago)
                      </span>
                    </div>
                  </div>

                  <div className="w-full lg:w-72 shrink-0">
                    <TicketStepper status={ticket.status} compact />
                  </div>

                  <div className="hidden items-center text-xs font-semibold text-[#2E5D4B] lg:flex">
                    <span>Details</span>
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
