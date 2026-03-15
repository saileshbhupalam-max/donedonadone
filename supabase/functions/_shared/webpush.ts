/**
 * @module webpush
 * @description Web Push protocol implementation using Web Crypto API (Deno/Edge Functions).
 *
 * Implements RFC 8291 (Message Encryption for Web Push) and RFC 8292 (VAPID).
 * No external dependencies — uses only SubtleCrypto APIs available in Deno.
 *
 * @key-exports sendWebPush
 * @dependencies none (uses built-in Web Crypto)
 */

// ── Encoding helpers ──────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  // Handle both standard base64 and base64url
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

function encodeLength(value: number, length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    buffer[i] = value & 0xff;
    value >>= 8;
  }
  return buffer;
}

// ── VAPID JWT (RFC 8292) ──────────────────────────────────

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string,
  expSeconds = 12 * 60 * 60 // 12 hours
): Promise<{ authorization: string; cryptoKey: string }> {
  // JWT header
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" }))
  );

  // JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + expSeconds, sub: subject })
    )
  );

  // Import VAPID private key for signing
  const rawPrivate = base64UrlDecode(privateKeyBase64);
  // ECDSA P-256 private key is 32 bytes; construct JWK
  const rawPublic = base64UrlDecode(publicKeyBase64);

  // The public key is in uncompressed form (65 bytes: 0x04 + 32 x + 32 y)
  const pubUncompressed = rawPublic.length === 65 ? rawPublic : rawPublic;
  const x = base64UrlEncode(pubUncompressed.slice(1, 33));
  const y = base64UrlEncode(pubUncompressed.slice(33, 65));
  const d = base64UrlEncode(rawPrivate);

  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d,
  };

  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the JWT
  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    sigInput
  );

  // ECDSA signature is DER-encoded by SubtleCrypto; Web Push needs raw r||s (64 bytes)
  const rawSig = derToRaw(new Uint8Array(signature));
  const token = `${header}.${payload}.${base64UrlEncode(rawSig)}`;

  return {
    authorization: `vapid t=${token},k=${publicKeyBase64}`,
    cryptoKey: publicKeyBase64,
  };
}

// Convert DER-encoded ECDSA signature to raw r||s format
function derToRaw(der: Uint8Array): Uint8Array {
  // If already 64 bytes, it's already raw format
  if (der.length === 64) return der;

  // DER format: 0x30 <total-len> 0x02 <r-len> <r> 0x02 <s-len> <s>
  let offset = 2; // skip 0x30 and total length
  if (der[0] !== 0x30) return der; // Not DER, return as-is

  // Read r
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  // Pad or trim to 32 bytes each
  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

// ── Content Encryption (RFC 8291 + RFC 8188 aes128gcm) ────

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<Uint8Array> {
  const clientPublicKey = base64UrlDecode(p256dhBase64);
  const clientAuth = base64UrlDecode(authBase64);
  const plaintext = new TextEncoder().encode(payload);

  // 1. Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // 2. Import client's p256dh public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // 3. Derive shared secret via ECDH
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      ephemeral.privateKey,
      256
    )
  );

  // 4. Export ephemeral public key (uncompressed point)
  const ephemeralPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey)
  );

  // 5. HKDF to derive IKM from shared secret (RFC 8291 Section 3.3)
  //    salt = client auth secret
  //    info = "WebPush: info\0" + client_public + server_public
  const ikmInfo = concatBuffers(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    ephemeralPublicKey
  );

  const ikm = await hkdf(clientAuth, sharedSecret, ikmInfo, 32);

  // 6. Derive content encryption key (CEK) and nonce
  //    salt = random 16 bytes (sent in the header)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // 7. Add padding delimiter (RFC 8188): payload + 0x02 (single record with padding)
  const paddedPayload = concatBuffers(plaintext, new Uint8Array([2]));

  // 8. Encrypt with AES-128-GCM
  const encryptionKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      encryptionKey,
      paddedPayload
    )
  );

  // 9. Assemble aes128gcm content coding (RFC 8188 Section 2)
  //    salt (16) + record_size (4) + key_id_len (1) + key_id (65 = ephemeral pub) + encrypted
  const recordSize = encodeLength(encrypted.length + 86, 4); // header + encrypted
  const keyIdLen = new Uint8Array([65]); // uncompressed P-256 point

  return concatBuffers(salt, recordSize, keyIdLen, ephemeralPublicKey, encrypted);
}

// HKDF-SHA256: extract then expand
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // Extract: PRK = HMAC-SHA256(salt, IKM)
  const extractKey = await crypto.subtle.importKey(
    "raw",
    salt.length > 0 ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", extractKey, ikm)
  );

  // Expand: OKM = HMAC-SHA256(PRK, info + 0x01)
  const expandKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expandInput = concatBuffers(info, new Uint8Array([1]));
  const okm = new Uint8Array(
    await crypto.subtle.sign("HMAC", expandKey, expandInput)
  );

  return okm.slice(0, length);
}

// ── Public API ────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

export interface PushResult {
  endpoint: string;
  success: boolean;
  status?: number;
  error?: string;
}

/**
 * Send a Web Push notification to a single subscription.
 *
 * Requires VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, and VAPID_SUBJECT
 * to be set in Deno.env (Supabase secrets).
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<PushResult> {
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@danadone.club";

  if (!vapidPrivateKey || !vapidPublicKey) {
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: "VAPID keys not configured",
    };
  }

  try {
    // Build audience from endpoint URL
    const endpointUrl = new URL(subscription.endpoint);
    const audience = endpointUrl.origin;

    // Create VAPID authorization
    const { authorization } = await createVapidJwt(
      audience,
      vapidSubject,
      vapidPrivateKey,
      vapidPublicKey
    );

    // Encrypt the payload
    const payloadJson = JSON.stringify(payload);
    const encryptedBody = await encryptPayload(
      payloadJson,
      subscription.p256dh,
      subscription.auth
    );

    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400", // 24 hours
        Urgency: "normal",
      },
      body: encryptedBody,
    });

    if (response.status === 201 || response.status === 200) {
      return { endpoint: subscription.endpoint, success: true, status: response.status };
    }

    // 410 Gone = subscription expired, should be removed
    const errorText = await response.text().catch(() => "");
    return {
      endpoint: subscription.endpoint,
      success: false,
      status: response.status,
      error: `Push service returned ${response.status}: ${errorText}`,
    };
  } catch (err) {
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send a Web Push notification to multiple subscriptions.
 * Returns results for each endpoint.
 */
export async function sendWebPushBatch(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<PushResult[]> {
  return Promise.all(
    subscriptions.map((sub) => sendWebPush(sub, payload))
  );
}
