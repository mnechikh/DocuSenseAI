"use server";

import { adminAuth, adminDb, isSuperAdmin } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { PLAN_DEFAULTS, nextResetTs, type TenantPlan } from "@/lib/quota-constants";

const SESSION_COOKIE_NAME = "docusense_session";
const SESSION_DURATION_MS = 60 * 60 * 24 * 14 * 1000; // 14 days
const INVITE_EXPIRY_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

// ─── Session ──────────────────────────────────────────────────────────────────

export async function createSessionCookie(idToken: string) {
  // Verify the token to get the uid, then stamp tenantId + role as custom claims
  // so Firestore security rules can use request.auth.token.tenantId directly.
  const decoded = await adminAuth.verifyIdToken(idToken);
  const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
  if (userSnap.exists) {
    const { tenantId, role } = userSnap.data() as { tenantId: string; role: string };
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
    const profileSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!profileSnap.exists) return null;
    return { uid: decoded.uid, ...profileSnap.data() } as {
      uid: string;
      tenantId: string;
      email: string;
      role: "Admin" | "User";
      name: string;
      status: "pending" | "active" | "suspended";
    };
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
    status: "pending",
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
 * Does NOT increment — caller must create the document record separately.
 */
export async function checkDocumentQuota(
  tenantId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const snap = await adminDb.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) return { allowed: false, reason: "Tenant not found." };
  const data = snap.data() as Record<string, unknown>;
  const docQuota = (data.docQuota as number) ?? 5;
  // Count indexed + processing docs (not failed/uploaded-only)
  const countSnap = await adminDb
    .collection("documents")
    .where("tenantId", "==", tenantId)
    .where("status", "in", ["uploaded", "processing", "indexed"])
    .count()
    .get();
  const current = countSnap.data().count;
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
  await adminDb.doc(`users/${targetUid}`).update({ status: "suspended" });
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
