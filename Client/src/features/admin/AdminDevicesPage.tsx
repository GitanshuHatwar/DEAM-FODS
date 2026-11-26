import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  KeyRound,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { formatLocalDate } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { AssetStatusBadge, RfidChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import type { Asset } from "@/types/asset";
import { AdminRekeyModal } from "./AdminRekeyModal";

export function AdminDevicesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [showArchived, setShowArchived] = useState(true);
  const [search, setSearch] = useState("");
  const [rekeyTarget, setRekeyTarget] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const {
    data: assets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.assets({
      admin: true,
      include_archived: showArchived,
      q: search,
    }),
    queryFn: () =>
      api.assets.list({
        include_archived: showArchived,
        q: search || undefined,
      }),
  });

  const archiveMutation = useMutation({
    mutationFn: (asset: Asset) =>
      asset.archived_at
        ? api.assets.restore(asset.rfid_uid)
        : api.assets.archive(asset.rfid_uid),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success(
        updated.archived_at ? "Device archived" : "Device restored",
        `${updated.name} (${updated.rfid_uid})`,
      );
      setDeleteTarget(null);
      setBlockedMsg(null);
    },
    onError: (err) => {
      toast.error(
        "Lifecycle action failed",
        err instanceof Error ? err.message : "Error",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (rfid: string) => api.assets.remove(rfid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success("Device deleted permanently");
      setDeleteTarget(null);
      setBlockedMsg(null);
    },
    onError: (err) => {
      if (
        err instanceof ApiClientError &&
        err.code === "has_linked_records"
      ) {
        setBlockedMsg(err.message);
      } else {
        toast.error(
          "Delete failed",
          err instanceof Error ? err.message : "Blocked",
        );
        setDeleteTarget(null);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            Asset Governance
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
            Device Lifecycle Console
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Archive or restore equipment, cascade RFID tag replacements, and enforce history preservation.
          </p>
        </div>

        <Link to="/tech/devices/new">
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            Register Equipment
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search device name, RFID UID, or location…"
              className="input-field py-2 pl-10 text-xs"
            />
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0F172A]">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 rounded border-[#E5E7EB] accent-[#2E5D4B]"
            />
            Show Archived Devices
          </label>
        </div>
      </Card>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load devices."}
          onRetry={() => refetch()}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E7EB] bg-[#F8F6F3] text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3.5">Equipment</th>
                  <th className="px-4 py-3.5">RFID UID</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Next Service</th>
                  <th className="px-5 py-3.5 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {assets.map((asset) => {
                  const isArchived = Boolean(asset.archived_at);
                  return (
                    <tr
                      key={asset.rfid_uid}
                      className="transition-colors hover:bg-[#F8F6F3]/65"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/tech/devices/${asset.rfid_uid}`}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A] hover:text-[#2E5D4B]"
                        >
                          <span>{asset.name}</span>
                          <ExternalLink className="h-3 w-3 text-[#6B7280]" />
                        </Link>
                        <p className="text-xs text-[#6B7280]">
                          {asset.location} · {asset.model}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <RfidChip uid={asset.rfid_uid} />
                      </td>
                      <td className="px-4 py-3.5">
                        <AssetStatusBadge
                          status={asset.status}
                          archived={isArchived}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                        {formatLocalDate(asset.next_service_due)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                            onClick={() => setRekeyTarget(asset)}
                          >
                            Re-Key
                          </Button>

                          <Button
                            variant={isArchived ? "mint" : "ghost"}
                            size="sm"
                            isLoading={archiveMutation.isPending}
                            leftIcon={
                              isArchived ? (
                                <ArchiveRestore className="h-3.5 w-3.5" />
                              ) : (
                                <Archive className="h-3.5 w-3.5" />
                              )
                            }
                            onClick={() => archiveMutation.mutate(asset)}
                          >
                            {isArchived ? "Restore" : "Archive"}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Permanent delete (only if zero linked history)"
                            onClick={() => {
                              setBlockedMsg(null);
                              setDeleteTarget(asset);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-[#DC6464]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AdminRekeyModal
        asset={rekeyTarget}
        onClose={() => setRekeyTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setBlockedMsg(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.rfid_uid);
        }}
        title={`Permanently Delete ${deleteTarget?.name ?? "Device"}?`}
        description="Permanent deletion removes the device completely. Devices with any past tickets, incidents, or maintenance logs cannot be deleted and must be archived instead."
        confirmLabel="Delete Permanently"
        isLoading={deleteMutation.isPending}
        blockedMessage={blockedMsg}
        fallbackAction={
          deleteTarget && !deleteTarget.archived_at
            ? {
                label: "Archive Device Instead",
                isLoading: archiveMutation.isPending,
                onClick: () => archiveMutation.mutate(deleteTarget),
              }
            : undefined
        }
      />
    </div>
  );
}
