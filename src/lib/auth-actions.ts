"use server";

import { adminAuth, adminDb, isSuperAdmin } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { PLAN_DEFAULTS, nextResetTs, type TenantPlan } from "@/lib/quota-constants";
import { logActivity } from "@/lib/activity-log";

const SESSION_COOKIE_NAME = "docusense_session";
const SESSION_DURATION_MS = 60 * 60 * 24 * 14 * 1000; // 14 days
const INVITE_EXPIRY_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

// ─── Session ──────────────────────────────────────────────────────────────────

export async function createSessionCookie(idToken: string) {
  // Verify the token to get the uid, then stamp tenantId + role as custom claims
  // so Firestore security rules can use request.auth.token.tenantId directly.
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    let tenantIdForLog: string | undefined;
    if (userSnap.exists) {
      const { tenantId, role } = userSnap.data() as { tenantId: string; role: string; email?: string };
      tenantIdForLog = tenantId;
      await adminAuth.setCustomUserClaims(decoded.uid, { tenantId, role });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
    });

    if (tenantIdForLog) {
      logActivity({
        tenantId: tenantIdForLog,
        level: 'info',
        category: 'auth',
        action: 'auth.login_success',
        actorId: tenantIdForLog ? undefined : undefined,
        actorEmail: decoded.email,
        message: `Successful login for ${decoded.email ?? 'unknown'}`,
      });
    }
  } catch (err) {
    // Re-throw as a plain Error so Next.js server actions can serialize it
    // (Firebase Admin SDK errors have non-serializable properties).
    const message = (err as { message?: string; errorInfo?: { message?: string } })?.errorInfo?.message
      ?? (err as Error)?.message
      ?? 'Failed to create session.';
    throw new Error(message);
  }
}

