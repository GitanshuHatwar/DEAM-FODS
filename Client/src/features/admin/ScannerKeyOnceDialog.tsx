import { useState } from "react";
import { AlertTriangle, Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ScannerKeyResponse } from "@/types/admin";

export function ScannerKeyOnceDialog({
  data,
  onClose,
}: {
  data: ScannerKeyResponse | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.device_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <Modal
      open={Boolean(data)}
      onClose={onClose}
      title="Save Scanner X-Device-Key"
      description={`Generated credentials for ESP32 scanner ${data.scanner.scanner_code} (${data.scanner.location}).`}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-[#D99A45]/45 bg-[#F4ECE1] p-3.5 text-xs text-[#0F172A]">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-[#D99A45] mt-0.5" />
          <span>
            <strong>One-Time Display:</strong> Only the cryptographic hash is stored in the database. After closing this dialog, this plaintext{" "}
            <code className="font-mono">X-Device-Key</code> cannot be viewed again.
          </span>
        </div>

        <div className="rounded-xl border border-[#2E5D4B]/25 bg-[#E8F3EF]/75 p-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#2E5D4B]">
              <KeyRound className="h-3.5 w-3.5" />
              X-Device-Key
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5">
            <code className="font-mono text-xs font-semibold text-[#0F172A] break-all">
              {data.device_key}
            </code>
            <Button
              type="button"
              variant={copied ? "mint" : "secondary"}
              size="sm"
              leftIcon={
                copied ? (
                  <Check className="h-3.5 w-3.5 text-[#16A36A]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )
              }
              onClick={handleCopy}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            I Have Saved This Key
          </Button>
        </div>
      </div>
    </Modal>
  );
}
