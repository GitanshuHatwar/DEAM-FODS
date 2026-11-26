import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Cpu,
  Edit3,
  MapPin,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDate, isDateOverdue } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AssetStatusBadge, Badge, RfidChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { DeviceHistoryTimeline } from "./DeviceHistoryTimeline";
import { MaintenanceLogModal } from "./MaintenanceLogModal";

export function DeviceDetailPage() {
  const { rfid = "" } = useParams<{ rfid: string }>();
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const {
    data: asset,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.asset(rfid),
    queryFn: () => api.assets.get(rfid),
    enabled: Boolean(rfid),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.assetHistory(rfid),
    queryFn: () => api.assets.history(rfid),
    enabled: Boolean(rfid),
  });

  if (isLoading) return <CardListSkeleton count={3} />;

  if (isError || !asset) {
    return (
      <ErrorState
        title="Equipment record not found"
        message={error instanceof Error ? error.message : "Could not load device."}
        onRetry={() => refetch()}
      />
    );
  }

  const overdue = isDateOverdue(asset.next_service_due);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/tech/devices"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Equipment Registry
        </Link>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="mint"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setMaintenanceOpen(true)}
            disabled={Boolean(asset.archived_at)}
          >
            Log Maintenance
          </Button>
          <Link to={`/tech/devices/${asset.rfid_uid}/edit`}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit3 className="h-4 w-4" />}
            >
              Edit Device
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Biodata Card */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <RfidChip uid={asset.rfid_uid} />
              <AssetStatusBadge
                status={asset.status}
                archived={Boolean(asset.archived_at)}
              />
              <Badge tone="beige">Criticality {asset.criticality} / 5</Badge>
              {overdue && (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" />
                  Service Overdue
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A]">{asset.name}</h1>
            <p className="text-sm text-[#6B7280]">
              Model <strong className="text-[#0F172A]">{asset.model}</strong> · Serial{" "}
              <span className="font-mono text-[#0F172A]">{asset.serial_no}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-[#E5E7EB] bg-[#F8F6F3] p-4 text-xs">
          <div>
            <span className="text-[#6B7280]">Location</span>
            <p className="mt-1 font-semibold text-[#0F172A] flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#2E5D4B]" />
              {asset.location}
            </p>
          </div>
          <div>
            <span className="text-[#6B7280]">Install &amp; Warranty</span>
            <p className="mt-1 font-medium text-[#0F172A] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#2E5D4B]" />
              Installed {formatLocalDate(asset.install_date)}
            </p>
            <p className="text-[11px] text-[#6B7280]">
              Warranty expires {formatLocalDate(asset.warranty_expiry)}
            </p>
          </div>
          <div>
            <span className="text-[#6B7280]">Last Service</span>
            <p className="mt-1 font-medium text-[#0F172A] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#6B7280]" />
              {formatLocalDate(asset.last_service_date)}
            </p>
          </div>
          <div>
            <span className="text-[#6B7280]">Next Service Due</span>
            <p
              className={cn(
                "mt-1 font-semibold flex items-center gap-1.5",
                overdue ? "text-[#D99A45]" : "text-[#0F172A]",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {formatLocalDate(asset.next_service_due)}
            </p>
          </div>
        </div>

        {asset.notes && (
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F4ECE1]/60 px-4 py-3 text-xs text-[#0F172A]">
            <strong className="text-[#2E5D4B]">Technician Notes: </strong>
            {asset.notes}
          </div>
        )}
      </Card>

      {/* Specs + Photos */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card padding="lg" className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4.5 w-4.5 text-[#2E5D4B]" />
            <h2 className="text-base font-semibold text-[#0F172A]">
              Technical Specifications
            </h2>
          </div>

          {Object.keys(asset.specs).length === 0 ? (
            <p className="text-xs text-[#6B7280]">
              No technical key-value specifications recorded yet.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {Object.entries(asset.specs).map(([key, val]) => (
                <div
                  key={key}
                  className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] px-3.5 py-2.5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    {key}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0F172A]">
                    {val}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="lg" className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Equipment Photos ({asset.images.length}/3)
          </h2>
          <ImageGallery
            images={asset.images.map((i) => i.url)}
            emptyLabel="No photos uploaded for this asset."
          />
        </Card>
      </div>

      {/* Merged History Timeline */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[#0F172A]">
          Merged Incident &amp; Maintenance Timeline ({history.length})
        </h2>
        {historyLoading ? (
          <CardListSkeleton count={2} />
        ) : (
          <DeviceHistoryTimeline items={history} />
        )}
      </div>

      <MaintenanceLogModal
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        rfidUid={asset.rfid_uid}
        assetName={asset.name}
      />
    </div>
  );
}
