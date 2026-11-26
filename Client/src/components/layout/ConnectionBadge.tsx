import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SSEConnectionState } from "@/types/tap";

export function ConnectionBadge({ state }: { state: SSEConnectionState }) {
  const cfg = {
    connected: {
      label: "RFID Stream Connected",
      shortLabel: "Live SSE",
      classes: "bg-[#E8F3EF] text-[#2E5D4B] border-[#16A36A]/30",
      dot: "bg-[#16A36A]",
      icon: <Wifi className="h-3.5 w-3.5 text-[#16A36A]" />,
    },
    reconnecting: {
      label: "Reconnecting Stream…",
      shortLabel: "Reconnecting",
      classes: "bg-[#F4ECE1] text-[#b87a24] border-[#D99A45]/35",
      dot: "bg-[#D99A45]",
      icon: <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D99A45]" />,
    },
    offline: {
      label: "Stream Offline",
      shortLabel: "Offline",
      classes: "bg-[#DC6464]/10 text-[#b94444] border-[#DC6464]/30",
      dot: "bg-[#DC6464]",
      icon: <WifiOff className="h-3.5 w-3.5 text-[#DC6464]" />,
    },
  }[state];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        cfg.classes,
      )}
      title={cfg.label}
    >
      <span className={cn("h-2 w-2 rounded-full", cfg.dot, state === "connected" && "animate-pulse")} />
      <span className="hidden md:inline">{cfg.label}</span>
      <span className="md:hidden">{cfg.shortLabel}</span>
      {cfg.icon}
    </div>
  );
}
