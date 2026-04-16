'use server';
/**
 * Document ingestion flow — extract → chunk → index, with structured logging.
 */

import { ai, mockVectorDb } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { checkDocumentQuota } from '@/lib/auth-actions';
import { z } from 'genkit';

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractText(documentDataUri: string, fileType: string): Promise<string> {
  // Support both Firebase Storage HTTPS URLs and legacy base64 data URIs
  const isHttpsUrl = documentDataUri.startsWith('https://') || documentDataUri.startsWith('http://');

  // ── Plain text: decode from base64 or fetch from URL ─────────────────────
  if (fileType.startsWith('text/')) {
    if (isHttpsUrl) {
      const res = await fetch(documentDataUri);
      if (!res.ok) throw new Error(`Failed to fetch document: ${res.statusText}`);
      return res.text();
    }
    if (!documentDataUri.includes(',')) throw new Error('Invalid Data URI.');
    return Buffer.from(documentDataUri.split(',')[1], 'base64').toString('utf-8');
  }

  // ── DOCX: extract raw text via mammoth ───────────────────────────────────
  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = (await import('mammoth')).default;
    let buffer: Buffer;
    if (isHttpsUrl) {
      const res = await fetch(documentDataUri);
      if (!res.ok) throw new Error(`Failed to fetch DOCX: ${res.statusText}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      if (!documentDataUri.includes(',')) throw new Error('Invalid Data URI.');
      buffer = Buffer.from(documentDataUri.split(',')[1], 'base64');
    }
    const result = await mammoth.extractRawText({ buffer });
    console.info('[Ingestion] mammoth extracted DOCX, length:', result.value.length);
    return result.value;
  }

  // ── XLSX: convert to CSV via xlsx ────────────────────────────────────────
  if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const XLSX = await import('xlsx');
    let buffer: Buffer;
    if (isHttpsUrl) {
      const res = await fetch(documentDataUri);
      if (!res.ok) throw new Error(`Failed to fetch XLSX: ${res.statusText}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      if (!documentDataUri.includes(',')) throw new Error('Invalid Data URI.');
      buffer = Buffer.from(documentDataUri.split(',')[1], 'base64');
    }
    const wb = XLSX.read(buffer);
    const csv = wb.SheetNames.map((name) =>
      `# Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`
    ).join('\n\n');
    console.info('[Ingestion] xlsx extracted sheets:', wb.SheetNames.length);
    return csv;
  }

  // ── PDF: fast local extraction via pdf-parse, Gemini fallback for scanned PDFs ──
  if (fileType === 'application/pdf') {
    let buffer: Buffer;
    if (isHttpsUrl) {
      const res = await fetch(documentDataUri);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      if (!documentDataUri.includes(',')) throw new Error('Invalid Data URI.');
      buffer = Buffer.from(documentDataUri.split(',')[1], 'base64');
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      if (parsed.text.trim().length >= 100) {
        console.info('[Ingestion] pdf-parse extracted text, length:', parsed.text.length);
        return parsed.text;
      }
      console.info('[Ingestion] pdf-parse returned < 100 chars — falling back to Gemini (likely scanned PDF)');
    } catch (pdfErr: unknown) {
      console.warn('[Ingestion] pdf-parse failed, falling back to Gemini:', (pdfErr as Error).message);
    }
    // Fall through to Gemini vision for scanned/image-only PDFs
  }

  // ── Images (and scanned PDF fallback): Gemini multimodal ─────────────────
  const geminiSupportedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (geminiSupportedTypes.includes(fileType)) {
    console.info('[Ingestion] Using Gemini to extract text from:', fileType);
    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash-lite',
      prompt: [
        { media: { url: documentDataUri, contentType: fileType } },
        {
          text: 'Extract ALL text content from this document verbatim. Output only the raw text. Preserve headings, paragraphs, lists, and all table content. Do not summarize, skip, or paraphrase anything. Output every word as-is.',
        },
      ],
    });
    const extracted = response.text;
    console.info('[Ingestion] Gemini extracted text length:', extracted?.length ?? 0);
    if (!extracted?.trim()) {
      throw new Error('Could not extract any text — document may be scanned without OCR or empty.');
    }
    return extracted;
  }

  throw new Error(`File type "${fileType}" is not supported for text extraction.`);
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 150,
  maxChunks = 250
): string[] {
  if (!text?.trim()) return [];

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < cleaned.length && chunks.length < maxChunks; i += step) {
    const chunk = cleaned.substring(i, i + chunkSize).trim();
    if (chunk.length > 20) chunks.push(chunk);
  }

  console.info('[Ingestion] Chunking complete:', {
    inputLength: cleaned.length,
    chunkSize,
    overlap,
    chunksProduced: chunks.length,
  });

  return chunks;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const UploadAndProcessDocumentInputSchema = z.object({
  tenantId: z.string().min(1),
  documentId: z.string().min(1),
  filename: z.string().min(1),
  fileType: z.string().min(1),
  documentDataUri: z.string().min(1).describe('Document content as a Data URI.'),
  callerRole: z.enum(['Admin', 'User']).optional().default('Admin').describe('Role of the calling user — enforced server-side.'),
});
export type UploadAndProcessDocumentInput = z.infer<typeof UploadAndProcessDocumentInputSchema>;

