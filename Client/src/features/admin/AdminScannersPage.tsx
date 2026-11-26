import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Edit3,
  KeyRound,
  MapPin,
  Plus,
  Power,
  Radio,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLocalDateTime, formatRelativeAge } from "@/lib/date";
import { queryKeys } from "@/lib/queryClient";
import { Badge, ScannerChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import type { Scanner, ScannerKeyResponse } from "@/types/admin";
import { ScannerKeyOnceDialog } from "./ScannerKeyOnceDialog";

export function AdminScannersPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [scannerCode, setScannerCode] = useState("");
  const [location, setLocation] = useState("");
  const [editTarget, setEditTarget] = useState<Scanner | null>(null);
  const [editLocation, setEditLocation] = useState("");
  const [keyOnceData, setKeyOnceData] = useState<ScannerKeyResponse | null>(null);

  const {
    data: scanners = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminScanners,
    queryFn: () => api.admin.listScanners(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.admin.createScanner({
        scanner_code: scannerCode.trim().toUpperCase(),
        location: location.trim(),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminScanners });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      setCreateOpen(false);
      setScannerCode("");
      setLocation("");
      setKeyOnceData(res);
    },
    onError: (err) => {
      toast.error(
        "Could not create scanner",
        err instanceof Error ? err.message : "Error",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      payload: { location?: string; is_active?: boolean };
    }) => api.admin.updateScanner(vars.id, vars.payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminScanners });
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      toast.success("Scanner updated");
      setEditTarget(null);
    },
    onError: (err) => {
      toast.error(
        "Update failed",
        err instanceof Error ? err.message : "Error",
      );
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.admin.rotateScannerKey(id),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      setKeyOnceData(res);
    },
    onError: (err) => {
      toast.error(
        "Key rotation failed",
        err instanceof Error ? err.message : "Error",
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E5D4B]">
            Edge Hardware Provisioning
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]">
            ESP32 RFID Scanners
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Register hardware readers, monitor last tap telemetry, and rotate <code className="font-mono">X-Device-Key</code> credentials.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Add Scanner
        </Button>
      </div>

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Could not load scanners."}
          onRetry={() => refetch()}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scanners.map((scn) => (
            <Card key={scn.id} padding="md" className="flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <ScannerChip code={scn.scanner_code} />
                  {scn.is_active ? (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Disabled</Badge>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#2E5D4B]" />
                    {scn.location}
                  </p>
                  <p className="mt-1.5 text-xs text-[#6B7280] flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5" />
                    Last ping:{" "}
                    {scn.last_seen_at
                      ? `${formatRelativeAge(scn.last_seen_at)} ago (${formatLocalDateTime(scn.last_seen_at)})`
                      : "Never seen"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setEditTarget(scn);
                    setEditLocation(scn.location);
                  }}
                >
                  Edit
                </Button>

                <Button
                  variant="mint"
                  size="sm"
                  isLoading={rotateMutation.isPending}
                  leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                  onClick={() => rotateMutation.mutate(scn.id)}
                >
                  Rotate Key
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Power className="h-3.5 w-3.5" />}
                  onClick={() =>
                    updateMutation.mutate({
                      id: scn.id,
                      payload: { is_active: !scn.is_active },
                    })
                  }
                >
                  {scn.is_active ? "Disable" : "Enable"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Scanner Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register ESP32 RFID Scanner"
        description="Generates a unique X-Device-Key displayed once upon creation."
      >
        <form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            if (!scannerCode.trim() || !location.trim()) return;
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Scanner Code *
            </label>
            <input
              type="text"
              value={scannerCode}
              onChange={(e) => setScannerCode(e.target.value.toUpperCase())}
              placeholder="e.g. SCN-004"
              className="input-field mt-1.5 font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Lab / Bench Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Machining Bay · Handheld 2"
              className="input-field mt-1.5"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
            >
              Provision Scanner
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Scanner Location Modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit ${editTarget?.scanner_code ?? "Scanner"}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editTarget || !editLocation.trim()) return;
            updateMutation.mutate({
              id: editTarget.id,
              payload: { location: editLocation.trim() },
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Location
            </label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="input-field mt-1.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Save Location
            </Button>
          </div>
        </form>
      </Modal>

      <ScannerKeyOnceDialog
        data={keyOnceData}
        onClose={() => setKeyOnceData(null)}
      />
    </div>
  );
}
