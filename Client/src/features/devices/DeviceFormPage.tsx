import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { CompressedImageResult } from "@/lib/imageCompression";
import { queryKeys } from "@/lib/queryClient";
import { isValidRfidFormat, normalizeRfid } from "@/lib/rfid";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import { ImageDropzone } from "@/features/portal/ImageDropzone";
import type { AssetStatus } from "@/types/asset";

interface SpecRow {
  key: string;
  value: string;
}

export function DeviceFormPage() {
  const { rfid } = useParams<{ rfid: string }>();
  const isEdit = Boolean(rfid);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const prefillRfid = normalizeRfid(searchParams.get("rfid") ?? "");

  const { data: existingAsset } = useQuery({
    queryKey: queryKeys.asset(rfid ?? ""),
    queryFn: () => api.assets.get(rfid!),
    enabled: isEdit,
  });

  const [rfidUid, setRfidUid] = useState(prefillRfid);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [location, setLocation] = useState("");
  const [criticality, setCriticality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [status, setStatus] = useState<AssetStatus>("active");
  const [installDate, setInstallDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [nextServiceDue, setNextServiceDue] = useState("");
  const [notes, setNotes] = useState("");
  const [specRows, setSpecRows] = useState<SpecRow[]>([
    { key: "", value: "" },
  ]);
  const [pendingImages, setPendingImages] = useState<CompressedImageResult[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingAsset) return;
    setRfidUid(existingAsset.rfid_uid);
    setName(existingAsset.name);
    setModel(existingAsset.model);
    setSerialNo(existingAsset.serial_no);
    setLocation(existingAsset.location);
    setCriticality(existingAsset.criticality);
    setStatus(existingAsset.status);
    setInstallDate(existingAsset.install_date ?? "");
    setWarrantyExpiry(existingAsset.warranty_expiry ?? "");
    setLastServiceDate(existingAsset.last_service_date ?? "");
    setNextServiceDue(existingAsset.next_service_due ?? "");
    setNotes(existingAsset.notes ?? "");
    const entries = Object.entries(existingAsset.specs ?? {});
    setSpecRows(
      entries.length > 0
        ? entries.map(([key, value]) => ({ key, value }))
        : [{ key: "", value: "" }],
    );
  }, [existingAsset]);

  const existingImages = existingAsset?.images ?? [];
  const remainingPhotoQuota = Math.max(0, 3 - existingImages.length);

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => api.assets.deleteImage(rfid!, imageId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.asset(rfid!) });
      toast.success("Photo removed");
    },
    onError: (err) => {
      toast.error(
        "Could not delete photo",
        err instanceof Error ? err.message : "Error",
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const specs: Record<string, string> = {};
      specRows.forEach((row) => {
        if (row.key.trim() && row.value.trim()) {
          specs[row.key.trim()] = row.value.trim();
        }
      });

      const payload = {
        name: name.trim(),
        model: model.trim(),
        serial_no: serialNo.trim(),
        location: location.trim(),
        criticality,
        status,
        install_date: installDate || null,
        warranty_expiry: warrantyExpiry || null,
        last_service_date: lastServiceDate || null,
        next_service_due: nextServiceDue || null,
        notes: notes.trim() || null,
        specs,
      };

      const saved = isEdit
        ? await api.assets.update(rfid!, payload)
        : await api.assets.create({
            ...payload,
            rfid_uid: normalizeRfid(rfidUid),
          });

      for (const img of pendingImages) {
        await api.assets.uploadImage(saved.rfid_uid, img.file);
      }

      return saved;
    },
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: queryKeys.asset(saved.rfid_uid) });
      toast.success(
        isEdit ? "Device updated" : "Device registered",
        `${saved.name} (${saved.rfid_uid}) saved successfully.`,
      );
      navigate(`/tech/devices/${saved.rfid_uid}`);
    },
    onError: (err) => {
      setFormError(
        err instanceof Error ? err.message : "Unable to save equipment.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const normalized = normalizeRfid(rfidUid);
    if (!isEdit && !isValidRfidFormat(normalized)) {
      setFormError("RFID UID must be 4–32 alphanumeric characters (e.g. 04A3B2C1).");
      return;
    }
    if (!name.trim() || !model.trim() || !location.trim()) {
      setFormError("Name, model, and location are required fields.");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={isEdit ? `/tech/devices/${rfid}` : "/tech/devices"}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#2E5D4B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">
          {isEdit ? `Edit ${existingAsset?.name ?? rfid}` : "Register New Equipment"}
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {isEdit
            ? "Update biodata, service schedules, technical specs, and photos. RFID re-keying is restricted to Admins."
            : "Link a physical 13.56 MHz RFID tag UID to its machine biodata and service intervals."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="rounded-2xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-4 text-sm font-medium text-[#b94444]">
            {formError}
          </div>
        )}

        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Core Identification
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="device-rfid"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                RFID Tag UID *
              </label>
              <input
                id="device-rfid"
                type="text"
                value={rfidUid}
                disabled={isEdit}
                onChange={(e) => setRfidUid(normalizeRfid(e.target.value))}
                placeholder="e.g. 04A3B2C1"
                className="input-field mt-1.5 font-mono uppercase"
              />
              {isEdit && (
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  Locked on edit. Admins can re-key damaged tags from Device Lifecycle.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="device-name"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Equipment Name *
              </label>
              <input
                id="device-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lab LaserJet Printer 04"
                className="input-field mt-1.5"
              />
            </div>

            <div>
              <label
                htmlFor="device-model"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Model *
              </label>
              <input
                id="device-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. HP-M404dn"
                className="input-field mt-1.5"
              />
            </div>

            <div>
              <label
                htmlFor="device-serial"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Serial Number
              </label>
              <input
                id="device-serial"
                type="text"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="e.g. SN-HP-404-019"
                className="input-field mt-1.5 font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="device-location"
                className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
              >
                Location / Bay *
              </label>
              <input
                id="device-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lab B · Desk 4"
                className="input-field mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="device-criticality"
                  className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                >
                  Criticality (1–5)
                </label>
                <select
                  id="device-criticality"
                  value={criticality}
                  onChange={(e) =>
                    setCriticality(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                  }
                  className="input-field mt-1.5"
                >
                  <option value={5}>5 — Critical</option>
                  <option value={4}>4 — High</option>
                  <option value={3}>3 — Medium</option>
                  <option value={2}>2 — Low</option>
                  <option value={1}>1 — Spare</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="device-status"
                  className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                >
                  Status
                </label>
                <select
                  id="device-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className="input-field mt-1.5"
                >
                  <option value="active">Active</option>
                  <option value="under_maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Lifecycle Dates &amp; Notes
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Install Date
              </label>
              <input
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className="input-field mt-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Warranty Expiry
              </label>
              <input
                type="date"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                className="input-field mt-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Last Service
              </label>
              <input
                type="date"
                value={lastServiceDate}
                onChange={(e) => setLastServiceDate(e.target.value)}
                className="input-field mt-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Next Service Due
              </label>
              <input
                type="date"
                value={nextServiceDue}
                onChange={(e) => setNextServiceDue(e.target.value)}
                className="input-field mt-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Operational Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Calibration requirements, voltage reminders, or special shut-off notes…"
              className="input-field mt-1.5"
            />
          </div>
        </Card>

        {/* Dynamic Specs JSONB Builder */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Technical Specifications
              </h2>
              <p className="text-xs text-[#6B7280]">
                Key-value hardware properties (e.g., Voltage: 220V, IP Address: 10.4.2.18).
              </p>
            </div>
            <Button
              type="button"
              variant="mint"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() =>
                setSpecRows((prev) => [...prev, { key: "", value: "" }])
              }
            >
              Add Spec
            </Button>
          </div>

          <div className="space-y-2">
            {specRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) =>
                    setSpecRows((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, key: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="Property (e.g. Power)"
                  className="input-field w-1/3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) =>
                    setSpecRows((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, value: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="Value (e.g. 1.5 kW)"
                  className="input-field flex-1 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSpecRows((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="rounded-lg p-2 text-[#6B7280] hover:text-[#DC6464]"
                  aria-label="Remove spec row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Device Photos (Max 3) */}
        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Device Reference Photos (Max 3)
          </h2>

          {existingImages.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8F6F3]"
                >
                  <img
                    src={img.url}
                    alt="Device reference"
                    className="h-32 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => deleteImageMutation.mutate(img.id)}
                    className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-[#DC6464] shadow hover:bg-white"
                    aria-label="Delete asset photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {remainingPhotoQuota > 0 ? (
            <ImageDropzone
              items={pendingImages}
              onChange={setPendingImages}
              maxFiles={remainingPhotoQuota}
            />
          ) : (
            <p className="text-xs text-[#D99A45] font-medium">
              Maximum 3 device photos reached. Remove an existing photo to upload a replacement.
            </p>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              navigate(isEdit ? `/tech/devices/${rfid}` : "/tech/devices")
            }
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={saveMutation.isPending}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {isEdit ? "Save Device Changes" : "Register Equipment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
