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
    pageSection: z.string().optional().describe('Section metadata.'),
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

async function retrieveRelevantChunks(
  query: string,
  tenantId: string
): Promise<z.infer<typeof DocumentChunkSchema>[]> {
  const tenantData = mockVectorDb[tenantId] || [];
  
  // Simple keyword matching for prototype retrieval
  const words = query.toLowerCase().split(/\s+/);
  const results = tenantData.filter(item => {
    const text = item.content.toLowerCase();
    return words.some(word => word.length > 3 && text.includes(word));
  });

  // If no keyword matches, return a few recent chunks to allow general questions
  const finalResults = results.length > 0 ? results : tenantData.slice(0, 3);

  return finalResults.map(item => ({
    content: item.content,
    metadata: {
      documentId: item.documentId,
      filename: item.filename,
    }
  }));
}

const retrieveDocumentChunksTool = ai.defineTool(
  {
    name: 'retrieveDocumentChunks',
    description: 'Retrieves relevant document chunks from the tenant database.',
    inputSchema: z.object({
      query: z.string(),
      tenantId: z.string(),
    }),
    outputSchema: z.array(DocumentChunkSchema),
  },
  async ({ query, tenantId }) => {
    return await retrieveRelevantChunks(query, tenantId);
  }
);

const generateAnswerPrompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  tools: [retrieveDocumentChunksTool],
  input: { schema: GetAIPoweredAnswersFromDocumentsInputSchema },
  output: { schema: GetAIPoweredAnswersFromDocumentsOutputSchema },
  prompt: `You are a professional AI assistant. You must answer using ONLY the provided document chunks.
If the information isn't there, say you don't have enough information in the uploaded documents.

User Query: {{{query}}}

Document Chunks:
{{#if @tool_code.retrieveDocumentChunks.output}}
  {{#each @tool_code.retrieveDocumentChunks.output}}
    [Source: {{{this.metadata.filename}}}]
    {{{this.content}}}
  {{/each}}
{{else}}
  No documents found for this query.
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
    const { output } = await generateAnswerPrompt(input);
    return output!;
  }
);

export async function getAIPoweredAnswersFromDocuments(input: GetAIPoweredAnswersFromDocumentsInput): Promise<GetAIPoweredAnswersFromDocumentsOutput> {
  return getAIPoweredAnswersFromDocumentsFlow(input);
}
