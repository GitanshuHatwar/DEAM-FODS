import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Cpu,
  FileText,
  Layers,
  Radio,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDateTime, formatRelativeAge } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { PriorityDistributionChart } from "@/components/charts/PriorityDistributionChart";
import { TicketResolutionChart } from "@/components/charts/TicketResolutionChart";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";

export function AdminOverviewPage() {
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: queryKeys.tickets({ scope: "admin-overview" }),
    queryFn: () => api.tickets.list(),
  });

  const { data: assets = [] } = useQuery({
    queryKey: queryKeys.assets({ include_archived: true }),
    queryFn: () => api.assets.list({ include_archived: true }),
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.adminUsers({}),
    queryFn: () => api.admin.listUsers(),
  });

  const { data: scanners = [] } = useQuery({
    queryKey: queryKeys.adminScanners,
    queryFn: () => api.admin.listScanners(),
  });

  const { data: auditData } = useQuery({
    queryKey: queryKeys.adminAuditLog({ page: 1, page_size: 5 }),
    queryFn: () => api.admin.listAuditLogs({ page: 1, page_size: 5 }),
  });

  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const activeAssets = assets.filter((a) => !a.archived_at).length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const activeScanners = scanners.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            System Super-Console
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
            DEAM-FODS Operations Overview
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Real-time queue telemetry, equipment health, scanner connectivity, and audit activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/admin/users/new">
            <Button variant="primary" size="sm" leftIcon={<Users className="h-4 w-4" />}>
              Provision User
            </Button>
          </Link>
          <Link to="/tech">
            <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Open Priority Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassPanel padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Open Tickets</span>
            <Layers className="h-4 w-4 text-[#2E5D4B]" />
          </div>
          {ticketsLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-[#0F172A]">{openTickets}</p>
          )}
          <p className="mt-1 text-xs text-[#6B7280]">
            {tickets.filter((t) => t.status === "under_review").length} pinned in progress
          </p>
        </GlassPanel>

        <GlassPanel padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Registered Devices</span>
            <Cpu className="h-4 w-4 text-[#2E5D4B]" />
          </div>
          <p className="mt-2 text-3xl font-bold text-[#0F172A]">{activeAssets}</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            {assets.length - activeAssets} archived in history
          </p>
        </GlassPanel>

        <GlassPanel padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Active Accounts</span>
            <Users className="h-4 w-4 text-[#2E5D4B]" />
          </div>
          <p className="mt-2 text-3xl font-bold text-[#0F172A]">{activeUsers}</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            {users.filter((u) => u.role === "technician" && u.is_active).length} technicians ·{" "}
            {users.filter((u) => u.role === "admin" && u.is_active).length} admins
          </p>
        </GlassPanel>

        <GlassPanel padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">ESP32 Scanners</span>
            <Radio className="h-4 w-4 text-[#16A36A]" />
          </div>
          <p className="mt-2 text-3xl font-bold text-[#0F172A]">
            {activeScanners} / {scanners.length}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Latest ping:{" "}
            {scanners[0]?.last_seen_at
              ? `${formatRelativeAge(scanners[0].last_seen_at)} ago`
              : "—"}
          </p>
        </GlassPanel>
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel padding="lg">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Fault Intake vs. Resolution Trend
              </h2>
              <p className="text-xs text-[#6B7280]">
                Sage primary telemetry across recent operating cycles
              </p>
            </div>
            <Badge tone="mint">Weekly</Badge>
          </div>
          <TicketResolutionChart tickets={tickets} />
        </GlassPanel>

        <GlassPanel padding="lg">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Open Queue Severity Breakdown
              </h2>
              <p className="text-xs text-[#6B7280]">
                Distribution across Critical, High, Medium, and Low tiers
              </p>
            </div>
            <Badge tone="beige">Live Queue</Badge>
          </div>
          <PriorityDistributionChart tickets={tickets} />
        </GlassPanel>
      </div>

      {/* Recent Audit Events */}
      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-[#2E5D4B]" />
            <h2 className="text-base font-semibold text-[#0F172A]">
              Recent Administrative Audit Events
            </h2>
          </div>
          <Link
            to="/admin/audit-log"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E5D4B] hover:underline"
          >
            View Full Audit Log
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-2.5">
          {(auditData?.items ?? []).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] px-4 py-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-[#2E5D4B]">
                  {entry.action}
                </span>
                <Badge tone="beige">{entry.target_type}</Badge>
                <span className="font-mono text-[#0F172A]">{entry.target_id}</span>
                <span className="text-[#6B7280]">by {entry.actor_name}</span>
              </div>
              <span className="text-[#6B7280]">
                {formatLocalDateTime(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
