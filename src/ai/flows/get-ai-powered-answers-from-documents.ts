'use server';
/**
 * RAG answer flow — strict grounding, scored retrieval, structured logging.
 */

import { ai, mockVectorDb } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { checkAndIncrementQueryQuota } from '@/lib/auth-actions';
import type { IntegrationRecord } from '@/lib/integration-actions';
import { z } from 'genkit';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const DocumentChunkSchema = z.object({
  content: z.string(),
  metadata: z.object({
    documentId: z.string(),
    filename: z.string(),
  }),
});

const ChatTurnSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const GetAIPoweredAnswersFromDocumentsInputSchema = z.object({
  tenantId: z.string().min(1).describe('Tenant ID — enforces data isolation.'),
  query: z.string().min(1).max(2000).describe('User query.'),
  chatHistory: z.array(ChatTurnSchema).optional().describe('Prior conversation turns.'),
  topK: z.number().int().min(1).max(20).optional().default(5).describe('Max chunks to retrieve.'),
  /** Client-persisted chunks for re-hydrating the server after a restart. */
  rehydrateChunks: z.array(z.object({
    documentId: z.string(),
    filename: z.string(),
    content: z.string(),
  })).optional(),
});
type GetAIPoweredAnswersFromDocumentsInput = z.infer<
  typeof GetAIPoweredAnswersFromDocumentsInputSchema
>;

const ProposedActionSchema = z.object({
  integrationId: z.string(),
  integrationName: z.string(),
  reason: z.string().describe('One-sentence explanation of why you are proposing this action.'),
  parameters: z.record(z.unknown()).describe('Parameter values to pass, keyed by parameter name.'),
});

const GetAIPoweredAnswersFromDocumentsOutputSchema = z.object({
  answer: z.string().describe('Grounded AI answer.'),
  citations: z.array(
    z.object({
      documentName: z.string(),
      pageSection: z.string().optional(),
    })
  ).describe('Source citations used to produce the answer.'),
  hasContext: z.boolean().describe('Whether relevant chunks were found.'),
  proposedAction: ProposedActionSchema.optional().describe(
    'Propose AT MOST ONE integration action when the user query clearly implies they want to DO something external. ' +
    'Only propose when confident. Leave undefined when purely answering a question.'
  ),
});
type GetAIPoweredAnswersFromDocumentsOutput = z.infer<
  typeof GetAIPoweredAnswersFromDocumentsOutputSchema
>;

// ─── Stop words ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was',
  'has', 'had', 'have', 'been', 'but', 'not', 'its', 'you', 'your',
  'can', 'will', 'what', 'how', 'who', 'why', 'when', 'where', 'which',
  'all', 'any', 'our', 'per', 'via', 'may', 'let', 'get', 'set', 'put',
  'use', 'see', 'ask', 'say', 'tell', 'give', 'look', 'take', 'make',
  'also', 'were', 'they', 'them', 'their', 'than', 'then', 'into',
  'more', 'over', 'here', 'there', 'each', 'such', 'both', 'some',
  'about', 'above', 'after', 'before', 'should', 'would', 'could',
  'does', 'did', 'just', 'only', 'very', 'even', 'still', 'most',
  'other', 'those', 'want', 'know', 'please', 'his', 'her', 'one',
  'show', 'find', 'need', 'must', 'like', 'high', 'higher', 'lower',
]);

/**
 * Ask Gemini to produce 10–15 keywords that are likely to appear VERBATIM
 * in documents that answer the query — synonyms, jargon, abbreviations, etc.
 * Runs in parallel with the Firestore fallback, adding ~0 wall-clock latency.
 */
async function expandQueryTerms(query: string): Promise<string[]> {
  try {
    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash-lite',
      prompt: `You are a search keyword expander for a document retrieval system.
Given the user query below, output ONLY a JSON array of 10–15 short keywords and phrases (1–3 words each) that are likely to appear VERBATIM in a document that answers this query.
Include: synonyms, domain-specific jargon, abbreviations, related numeric patterns (e.g. "$", "%", "AUD", "USD"), and alternative phrasings for the same concept.

Query: "${query.replace(/"/g, "'")}"

Output ONLY the JSON array. No explanation. Example: ["contract value", "total cost", "fee schedule", "rate", "amount", "$"]`,
    });
    const text = response.text?.trim() ?? '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.toLowerCase().trim())
      .filter((t) => t.length >= 2);
  } catch {
    return [];
  }
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Score-ranked retrieval with strict tenant isolation.
 * Stop-words are filtered, stemming applied, and AI-expanded synonyms
 * are included so domain terms like "Schedule of Rates" match "pricing".
 */
