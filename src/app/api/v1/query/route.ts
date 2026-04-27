import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractBearerToken } from "@/lib/api-auth";
import { getAIPoweredAnswersFromDocuments } from "@/ai/flows/get-ai-powered-answers-from-documents";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/v1/query
 *
 * Submit a natural-language question against your indexed knowledge base.
 *
 * Headers:
 *   Authorization: Bearer lum_<key>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     "query": "What are the payment terms?",
 *     "topK":  10,                        // optional, 1-20, default 10
 *     "chatHistory": [                    // optional — multi-turn context
 *       { "role": "user",  "content": "..." },
 *       { "role": "model", "content": "..." }
 *     ]
 *   }
 *
 * Response 200:
 *   {
 *     "answer": "...",
 *     "citations": [{ "documentName": "...", "pageSection": "..." }],
 *     "hasContext": true
 *   }
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await validateApiKey(extractBearerToken(req.headers.get("authorization")) ?? "");
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { query, topK, chatHistory } = body as Record<string, unknown>;

  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "'query' must be a non-empty string." }, { status: 400 });
  }
  if (query.length > 2000) {
    return NextResponse.json({ error: "'query' must be ≤ 2000 characters." }, { status: 400 });
  }

  const resolvedTopK =
    typeof topK === "number" && topK >= 1 && topK <= 20 ? Math.floor(topK) : 10;

  // Validate optional chatHistory shape
  const resolvedHistory: Array<{ role: "user" | "model"; content: string }> = [];
  if (Array.isArray(chatHistory)) {
    for (const turn of chatHistory) {
      if (
        turn &&
        typeof turn === "object" &&
        (turn.role === "user" || turn.role === "model") &&
        typeof turn.content === "string"
      ) {
        resolvedHistory.push({ role: turn.role, content: turn.content });
      }
    }
  }

  // ── Load rehydration chunks (mirrors what chat/page.tsx does) ─────────────
  let rehydrateChunks: Array<{ documentId: string; filename: string; content: string }> = [];
  try {
    const chunksSnap = await adminDb
      .collection("chunks")
      .where("tenantId", "==", auth.tenantId)
      .get();
    for (const doc of chunksSnap.docs) {
      const data = doc.data();
      for (const content of (data.chunks as string[]) ?? []) {
        rehydrateChunks.push({
          documentId: data.documentId as string,
          filename: data.filename as string,
          content,
        });
      }
    }
  } catch {
    // Non-fatal — the flow has its own Firestore fallback
    rehydrateChunks = [];
  }

  // ── Run the AI flow ───────────────────────────────────────────────────────
  try {
    const result = await getAIPoweredAnswersFromDocuments({
      tenantId: auth.tenantId,
      query: query.trim(),
      chatHistory: resolvedHistory,
      topK: resolvedTopK,
      rehydrateChunks,
    });

    // ── Fire query.answered webhook (fire-and-forget) ─────────────────────
    import("@/lib/webhook-actions").then(({ dispatchWebhook }) => {
      dispatchWebhook(auth.tenantId, "query.answered", {
        query: query.trim(),
        answer: result.answer,
        citations: result.citations,
        hasContext: result.hasContext,
      }).catch(() => {});
    }).catch(() => {});

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[API /query] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
