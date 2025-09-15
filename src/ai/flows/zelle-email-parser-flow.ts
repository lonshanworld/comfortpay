
'use server';
/**
 * @fileOverview An AI flow for parsing Zelle payment notification emails.
 *
 * - parseZelleEmail - Extracts structured data from raw email text.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
    ZelleEmailParseInputSchema,
    ZelleEmailParseOutputSchema,
    type ZelleEmailParseInput,
    type ZelleEmailParseOutput
} from '@/lib/schemas/zelle-email';
import { googleAI } from '@genkit-ai/googleai';

const prompt = ai.definePrompt({
  name: 'zelleEmailParserPrompt',
  input: { schema: ZelleEmailParseInputSchema },
  output: { schema: ZelleEmailParseOutputSchema },
  model: googleAI.model('gemini-2.0-flash-lite'),
  prompt: `You are an expert financial transaction parser. Your task is to analyze the raw content of a Zelle payment notification email and extract key information into a structured JSON format.

  **Critical Instructions (in order of priority):**
  1.  **Check for Disallowed Services FIRST:**
      - If the email content mentions "PayPal", "Venmo", "Sofi", or "Cash App" in any context, you MUST immediately set the 'status' to 'failed' and the 'failed_reason' to 'Payment from [Service Name] is not accepted', replacing [Service Name] with the name you found. Do not process the email further.
  2.  **Determine Payment Status:**
      - If the email indicates a successful Zelle payment (e.g., "sent you money", "you received"), set the 'status' to 'confirmation'.
  3.  **Data Extraction Strategy:**
      - **Formats Vary:** Zelle notification emails look different depending on the bank (e.g., Bank of America, Chase, etc.). Your logic must be flexible enough to handle various HTML and text structures.
      - **From Field ('from'):** Find the 'From:' line in the email headers and extract its entire value.
      - **Date ('datetime'):** Find the 'Date:' line in the email headers and extract its entire value. It must be converted to a standard GMT/UTC timestamp string (e.g., ISO 8601 format).
      - **Recipient Email ('payment_email'):** This is a critical field. Find it by looking for the "To:" line in the email headers. It will usually be near the top with the subject line.
      - **Sender Name ('name'):** The sender's full name is often in the subject line (e.g., "Subject: John Doe sent you...") or in a main heading in the body.
      - **Amount ('money_amount'):** Extract the numeric dollar amount. It will be preceded by a '$' sign.
  4.  **Ignore Distractions:** The email body will contain marketing text, footers, and legal disclaimers. Ignore all of this and focus only on the core transaction details.

  Here is the raw email content you need to parse:
  
  {{{emailContent}}}
  `,
});

const zelleEmailParserFlow = ai.defineFlow(
  {
    name: 'zelleEmailParserFlow',
    inputSchema: ZelleEmailParseInputSchema,
    outputSchema: ZelleEmailParseOutputSchema,
  },
  async (input) => {
    console.log("🧠 [Genkit Flow] Starting zelleEmailParserFlow with input:", { emailLength: input.emailContent.length });
    const { output } = await prompt(input);
    if (!output) {
      console.error("❌ [Genkit Flow] The AI model did not return a valid output.");
      throw new Error("The AI model did not return a valid output.");
    }
    console.log("✅ [Genkit Flow] AI model returned output:", output);
    return output;
  }
);

// Export a wrapper function to be called by the API route
export async function parseZelleEmail(input: ZelleEmailParseInput): Promise<ZelleEmailParseOutput> {
  return await zelleEmailParserFlow(input);
}
