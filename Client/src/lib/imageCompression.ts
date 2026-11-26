import imageCompression from "browser-image-compression";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 1_048_576; // 1 MB server cap

export interface CompressedImageResult {
  file: File;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  previewUrl: string;
}

export function validateImageFiles(
  incoming: File[],
  existingCount: number,
  maxAllowed: number,
): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  const mimeValid: File[] = [];

  for (const file of incoming) {
    if (
      !ALLOWED_IMAGE_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      errors.push(
        `"${file.name}" is unsupported (${file.type || "unknown"}). Use JPEG, PNG, or WebP.`,
      );
      continue;
    }
    mimeValid.push(file);
  }

  const remainingSlots = Math.max(0, maxAllowed - existingCount);
  if (mimeValid.length > remainingSlots) {
    errors.push(
      `Maximum ${maxAllowed} image${maxAllowed === 1 ? "" : "s"} allowed. You can attach ${remainingSlots} more.`,
    );
  }

  return { valid: mimeValid.slice(0, remainingSlots), errors };
}

export async function compressDiagnosticImage(
  file: File,
): Promise<CompressedImageResult> {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    throw new Error(
      `Unsupported image type "${file.type}". Please choose JPEG, PNG, or WebP.`,
    );
  }

  const originalSizeBytes = file.size;
  let outputFile = file;

  if (file.size > 350 * 1024) {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 0.45,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      initialQuality: 0.82,
    });
    outputFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type,
      lastModified: Date.now(),
    });
  }

  if (outputFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `"${file.name}" remains larger than 1 MB after compression (${formatBytes(outputFile.size)}). Please use a smaller photo.`,
    );
  }

  const previewUrl = URL.createObjectURL(outputFile);

  return {
    file: outputFile,
    originalSizeBytes,
    compressedSizeBytes: outputFile.size,
    previewUrl,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
