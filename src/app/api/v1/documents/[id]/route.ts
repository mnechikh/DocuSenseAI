import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractBearerToken } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/v1/documents/[id]   — retrieve a single document record
 * DELETE /api/v1/documents/[id] — delete document + its chunks
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(extractBearerToken(req.headers.get("authorization")) ?? "");
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const { id } = await params;
  const snap = await adminDb.collection("documents").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data = snap.data()!;
  if (data.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    filename: data.filename,
    fileType: data.fileType,
    status: data.status,
    chunkCount: data.chunkCount ?? null,
    processingMs: data.processingMs ?? null,
    failureReason: data.failureReason ?? null,
    timestamp: data.timestamp,
    extractedMetadata: data.extractedMetadata ?? null,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(extractBearerToken(req.headers.get("authorization")) ?? "");
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const { id } = await params;
  const snap = await adminDb.collection("documents").doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data = snap.data()!;
  if (data.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await Promise.all([
    adminDb.collection("documents").doc(id).delete(),
    adminDb.collection("chunks").doc(`${auth.tenantId}_${id}`).delete().catch(() => {}),
  ]);

  return new NextResponse(null, { status: 204 });
}
