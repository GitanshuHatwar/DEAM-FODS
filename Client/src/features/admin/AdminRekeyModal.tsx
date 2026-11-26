import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { isValidRfidFormat, normalizeRfid } from "@/lib/rfid";
import { RfidChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import type { Asset } from "@/types/asset";

export function AdminRekeyModal({
  asset,
  onClose,
}: {
  asset: Asset | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [newRfid, setNewRfid] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNewRfid("");
    setError(null);
  }, [asset]);

  const mutation = useMutation({
    mutationFn: () => api.assets.rekey(asset!.rfid_uid, newRfid),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success(
        "RFID tag re-keyed",
        `${updated.name} updated to ${updated.rfid_uid}. All history migrated.`,
      );
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not re-key device.");
    },
  });

  if (!asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeRfid(newRfid);
    if (!isValidRfidFormat(normalized)) {
      setError("Enter a valid 4–32 alphanumeric RFID UID.");
      return;
    }
    if (normalized === asset.rfid_uid) {
      setError("New RFID UID must differ from the current UID.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={Boolean(asset)}
      onClose={onClose}
      title="Re-Key Equipment RFID Tag"
      description={`Replace damaged or lost RFID tag for ${asset.name}. All tickets, incidents, maintenance logs, and photos cascade automatically.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-3 text-xs font-medium text-[#b94444]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] px-4 py-3 text-xs">
          <span className="text-[#6B7280]">Current RFID UID</span>
          <RfidChip uid={asset.rfid_uid} />
        </div>

        <div>
          <label
            htmlFor="rekey-new-rfid"
            className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
          >
            New Replacement RFID UID *
          </label>
          <input
            id="rekey-new-rfid"
            type="text"
            value={newRfid}
            onChange={(e) => setNewRfid(normalizeRfid(e.target.value))}
            placeholder="e.g. 04C910F2"
            className="input-field mt-1.5 font-mono uppercase"
          />
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Colons, spaces, and lowercase characters are normalized automatically.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={mutation.isPending}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Confirm Re-Key
          </Button>
        </div>
      </form>
    </Modal>
  );
}
