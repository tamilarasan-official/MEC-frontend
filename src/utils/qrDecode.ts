/**
 * Decode QR code data from various formats and extract the order ID.
 *
 * Supports:
 * - Base64-encoded JSON with `order_id`
 * - Base64-encoded JSON with `orderId`
 * - Base64-encoded JSON with `o` (minimal format)
 * - Raw JSON string
 * - URL with ?code=<base64>
 */

function extractOrderId(data: Record<string, unknown>): string | null {
  const id = data.order_id || data.orderId || data.o;
  return typeof id === 'string' ? id : null;
}

declare function atob(data: string): string;

function base64Decode(str: string): string {
  try {
    return atob(str);
  } catch {
    return '';
  }
}

export function decodeQrData(scanned: string): string | null {
  const trimmed = scanned.trim();

  // 1. URL format: ...?code=<base64>
  const codeMatch = trimmed.match(/[?&]code=([^&]+)/);
  if (codeMatch) {
    try {
      const decoded = JSON.parse(base64Decode(decodeURIComponent(codeMatch[1])));
      const id = extractOrderId(decoded);
      if (id) return id;
    } catch { /* fall through */ }
  }

  // 2. Try raw JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      const id = extractOrderId(parsed);
      if (id) return id;
    }
  } catch { /* not raw JSON, fall through */ }

  // 3. Try base64 decode
  try {
    const decoded = JSON.parse(base64Decode(trimmed));
    const id = extractOrderId(decoded);
    if (id) return id;
  } catch { /* fall through */ }

  // 4. If it looks like a raw MongoDB ObjectId, return as-is
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
