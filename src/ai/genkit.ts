import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash-lite',
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

// Always persist across hot-reloads in dev and across requests in the same
// Node.js process in production (e.g. on App Hosting where the process is
// long-lived). Without this the in-memory store was silently wiped every
// request in production because the conditional below was inverted.
if (!globalForGenkit.mockVectorDb) {
  globalForGenkit.mockVectorDb = {};
}

export const mockVectorDb = globalForGenkit.mockVectorDb;
