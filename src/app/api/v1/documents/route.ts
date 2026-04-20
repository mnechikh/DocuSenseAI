import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractBearerToken } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { uploadAndProcessDocumentForAIAnalysis } from "@/ai/flows/upload-and-process-document-for-ai-analysis";
import { randomUUID } from "crypto";

/**
 * GET /api/v1/documents
 * List all indexed documents for the tenant.
 *
 * POST /api/v1/documents
 * Ingest a new document.
 * Body: { "filename": "report.pdf", "fileType": "application/pdf", "dataUri": "data:..." }
 * OR:   { "filename": "page.html",  "fileType": "text/html",       "url": "https://..." }
 */

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(extractBearerToken(req.headers.get("authorization")) ?? "");
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const snap = await adminDb
    .collection("documents")
    .where("tenantId", "==", auth.tenantId)
    .orderBy("timestamp", "desc")
    .get();

  const docs = snap.docs.map((d) => {
    const r = d.data();
    return {
      id: r.id,
      filename: r.filename,
      fileType: r.fileType,
      status: r.status,
      chunkCount: r.chunkCount ?? null,
      processingMs: r.processingMs ?? null,
      failureReason: r.failureReason ?? null,
      timestamp: r.timestamp,
      extractedMetadata: r.extractedMetadata ?? null,
    };
  });

  return NextResponse.json({ documents: docs, total: docs.length }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(extractBearerToken(req.headers.get("authorization")) ?? "");
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { filename, fileType, dataUri, url } = body as Record<string, unknown>;

  if (typeof filename !== "string" || !filename.trim()) {
    return NextResponse.json({ error: "'filename' is required." }, { status: 400 });
  }
  if (typeof fileType !== "string" || !fileType.trim()) {
    return NextResponse.json({ error: "'fileType' is required." }, { status: 400 });
  }

  // Accept either inline base64 data URI or a remote URL
  const documentDataUri =
    typeof dataUri === "string" && dataUri.startsWith("data:")
      ? dataUri
      : typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))
      ? url
      : null;

  if (!documentDataUri) {
    return NextResponse.json(
      { error: "Provide either 'dataUri' (base64 data URI) or 'url' (https URL)." },
      { status: 400 }
    );
  }

  const documentId = randomUUID();
  const now = Date.now();

  // Write placeholder so quota check can exclude it (matches client-side flow)
  await adminDb.collection("documents").doc(documentId).set({
    id: documentId,
    tenantId: auth.tenantId,
    filename: filename.trim(),
    fileType: fileType.trim(),
    status: "uploaded",
    timestamp: now,
  });

  const result = await uploadAndProcessDocumentForAIAnalysis({
    tenantId: auth.tenantId,
    documentId,
    filename: filename.trim(),
    fileType: fileType.trim(),
    documentDataUri,
    callerRole: "Admin",
  });

  if (result.status === "processed") {
    await adminDb.collection("documents").doc(documentId).update({
      status: "indexed",
      chunkCount: result.chunkCount ?? 0,
      processingMs: null,
    });
  } else {
    await adminDb.collection("documents").doc(documentId).update({
      status: "failed",
      failureReason: result.message,
    });
  }

  return NextResponse.json(
    {
      documentId,
      status: result.status,
      message: result.message,
      chunkCount: result.chunkCount ?? null,
    },
    { status: result.status === "processed" ? 201 : 422 }
  );
}
