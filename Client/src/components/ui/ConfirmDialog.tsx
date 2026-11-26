import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger" | "warning";
  isLoading?: boolean;
  blockedMessage?: string | null;
  fallbackAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    isLoading?: boolean;
  };
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  isLoading = false,
  blockedMessage,
  fallbackAction,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex items-start gap-3.5">
        <div
          className={
            confirmVariant === "danger"
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DC6464]/12 text-[#DC6464]"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F3EF] text-[#2E5D4B]"
          }
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">
            {description}
          </p>
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}

      {blockedMessage && (
        <div className="mt-4 rounded-xl border border-[#D99A45]/35 bg-[#F4ECE1] p-3.5 text-sm text-[#0F172A]">
          <p className="font-medium text-[#926018]">Action Blocked — History Preserved</p>
          <p className="mt-1 text-xs text-[#6B7280] leading-relaxed">
            {blockedMessage}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>

        {blockedMessage && fallbackAction ? (
          <Button
            variant="warning"
            onClick={fallbackAction.onClick}
            isLoading={fallbackAction.isLoading}
          >
            {fallbackAction.label}
          </Button>
        ) : (
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        )}
      </div>
    </Modal>
  );
}
