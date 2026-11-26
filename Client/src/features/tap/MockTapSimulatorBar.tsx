import { useState } from "react";
import { Radio } from "lucide-react";
import { simulateRfidTap } from "@/lib/mocks/mockApi";
import { normalizeRfid } from "@/lib/rfid";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import type { TapPayload } from "@/types/tap";

const PRESETS = [
  { rfid: "04A3B2C1", label: "Printer (Start / Closeout)", tag: "04A3B2C1" },
  { rfid: "04E719A2", label: "3D Printer (Closeout)", tag: "04E719A2" },
  { rfid: "0488C1D0", label: "Oscilloscope (Asset Only)", tag: "0488C1D0" },
  { rfid: "04DEAD99", label: "Unknown Tag", tag: "04DEAD99" },
  { rfid: "04AA1122", label: "Archived Tag", tag: "04AA1122" },
];

export function MockTapSimulatorBar({
  compact = false,
  onTapSimulated,
}: {
  compact?: boolean;
  onTapSimulated: (payload: TapPayload) => void;
}) {
  const toast = useToast();
  const [customUid, setCustomUid] = useState("");
  const [scannerCode, setScannerCode] = useState("SCN-001");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const triggerTap = async (rawUid: string) => {
    const uid = normalizeRfid(rawUid);
    if (!uid) return;
    setBusyUid(uid);
    try {
      const payload = await simulateRfidTap(uid, scannerCode);
      onTapSimulated(payload);
    } catch (err) {
      toast.warning(
        "Tap rejected",
        err instanceof Error ? err.message : "Could not simulate tap.",
      );
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#2E5D4B]/20 bg-[#F4ECE1]/75 p-3.5 shadow-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-[#2E5D4B]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E5D4B]">
            ESP32 Tap Simulator
          </span>
        </div>
        <select
          value={scannerCode}
          onChange={(e) => setScannerCode(e.target.value)}
          aria-label="Mock scanner code"
          className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-0.5 font-mono text-[10px] text-[#0F172A]"
        >
          <option value="SCN-001">SCN-001</option>
          <option value="SCN-002">SCN-002</option>
        </select>
      </div>

      <div
        className={cn(
          "mt-2.5 gap-1.5",
          compact ? "flex flex-wrap" : "flex flex-col",
        )}
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.rfid}
            type="button"
            disabled={busyUid === preset.rfid}
            onClick={() => triggerTap(preset.rfid)}
            className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-[#0F172A] transition hover:border-[#2E5D4B]/45 hover:bg-[#E8F3EF]/60 disabled:opacity-60"
          >
            <span className="truncate">{preset.label}</span>
            <span className="font-mono text-[10px] text-[#2E5D4B] shrink-0">
              {preset.tag}
            </span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void triggerTap(customUid);
        }}
        className="mt-2.5 flex gap-1.5"
      >
        <input
          type="text"
          value={customUid}
          onChange={(e) => setCustomUid(e.target.value)}
          placeholder="Custom UID…"
          className="input-field py-1.5 px-2.5 text-xs font-mono uppercase"
        />
        <button
          type="submit"
          className="rounded-xl bg-[#2E5D4B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3F7A64] shrink-0"
        >
          Tap
        </button>
      </form>
    </div>
  );
}