export async function revokeSessionCookie() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {}
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);

    // Primary lookup: by UID
    const profileSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (profileSnap.exists) {
      return { uid: decoded.uid, ...profileSnap.data() } as {
        uid: string; tenantId: string; email: string;
        role: "Admin" | "User"; name: string;
        status: "pending" | "active" | "suspended";
      };
    }

    // Fallback: look up by email (handles existing email/password users signing in
    // with Google for the first time — different UID, same email).
    if (decoded.email) {
      const emailQuery = await adminDb.collection("users")
        .where("email", "==", decoded.email)
        .limit(1)
        .get();
      if (!emailQuery.empty) {
        const doc = emailQuery.docs[0];
        // Migrate the doc to the new Google UID so future lookups hit the fast path.
        await adminDb.doc(`users/${decoded.uid}`).set(doc.data());
        await adminDb.doc(`users/${doc.id}`).delete();
        return { uid: decoded.uid, ...doc.data() } as {
          uid: string; tenantId: string; email: string;
          role: "Admin" | "User"; name: string;
          status: "pending" | "active" | "suspended";
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Profile & Tenant Creation ────────────────────────────────────────────────

export async function createUserProfile(
  uid: string,
  email: string,
  name: string,
  tenantId: string,
  role: "Admin" | "User",
  status: "pending" | "active" = "pending"
) {
  await adminDb.doc(`users/${uid}`).set({
    email,
    name,
    tenantId,
    role,
    status,
    createdAt: Date.now(),
  });
}

export async function createTenant(
  tenantId: string,
  tenantName: string,
  ownerId: string
) {
  const defaults = PLAN_DEFAULTS.free;
  await adminDb.doc(`tenants/${tenantId}`).set({
    name: tenantName,
    ownerId,
    status: "active",
    createdAt: Date.now(),
    stripeCustomerId: null,
    paidAt: null,
    // Quota fields — defaulting to free tier
    plan: "free" as TenantPlan,
    docQuota: defaults.docQuota,
    queryQuota: defaults.queryQuota,
    storageMB: defaults.storageMB,
    queriesThisMonth: 0,
    quotaResetAt: nextResetTs(),
  });
}

// ─── Owner Super-Admin Actions ────────────────────────────────────────────────

async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user || !isSuperAdmin(user.uid)) {
    throw new Error("Unauthorized: super-admin only.");
  }
  return user;
}

export async function getAllTenants() {
  await requireSuperAdmin();
  const tenantsSnap = await adminDb.collection("tenants").orderBy("createdAt", "desc").get();
  const tenants = tenantsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

  const result = await Promise.all(
    tenants.map(async (t) => {
      const usersSnap = await adminDb.collection("users").where("tenantId", "==", t.id).count().get();
      return { ...t, userCount: usersSnap.data().count };
    })
  );
  return result as Array<{
    id: string;
    name: string;
    ownerId: string;
    status: "pending" | "active" | "suspended";
    createdAt: number;
    userCount: number;
    stripeCustomerId: string | null;
    paidAt: number | null;
    // quota fields (may be absent on old tenants — default gracefully in UI)
    plan: TenantPlan;
    docQuota: number;
    queryQuota: number;
    storageMB: number;
    queriesThisMonth: number;
    quotaResetAt: number;
  }>;
}

export async function approveTenant(tenantId: string) {
  await requireSuperAdmin();
  const batch = adminDb.batch();
  batch.update(adminDb.doc(`tenants/${tenantId}`), { status: "active" });
  const usersSnap = await adminDb.collection("users").where("tenantId", "==", tenantId).get();
  usersSnap.forEach((doc) => batch.update(doc.ref, { status: "active" }));
  await batch.commit();
}

export async function suspendTenant(tenantId: string) {
  await requireSuperAdmin();
  const batch = adminDb.batch();
  batch.update(adminDb.doc(`tenants/${tenantId}`), { status: "suspended" });
  const usersSnap = await adminDb.collection("users").where("tenantId", "==", tenantId).get();
  usersSnap.forEach((doc) => batch.update(doc.ref, { status: "suspended" }));
  await batch.commit();
}

// ─── Tenant CRUD (super-admin) ────────────────────────────────────────────────

/**
 * Rewrites a Firebase password-reset link to use the app's own domain,
 * hiding the Firebase project URL from recipients.
 * Input:  https://xxx.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC&...
 * Output: https://your-app.com/set-password?oobCode=ABC
 */
function toAppResetLink(firebaseLink: string): string {
  try {
    const parsed = new URL(firebaseLink);
    const oobCode = parsed.searchParams.get("oobCode");
    if (!oobCode) return firebaseLink; // fallback to raw link
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    return `${base}/set-password?oobCode=${encodeURIComponent(oobCode)}`;
  } catch {
    return firebaseLink;
  }
}

/**
 * Create a workspace from the admin panel.
 * If a Firebase Auth account for ownerEmail already exists, it is reused.
 * Otherwise a new account is created and a password-reset email is sent so
 * the owner can set their own password.
 * Returns { tenantId, resetLink } — resetLink is null if the owner already had
 * an account (use getOwnerResetLink to generate one on demand in that case).
 */
export async function createTenantAsAdmin(
  workspaceName: string,
  ownerEmail: string
): Promise<{ tenantId: string; resetLink: string | null }> {
  await requireSuperAdmin();

  // Slug the workspace name into a readable tenantId, with collision counter
  const slug = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  let tenantId = slug;
  let suffix = 1;
  while ((await adminDb.doc(`tenants/${tenantId}`).get()).exists) {
    suffix += 1;
    tenantId = `${slug}-${suffix}`;
  }

  // Find or create the owner Firebase Auth account
  let ownerUid: string;
  let resetLink: string | null = null;
  let isNewAccount = false;
  try {
    const existing = await adminAuth.getUserByEmail(ownerEmail);
    ownerUid = existing.uid;
  } catch {
    const created = await adminAuth.createUser({ email: ownerEmail });
    ownerUid = created.uid;
    isNewAccount = true;
  }

  // Write tenant + owner user profile in a batch
  const batch = adminDb.batch();
  const defaults = PLAN_DEFAULTS.free;
  batch.set(adminDb.doc(`tenants/${tenantId}`), {
    name: workspaceName,
    ownerId: ownerUid,
    status: "active",
    createdAt: Date.now(),
    stripeCustomerId: null,
    paidAt: null,
    plan: "free" as TenantPlan,
    docQuota: defaults.docQuota,
    queryQuota: defaults.queryQuota,
    storageMB: defaults.storageMB,
    queriesThisMonth: 0,
    quotaResetAt: nextResetTs(),
  });
  batch.set(adminDb.doc(`users/${ownerUid}`), {
    email: ownerEmail,
    name: ownerEmail.split("@")[0],
    tenantId,
    role: "Admin",
    status: "active",
    createdAt: Date.now(),
  }, { merge: true });
  await batch.commit();

  // Stamp custom claims so Firestore rules work immediately
  await adminAuth.setCustomUserClaims(ownerUid, { tenantId, role: "Admin" });

  // Generate reset link for new accounts so the admin can share it
  if (isNewAccount) {
    try {
      const raw = await adminAuth.generatePasswordResetLink(ownerEmail);
      resetLink = toAppResetLink(raw);
    } catch {
      // non-fatal — admin can use the per-row button to generate one
    }
  }

  return { tenantId, resetLink };
}

export async function renameTenant(tenantId: string, newName: string) {
  await requireSuperAdmin();
  const name = newName.trim();
  if (!name) throw new Error("Workspace name cannot be empty.");
  await adminDb.doc(`tenants/${tenantId}`).update({ name });
}

/**
 * Generate a fresh Firebase password-reset link for the workspace owner.
 * The link is returned to the caller (admin UI) for copy/paste — no email is sent.
 */
export async function getOwnerResetLink(tenantId: string): Promise<string> {
  await requireSuperAdmin();
  const tenantSnap = await adminDb.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) throw new Error("Tenant not found.");
  const { ownerId } = tenantSnap.data() as { ownerId: string };
  const userSnap = await adminDb.doc(`users/${ownerId}`).get();
  if (!userSnap.exists) throw new Error("Owner profile not found.");
  const { email } = userSnap.data() as { email: string };
  const raw = await adminAuth.generatePasswordResetLink(email);
  return toAppResetLink(raw);
}