function retrieveRelevantChunks(
  query: string,
  tenantId: string,
  topK = 10,
  extraTerms: string[] = []
): z.infer<typeof DocumentChunkSchema>[] {
  const tenantData = mockVectorDb[tenantId];

  if (!tenantData || tenantData.length === 0) {
    console.info('[RAG] No indexed data for tenant:', tenantId);
    return [];
  }

  // Extract meaningful query terms: strip punctuation, remove stop-words
  const rawTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // Stemmed variants for broader matching (pricing→pric, contracts→contract, etc.)
  const stemmed = rawTerms.flatMap((t) => {
    const v = [t];
    if (t.endsWith('ing') && t.length > 5) v.push(t.slice(0, -3));
    if (t.endsWith('tion') && t.length > 6) v.push(t.slice(0, -4));
    if (t.endsWith('ment') && t.length > 6) v.push(t.slice(0, -4));
    if (t.endsWith('ed') && t.length > 4) v.push(t.slice(0, -2));
    if (t.endsWith('ly') && t.length > 4) v.push(t.slice(0, -2));
    if (t.endsWith('ies') && t.length > 4) v.push(t.slice(0, -3) + 'y');
    if (t.endsWith('ness') && t.length > 6) v.push(t.slice(0, -4));
    return v;
  });

  // All scoring terms: stemmed query terms + AI-expanded synonyms, deduplicated
  const allTerms = [...new Set([...stemmed, ...extraTerms])];

  if (allTerms.length === 0) {
    // Nothing actionable — return most recent chunks
    return tenantData.slice(0, topK).map((item) => ({
      content: item.content,
      metadata: { documentId: item.documentId, filename: item.filename },
    }));
  }

  // Score each chunk: all terms (base weight) + raw query terms get 2× bonus for exact signal
  const scored = tenantData.map((item) => {
    const text = item.content.toLowerCase();
    const base = allTerms.reduce((acc, term) => acc + (text.split(term).length - 1), 0);
    const bonus = rawTerms.reduce((acc, term) => acc + (text.split(term).length - 1), 0);
    return { item, score: base + bonus };
  });

  // Guarantee at least 1 chunk per document so cross-doc queries always work.
  // Strategy: take the top-scoring chunk from each unique document first,
  // then fill remaining slots with the globally highest-scored chunks.
  const uniqueDocIds = [...new Set(tenantData.map((c) => c.documentId))];
  const perDocBest = uniqueDocIds.map((docId) => {
    const docChunks = scored.filter((s) => s.item.documentId === docId);
    return docChunks.sort((a, b) => b.score - a.score)[0];
  });

  // Pool = per-doc best + remaining sorted by score, deduplicated
  const usedIndices = new Set(perDocBest.map((s) => tenantData.indexOf(s.item)));
  const remaining = scored
    .map((s, i) => ({ ...s, idx: i }))
    .filter((s) => !usedIndices.has(s.idx))
    .sort((a, b) => b.score - a.score);

  const pool = [...perDocBest, ...remaining.map((s) => ({ item: s.item, score: s.score }))];
  const topChunks = pool.slice(0, topK);

  console.debug('[RAG] Retrieved chunks:', topChunks.map((r) => ({
    filename: r.item.filename,
    score: r.score,
    preview: r.item.content.substring(0, 80),
  })));

  return topChunks.map(({ item }) => ({
    content: item.content,
    metadata: { documentId: item.documentId, filename: item.filename },
  }));
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const generateAnswerPrompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  input: {
    schema: GetAIPoweredAnswersFromDocumentsInputSchema.extend({
      context: z.array(DocumentChunkSchema),
      hasContext: z.boolean(),
      documentNames: z.array(z.string()),
      integrationDescriptions: z.string().optional(),
    }),
  },
  output: { schema: GetAIPoweredAnswersFromDocumentsOutputSchema },
  prompt: `You are a precise, professional AI assistant for an enterprise knowledge platform.

RULES:
1. Answer using the document chunks in <context>. Cite every source you use. Use Markdown: **bold** key terms, bullet lists for multiple items, tables where helpful.
2. Use the <available_documents> list to answer meta-questions (e.g. "what files are uploaded?").
3. If you can only partially answer, give what you can and note what is missing.
4. Only if <context> is completely empty AND <available_documents> is empty, say you have no documents to reference.
5. Never fabricate information not present in the provided context.
6. Be concise and professional.
{{#if integrationDescriptions}}
7. If the user clearly wants to take an action in an external system AND you have all required parameters, immediately populate "proposedAction" — do not ask for confirmation first. If optional parameters are missing, set them to null or omit them. If required parameters are unclear, ask only for those. Propose AT MOST ONE action. Never propose for purely informational queries.
8. When proposedAction is populated, your "answer" field MUST be a short declarative statement of ≤15 words describing what you are about to do (e.g. "Listing bids for tenant default with a limit of 50."). NEVER use: "please confirm", "would you like", "shall I", "do you want to proceed", "I can", "I will" — just state the action directly.
{{/if}}

<available_documents>
{{#each documentNames}}
- {{this}}
{{/each}}
</available_documents>

<context>
{{#if hasContext}}
{{#each context}}
--- Source: {{this.metadata.filename}} ---
{{this.content}}

{{/each}}
{{else}}
[No relevant chunks retrieved for this query.]
{{/if}}
</context>

{{#if integrationDescriptions}}
<available_integrations>
{{{integrationDescriptions}}}
</available_integrations>
{{/if}}

{{#if chatHistory.length}}
<conversation_history>
{{#each chatHistory}}
{{this.role}}: {{this.content}}
{{/each}}
</conversation_history>
{{/if}}

User Query: {{{query}}}`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const getAIPoweredAnswersFromDocumentsFlow = ai.defineFlow(
  {
    name: 'getAIPoweredAnswersFromDocumentsFlow',
    inputSchema: GetAIPoweredAnswersFromDocumentsInputSchema,
    outputSchema: GetAIPoweredAnswersFromDocumentsOutputSchema,
  },
  async (input) => {
    const topK = input.topK ?? 5;

    // ── Load enabled integrations for this tenant (admin SDK, no auth cookie needed)
    let integrationDescriptions: string | undefined;
    try {
      const intSnap = await adminDb
        .collection('integrations')
        .where('tenantId', '==', input.tenantId)
        .where('enabled', '==', true)
        .get();
      if (!intSnap.empty) {
        const lines: string[] = [];
        intSnap.forEach((doc) => {
          const r = doc.data() as IntegrationRecord;
          const params = r.parameters.map((p) => `    - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`).join('\n');
          lines.push(
            `Integration ID: ${r.id}\n` +
            `  Name: ${r.name}\n` +
            `  Description: ${r.description}\n` +
            (params ? `  Parameters:\n${params}` : '  Parameters: none')
          );
        });
        integrationDescriptions = lines.join('\n\n');
      }
    } catch (intErr: unknown) {
      console.warn('[RAG] Failed to load integrations, continuing without:', (intErr as Error).message);
    }

    // ── Query quota gate: atomically check + increment before calling Gemini ──
    const quotaCheck = await checkAndIncrementQueryQuota(input.tenantId);
    if (!quotaCheck.allowed) {
      console.warn('[RAG] Query quota exceeded:', { tenantId: input.tenantId, reason: quotaCheck.reason });
      return {
        answer: quotaCheck.reason ?? 'Monthly query limit reached. Please upgrade your plan.',
        citations: [],
        hasContext: false,
      };
    }

    // ── Step 1: Fast-path rehydration from client-persisted chunks.
    // Merges any documentIds the server doesn't already have.
    if (input.rehydrateChunks && input.rehydrateChunks.length > 0) {
      if (!mockVectorDb[input.tenantId]) {
        mockVectorDb[input.tenantId] = [];
      }
      const existingDocIds = new Set(
        mockVectorDb[input.tenantId].map((c) => c.documentId)
      );
      const newChunks = input.rehydrateChunks.filter(
        (c) => !existingDocIds.has(c.documentId)
      );
      if (newChunks.length > 0) {
        mockVectorDb[input.tenantId].push(
          ...newChunks.map((c) => ({
            documentId: c.documentId,
            filename: c.filename,
            content: c.content,
            tenantId: input.tenantId,
          }))
        );
        console.info('[RAG] Fast-path rehydration from client:', {
          tenantId: input.tenantId,
          addedChunks: newChunks.length,
        });
      }
    }

    // ── Step 2: Firestore fallback + query expansion — run in parallel.
    // Firestore loads chunks if the in-memory index is still empty.
    // expandQueryTerms generates semantic synonyms to improve TF retrieval.
    // Both tasks are independent; parallel execution adds zero extra latency.
    const needsFirestoreLoad = !mockVectorDb[input.tenantId] || mockVectorDb[input.tenantId].length === 0;

    const [extraTerms] = await Promise.all([
      expandQueryTerms(input.query),
      needsFirestoreLoad
        ? (async () => {
            try {
              const snapshot = await adminDb
                .collection('chunks')
                .where('tenantId', '==', input.tenantId)
                .get();
              if (!snapshot.empty) {
                mockVectorDb[input.tenantId] = [];
                snapshot.forEach((doc) => {
                  const data = doc.data();
                  const docChunks: string[] = data.chunks ?? [];
                  mockVectorDb[input.tenantId].push(
                    ...docChunks.map((content: string) => ({
                      documentId: data.documentId as string,
                      filename: data.filename as string,
                      content,
                      tenantId: input.tenantId,
                    }))
                  );
                });
                console.info('[RAG] Loaded from Firestore:', {
                  tenantId: input.tenantId,
                  docs: snapshot.size,
                  totalChunks: mockVectorDb[input.tenantId].length,
                });
              }
            } catch (fsErr: unknown) {
              console.warn('[RAG] Firestore load failed, continuing with empty index:', (fsErr as Error).message);
            }
          })()
        : Promise.resolve(),
    ]);

    console.info('[RAG] Query expanded terms:', { original: input.query, extraTerms });

    const context = retrieveRelevantChunks(input.query, input.tenantId, topK, extraTerms);
    const hasContext = context.length > 0;

    // Collect unique document names known to this tenant (for meta-questions)
    const documentNames = [
      ...new Set(
        (mockVectorDb[input.tenantId] ?? []).map((c) => c.filename)
      ),
    ];

    console.info('[RAG] Query:', { tenantId: input.tenantId, query: input.query, chunksFound: context.length, documentsAvailable: documentNames.length });

    if (!hasContext && documentNames.length === 0) {
      // Truly no data at all — short-circuit with deterministic reply
      return {
        answer:
          "I don't have enough information in your uploaded documents to answer that question. Please upload relevant documents and try again.",
        citations: [],
        hasContext: false,
      };
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const { output } = await generateAnswerPrompt({ ...input, context, hasContext, documentNames, integrationDescriptions });
        if (!output) throw new Error('AI returned an empty response.');

        console.info('[RAG] Answer generated:', {
          tenantId: input.tenantId,
          citationCount: output.citations.length,
          answerLength: output.answer.length,
          proposedAction: output.proposedAction?.integrationName,
        });

        return { ...output, hasContext };
      } catch (error: unknown) {
        attempts++;
        const msg = (error as Error).message;
        console.warn(`[RAG] Generation attempt ${attempts}/${maxAttempts} failed:`, msg);
        if (attempts >= maxAttempts) {
          console.error('[RAG] All attempts exhausted for query:', input.query);
          throw error;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    throw new Error('Failed to generate an answer after multiple attempts.');
  }
);

// ─── Public export ────────────────────────────────────────────────────────────

export async function getAIPoweredAnswersFromDocuments(
  input: GetAIPoweredAnswersFromDocumentsInput
): Promise<GetAIPoweredAnswersFromDocumentsOutput> {
  return getAIPoweredAnswersFromDocumentsFlow(input);
}
