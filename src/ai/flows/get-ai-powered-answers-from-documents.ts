'use server';
/**
 * @fileOverview This file implements a Genkit flow for a Retrieval-Augmented Generation (RAG) system.
 */

import { ai, mockVectorDb } from '@/ai/genkit';
import { z } from 'genkit';

const DocumentChunkSchema = z.object({
  content: z.string().describe('The textual content of the document chunk.'),
  metadata: z.object({
    documentId: z.string().describe('The source document ID.'),
    filename: z.string().describe('The source filename.'),
  }).describe('Metadata.'),
});

const GetAIPoweredAnswersFromDocumentsInputSchema = z.object({
  tenantId: z.string().describe('The ID of the tenant.'),
  query: z.string().describe('The user query.'),
  chatHistory: z.array(
    z.object({ role: z.enum(['user', 'model']), content: z.string() })
  ).optional().describe('History.'),
});
export type GetAIPoweredAnswersFromDocumentsInput = z.infer<typeof GetAIPoweredAnswersFromDocumentsInputSchema>;

const GetAIPoweredAnswersFromDocumentsOutputSchema = z.object({
  answer: z.string().describe('AI answer.'),
  citations: z.array(
    z.object({
      documentName: z.string().describe('Document name.'),
      pageSection: z.string().optional().describe('Section.'),
    })
  ).describe('Citations.'),
});
export type GetAIPoweredAnswersFromDocumentsOutput = z.infer<typeof GetAIPoweredAnswersFromDocumentsOutputSchema>;

/**
 * Deterministic retrieval logic used inside the flow.
 */
async function retrieveRelevantChunks(
  query: string,
  tenantId: string
): Promise<z.infer<typeof DocumentChunkSchema>[]> {
  const tenantData = mockVectorDb[tenantId] || [];
  
  // Simple keyword matching for prototype retrieval
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  let results = tenantData.filter(item => {
    const text = item.content.toLowerCase();
    return words.some(word => text.includes(word));
  });

  // If no matches, return generic organizational knowledge if available
  if (results.length === 0) {
    results = tenantData.slice(0, 3);
  }

  return results.map(item => ({
    content: item.content,
    metadata: {
      documentId: item.documentId,
      filename: item.filename,
    }
  }));
}

const generateAnswerPrompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  input: { 
    schema: GetAIPoweredAnswersFromDocumentsInputSchema.extend({
      context: z.array(DocumentChunkSchema)
    })
  },
  output: { schema: GetAIPoweredAnswersFromDocumentsOutputSchema },
  prompt: `You are a professional AI assistant. You must answer using ONLY the provided document chunks in the "context" field.
If the information isn't there, say you don't have enough information in the uploaded documents for this tenant.

User Query: {{{query}}}

Context Documents:
{{#if context}}
  {{#each context}}
    [Source: {{{this.metadata.filename}}}]
    {{{this.content}}}
  {{/each}}
{{else}}
  No relevant documents found for this specific query.
{{/if}}

Chat History:
{{#each chatHistory}}
  {{this.role}}: {{this.content}}
{{/each}}`,
});

const getAIPoweredAnswersFromDocumentsFlow = ai.defineFlow(
  {
    name: 'getAIPoweredAnswersFromDocumentsFlow',
    inputSchema: GetAIPoweredAnswersFromDocumentsInputSchema,
    outputSchema: GetAIPoweredAnswersFromDocumentsOutputSchema,
  },
  async (input) => {
    // Perform retrieval BEFORE prompt call for reliability
    const context = await retrieveRelevantChunks(input.query, input.tenantId);
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const { output } = await generateAnswerPrompt({
          ...input,
          context
        });
        
        if (!output) throw new Error('AI returned an empty response.');
        return output;
      } catch (error: any) {
        attempts++;
        console.warn(`AI generation attempt ${attempts} failed:`, error.message);
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
    throw new Error('Failed to generate AI answer after multiple attempts.');
  }
);

export async function getAIPoweredAnswersFromDocuments(input: GetAIPoweredAnswersFromDocumentsInput): Promise<GetAIPoweredAnswersFromDocumentsOutput> {
  return getAIPoweredAnswersFromDocumentsFlow(input);
}
