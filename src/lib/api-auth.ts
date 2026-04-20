/**
 * API key validation for the public REST API.
 * Keys are formatted as:  lum_<32-hex-chars>
 * The full key is shown once to the user; only the SHA-256 hash is stored.
 */
import { createHash, randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase-admin";

export interface ApiKeyRecord {
  keyId: string;
  tenantId: string;
  label: string;
  keyPrefix: string;   // first 8 chars of the raw key — shown in UI for identification
  keyHash: string;     // SHA-256 of the full raw key
  createdAt: number;
  lastUsedAt: number | null;
  active: boolean;
}

/** Generate a new API key raw value. Returns both the raw key (show once) and the record to store. */
export function generateRawKey(tenantId: string, label: string): { rawKey: string; record: ApiKeyRecord } {
  const secret = randomBytes(32).toString("hex");
  const rawKey = `lum_${secret}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyId = randomBytes(8).toString("hex");
  return {
    rawKey,
    record: {
      keyId,
      tenantId,
      label,
      keyPrefix: rawKey.slice(0, 12),   // "lum_" + first 8 hex chars
      keyHash,
      createdAt: Date.now(),
      lastUsedAt: null,
      active: true,
    },
  };
}

/**
 * Validate an API key from the Authorization header.
 * Returns the tenant ID if valid, or null if invalid/revoked.
 */
export async function validateApiKey(rawKey: string): Promise<{ tenantId: string; keyId: string } | null> {
  if (!rawKey?.startsWith("lum_")) return null;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const snap = await adminDb
    .collection("apiKeys")
    .where("keyHash", "==", keyHash)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const record = snap.docs[0].data() as ApiKeyRecord;
  // Update lastUsedAt asynchronously — don't block the request
  snap.docs[0].ref.update({ lastUsedAt: Date.now() }).catch(() => {});
  return { tenantId: record.tenantId, keyId: record.keyId };
}

/** Extract the bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
