'use server';
/**
 * @fileOverview A Genkit flow for uploading and processing documents for AI analysis.
 */

import { ai, mockVectorDb } from '@/ai/genkit';
import { z } from 'genkit';

// --- Placeholder Service Functions ---

/**
 * Mock function to simulate text extraction from various document types.
 */
async function extractText(documentDataUri: string, fileType: string): Promise<string> {
  console.log(`Extracting text from ${fileType} document...`);
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate work

  try {
    const base64Content = documentDataUri.split(',')[1];
    if (fileType.includes('text/plain') || fileType.includes('text/csv')) {
      return Buffer.from(base64Content, 'base64').toString('utf-8');
    }
  } catch (e) {
    console.warn("Failed to decode base64, using fallback text.");
  }

  return `This is extracted content from a ${fileType} file. It contains business data relevant to the organization's operations and strategy. Documentation regarding policies, reports, and internal procedures for the specific tenant environment.`;
}

/**
 * Mock function to simulate text chunking.
 */
async function chunkText(text: string, chunkSize: number = 300, chunkOverlap: number = 50): Promise<string[]> {
  const chunks: string[] = [];
  if (!text) return [];
  
  for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
    const chunk = text.substring(i, i + chunkSize);
    if (chunk.trim().length > 10) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

// --- Genkit Flow Definition ---

const UploadAndProcessDocumentInputSchema = z.object({
  tenantId: z.string().describe('The ID of the tenant owning the document.'),
  documentId: z.string().describe('A unique ID for the document within the tenant.'),
  filename: z.string().describe('The original filename of the uploaded document.'),
  fileType: z.string().describe('The MIME type of the uploaded document.'),
  documentDataUri: z
    .string()
    .describe(
      "The document content as a data URI."
    ),
});
export type UploadAndProcessDocumentInput = z.infer<typeof UploadAndProcessDocumentInputSchema>;

const UploadAndProcessDocumentOutputSchema = z.object({
  documentId: z.string().describe('The unique ID of the processed document.'),
  status: z.enum(['processed', 'failed']).describe('The processing status.'),
  message: z.string().describe('Outcome message.'),
  chunkCount: z.number().optional().describe('Number of chunks generated.'),
});
export type UploadAndProcessDocumentOutput = z.infer<typeof UploadAndProcessDocumentOutputSchema>;

export async function uploadAndProcessDocumentForAIAnalysis(
  input: UploadAndProcessDocumentInput
): Promise<UploadAndProcessDocumentOutput> {
  return uploadAndProcessDocumentFlow(input);
}

const uploadAndProcessDocumentFlow = ai.defineFlow(
  {
    name: 'uploadAndProcessDocumentForAIAnalysis',
    inputSchema: UploadAndProcessDocumentInputSchema,
    outputSchema: UploadAndProcessDocumentOutputSchema,
  },
  async (input) => {
    const { tenantId, documentId, filename, fileType, documentDataUri } = input;

    try {
      const extractedText = await extractText(documentDataUri, fileType);
      const chunks = await chunkText(extractedText);

      // Generate embeddings using the correct embedding API
      if (chunks.length > 0) {
        try {
          await ai.embedMany({
            model: 'googleai/text-embedding-004',
            content: chunks,
          });
        } catch (embeddingError) {
          console.warn("Embedding failed, proceeding with text-only index for prototype:", embeddingError);
        }
      }

      // Persist to server-side mock DB for immediate retrieval in chat
      if (!mockVectorDb[tenantId]) mockVectorDb[tenantId] = [];
      
      chunks.forEach((content) => {
        mockVectorDb[tenantId].push({
          documentId,
          filename,
          content,
          tenantId
        });
      });

      return {
        documentId,
        status: 'processed',
        message: 'Document successfully processed and indexed.',
        chunkCount: chunks.length,
      };
    } catch (error: any) {
      console.error("Flow error:", error);
      return {
        documentId,
        status: 'failed',
        message: `Processing failed: ${error.message || 'Unknown error.'}`,
      };
    }
  }
);
