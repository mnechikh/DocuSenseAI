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
  
  try {
    if (!documentDataUri || !documentDataUri.includes(',')) {
      throw new Error("Invalid Data URI format received.");
    }

    const base64Content = documentDataUri.split(',')[1];
    if (!base64Content) {
      throw new Error("Empty document content.");
    }

    // Only attempt real decoding for common text formats in the prototype
    if (fileType.includes('text/plain') || fileType.includes('text/csv')) {
      return Buffer.from(base64Content, 'base64').toString('utf-8');
    }
    
    // For binary formats (PDF, DOCX) in a prototype, we simulate extraction
    // In a production app, we would use a service like Cloud Document AI
    return `[SIMULATED EXTRACTION FOR ${fileType}] This document contains structural data and business information relevant to the tenant context. Specifically, it appears to be a ${fileType.split('/')[1] || 'document'} file related to the organization's current operational reporting and policy framework.`;
  } catch (e: any) {
    console.warn("Extraction warning:", e.message);
    return `Fallback content for ${fileType}: This file could not be fully parsed in the prototype environment, but its metadata is indexed.`;
  }
}

/**
 * Mock function to simulate text chunking.
 */
async function chunkText(text: string, chunkSize: number = 500, chunkOverlap: number = 100): Promise<string[]> {
  const chunks: string[] = [];
  if (!text) return [];
  
  // Clean text
  const cleaned = text.replace(/\s+/g, ' ').trim();
  
  for (let i = 0; i < cleaned.length; i += chunkSize - chunkOverlap) {
    const chunk = cleaned.substring(i, i + chunkSize);
    if (chunk.trim().length > 20) {
      chunks.push(chunk);
    }
    // Safety break to prevent infinite loops with very large overlaps or bugs
    if (chunks.length > 500) break; 
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
      console.log(`Starting processing for document: ${filename} (ID: ${documentId})`);
      
      const extractedText = await extractText(documentDataUri, fileType);
      const chunks = await chunkText(extractedText);

      console.log(`Generated ${chunks.length} chunks for indexing.`);

      // Optional: Generate embeddings if supported
      if (chunks.length > 0) {
        try {
          await ai.embedMany({
            model: 'googleai/text-embedding-004',
            content: chunks,
          });
        } catch (embeddingError: any) {
          console.warn("Embedding failed, proceeding with keyword-only index:", embeddingError.message);
        }
      }

      // Persist to server-side mock DB
      if (!mockVectorDb[tenantId]) {
        mockVectorDb[tenantId] = [];
      }
      
      const newEntries = chunks.map((content) => ({
        documentId,
        filename,
        content,
        tenantId
      }));

      mockVectorDb[tenantId].push(...newEntries);

      console.log(`Successfully indexed ${chunks.length} chunks for tenant ${tenantId}`);

      return {
        documentId,
        status: 'processed',
        message: 'Document successfully processed and indexed.',
        chunkCount: chunks.length,
      };
    } catch (error: any) {
      console.error("Critical Flow Error:", error);
      return {
        documentId,
        status: 'failed',
        message: `Processing failed: ${error.message || 'Unknown internal error during processing.'}`,
      };
    }
  }
);
