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

export interface QRPaymentData {
  type: 'shop_qr_payment';
  paymentId: string;
  title: string;
  amount: number;
  shopId: string;
  shopName: string;
}

/**
 * Detect if a scanned QR code is a shop QR payment.
 * Returns the payment data if valid, null otherwise.
 */
export function decodeQrPaymentData(scanned: string): QRPaymentData | null {
  try {
    const parsed = JSON.parse(scanned.trim());
    if (!parsed) return null;

    // New compact format: { t: 'qp', p: paymentId, a: amount, s: shopId }
    if (parsed.t === 'qp' && typeof parsed.p === 'string' && typeof parsed.a === 'number') {
      return {
        type: 'shop_qr_payment',
        paymentId: parsed.p,
        title: '',
        amount: parsed.a,
        shopId: parsed.s || '',
        shopName: '',
      };
    }

    // Legacy full format: { type: 'shop_qr_payment', paymentId, amount, ... }
    if (
      parsed.type === 'shop_qr_payment' &&
      typeof parsed.paymentId === 'string' &&
      typeof parsed.amount === 'number'
    ) {
      return {
        type: 'shop_qr_payment',
        paymentId: parsed.paymentId,
        title: parsed.title || '',
        amount: parsed.amount,
        shopId: parsed.shopId || '',
        shopName: parsed.shopName || '',
      };
    }
  } catch { /* not a payment QR */ }
  return null;
}

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

// QR codes expire after 10 minutes to prevent replay attacks (M8 fix)
const QR_TTL_MS = 10 * 60 * 1000;

/**
 * Check if a parsed QR payload has expired.
 * Requires the backend to include a `ts` (Unix ms timestamp) in the QR payload.
 * Returns true (expired) if ts is present and older than QR_TTL_MS.
 */
function isQrExpired(parsed: Record<string, unknown>): boolean {
  if (typeof parsed.ts !== 'number') return false; // No timestamp — backward compat, allow
  return (Date.now() - parsed.ts) > QR_TTL_MS;
}

export function decodeQrData(scanned: string): string | null {
  const trimmed = scanned.trim();

  // 1. URL format: ...?code=<base64>
  const codeMatch = trimmed.match(/[?&]code=([^&]+)/);
  if (codeMatch) {
    try {
      const decoded = JSON.parse(base64Decode(decodeURIComponent(codeMatch[1])));
      if (isQrExpired(decoded)) return null; // Expired QR — reject
      const id = extractOrderId(decoded);
      if (id) return id;
    } catch { /* fall through */ }
  }

  // 2. Try raw JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      if (isQrExpired(parsed)) return null; // Expired QR — reject
      const id = extractOrderId(parsed);
      if (id) return id;
    }
  } catch { /* not raw JSON, fall through */ }

  // 3. Try base64 decode
  try {
    const decoded = JSON.parse(base64Decode(trimmed));
    if (isQrExpired(decoded)) return null; // Expired QR — reject
    const id = extractOrderId(decoded);
    if (id) return id;
  } catch { /* fall through */ }

  // 4. If it looks like a raw MongoDB ObjectId, return as-is
  // Note: raw ObjectIds have no timestamp — backend must validate shop ownership
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
