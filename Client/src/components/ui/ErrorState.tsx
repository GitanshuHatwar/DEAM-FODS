import { AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Unable to load data",
  message = "An unexpected error occurred while fetching this view.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DC6464]/30 bg-white px-6 py-10 text-center shadow-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DC6464]/10 text-[#DC6464]">
        <AlertOctagon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#0F172A]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#6B7280]">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
