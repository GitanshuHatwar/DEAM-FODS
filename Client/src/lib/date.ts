/**
 * Date & timestamp utilities converting UTC ISO strings to user's local timezone.
 */

export function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatLocalDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatRelativeAge(
  iso: string | null | undefined,
  nowMs = Date.now(),
): string {
  if (!iso) return "—";
  const targetMs = new Date(iso).getTime();
  if (Number.isNaN(targetMs)) return "—";
  const diffSec = Math.max(0, Math.floor((nowMs - targetMs) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHr < 24) return remMin > 0 ? `${diffHr}h ${remMin}m` : `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  const remHr = diffHr % 24;
  return remHr > 0 ? `${diffDay}d ${remHr}h` : `${diffDay}d`;
}

export function isDateOverdue(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false;
  const targetMs = new Date(isoDate).getTime();
  if (Number.isNaN(targetMs)) return false;
  return targetMs < Date.now();
}

export function toLocalDateTimeInputValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
