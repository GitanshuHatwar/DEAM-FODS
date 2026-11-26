import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Pin,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { partitionAndSortQueue } from "@/lib/priority";
import { queryKeys } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { PriorityDistributionChart } from "@/components/charts/PriorityDistributionChart";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { QueueTicketCard } from "./QueueTicketCard";

export function TechQueuePage() {
  const [tab, setTab] = useState<"active" | "resolved">("active");
  const [search, setSearch] = useState("");

  const {
    data: tickets = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.tickets({ scope: "queue" }),
    queryFn: () => api.tickets.list(),
    refetchInterval: 15_000,
  });

  const { pinnedActive, waitingQueue, resolvedTickets } =
    partitionAndSortQueue(tickets);

  const matchesSearch = (t: (typeof tickets)[number]) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.asset_name.toLowerCase().includes(q) ||
      t.asset_rfid.toLowerCase().includes(q) ||
      t.ticket_number.toLowerCase().includes(q) ||
      t.raised_by_name.toLowerCase().includes(q)
    );
  };

  const filteredPinned = pinnedActive.filter(matchesSearch);
  const filteredWaiting = waitingQueue.filter(matchesSearch);
  const filteredResolved = resolvedTickets.filter(matchesSearch);

  const criticalCount = [...pinnedActive, ...waitingQueue].filter(
    (t) => t.severity === "critical" || t.triage.safety_risk,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header + Live Refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            Technician Operations
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
            Non-Preemptive Priority Queue
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Active repairs remain pinned at the top while incoming faults rank below by criticality, safety risk, and aging.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          leftIcon={
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
          }
        >
          {isFetching ? "Refreshing…" : "Refresh Queue"}
        </Button>
      </div>

      {/* Analytics Summary Bar + Chart */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
          <GlassPanel padding="md">
            <p className="text-xs font-medium text-[#6B7280]">
              Active In Progress
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-[#0F172A]">
                {pinnedActive.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D99A45]/15 px-2.5 py-0.5 text-xs font-semibold text-[#b87a24]">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Tap tag again to open close-out
            </p>
          </GlassPanel>

          <GlassPanel padding="md">
            <p className="text-xs font-medium text-[#6B7280]">
              Waiting in Queue
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-[#0F172A]">
                {waitingQueue.length}
              </span>
              <span className="rounded-full bg-[#E8F3EF] px-2.5 py-0.5 text-xs font-semibold text-[#2E5D4B]">
                Ranked
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Auto-refreshes every 15s
            </p>
          </GlassPanel>

          <GlassPanel padding="md">
            <p className="text-xs font-medium text-[#6B7280]">
              Critical / Safety Alerts
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-[#DC6464]">
                {criticalCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#DC6464]/12 px-2.5 py-0.5 text-xs font-semibold text-[#b94444]">
                <ShieldAlert className="h-3 w-3" />
                Urgent
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Immediate inspection advised
            </p>
          </GlassPanel>
        </div>

        <GlassPanel padding="md" className="lg:col-span-5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Open Queue by Severity
            </p>
            <span className="text-[11px] font-medium text-[#2E5D4B]">
              {pinnedActive.length + waitingQueue.length} total open
            </span>
          </div>
          <PriorityDistributionChart tickets={tickets} />
        </GlassPanel>
      </div>

      {/* Tabs & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-card">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              tab === "active"
                ? "bg-[#E8F3EF] text-[#2E5D4B]"
                : "text-[#6B7280] hover:text-[#0F172A]",
            )}
          >
            Active Queue ({pinnedActive.length + waitingQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("resolved")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              tab === "resolved"
                ? "bg-[#E8F3EF] text-[#2E5D4B]"
                : "text-[#6B7280] hover:text-[#0F172A]",
            )}
          >
            Resolved Archive ({resolvedTickets.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#6B7280]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ticket #, RFID, asset, or user…"
            className="input-field py-2 pl-10 text-xs"
          />
        </div>
      </div>

      {/* Queue List */}
      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Failed to load queue."
          }
          onRetry={() => refetch()}
        />
      ) : tab === "active" ? (
        <div className="space-y-6">
          {/* Tier 1: Pinned In-Progress */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D99A45]/30 bg-[#F4ECE1]/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D99A45]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Tier 1 · Pinned Active Work ({filteredPinned.length})
                </h2>
              </div>
              <span className="text-xs text-[#6B7280]">
                Non-preemptive: remains pinned above higher-scoring waiting tickets
              </span>
            </div>

            {filteredPinned.length === 0 ? (
              <Card variant="warm" padding="md" className="text-center text-xs text-[#6B7280]">
                No ticket is currently in progress. Tap an asset&apos;s RFID tag to start work on the next ticket.
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPinned.map((ticket) => (
                  <QueueTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    pinned
                  />
                ))}
              </div>
            )}
          </section>

          {/* Tier 2: Priority Waiting Queue */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Tier 2 · Priority Waiting Queue ({filteredWaiting.length})
              </h2>
              <span className="text-xs text-[#6B7280]">
                Sorted by effective priority score + aging
              </span>
            </div>

            {filteredWaiting.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Waiting queue is clear"
                description="All pending maintenance tickets have been claimed or resolved."
              />
            ) : (
              <div className="space-y-3">
                {filteredWaiting.map((ticket, index) => (
                  <QueueTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    rank={index + 1}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : filteredResolved.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="No resolved tickets found"
          description="Resolved maintenance tickets appear here after atomic close-out."
        />
      ) : (
        <div className="space-y-3">
          {filteredResolved.map((ticket) => (
            <QueueTicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
