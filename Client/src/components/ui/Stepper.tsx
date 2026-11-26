import { motion } from "framer-motion";
import { Check, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/types/ticket";

const STEPS: Array<{
  key: TicketStatus;
  label: string;
  sublabel: string;
}> = [
  { key: "pending_review", label: "Pending Review", sublabel: "Queued" },
  { key: "under_review", label: "Under Review", sublabel: "In Progress" },
  { key: "resolved", label: "Resolved", sublabel: "Closed" },
];

export function TicketStepper({
  status,
  compact = false,
}: {
  status: TicketStatus;
  compact?: boolean;
}) {
  const activeIdx = STEPS.findIndex((s) => s.key === status);
  const progressPercent = activeIdx === 0 ? 12 : activeIdx === 1 ? 56 : 100;

  return (
    <div className="w-full" aria-label={`Ticket status: ${STEPS[activeIdx]?.label}`}>
      <div className="relative flex items-center justify-between">
        {/* Background track */}
        <div className="absolute left-4 right-4 top-4 h-1 rounded-full bg-[#E5E7EB]" />

        {/* Animated progress fill */}
        <motion.div
          className={cn(
            "absolute left-4 top-4 h-1 rounded-full",
            status === "resolved" ? "bg-[#16A36A]" : "bg-[#2E5D4B]",
          )}
          initial={{ width: "0%" }}
          animate={{ width: `calc(${progressPercent}% - 16px)` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />

        {STEPS.map((step, idx) => {
          const isCompleted = idx < activeIdx || status === "resolved";
          const isCurrent = idx === activeIdx && status !== "resolved";
          const isUnderReview = isCurrent && step.key === "under_review";

          return (
            <div
              key={step.key}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.06 : 1,
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  isCompleted
                    ? "border-[#16A36A] bg-[#16A36A] text-white"
                    : isUnderReview
                      ? "border-[#D99A45] bg-[#FFFBEB] text-[#D99A45]"
                      : isCurrent
                        ? "border-[#2E5D4B] bg-[#E8F3EF] text-[#2E5D4B]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280]",
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : step.key === "under_review" ? (
                  <Wrench className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
              </motion.div>

              <span
                className={cn(
                  "mt-1.5 font-medium leading-tight",
                  compact ? "text-[11px]" : "text-xs",
                  isCompleted || isCurrent ? "text-[#0F172A]" : "text-[#6B7280]",
                )}
              >
                {step.label}
              </span>
              {!compact && (
                <span className="text-[11px] text-[#6B7280]">{step.sublabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
