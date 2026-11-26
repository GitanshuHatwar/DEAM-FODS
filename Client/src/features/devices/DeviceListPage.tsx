import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDate, isDateOverdue } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { AssetStatusBadge, Badge, RfidChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardListSkeleton } from "@/components/ui/Skeleton";

export function DeviceListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [criticalityFilter, setCriticalityFilter] = useState("all");

  const {
    data: assets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.assets({
      q: search,
      status: statusFilter,
      criticality: criticalityFilter,
    }),
    queryFn: () =>
      api.assets.list({
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        criticality:
          criticalityFilter !== "all" ? Number(criticalityFilter) : undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            Equipment Registry
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
            Registered Assets &amp; Biodata
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Inspect specifications, warranty dates, overdue service alerts, and complete maintenance timelines.
          </p>
        </div>

        <Link to="/tech/devices/new">
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            Register Equipment
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, RFID UID, model, serial, or location…"
              className="input-field py-2 pl-10 text-xs"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="input-field py-2 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              aria-label="Filter by criticality"
              className="input-field py-2 text-xs"
            >
              <option value="all">All Criticality Tiers</option>
              <option value="5">Criticality 5 (Mission Critical)</option>
              <option value="4">Criticality 4 (High)</option>
              <option value="3">Criticality 3 (Standard)</option>
              <option value="2">Criticality 2 (Low)</option>
              <option value="1">Criticality 1 (Spare)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load equipment."}
          onRetry={() => refetch()}
        />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Cpu className="h-6 w-6" />}
          title="No matching equipment"
          description="Adjust your filters or register a new asset using its 13.56 MHz RFID UID."
          action={
            <Link to="/tech/devices/new">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                Add Equipment
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assets.map((asset) => {
            const overdue = isDateOverdue(asset.next_service_due);
            return (
              <Link
                key={asset.rfid_uid}
                to={`/tech/devices/${asset.rfid_uid}`}
                className="block group"
              >
                <Card
                  padding="md"
                  className="h-full transition-all duration-150 group-hover:border-[#2E5D4B]/45 group-hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <RfidChip uid={asset.rfid_uid} />
                        <AssetStatusBadge status={asset.status} />
                        {overdue && (
                          <Badge tone="warning">
                            <AlertTriangle className="h-3 w-3" />
                            Service Overdue
                          </Badge>
                        )}
                      </div>
                      <h2 className="mt-2.5 text-base font-bold text-[#0F172A] group-hover:text-[#2E5D4B] transition-colors">
                        {asset.name}
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        {asset.model} · SN:{" "}
                        <span className="font-mono">{asset.serial_no}</span>
                      </p>
                    </div>

                    <span className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] px-2.5 py-1 font-mono text-xs font-semibold text-[#0F172A] shrink-0">
                      Tier {asset.criticality}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3 text-xs text-[#6B7280]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#2E5D4B]" />
                      {asset.location}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={overdue ? "font-semibold text-[#D99A45]" : ""}>
                        Due: {formatLocalDate(asset.next_service_due)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#2E5D4B] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
