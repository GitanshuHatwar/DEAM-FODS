import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  compressDiagnosticImage,
  formatBytes,
  validateImageFiles,
  type CompressedImageResult,
} from "@/lib/imageCompression";

export function ImageDropzone({
  items,
  onChange,
  maxFiles = 2,
}: {
  items: CompressedImageResult[];
  onChange: (next: CompressedImageResult[]) => void;
  maxFiles?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrors([]);

    const incoming = Array.from(fileList);
    const { valid, errors: validationErrors } = validateImageFiles(
      incoming,
      items.length,
      maxFiles,
    );

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }
    if (valid.length === 0) return;

    setIsCompressing(true);
    const nextItems: CompressedImageResult[] = [...items];
    const compressionErrors: string[] = [];

    for (const file of valid) {
      try {
        const compressed = await compressDiagnosticImage(file);
        nextItems.push(compressed);
      } catch (err) {
        compressionErrors.push(
          err instanceof Error ? err.message : `Failed to process "${file.name}".`,
        );
      }
    }

    if (compressionErrors.length > 0) {
      setErrors((prev) => [...prev, ...compressionErrors]);
    }
    onChange(nextItems);
    setIsCompressing(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (idx: number) => {
    const target = items[idx];
    if (target?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#6B7280]">
          Optional: up to <strong>{maxFiles}</strong> photos (JPEG, PNG, WebP).
          Automatically compressed for fast lab uploads.
        </p>
        <span className="font-mono text-xs text-[#2E5D4B]">
          {items.length}/{maxFiles} attached
        </span>
      </div>

      {items.length < maxFiles && (
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#2E5D4B]/35 bg-[#F8F6F3] px-4 py-6 text-center transition hover:border-[#2E5D4B] hover:bg-[#E8F3EF]/45"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={maxFiles - items.length > 1}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleFiles(e.target.files)
            }
            className="sr-only"
          />
          {isCompressing ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[#2E5D4B]" />
              <span className="mt-2 text-xs font-medium text-[#2E5D4B]">
                Compressing image…
              </span>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F3EF] text-[#2E5D4B]">
                <ImagePlus className="h-5 w-5" />
              </div>
              <span className="mt-2 text-sm font-medium text-[#0F172A]">
                Tap or click to attach fault photo
              </span>
              <span className="mt-0.5 text-xs text-[#6B7280]">
                Targets ~300–450 KB · max 1280px
              </span>
            </>
          )}
        </label>
      )}

      {errors.length > 0 && (
        <div className="space-y-1 rounded-xl border border-[#DC6464]/35 bg-[#DC6464]/10 p-3 text-xs text-[#b94444]">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item, idx) => (
            <div
              key={`${item.file.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-2.5 shadow-card"
            >
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="h-16 w-16 shrink-0 rounded-lg object-cover border border-[#E5E7EB]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#0F172A]">
                  {item.file.name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[#16A36A]">
                  {formatBytes(item.originalSizeBytes)} →{" "}
                  {formatBytes(item.compressedSizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label={`Remove ${item.file.name}`}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#DC6464]/10 hover:text-[#DC6464]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
