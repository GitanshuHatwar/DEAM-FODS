import { describe, expect, it } from "vitest";
import { formatBytes, validateImageFiles } from "@/lib/imageCompression";

function makeFakeFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(["a".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("Image upload validation", () => {
  it("rejects unsupported MIME types such as GIF or PDF", () => {
    const files = [
      makeFakeFile("anim.gif", "image/gif"),
      makeFakeFile("doc.pdf", "application/pdf"),
      makeFakeFile("photo.jpg", "image/jpeg"),
    ];

    const res = validateImageFiles(files, 0, 2);
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].name).toBe("photo.jpg");
    expect(res.errors).toHaveLength(2);
  });

  it("enforces max image count limit for tickets (2) and assets (3)", () => {
    const files = [
      makeFakeFile("1.png", "image/png"),
      makeFakeFile("2.webp", "image/webp"),
      makeFakeFile("3.jpg", "image/jpeg"),
    ];

    const ticketCheck = validateImageFiles(files, 0, 2);
    expect(ticketCheck.valid).toHaveLength(2);
    expect(ticketCheck.errors[0]).toContain("Maximum 2 images");

    const assetCheck = validateImageFiles(files, 1, 3);
    expect(assetCheck.valid).toHaveLength(2);
    expect(assetCheck.errors[0]).toContain("Maximum 3 images");
  });

  it("formats file sizes cleanly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(350 * 1024)).toBe("350 KB");
    expect(formatBytes(1_572_864)).toBe("1.50 MB");
  });
});