/**
 * Hard-delete a workspace and all its data:
 * users, documents, chunks, invites, and the tenant document itself.
 * Firebase Auth accounts are NOT deleted — only suspended in Firestore.
 */
export async function deleteTenant(tenantId: string) {
  await requireSuperAdmin();

  // 1. Suspend + collect all user UIDs
  const usersSnap = await adminDb.collection("users").where("tenantId", "==", tenantId).get();
  const userBatch = adminDb.batch();
  const uids: string[] = [];
  usersSnap.forEach((d) => { userBatch.delete(d.ref); uids.push(d.id); });
  if (usersSnap.size > 0) await userBatch.commit();

  // Revoke refresh tokens so sessions are instantly invalidated
  await Promise.allSettled(uids.map((uid) => adminAuth.revokeRefreshTokens(uid)));

  // 2. Delete documents
  const docsSnap = await adminDb.collection("documents").where("tenantId", "==", tenantId).get();
  const docBatch = adminDb.batch();
  docsSnap.forEach((d) => docBatch.delete(d.ref));
  if (docsSnap.size > 0) await docBatch.commit();

  // 3. Delete chunk docs (stored as chunks/{tenantId}_{documentId})
  const chunksSnap = await adminDb.collection("chunks")
    .where("tenantId", "==", tenantId)
    .get();
  if (chunksSnap.size > 0) {
    const chunkBatch = adminDb.batch();
    chunksSnap.forEach((d) => chunkBatch.delete(d.ref));
    await chunkBatch.commit();
  }

  // 4. Delete invites
  const invitesSnap = await adminDb.collection("invites").where("tenantId", "==", tenantId).get();
  if (invitesSnap.size > 0) {
    const invBatch = adminDb.batch();
    invitesSnap.forEach((d) => invBatch.delete(d.ref));
    await invBatch.commit();
  }

  // 5. Delete the tenant document itself
  await adminDb.doc(`tenants/${tenantId}`).delete();
}

// ─── Quota management (super-admin) ──────────────────────────────────────────

export async function getTenantQuota(tenantId: string) {
  await requireSuperAdmin();
  const snap = await adminDb.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) throw new Error("Tenant not found.");
  const data = snap.data() as Record<string, unknown>;
  const plan = (data.plan as TenantPlan) ?? "free";
  const defaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.free;
  return {
    plan,
    docQuota:         (data.docQuota         as number) ?? defaults.docQuota,
    queryQuota:       (data.queryQuota       as number) ?? defaults.queryQuota,
    storageMB:        (data.storageMB        as number) ?? defaults.storageMB,
    queriesThisMonth: (data.queriesThisMonth as number) ?? 0,
    quotaResetAt:     (data.quotaResetAt     as number) ?? nextResetTs(),
  };
}

export async function setTenantQuota(
  tenantId: string,
  plan: TenantPlan,
  overrides?: { docQuota?: number; queryQuota?: number; storageMB?: number }
) {
  await requireSuperAdmin();
  const defaults = PLAN_DEFAULTS[plan];
  await adminDb.doc(`tenants/${tenantId}`).update({
    plan,
    docQuota:   overrides?.docQuota   ?? defaults.docQuota,
    queryQuota: overrides?.queryQuota ?? defaults.queryQuota,
    storageMB:  overrides?.storageMB  ?? defaults.storageMB,
  });
}

