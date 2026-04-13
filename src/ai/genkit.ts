import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

/**
 * Shared in-memory mock database for the prototype.
 * We use a global variable to ensure it persists across HMR in development.
 */
const globalForGenkit = global as unknown as {
  mockVectorDb: Record<string, { 
    documentId: string; 
    filename: string; 
    content: string; 
    tenantId: string;
  }[]>;
};

export const mockVectorDb = globalForGenkit.mockVectorDb || {};

if (process.env.NODE_ENV !== 'production') {
  globalForGenkit.mockVectorDb = mockVectorDb;
}
