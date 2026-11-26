import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Cpu, Radio, Search, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { normalizeRfid } from "@/lib/rfid";
import { cn } from "@/lib/utils";
import { AssetStatusBadge, RfidChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Asset } from "@/types/asset";

export function DeviceSelector({
  selectedAsset,
  onSelect,
}: {
  selectedAsset: Asset | null;
  onSelect: (asset: Asset | null) => void;
}) {
  const [mode, setMode] = useState<"dropdown" | "rfid">("dropdown");
  const [searchTerm, setSearchTerm] = useState("");
  const [rfidInput, setRfidInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: queryKeys.assets({ activeOnly: true }),
    queryFn: () => api.assets.list(),
  });

  const filteredAssets = assets.filter((a) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q) ||
      a.rfid_uid.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q)
    );
  });

  const handleRfidValidate = async (raw?: string) => {
    const normalized = normalizeRfid(raw ?? rfidInput);
    setRfidInput(normalized);
    if (!normalized) {
      setLookupError("Enter an equipment RFID UID to validate.");
      onSelect(null);
      return;
    }

    setLookupError(null);
    setIsLookingUp(true);
    try {
      const found = await api.assets.lookup(normalized);
      onSelect(found);
    } catch {
      onSelect(null);
      setLookupError(
        `Unknown or archived device (${normalized}). Verify the tag ID printed near the scanner badge.`,
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-[#F8F6F3] p-1">
        <button
          type="button"
          onClick={() => {
            setMode("dropdown");
            setLookupError(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            mode === "dropdown"
              ? "bg-white text-[#2E5D4B] shadow-card font-semibold"
              : "text-[#6B7280] hover:text-[#0F172A]",
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          Select Equipment
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("rfid");
            setLookupError(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            mode === "rfid"
              ? "bg-white text-[#2E5D4B] shadow-card font-semibold"
              : "text-[#6B7280] hover:text-[#0F172A]",
          )}
        >
          <Radio className="h-3.5 w-3.5" />
          Enter RFID Tag ID
        </button>
      </div>

      {mode === "dropdown" ? (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#6B7280]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter equipment by name, lab bench, model, or RFID…"
              className="input-field pl-10"
            />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-[#F8F6F3]/60 p-2">
            {isLoading ? (
              <p className="p-3 text-xs text-[#6B7280]">Loading active equipment…</p>
            ) : filteredAssets.length === 0 ? (
              <p className="p-3 text-xs text-[#6B7280]">
                No matching active equipment found.
              </p>
            ) : (
              filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.rfid_uid === asset.rfid_uid;
                return (
                  <button
                    key={asset.rfid_uid}
                    type="button"
                    onClick={() => {
                      setLookupError(null);
                      onSelect(asset);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                      isSelected
                        ? "border-[#2E5D4B] bg-[#E8F3EF]/85 shadow-sm"
                        : "border-[#E5E7EB] bg-white hover:border-[#2E5D4B]/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">
                        {asset.name}
                      </p>
                      <p className="truncate text-xs text-[#6B7280]">
                        {asset.location} · {asset.model}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <AssetStatusBadge status={asset.status} />
                      <RfidChip uid={asset.rfid_uid} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={rfidInput}
              onChange={(e) => {
                setRfidInput(e.target.value);
                setLookupError(null);
              }}
              onBlur={() => {
                if (rfidInput.trim()) void handleRfidValidate();
              }}
              placeholder="e.g. 04A3B2C1 or 04:a3:b2:c1"
              className="input-field font-mono uppercase"
              aria-label="RFID Tag ID"
            />
            <Button
              type="button"
              variant="secondary"
              isLoading={isLookingUp}
              onClick={() => handleRfidValidate()}
            >
              Validate RFID
            </Button>
          </div>
          <p className="text-[11px] text-[#6B7280]">
            Colons, spaces, and lowercase letters are normalized automatically.
          </p>

          {lookupError && (
            <div className="flex items-start gap-2 rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-3 text-xs text-[#b94444]">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}
        </div>
      )}

      {selectedAsset && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2E5D4B]/25 bg-[#E8F3EF]/80 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4.5 w-4.5 text-[#16A36A] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {selectedAsset.name}
              </p>
              <p className="text-xs text-[#6B7280]">
                {selectedAsset.location} · {selectedAsset.model}
              </p>
            </div>
          </div>
          <RfidChip uid={selectedAsset.rfid_uid} />
        </div>
      )}
    </div>
  );
}
