import { Link } from "react-router-dom";
import { AlertCircle, PlusCircle } from "lucide-react";
import { formatLocalDateTime } from "@/lib/date";
import { RfidChip, ScannerChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { TapPayload } from "@/types/tap";

export function TapUnknownTagMode({
  payload,
  onNavigateAway,
}: {
  payload: TapPayload;
  onNavigateAway: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-[#b94444]">
            <AlertCircle className="h-5 w-5" />
            <h3 className="text-base font-bold">Unregistered RFID Tag Scanned</h3>
          </div>
          <ScannerChip code={payload.scanner_code} />
        </div>

        <p className="text-sm text-[#0F172A] leading-relaxed">
          No active or archived equipment matches this RFID UID in the registry.
          Verify whether this is a newly tagged machine ready for onboarding.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <RfidChip uid={payload.rfid_uid} />
          <span className="text-xs text-[#6B7280]">
            Scanned {formatLocalDateTime(payload.tapped_at)}
          </span>
        </div>
      </div>

      <Link
        to={`/tech/devices/new?rfid=${encodeURIComponent(payload.rfid_uid)}`}
        onClick={onNavigateAway}
        className="block"
      >
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          leftIcon={<PlusCircle className="h-4 w-4" />}
        >
          Add Device with RFID {payload.rfid_uid}
        </Button>
      </Link>
    </div>
  );
}
