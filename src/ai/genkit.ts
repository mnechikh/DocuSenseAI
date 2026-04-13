import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

/**
 * Shared in-memory mock database for the prototype.
 * This allows the 'upload' flow and 'chat' flow to share data in the same process.
 */
export const mockVectorDb: Record<string, { 
  documentId: string; 
  filename: string; 
  content: string; 
  tenantId: string;
}[]> = {};