export async function resetTenantQueryCount(tenantId: string) {
  await requireSuperAdmin();
  await adminDb.doc(`tenants/${tenantId}`).update({
    queriesThisMonth: 0,
    quotaResetAt: nextResetTs(),
  });
}

// ─── Quota enforcement helpers (called from AI server actions) ────────────────

/**
 * Check and atomically increment the monthly query counter.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function checkAndIncrementQueryQuota(
  tenantId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const ref = adminDb.doc(`tenants/${tenantId}`);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { allowed: false, reason: "Tenant not found." };
    const data = snap.data() as Record<string, unknown>;
    const queryQuota = (data.queryQuota       as number) ?? 50;
    let   count      = (data.queriesThisMonth as number) ?? 0;
    const resetAt    = (data.quotaResetAt     as number) ?? 0;
    // Auto-reset counter at start of new billing month
    if (Date.now() >= resetAt) {
      count = 0;
      tx.update(ref, { queriesThisMonth: 0, quotaResetAt: nextResetTs() });
    }
    if (count >= queryQuota) {
      return { allowed: false, reason: `Monthly query limit reached (${queryQuota}). Please upgrade your plan.` };
    }
    tx.update(ref, { queriesThisMonth: count + 1 });
    return { allowed: true };
  });
}

/**
 * Check whether adding a new document would exceed the tenant's docQuota.
 * Pass `excludeDocumentId` to exclude a already-written placeholder doc from the count
 * (the client pre-writes a doc with status "uploaded" before calling this).
 */
export async function checkDocumentQuota(
  tenantId: string,
  excludeDocumentId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const snap = await adminDb.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) return { allowed: false, reason: "Tenant not found." };
  const data = snap.data() as Record<string, unknown>;
  const docQuota = (data.docQuota as number) ?? 5;
  // Count indexed + processing + uploaded docs, excluding the current in-flight doc
  const countSnap = await adminDb
    .collection("documents")
    .where("tenantId", "==", tenantId)
    .where("status", "in", ["uploaded", "processing", "indexed"])
    .count()
    .get();
  // Subtract 1 if the caller pre-wrote their own placeholder doc before calling us
  const inflight = excludeDocumentId ? 1 : 0;
  const current = countSnap.data().count - inflight;
  if (current >= docQuota) {
    return {
      allowed: false,
      reason: `Document quota reached (${current}/${docQuota}). Please upgrade your plan or delete unused documents.`,
    };
  }
  return { allowed: true };
}

/**
 * Returns quota status for the currently authenticated tenant.
 * Callable by any authenticated user belonging to the tenant.
 */
export async function getMyTenantQuota(): Promise<{
  plan: TenantPlan;
  docQuota: number;
  queryQuota: number;
  storageMB: number;
  queriesThisMonth: number;
  quotaResetAt: number;
}> {
  const user = await getSessionUser();
  if (!user?.tenantId) throw new Error("Not authenticated.");
  const snap = await adminDb.doc(`tenants/${user.tenantId}`).get();
  if (!snap.exists) throw new Error("Tenant not found.");
  const data = snap.data() as Record<string, unknown>;
  const plan = (data.plan as TenantPlan) ?? "free";
  const defaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.free;
  return {
    plan,
    docQuota:         (data.docQuota         as number) ?? defaults.docQuota,
    queryQuota:       (data.queryQuota       as number) ?? defaults.queryQuota,
    storageMB:        (data.storageMB        as number) ?? defaults.storageMB,
    queriesThisMonth: (data.queriesThisMonth as number) ?? 0,
    quotaResetAt:     (data.quotaResetAt     as number) ?? nextResetTs(),
  };
}

// ─── Invite Tokens ────────────────────────────────────────────────────────────

export async function generateInviteToken(
  tenantId: string,
  role: "Admin" | "User",
  createdBy: string,
  email?: string
): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized.");
  if (
    !isSuperAdmin(user.uid) &&
    (user.tenantId !== tenantId || user.role !== "Admin" || user.status !== "active")
  ) {
    throw new Error("Unauthorized: must be an active admin of this workspace.");
  }
  const token = crypto.randomUUID();
  await adminDb.doc(`invites/${token}`).set({
    tenantId,
    role,
    createdBy,
    email: email ?? null,
    createdAt: Date.now(),
    expiresAt: Date.now() + INVITE_EXPIRY_MS,
    usedAt: null,
    usedBy: null,
  });
  return token;
}

