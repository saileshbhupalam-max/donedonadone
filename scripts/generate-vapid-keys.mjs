#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push notifications.
 *
 * Usage: node scripts/generate-vapid-keys.mjs
 *
 * Outputs the keys in the format needed for:
 * - .env (frontend: VITE_VAPID_PUBLIC_KEY)
 * - Supabase secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
 */

const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);

const publicKeyRaw = new Uint8Array(
  await crypto.subtle.exportKey("raw", keyPair.publicKey)
);
const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

// base64url encode
function base64UrlEncode(buffer) {
  let binary = "";
  for (const b of buffer) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const publicKey = base64UrlEncode(publicKeyRaw);
const privateKey = privateKeyJwk.d; // Already base64url

console.log("=== VAPID Keys Generated ===\n");
console.log("Add to .env (frontend):");
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}\n`);
console.log("Add as Supabase secrets:");
console.log(`supabase secrets set VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`supabase secrets set VAPID_PRIVATE_KEY="${privateKey}"`);
console.log(`supabase secrets set VAPID_SUBJECT="mailto:hello@danadone.club"\n`);
console.log("Public Key (65 bytes, uncompressed):", publicKey);
console.log("Private Key (32 bytes):", privateKey);
