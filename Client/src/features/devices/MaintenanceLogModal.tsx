import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import type { MaintenanceType, PartReplaced } from "@/types/asset";

export function MaintenanceLogModal({
  open,
  onClose,
  rfidUid,
  assetName,
}: {
  open: boolean;
  onClose: () => void;
  rfidUid: string;
  assetName: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const [type, setType] = useState<MaintenanceType>("preventive");
  const [report, setReport] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [parts, setParts] = useState<PartReplaced[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.assets.addMaintenance(rfidUid, {
        type,
        report: report.trim(),
        parts_replaced: parts
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), qty: Math.max(1, p.qty) })),
        next_due_date: nextDueDate || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assets", rfidUid] });
      void qc.invalidateQueries({ queryKey: ["assets", rfidUid, "history"] });
      void qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success(
        "Maintenance log added",
        `Recorded ${type} service for ${assetName}.`,
      );
      setReport("");
      setParts([]);
      setNextDueDate("");
      onClose();
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to save maintenance record.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (report.trim().length < 5) {
      setError("Please describe the maintenance or inspection performed.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Standalone Maintenance"
      description={`Add preventive service, inspection, or calibration record for ${assetName} (${rfidUid}).`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-3 text-xs font-medium text-[#b94444]">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="mnt-type"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
            >
              Maintenance Type
            </label>
            <select
              id="mnt-type"
              value={type}
              onChange={(e) => setType(e.target.value as MaintenanceType)}
              className="input-field mt-1.5 py-2 text-xs"
            >
              <option value="preventive">Preventive</option>
              <option value="inspection">Inspection</option>
              <option value="corrective">Corrective</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="mnt-next-due"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
            >
              Next Service Due (Optional)
            </label>
            <input
              id="mnt-next-due"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="input-field mt-1.5 py-2 text-xs"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="mnt-report"
            className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
          >
            Service &amp; Findings Report *
          </label>
          <textarea
            id="mnt-report"
            rows={3}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Describe calibration checks, cleaning, lubrication, or component tests…"
            className="input-field mt-1.5"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Parts Consumed / Replaced
            </span>
            <Button
              type="button"
              variant="mint"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setParts((prev) => [...prev, { name: "", qty: 1 }])}
            >
              Add Part
            </Button>
          </div>

          {parts.map((part, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={part.name}
                onChange={(e) =>
                  setParts((prev) =>
                    prev.map((p, i) =>
                      i === idx ? { ...p, name: e.target.value } : p,
                    ),
                  )
                }
                placeholder="Consumable or part name"
                className="input-field flex-1 py-2 text-xs"
              />
              <input
                type="number"
                min={1}
                value={part.qty}
                onChange={(e) =>
                  setParts((prev) =>
                    prev.map((p, i) =>
                      i === idx
                        ? { ...p, qty: Number(e.target.value) || 1 }
                        : p,
                    ),
                  )
                }
                className="input-field w-20 py-2 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() =>
                  setParts((prev) => prev.filter((_, i) => i !== idx))
                }
                className="rounded-lg p-2 text-[#6B7280] hover:text-[#DC6464]"
                aria-label="Remove part"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={mutation.isPending}
            leftIcon={<Wrench className="h-4 w-4" />}
          >
            Save Maintenance Log
          </Button>
        </div>
      </form>
    </Modal>
  );
}
