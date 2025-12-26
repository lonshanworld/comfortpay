import { z } from '@genkit-ai/core/schema';
import { ZelleEmailParseOutputSchema } from './zelle-email';

/**
 * Extend the Zelle parse output with a `paymentType` so external parsers
 * can indicate which channel produced the email (zelle | interac | wise).
 */
export const PaymentEmailParseOutputSchema = ZelleEmailParseOutputSchema.extend({
  paymentType: z
    .enum(['zelle', 'interac', 'wise'])
    .default('zelle')
    .describe('Source payment channel for this parsed email.'),
  orderId: z.union([z.string(), z.number()]).optional().describe('Optional platform order id (numeric or prefixed like "CP123").'),
});

export type PaymentEmailParseOutput = z.infer<typeof PaymentEmailParseOutputSchema>;