const UploadAndProcessDocumentOutputSchema = z.object({
  documentId: z.string(),
  status: z.enum(['processed', 'failed']),
  message: z.string(),
  chunkCount: z.number().optional(),
  chunks: z.array(z.string()).optional().describe('Raw text chunks for client-side persistence.'),
});
export type UploadAndProcessDocumentOutput = z.infer<typeof UploadAndProcessDocumentOutputSchema>;

// ─── Flow ─────────────────────────────────────────────────────────────────────

const uploadAndProcessDocumentFlow = ai.defineFlow(
  {
    name: 'uploadAndProcessDocumentForAIAnalysis',
    inputSchema: UploadAndProcessDocumentInputSchema,
    outputSchema: UploadAndProcessDocumentOutputSchema,
  },
  async (input) => {
    const { tenantId, documentId, filename, fileType, documentDataUri } = input;
    const ingestionStart = Date.now();

    console.info('[Ingestion] Starting:', { tenantId, documentId, filename, fileType });

    // ── Server-side permission enforcement ──
    if (input.callerRole !== 'Admin') {
      console.warn('[Ingestion] Unauthorised upload attempt by non-Admin role:', { tenantId, documentId });
      return {
        documentId,
        status: 'failed' as const,
        message: 'Forbidden: only administrators can upload documents.',
      };
    }

    // ── Document quota check ──
    const quotaCheck = await checkDocumentQuota(tenantId);
    if (!quotaCheck.allowed) {
      console.warn('[Ingestion] Document quota exceeded:', { tenantId, reason: quotaCheck.reason });
      return {
        documentId,
        status: 'failed' as const,
        message: quotaCheck.reason ?? 'Document quota exceeded.',
      };
    }

    try {
      const extractedText = await extractText(documentDataUri, fileType);
      const chunks = chunkText(extractedText);

      if (chunks.length === 0) {
        console.warn('[Ingestion] No usable chunks produced for:', filename);
        return {
          documentId,
          status: 'failed' as const,
          message: 'No extractable text found in this document.',
        };
      }

      // Attempt embeddings — graceful degradation to keyword-only on failure
      if (chunks.length > 0) {
        try {
          await ai.embedMany({ embedder: 'googleai/gemini-embedding-001', content: chunks });
          console.info('[Ingestion] Embeddings generated for', chunks.length, 'chunks.');
        } catch (embeddingError: unknown) {
          console.warn(
            '[Ingestion] Embedding failed — falling back to keyword index:',
            (embeddingError as Error).message
          );
        }
      }

      // Persist to tenant-isolated in-memory store
      if (!mockVectorDb[tenantId]) {
        mockVectorDb[tenantId] = [];
      }

      // De-duplicate: remove any existing chunks for this documentId before re-indexing
      mockVectorDb[tenantId] = mockVectorDb[tenantId].filter(
        (entry) => entry.documentId !== documentId
      );

      mockVectorDb[tenantId].push(
        ...chunks.map((content) => ({ documentId, filename, content, tenantId }))
      );

      // Persist chunks to Firestore so they survive server restarts / HMR.
      // Path: chunks/{tenantId}_{documentId}
      try {
        await adminDb.collection('chunks').doc(`${tenantId}_${documentId}`).set({
          tenantId,
          documentId,
          filename,
          chunks,
          updatedAt: Date.now(),
        });
        console.info('[Ingestion] Firestore chunks saved:', { documentId, chunkCount: chunks.length });
      } catch (fsErr: unknown) {
        // Non-fatal — in-memory index still works for the current process
        console.warn('[Ingestion] Firestore chunk save failed:', (fsErr as Error).message);
      }

      const elapsedMs = Date.now() - ingestionStart;
      console.info('[Ingestion] Complete:', {
        tenantId,
        documentId,
        filename,
        chunkCount: chunks.length,
        elapsedMs,
      });

      return {
        documentId,
        status: 'processed' as const,
        message: `Indexed ${chunks.length} chunks in ${elapsedMs}ms.`,
        chunkCount: chunks.length,
        chunks,
      };
    } catch (error: unknown) {
      const msg = (error as Error).message ?? 'Unknown internal error.';
      console.error('[Ingestion] Critical error:', { documentId, filename, error: msg });
      return {
        documentId,
        status: 'failed' as const,
        message: `Processing failed: ${msg}`,
      };
    }
  }
);

export async function uploadAndProcessDocumentForAIAnalysis(
  input: UploadAndProcessDocumentInput
): Promise<UploadAndProcessDocumentOutput> {
  try {
    return await uploadAndProcessDocumentFlow(input);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Ingestion] Unhandled flow error:', msg);
    return {
      documentId: input.documentId,
      status: 'failed' as const,
      message: `Processing error: ${msg}`,
    };
  }
}