export async function validateInviteToken(token: string): Promise<{
  tenantId: string;
  role: "Admin" | "User";
  email: string | null;
} | null> {
  if (!token) return null;
  try {
    const snap = await adminDb.doc(`invites/${token}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as {
      tenantId: string;
      role: "Admin" | "User";
      email: string | null;
      expiresAt: number;
      usedAt: number | null;
    };
    if (data.usedAt !== null) return null;
    if (Date.now() > data.expiresAt) return null;
    return { tenantId: data.tenantId, role: data.role, email: data.email };
  } catch {
    return null;
  }
}

export async function consumeInviteToken(token: string, usedBy: string) {
  await adminDb.doc(`invites/${token}`).update({ usedAt: Date.now(), usedBy });
}

export async function getTenantMembers(tenantId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized.");
  if (!isSuperAdmin(user.uid) && user.tenantId !== tenantId) {
    throw new Error("Unauthorized.");
  }
  const snap = await adminDb.collection("users").where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as Record<string, unknown>),
  })) as Array<{
    uid: string;
    name: string;
    email: string;
    role: "Admin" | "User";
    status: "pending" | "active" | "suspended";
    createdAt: number;
  }>;
}

export async function removeUserFromTenant(targetUid: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized.");
  const targetSnap = await adminDb.doc(`users/${targetUid}`).get();
  if (!targetSnap.exists) throw new Error("User not found.");
  const target = targetSnap.data() as { tenantId: string };
  if (!isSuperAdmin(user.uid) && (user.tenantId !== target.tenantId || user.role !== "Admin")) {
    throw new Error("Unauthorized.");
  }
  if (targetUid === user.uid) throw new Error("Cannot remove yourself.");
  const targetData = targetSnap.data() as { tenantId: string; email?: string; name?: string };
  await adminDb.doc(`users/${targetUid}`).update({ status: "suspended" });
  logActivity({
    tenantId: targetData.tenantId,
    level: 'warning',
    category: 'user',
    action: 'user.removed',
    actorId: user.uid,
    actorEmail: user.email,
    targetId: targetUid,
    targetName: targetData.email ?? targetData.name,
    message: `User ${targetData.email ?? targetUid} removed from tenant`,
  });
}

// ─── Stripe stub ───────────────────────────────────────────────────────────────
// When Stripe is integrated: call approveTenant() from the Stripe webhook at
// /api/webhooks/stripe and store stripeCustomerId + paidAt on the tenant document.

// ─── Document chunk cleanup ───────────────────────────────────────────────────

export async function deleteDocumentChunks(documentId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized.");
  // Delete the Firestore chunks doc for this document
  await adminDb.doc(`chunks/${user.tenantId}_${documentId}`).delete();
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export async function createApiKey(label: string): Promise<{ rawKey: string; keyId: string }> {
  const user = await getSessionUser();
  if (!user || user.role !== "Admin") throw new Error("Only Admins can create API keys.");
  const { generateRawKey } = await import("@/lib/api-auth");
  const { rawKey, record } = generateRawKey(user.tenantId, label.trim() || "Unnamed key");
  await adminDb.collection("apiKeys").doc(record.keyId).set(record);
  return { rawKey, keyId: record.keyId };
}

export async function listApiKeys(): Promise<Array<{
  keyId: string;
  label: string;
  keyPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  active: boolean;
}>> {
  const user = await getSessionUser();
  if (!user || user.role !== "Admin") throw new Error("Only Admins can list API keys.");
  const snap = await adminDb
    .collection("apiKeys")
    .where("tenantId", "==", user.tenantId)
    .where("active", "==", true)
    .get();
  return snap.docs
    .map((d) => {
      const r = d.data();
      return {
        keyId: r.keyId as string,
        label: r.label as string,
        keyPrefix: r.keyPrefix as string,
        createdAt: r.createdAt as number,
        lastUsedAt: (r.lastUsedAt as number | null) ?? null,
        active: r.active as boolean,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.role !== "Admin") throw new Error("Only Admins can revoke API keys.");
  const ref = adminDb.collection("apiKeys").doc(keyId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Key not found.");
  if ((snap.data() as { tenantId: string }).tenantId !== user.tenantId) {
    throw new Error("Unauthorized.");
  }
  await ref.update({ active: false });
}
