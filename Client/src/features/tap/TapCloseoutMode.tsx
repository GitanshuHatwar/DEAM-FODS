import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDateTime } from "@/lib/date";
import type { CompressedImageResult } from "@/lib/imageCompression";
import { Button } from "@/components/ui/Button";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { RfidChip, ScannerChip, SeverityBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import { ImageDropzone } from "@/features/portal/ImageDropzone";
import type { PartReplaced } from "@/types/asset";
import type { TapPayload } from "@/types/tap";

export function TapCloseoutMode({
  payload,
  onResolved,
}: {
  payload: TapPayload;
  onResolved: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const ticket = payload.ticket;
  const asset = payload.asset;

  const [rootCause, setRootCause] = useState("");
  const [resolution, setResolution] = useState("");
  const [parts, setParts] = useState<PartReplaced[]>([]);
  const [assetStatus, setAssetStatus] = useState<
    "active" | "under_maintenance" | "retired"
  >("active");
  const [nextServiceDue, setNextServiceDue] = useState(
    asset?.next_service_due ?? "",
  );
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [report, setReport] = useState("");
  const [postPhotos, setPostPhotos] = useState<CompressedImageResult[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const existingPhotoCount = asset?.images.length ?? 0;
  const remainingPhotoQuota = Math.max(0, 3 - existingPhotoCount);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!ticket || !asset) throw new Error("Missing ticket or asset context.");

      // Upload optional post-repair device photos first
      for (const item of postPhotos) {
        await api.assets.uploadImage(asset.rfid_uid, item.file);
      }

      const validParts = parts
        .filter((p) => p.name.trim())
        .map((p) => ({ name: p.name.trim(), qty: Math.max(1, p.qty) }));

      return api.tickets.resolve(ticket.id, {
        root_cause: rootCause.trim(),
        resolution: resolution.trim(),
        parts_replaced: validParts,
        asset_updates: {
          status: assetStatus,
          next_service_due: nextServiceDue || null,
          notes: notes.trim() || null,
        },
        report: report.trim() || undefined,
      });
    },
    onSuccess: (resolved) => {
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      void qc.invalidateQueries({ queryKey: ["tickets", resolved.id] });
      void qc.invalidateQueries({ queryKey: ["assets"] });
      if (asset) {
        void qc.invalidateQueries({ queryKey: ["assets", asset.rfid_uid] });
        void qc.invalidateQueries({
          queryKey: ["assets", asset.rfid_uid, "history"],
        });
      }
      toast.success(
        `Ticket ${resolved.ticket_number} resolved`,
        "Incident and maintenance record appended atomically to device history.",
      );
      onResolved();
    },
    onError: (err) => {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit close-out.",
      );
    },
  });

  if (!ticket || !asset) return null;

  const handleAddPart = () => {
    setParts((prev) => [...prev, { name: "", qty: 1 }]);
  };

  const handlePartChange = (
    idx: number,
    field: "name" | "qty",
    value: string | number,
  ) => {
    setParts((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (rootCause.trim().length < 4) {
      setFormError("Root cause is required (minimum 4 characters).");
      return;
    }
    if (resolution.trim().length < 4) {
      setFormError("Resolution details are required (minimum 4 characters).");
      return;
    }
    resolveMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#D99A45]/40 bg-[#F4ECE1] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-4.5 w-4.5 text-[#b87a24]" />
            <span className="text-sm font-bold text-[#0F172A]">
              Close-Out &amp; Maintenance Record
            </span>
          </div>
          <ScannerChip code={payload.scanner_code} />
        </div>
        <p className="mt-1 text-xs text-[#6B7280]">
          Second RFID tap detected at {formatLocalDateTime(payload.tapped_at)}. Ticket remains open until you submit this atomic close-out form.
        </p>
      </div>

      {/* Original Complaint Context */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F6F3] p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#2E5D4B]">
              {ticket.ticket_number ?? ticket.id.slice(0, 8)}
            </span>
            <SeverityBadge severity={ticket.severity} />
            <RfidChip uid={asset.rfid_uid} />
          </div>
          <span className="text-xs text-[#6B7280]">{asset.name}</span>
        </div>

        <h3 className="text-sm font-bold text-[#0F172A]">{ticket.title}</h3>
        <p className="text-xs leading-relaxed text-[#6B7280]">
          {ticket.description}
        </p>
        {ticket.images.length > 0 && <ImageGallery images={ticket.images} />}
      </div>

      {/* Close-out Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-3 text-xs font-medium text-[#b94444]">
            {formError}
          </div>
        )}

        <div>
          <label
            htmlFor="closeout-root-cause"
            className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
          >
            Root Cause *
          </label>
          <input
            id="closeout-root-cause"
            type="text"
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            placeholder="e.g. Fuser assembly thermal sensor fault"
            className="input-field mt-1.5"
          />
        </div>

        <div>
          <label
            htmlFor="closeout-resolution"
            className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
          >
            Resolution &amp; Repair Performed *
          </label>
          <textarea
            id="closeout-resolution"
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="e.g. Replaced fuser thermistor and cleared error state"
            className="input-field mt-1.5"
          />
        </div>

        {/* Parts Replaced Builder */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Parts Replaced
            </span>
            <Button
              type="button"
              variant="mint"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={handleAddPart}
            >
              Add Part
            </Button>
          </div>

          {parts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F6F3] px-3 py-2.5 text-xs text-[#6B7280]">
              No parts added. Click &ldquo;Add Part&rdquo; if components were replaced.
            </p>
          ) : (
            <div className="space-y-2">
              {parts.map((part, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={part.name}
                    onChange={(e) =>
                      handlePartChange(idx, "name", e.target.value)
                    }
                    placeholder="Part name / SKU"
                    className="input-field flex-1 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={part.qty}
                    onChange={(e) =>
                      handlePartChange(idx, "qty", Number(e.target.value) || 1)
                    }
                    className="input-field w-20 py-2 text-xs font-mono"
                    aria-label="Part quantity"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setParts((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="rounded-lg p-2 text-[#6B7280] hover:bg-[#DC6464]/10 hover:text-[#DC6464]"
                    aria-label="Remove part"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Asset Updates */}
        <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-[#E5E7EB] bg-[#F8F6F3] p-4">
          <div>
            <label
              htmlFor="closeout-asset-status"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
            >
              Updated Device Status
            </label>
            <select
              id="closeout-asset-status"
              value={assetStatus}
              onChange={(e) =>
                setAssetStatus(
                  e.target.value as "active" | "under_maintenance" | "retired",
                )
              }
              className="input-field mt-1.5 py-2 text-xs"
            >
              <option value="active">Active (Operational)</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="closeout-next-service"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
            >
              Next Service Due
            </label>
            <input
              id="closeout-next-service"
              type="date"
              value={nextServiceDue}
              onChange={(e) => setNextServiceDue(e.target.value)}
              className="input-field mt-1.5 py-2 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="closeout-asset-notes"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
            >
              Device Notes
            </label>
            <input
              id="closeout-asset-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Updated operational or follow-up notes…"
              className="input-field mt-1.5 py-2 text-xs"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="closeout-report"
            className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
          >
            Detailed Verification Report (Optional)
          </label>
          <textarea
            id="closeout-report"
            rows={2}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="e.g. Tested 20-page duplex print run with zero jams"
            className="input-field mt-1.5"
          />
        </div>

        {remainingPhotoQuota > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Post-Repair Device Photos (Optional, {remainingPhotoQuota} slots left)
            </p>
            <ImageDropzone
              items={postPhotos}
              onChange={setPostPhotos}
              maxFiles={remainingPhotoQuota}
            />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={resolveMutation.isPending}
          leftIcon={<CheckCircle2 className="h-4 w-4" />}
        >
          Submit Atomic Close-Out &amp; Resolve Ticket
        </Button>
      </form>
    </div>
  );
}
