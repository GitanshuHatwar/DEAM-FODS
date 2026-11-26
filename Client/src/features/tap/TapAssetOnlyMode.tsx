import { Link } from "react-router-dom";
import { Calendar, Cpu, Edit3, ExternalLink, MapPin, Wrench } from "lucide-react";
import { formatLocalDate, formatLocalDateTime, isDateOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AssetStatusBadge, Badge, RfidChip, ScannerChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ImageGallery } from "@/components/ui/ImageGallery";
import type { TapPayload } from "@/types/tap";

export function TapAssetOnlyMode({
  payload,
  onNavigateAway,
}: {
  payload: TapPayload;
  onNavigateAway: () => void;
}) {
  const asset = payload.asset;
  if (!asset) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#648DAA]/30 bg-[#648DAA]/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4.5 w-4.5 text-[#476d88]" />
            <span className="text-sm font-bold text-[#0F172A]">
              Equipment Inspection (No Open Tickets)
            </span>
          </div>
          <ScannerChip code={payload.scanner_code} />
        </div>
        <p className="mt-1 text-xs text-[#6B7280]">
          Tag scanned at {formatLocalDateTime(payload.tapped_at)}. All fault reports for this device are clear.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">{asset.name}</h3>
            <p className="text-xs text-[#6B7280]">
              {asset.model}
              {asset.serial_no ? ` · SN ${asset.serial_no}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AssetStatusBadge status={asset.status} />
            <RfidChip uid={asset.rfid_uid} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-3 text-xs">
          <div>
            <span className="text-[#6B7280]">Location</span>
            <p className="mt-0.5 font-medium text-[#0F172A] flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#2E5D4B]" />
              {asset.location}
            </p>
          </div>
          <div>
            <span className="text-[#6B7280]">Criticality</span>
            <p className="mt-0.5 font-mono font-semibold text-[#0F172A]">
              Tier {asset.criticality} / 5
            </p>
          </div>
          <div>
            <span className="text-[#6B7280]">Last Serviced</span>
            <p className="mt-0.5 font-medium text-[#0F172A]">
              {formatLocalDate(asset.last_service_date)}
            </p>
          </div>
          <div>
            <span className="text-[#6B7280]">Next Service Due</span>
            <p
              className={cn(
                "mt-0.5 font-medium",
                isDateOverdue(asset.next_service_due)
                  ? "text-[#D99A45] font-semibold"
                  : "text-[#0F172A]",
              )}
            >
              {formatLocalDate(asset.next_service_due)}
            </p>
          </div>
        </div>

        {asset.specs && Object.keys(asset.specs).length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Specifications
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(asset.specs).map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg border border-[#E5E7EB] bg-[#F8F6F3]/70 px-3 py-2 text-xs"
                >
                  <span className="text-[#6B7280]">{k}: </span>
                  <span className="font-medium text-[#0F172A]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {asset.images.length > 0 && <ImageGallery images={asset.images} />}
      </div>

      {/* Merged Recent History */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          Recent Incidents &amp; Maintenance
        </p>
        {asset.recent_incidents.length === 0 &&
        asset.recent_maintenance.length === 0 ? (
          <p className="text-xs text-[#6B7280]">No recorded history yet.</p>
        ) : (
          <div className="space-y-2">
            {asset.recent_incidents.slice(0, 3).map((inc) => (
              <div
                key={inc.id}
                className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="warning">Incident</Badge>
                  <span className="text-[#6B7280]">
                    {formatLocalDate(inc.resolved_at)}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-[#0F172A]">{inc.summary}</p>
                <p className="mt-0.5 text-[#6B7280]">{inc.resolution}</p>
              </div>
            ))}
            {asset.recent_maintenance.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="mint" className="capitalize">
                    <Wrench className="h-3 w-3" />
                    {m.type}
                  </Badge>
                  <span className="text-[#6B7280] flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatLocalDate(m.performed_at)}
                  </span>
                </div>
                <p className="mt-1.5 text-[#0F172A]">{m.report}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Link
          to={`/tech/devices/${asset.rfid_uid}`}
          onClick={onNavigateAway}
          className="flex-1"
        >
          <Button
            variant="primary"
            className="w-full"
            rightIcon={<ExternalLink className="h-4 w-4" />}
          >
            Full Biodata &amp; Log Maintenance
          </Button>
        </Link>
        <Link
          to={`/tech/devices/${asset.rfid_uid}/edit`}
          onClick={onNavigateAway}
        >
          <Button variant="secondary" leftIcon={<Edit3 className="h-4 w-4" />}>
            Edit Device
          </Button>
        </Link>
      </div>
    </div>
  );
}
