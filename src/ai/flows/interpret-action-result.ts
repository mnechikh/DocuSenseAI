'use server';

import { ai } from '@/ai/genkit';

export interface InterpretActionResultInput {
  actionName: string;
  parameters: Record<string, unknown>;
  statusCode: number;
  result: string;
}

/**
 * Calls the AI to produce a concise plain-English interpretation of an
 * integration API result. Does NOT decrement query quota — this is a
 * system-generated request triggered by running an action.
 *
 * Returns null silently on any error so callers never crash.
 */
export async function interpretActionResult(
  input: InterpretActionResultInput
): Promise<string | null> {
  try {
    const paramsText = Object.entries(input.parameters)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `  ${k}: ${String(v)}`)
      .join('\n');

    // Truncate result preview sent to AI — 8k chars is plenty for summarisation
    const resultPreview =
      input.result.length > 8_000
        ? input.result.slice(0, 8_000) + '\n…[truncated]'
        : input.result;

    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash-lite',
      prompt: `You are a data analyst assistant. Summarize the following API response for a non-technical user.

Action: ${input.actionName}
Parameters used:
${paramsText || '  (none)'}
HTTP status: ${input.statusCode}

API Response:
${resultPreview}

Instructions:
- Write 2–4 sentences covering: total count (if applicable), key patterns or categories, and anything notable or worth flagging.
- If the data contains meaningful records, add a compact Markdown table showing the 5 most relevant ones. Choose 3–5 columns that are most informative. Never show raw IDs unless they are the only identifier.
- Use **bold** for numbers and key terms.
- Do NOT repeat the action name or say "The API returned". Start directly with findings.
- Do NOT add preamble like "Here is a summary" or "Certainly!".
- If the response is an error or empty, explain it plainly in one sentence.`,
    });

    const text = response.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}
