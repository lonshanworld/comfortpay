/**
 * @fileOverview This file initializes and configures the Genkit AI object.
 *
 * It sets up the necessary plugins (like Google AI for Gemini) and exports
 * a single `ai` object that is used throughout the application to define
 * and run AI flows, prompts, and tools.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      // We recommend using `gemini-1.5-flash-latest` for this,
      // as it is the most performant and cost-effective model.
    }),
  ],
  // Log developer-friendly errors and warnings.
  logLevel: 'debug',
  // Perform OpenTelemetry instrumentation and enable traces.
  enableTracing: true,
});
