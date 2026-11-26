import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, AlertTriangle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import { formatLocalDateTime } from "@/lib/date";
import { RfidChip, ScannerChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import type { TapPayload } from "@/types/tap";

export function TapArchivedTagMode({
  payload,
  onRestored,
}: {
  payload: TapPayload;
  onRestored: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const asset = payload.asset;

  const restoreMutation = useMutation({
    mutationFn: () => api.assets.restore(payload.rfid_uid),
    onSuccess: (restored) => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["assets", restored.rfid_uid] });
      toast.success(
        "Device restored",
        `${restored.name} (${restored.rfid_uid}) is active again.`,
      );
      onRestored();
    },
    onError: (err) => {
      toast.error(
        "Restore failed",
        err instanceof Error ? err.message : "Could not restore device.",
      );
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#D99A45]/40 bg-[#F4ECE1] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#926018]">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-base font-bold">Archived Device Tag Scanned</h3>
          </div>
          <ScannerChip code={payload.scanner_code} />
        </div>

        <p className="text-sm text-[#0F172A]">
          <strong>{asset?.name ?? "This device"}</strong> was archived
          {asset?.archived_at
            ? ` on ${formatLocalDateTime(asset.archived_at)}`
            : ""}
          . Historical repair logs remain intact, but new tickets cannot be raised against archived tags.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <RfidChip uid={payload.rfid_uid} />
          {asset?.location && (
            <span className="text-xs text-[#6B7280]">{asset.location}</span>
          )}
        </div>
      </div>

      {user?.role === "admin" ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={restoreMutation.isPending}
          onClick={() => restoreMutation.mutate()}
          leftIcon={<ArchiveRestore className="h-4 w-4" />}
        >
          Restore Archived Device
        </Button>
      ) : (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-3.5 text-xs text-[#6B7280]">
          Only an Administrator can restore an archived equipment record. Contact an admin if this machine is returning to active lab service.
        </div>
      )}
    </div>
  );
}
