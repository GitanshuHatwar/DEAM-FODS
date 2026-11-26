/**
 * Normalizes a raw RFID UID string by trimming, stripping `:`, `-`, and whitespace,
 * and converting to uppercase hexadecimal characters.
 */
export function normalizeRfid(raw: string): string {
  return raw.replace(/[:\-\s]+/g, "").trim().toUpperCase();
}

/**
 * Validates that a normalized RFID UID contains 4-32 hexadecimal or alphanumeric chars.
 */
export function isValidRfidFormat(raw: string): boolean {
  const normalized = normalizeRfid(raw);
  return /^[0-9A-Z]{4,32}$/.test(normalized);
}

/**
 * Formats an RFID UID in grouped 2-character octets for crisp hardware display
 * (e.g., "04A3B2C1" -> "04:A3:B2:C1") when desired, while keeping raw normalized for lookups.
 */
export function formatRfidGrouped(raw: string): string {
  const normalized = normalizeRfid(raw);
  if (normalized.length % 2 !== 0 || normalized.length < 4) {
    return normalized;
  }
  return normalized.match(/.{1,2}/g)?.join(":") ?? normalized;
}
