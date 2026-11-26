import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Radio, X } from "lucide-react";
import { RfidChip } from "@/components/ui/Badge";
import type { TapPayload } from "@/types/tap";
import { TapArchivedTagMode } from "./TapArchivedTagMode";
import { TapAssetOnlyMode } from "./TapAssetOnlyMode";
import { TapCloseoutMode } from "./TapCloseoutMode";
import { TapStartMode } from "./TapStartMode";
import { TapUnknownTagMode } from "./TapUnknownTagMode";

export function LiveTapDrawer({
  open,
  payload,
  onClose,
  onResolved,
}: {
  open: boolean;
  payload: TapPayload | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Live RFID Tap Panel"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F172A]/30 backdrop-blur-xs"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-[#E5E7EB] bg-white/92 backdrop-blur-md shadow-drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4 bg-white/75">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F3EF] text-[#2E5D4B]">
                  <Radio className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">
                    Live RFID Tap Panel
                  </h2>
                  <p className="text-[11px] text-[#6B7280]">
                    Real-time SSE equipment &amp; ticket action stream
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {payload && <RfidChip uid={payload.rfid_uid} />}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Live Tap Drawer"
                  className="rounded-xl p-2 text-[#6B7280] hover:bg-[#F8F6F3] hover:text-[#0F172A]"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {!payload ? (
                <div className="flex h-full flex-col items-center justify-center text-center px-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F3EF] text-[#2E5D4B]">
                    <Radio className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#0F172A]">
                    Waiting for Hardware RFID Tap
                  </h3>
                  <p className="mt-1.5 max-w-sm text-sm text-[#6B7280]">
                    Tap any equipment&apos;s 13.56 MHz RFID tag with an ESP32 scanner (or use the Mock Tap Simulator) to automatically start tickets, inspect biodata, or open close-out.
                  </p>
                </div>
              ) : payload.mode === "start" ? (
                <TapStartMode payload={payload} onNavigateAway={onClose} />
              ) : payload.mode === "closeout" ? (
                <TapCloseoutMode payload={payload} onResolved={onResolved} />
              ) : payload.mode === "asset_only" ? (
                <TapAssetOnlyMode payload={payload} onNavigateAway={onClose} />
              ) : payload.mode === "unknown_tag" ? (
                <TapUnknownTagMode payload={payload} onNavigateAway={onClose} />
              ) : (
                <TapArchivedTagMode
                  payload={payload}
                  onRestored={onResolved}
                />
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
