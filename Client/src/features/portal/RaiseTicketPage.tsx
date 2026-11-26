import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { api } from "@/lib/api";
import { toLocalDateTimeInputValue } from "@/lib/date";
import type { CompressedImageResult } from "@/lib/imageCompression";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import type { Asset } from "@/types/asset";
import { DeviceSelector } from "./DeviceSelector";
import { ImageDropzone } from "./ImageDropzone";

const EXAMPLE_ISSUES = [
  "Printer Offline",
  "Monitor No Signal",
  "Abnormal Noise / Heat",
  "Calibration Drift",
];

export function RaiseTicketPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [workstation, setWorkstation] = useState("");
  const [title, setTitle] = useState("");
  const [occurredAtLocal, setOccurredAtLocal] = useState(() =>
    toLocalDateTimeInputValue(),
  );
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<CompressedImageResult[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedAsset) {
        throw new Error("Please select or validate an active equipment RFID.");
      }
      const occurredIso = occurredAtLocal
        ? new Date(occurredAtLocal).toISOString()
        : new Date().toISOString();

      return api.tickets.create({
        asset_rfid: selectedAsset.rfid_uid,
        title,
        description,
        occurred_at: occurredIso,
        workstation: workstation.trim() || undefined,
        images: images.map((i) => i.file),
      });
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tickets() });
      toast.success(
        `Ticket ${created.ticket_number} submitted`,
        `Assigned ${created.severity.toUpperCase()} priority and queued for technician triage.`,
      );
      navigate("/portal");
    },
    onError: (err) => {
      setFormError(
        err instanceof Error ? err.message : "Unable to submit maintenance ticket.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedAsset) {
      setFormError("Step 1: Select an equipment item or validate a valid RFID UID.");
      return;
    }
    if (title.trim().length < 4) {
      setFormError("Step 2: Enter a concise issue title (at least 4 characters).");
      return;
    }
    if (description.trim().length < 10) {
      setFormError(
        "Step 3: Please describe the observed symptoms (at least 10 characters).",
      );
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to My Tickets
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">
            Report Equipment Fault
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Submit an equipment issue in under 2 minutes. Our triage engine prioritizes safety and critical downtime automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="rounded-2xl border border-[#DC6464]/35 bg-[#DC6464]/10 px-4 py-3 text-sm font-medium text-[#b94444]">
            {formError}
          </div>
        )}

        {/* Section 1: Device or Equipment Details */}
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2E5D4B] text-xs font-bold text-white">
              1
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Device or Equipment Details
              </h2>
              <p className="text-xs text-[#6B7280]">
                Choose from active equipment or scan/type the asset&apos;s RFID tag UID.
              </p>
            </div>
          </div>

          <DeviceSelector
            selectedAsset={selectedAsset}
            onSelect={setSelectedAsset}
          />

          <div className="mt-4">
            <label
              htmlFor="workstation-context"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
            >
              Workstation / Desk Context (Optional)
            </label>
            <input
              id="workstation-context"
              type="text"
              value={workstation}
              onChange={(e) => setWorkstation(e.target.value)}
              placeholder="e.g. Desk D · Lab Bench 4"
              className="input-field mt-1.5"
            />
          </div>
        </Card>

        {/* Section 2: What is the Issue */}
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2E5D4B] text-xs font-bold text-white">
              2
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                What is the Issue?
              </h2>
              <p className="text-xs text-[#6B7280]">
                Provide a short summary and when you noticed the fault.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="issue-title"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Issue Summary *
              </label>
              <input
                id="issue-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Printer offline and amber warning LED flashing"
                className="input-field mt-1.5"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLE_ISSUES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTitle(chip)}
                    className="rounded-lg border border-[#E5E7EB] bg-[#F8F6F3] px-2.5 py-1 text-xs font-medium text-[#6B7280] transition hover:border-[#2E5D4B]/30 hover:bg-[#E8F3EF] hover:text-[#2E5D4B]"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="occurred-at"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Issue Occurred At
              </label>
              <input
                id="occurred-at"
                type="datetime-local"
                value={occurredAtLocal}
                onChange={(e) => setOccurredAtLocal(e.target.value)}
                className="input-field mt-1.5 sm:max-w-xs"
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Describe the Fault & Optional Photo */}
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2E5D4B] text-xs font-bold text-white">
              3
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Describe the Fault &amp; Optional Photo
              </h2>
              <p className="text-xs text-[#6B7280]">
                Include error codes, strange sounds, heat/smoke signs, or steps before failure.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="fault-description"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Detailed Fault Description *
              </label>
              <textarea
                id="fault-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, any error message on the display, and whether it prevents lab work from continuing…"
                className="input-field mt-1.5"
              />
              <p className="mt-1 text-right text-[11px] text-[#6B7280]">
                {description.trim().length} characters
              </p>
            </div>

            <ImageDropzone items={images} onChange={setImages} maxFiles={2} />
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate("/portal")}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={createMutation.isPending}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Submit Maintenance Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
