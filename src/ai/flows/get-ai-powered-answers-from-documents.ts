'use server';
/**
 * @fileOverview This file implements a Genkit flow for a Retrieval-Augmented Generation (RAG) system.
 *
 * - getAIPoweredAnswersFromDocuments - A function that takes a natural language query and a tenantId,
 *   retrieves relevant document chunks, and generates an AI-powered answer with citations.
 * - GetAIPoweredAnswersFromDocumentsInput - The input type for the getAIPoweredAnswersFromDocuments function.
 * - GetAIPoweredAnswersFromDocumentsOutput - The return type for the getAIPoweredAnswersFromDocuments function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DocumentChunkSchema = z.object({
  content: z.string().describe('The textual content of the document chunk.'),
  metadata: z.object({
    documentId: z.string().describe('The unique identifier of the source document.'),
    filename: z.string().describe('The name of the source file.'),
    pageSection: z.string().optional().describe('The page number or section where the chunk originated.'),
  }).describe('Metadata about the source document chunk.'),
}).describe('A single chunk of a document along with its metadata.');

const GetAIPoweredAnswersFromDocumentsInputSchema = z.object({
  tenantId: z.string().describe('The ID of the tenant requesting the answer.'),
  query: z.string().describe('The natural language query from the user.'),
  chatHistory: z.array(
    z.object({ role: z.enum(['user', 'model']), content: z.string() })
  ).optional().describe('Previous chat messages to provide conversation context.'),
});
export type GetAIPoweredAnswersFromDocumentsInput = z.infer<typeof GetAIPoweredAnswersFromDocumentsInputSchema>;

const GetAIPoweredAnswersFromDocumentsOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer, strictly grounded in the provided documents.'),
  citations: z.array(
    z.object({
      documentName: z.string().describe('The name of the document cited.'),
      pageSection: z.string().optional().describe('The page number or section cited.'),
    })
  ).describe('List of document citations for the answer.'),
});
export type GetAIPoweredAnswersFromDocumentsOutput = z.infer<typeof GetAIPoweredAnswersFromDocumentsOutputSchema>;

// Mocks a vector database call to retrieve relevant document chunks.
// In a real application, this would interact with a vector database (e.g., Pinecone, Chroma).
async function mockRetrieveRelevantDocumentChunks(
  query: string,
  tenantId: string
): Promise<z.infer<typeof DocumentChunkSchema>[] | undefined> {
  // Simulate document retrieval based on query and tenantId
  // For demonstration, returning a fixed set of chunks.
  // In a real app, you'd perform a vector search here.
  console.log(`Mock retrieving chunks for tenant '${tenantId}' with query: '${query}'`);

  // Simulating different responses for different queries
  if (query.toLowerCase().includes('annual report') && tenantId === 'tenant-123') {
    return [
      {
        content: 'The company reported a 15% increase in revenue for Q4 2023, primarily driven by strong sales in the cloud services division. Operating income reached $2.5 billion. This growth was consistent across all major markets.',
        metadata: { documentId: 'doc-1', filename: 'Annual_Report_2023.pdf', pageSection: '5' },
      },
      {
        content: 'Our strategic investments in AI research and development have started to yield significant returns, with several new product launches planned for the upcoming fiscal year. Customer satisfaction scores improved by 8% year-over-year.',
        metadata: { documentId: 'doc-1', filename: 'Annual_Report_2023.pdf', pageSection: '7' },
      },
      {
        content: 'Employee retention rates remain high at 92%, reflecting our commitment to a positive work environment and competitive compensation packages. Diversity and inclusion initiatives are ongoing.',
        metadata: { documentId: 'doc-1', filename: 'Annual_Report_2023.pdf', pageSection: '12' },
      },
    ];
  } else if (query.toLowerCase().includes('onboarding process') && tenantId === 'tenant-456') {
    return [
      {
        content: 'New employee onboarding typically involves a two-week orientation period, covering company culture, IT setup, and departmental introductions. All new hires are assigned a mentor.',
        metadata: { documentId: 'doc-2', filename: 'HR_Policy_Manual.docx', pageSection: 'Onboarding Section' },
      },
      {
        content: 'Mandatory training modules include data privacy, security awareness, and compliance. These must be completed within the first 30 days of employment. Access to systems is provisioned after completion.',
        metadata: { documentId: 'doc-2', filename: 'HR_Policy_Manual.docx', pageSection: 'Training Requirements' },
      },
    ];
  } else if (query.toLowerCase().includes('return policy')) {
    // Simulate a common document across tenants if tenantId check is removed for simplicity
    return [
      {
        content: 'Customers can return items within 30 days of purchase with a valid receipt for a full refund. Items must be in their original condition. Exceptions apply to perishable goods.',
        metadata: { documentId: 'doc-3', filename: 'Store_Policy.pdf', pageSection: 'Returns' },
      },
      {
        content: 'Exchanges are permitted within 60 days. Defective products can be returned at any time with proof of defect. Online returns require a return authorization number.',
        metadata: { documentId: 'doc-3', filename: 'Store_Policy.pdf', pageSection: 'Exchanges' },
      },
    ];
  }
  // Return empty array if no relevant chunks are found, simulating 'I don't have enough information'
  return [];
}

const retrieveDocumentChunksTool = ai.defineTool(
  {
    name: 'retrieveDocumentChunks',
    description: 'Retrieves relevant document chunks from the indexed knowledge base based on a query and tenant ID.',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant documents.'),
      tenantId: z.string().describe('The ID of the tenant to filter documents.'),
    }),
    outputSchema: z.array(DocumentChunkSchema),
  },
  async ({ query, tenantId }) => {
    const chunks = await mockRetrieveRelevantDocumentChunks(query, tenantId);
    return chunks || [];
  }
);

const generateAnswerPrompt = ai.definePrompt({
  name: 'generateAnswerPrompt',
  tools: [retrieveDocumentChunksTool],
  input: { schema: GetAIPoweredAnswersFromDocumentsInputSchema },
  output: { schema: GetAIPoweredAnswersFromDocumentsOutputSchema },
  prompt: `You are a helpful assistant specialized in providing accurate answers strictly based on the provided document chunks.

Instructions:
1.  Answer the user's query based ONLY on the information contained in the 'Document Chunks' section below.
2.  If the answer is not found in the provided document chunks, state "I don't have enough information from the provided documents to answer that question." Do NOT make up information.
3.  Cite the source for each piece of information you use in your answer. The citation format should be: [Document Name - Page/Section]. If page/section is not available, use just [Document Name].
4.  Format citations as a list of objects in the 'citations' array, with 'documentName' and 'pageSection' fields.
5.  Include previous chat history to maintain conversation context.

Chat History:
{{#each chatHistory}}
  {{this.role}}: {{this.content}}
{{/each}}

User Query: {{{query}}}

Document Chunks:
{{#if @tool_code.retrieveDocumentChunks.output}}
  {{#each @tool_code.retrieveDocumentChunks.output}}
    --- Chunk Start ---
    Document: {{{this.metadata.filename}}}{{#if this.metadata.pageSection}} - Page/Section: {{{this.metadata.pageSection}}}{{/if}}
    Content: {{{this.content}}}
    --- Chunk End ---
  {{/each}}
{{else}}
  No relevant documents found.
{{/if}}

Your response should be a JSON object with 'answer' (string) and 'citations' (array of objects) fields.`,
});

const getAIPoweredAnswersFromDocumentsFlow = ai.defineFlow(
  {
    name: 'getAIPoweredAnswersFromDocumentsFlow',
    inputSchema: GetAIPoweredAnswersFromDocumentsInputSchema,
    outputSchema: GetAIPoweredAnswersFromDocumentsOutputSchema,
  },
  async (input) => {
    // The retrieveDocumentChunksTool is made available to the prompt.
    // The LLM will decide whether to call it based on the prompt's instructions and the user's query.
    // The prompt then uses the tool's output via Handlebars `@tool_code.retrieveDocumentChunks.output`.

    const { output } = await generateAnswerPrompt(input);
    return output!;
  }
);

export async function getAIPoweredAnswersFromDocuments(input: GetAIPoweredAnswersFromDocumentsInput): Promise<GetAIPoweredAnswersFromDocumentsOutput> {
  return getAIPoweredAnswersFromDocumentsFlow(input);
}
