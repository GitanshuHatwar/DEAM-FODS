import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import type { Ticket } from "@/types/ticket";

export function PriorityOverrideModal({
  open,
  onClose,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [score, setScore] = useState<number>(
    ticket.priority_override ?? ticket.priority_score,
  );

  useEffect(() => {
    setScore(ticket.priority_override ?? ticket.priority_score);
  }, [ticket, open]);

  const mutation = useMutation({
    mutationFn: (overrideVal: number | null) =>
      api.tickets.overridePriority(ticket.id, overrideVal),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      void qc.invalidateQueries({ queryKey: ["tickets", updated.id] });
      toast.success(
        updated.priority_override !== null
          ? "Manual priority override applied"
          : "Priority override cleared",
        updated.priority_override !== null
          ? `${ticket.ticket_number} now ranks at ${updated.priority_override}.`
          : `${ticket.ticket_number} returned to computed rule-based score.`,
      );
      onClose();
    },
    onError: (err) => {
      toast.error(
        "Failed to update priority",
        err instanceof Error ? err.message : "Unknown error",
      );
    },
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const clamped = Math.min(100, Math.max(0, Math.round(score)));
    mutation.mutate(clamped);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Override Ticket Priority"
      description={`Adjust queue ranking for ${ticket.ticket_number}. Active in-progress tickets remain pinned above waiting tickets.`}
    >
      <form onSubmit={handleApply} className="space-y-5">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Computed Rule Score</span>
            <span className="font-mono font-semibold text-[#0F172A]">
              {ticket.priority_score}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="override-score-input"
                className="text-xs font-semibold uppercase tracking-wide text-[#2E5D4B]"
              >
                Manual Priority Score (0–100)
              </label>
              <span className="font-mono text-lg font-bold text-[#2E5D4B]">
                {score}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-[#2E5D4B]"
            />
            <input
              id="override-score-input"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="input-field mt-2 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {ticket.priority_override !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate(null)}
            >
              Clear Override
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
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
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
            >
              Apply Override
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
