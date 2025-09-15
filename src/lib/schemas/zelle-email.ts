
import { z } from '@genkit-ai/core/schema';
/**
 * @fileOverview Zod schemas and TypeScript types for the Zelle email parser.
 *
 * This file defines the expected input and output structures for the AI flow
 * that parses Zelle payment notification emails.
 */
export const ZelleEmailParseInputSchema = z.object({
  emailContent: z.string().describe('The full, raw text content of the Zelle notification email.'),
});
export type ZelleEmailParseInput = z.infer<typeof ZelleEmailParseInputSchema>;

export const ZelleEmailParseOutputSchema = z.object({
  status: z.enum(["confirmation", "rejected", "alert", "not_success", "failed", "unknown", "cancel"]).describe("The status of the payment. Use 'failed' if PayPal, Venmo, Sofi, or Cash App are mentioned. Use 'confirmation' for a standard successful payment."),
  failed_reason: z.string().optional().describe("The reason for failure. Only provide this if the status is 'failed', 'rejected', 'cancel', 'unknown', 'not_success', or 'alert'."),
  money_amount: z.number().optional().describe("The numeric dollar amount of the transaction."),
  currency: z.string().default("USD").describe("The currency of the transaction, e.g., USD."),
  name: z.string().optional().describe("The full name of the person who sent the payment."),
  payment_email: z.string().email().optional().describe("The email address the payment was sent to. Found in the 'To:' line of the email headers."),
  datetime: z.string().optional().describe("The timestamp of when the payment was sent, in GMT. Found in the 'Date:' line of the email headers."),
  from: z.string().optional().describe("The full 'From:' line from the email headers, including the sender's name and email address."),
});
export type ZelleEmailParseOutput = z.infer<typeof ZelleEmailParseOutputSchema>;

