import { AlertOctagon, Calendar, Package, Wrench } from "lucide-react";
import { formatLocalDate, formatLocalDateTime } from "@/lib/date";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AssetHistoryItem } from "@/types/asset";

export function DeviceHistoryTimeline({ items }: { items: AssetHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title="No service history recorded yet"
        description="Resolved fault incidents and standalone preventive maintenance logs will appear here chronologically."
      />
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E7EB]">
      {items.map((item) => {
        if (item.kind === "incident") {
          const inc = item.data;
          return (
            <div key={item.id} className="relative">
              <span className="absolute -left-6 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#D99A45] text-white shadow-sm">
                <AlertOctagon className="h-3.5 w-3.5" />
              </span>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-card space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="error">Incident Resolution</Badge>
                    {inc.created_by_name && (
                      <span className="text-xs text-[#6B7280]">
                        by {inc.created_by_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#6B7280]">
                    {formatLocalDateTime(inc.resolved_at)}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[#0F172A]">{inc.summary}</h4>

                <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl bg-[#F8F6F3] p-2.5 border border-[#E5E7EB]">
                    <span className="font-semibold text-[#6B7280] uppercase text-[10px]">
                      Root Cause
                    </span>
                    <p className="mt-0.5 text-[#0F172A]">{inc.root_cause}</p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F3] p-2.5 border border-[#E5E7EB]">
                    <span className="font-semibold text-[#6B7280] uppercase text-[10px]">
                      Resolution
                    </span>
                    <p className="mt-0.5 text-[#0F172A]">{inc.resolution}</p>
                  </div>
                </div>

                {inc.parts_replaced.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Package className="h-3.5 w-3.5 text-[#2E5D4B]" />
                    {inc.parts_replaced.map((p, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg border border-[#E5E7EB] bg-[#F4ECE1]/70 px-2 py-0.5 text-[11px] font-medium text-[#0F172A]"
                      >
                        {p.name} <span className="font-mono">×{p.qty}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        const log = item.data;
        const typeTone =
          log.type === "preventive"
            ? "mint"
            : log.type === "inspection"
              ? "info"
              : "primary";

        return (
          <div key={item.id} className="relative">
            <span className="absolute -left-6 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#2E5D4B] text-white shadow-sm">
              <Wrench className="h-3.5 w-3.5" />
            </span>

            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F6F3]/60 p-4 shadow-card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={typeTone} className="capitalize">
                    {log.type} Maintenance
                  </Badge>
                  {log.performed_by_name && (
                    <span className="text-xs text-[#6B7280]">
                      by {log.performed_by_name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#6B7280]">
                  {formatLocalDateTime(log.performed_at)}
                </span>
              </div>

              <p className="text-sm text-[#0F172A] leading-relaxed">
                {log.report}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#6B7280]">
                {log.parts_replaced.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#2E5D4B]" />
                    {log.parts_replaced.map((p, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-0.5 text-[11px] font-medium text-[#0F172A]"
                      >
                        {p.name} <span className="font-mono">×{p.qty}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span />
                )}

                {log.next_due_date && (
                  <span className="inline-flex items-center gap-1 font-medium text-[#2E5D4B]">
                    <Calendar className="h-3.5 w-3.5" />
                    Next Due: {formatLocalDate(log.next_due_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
