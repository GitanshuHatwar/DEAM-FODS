import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDateTime } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardListSkeleton } from "@/components/ui/Skeleton";

export function AdminAuditLogPage() {
  const [actor, setActor] = useState("");
  const [actionPrefix, setActionPrefix] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.adminAuditLog({
      actor,
      action: actionPrefix,
      from: fromDate,
      to: toDate,
      page,
    }),
    queryFn: () =>
      api.admin.listAuditLogs({
        actor: actor || undefined,
        action: actionPrefix,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        page_size: 15,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
          Governance &amp; Compliance
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
          Immutable Admin Audit Log
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Every user provisioning, role update, device lifecycle change, and scanner key rotation is captured with before/after JSON diffs.
        </p>
      </div>

      <Card padding="sm">
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-4">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#6B7280]" />
            <input
              type="text"
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by actor name or email…"
              className="input-field py-2 pl-10 text-xs"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={actionPrefix}
              onChange={(e) => {
                setActionPrefix(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by action domain"
              className="input-field py-2 text-xs"
            >
              <option value="all">All Action Domains</option>
              <option value="user.">User Actions (user.*)</option>
              <option value="device.">Device Actions (device.*)</option>
              <option value="scanner.">Scanner Actions (scanner.*)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label="From date"
              className="input-field py-2 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label="To date"
              className="input-field py-2 text-xs"
            />
          </div>

          <div className="sm:col-span-1 flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActor("");
                setActionPrefix("all");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Could not load audit logs."}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No matching audit events"
          description="Try widening your date range or clearing filters."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-[#E5E7EB]">
            {items.map((entry) => {
              const isOpen = expandedId === entry.id;
              return (
                <div key={entry.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isOpen ? null : entry.id)
                    }
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-[#F8F6F3]/75"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-[#2E5D4B]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#6B7280]" />
                      )}
                      <span className="font-mono text-xs font-bold text-[#2E5D4B]">
                        {entry.action}
                      </span>
                      <Badge tone="beige">{entry.target_type}</Badge>
                      <span className="font-mono text-xs text-[#0F172A]">
                        {entry.target_id}
                      </span>
                      <span className="text-xs text-[#6B7280]">
                        by <strong className="text-[#0F172A]">{entry.actor_name}</strong>
                      </span>
                    </div>

                    <span className="text-xs text-[#6B7280]">
                      {formatLocalDateTime(entry.created_at)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#E5E7EB] bg-[#F8F6F3] px-5 py-3.5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                        Change Payload Diff
                      </p>
                      <pre className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white p-3 font-mono text-xs text-[#0F172A]">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F8F6F3] px-5 py-3 text-xs text-[#6B7280]">
            <span>
              Page {page} of {totalPages} ({total} total events)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
