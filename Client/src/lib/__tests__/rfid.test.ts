import { describe, expect, it } from "vitest";
import {
  formatRfidGrouped,
  isValidRfidFormat,
  normalizeRfid,
} from "@/lib/rfid";

describe("RFID normalization & validation", () => {
  it("strips colons, hyphens, and whitespace and uppercases hex", () => {
    expect(normalizeRfid(" 04:a3:b2:c1 ")).toBe("04A3B2C1");
    expect(normalizeRfid("04-a3-b2-c1")).toBe("04A3B2C1");
    expect(normalizeRfid("04 a3 b2 c1")).toBe("04A3B2C1");
    expect(normalizeRfid("  9f:0e-12 c4  ")).toBe("9F0E12C4");
  });

  it("validates RFID format boundaries", () => {
    expect(isValidRfidFormat("04:a3:b2:c1")).toBe(true);
    expect(isValidRfidFormat("ABCD")).toBe(true);
    expect(isValidRfidFormat("AB")).toBe(false);
    expect(isValidRfidFormat("04#A3!B2")).toBe(false);
  });

  it("formats even-length UIDs into colon-separated octets", () => {
    expect(formatRfidGrouped("04a3b2c1")).toBe("04:A3:B2:C1");
    expect(formatRfidGrouped("ABC")).toBe("ABC");
  });
});
