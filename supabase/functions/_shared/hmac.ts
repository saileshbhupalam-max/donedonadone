/**
 * @module hmac
 * @description HMAC-SHA256 utility for Razorpay signature verification.
 * Uses Web Crypto API (available in Deno/Edge Functions).
 *
 * @key-exports verifyHmacSha256, computeHmacSha256Hex
 * @dependencies none (uses built-in Web Crypto)
 */

/**
 * Compute HMAC-SHA256 and return as hex string.
 */
export async function computeHmacSha256Hex(
  message: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify an HMAC-SHA256 signature (constant-time comparison).
 */
export async function verifyHmacSha256(
  message: string,
  secret: string,
  expectedHex: string
): Promise<boolean> {
  const computed = await computeHmacSha256Hex(message, secret);
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== expectedHex.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return result === 0;
}
