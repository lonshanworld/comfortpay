
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { executeQuery } from '@/lib/db';
import { CreateCheckoutSessionInputSchema } from '@/lib/schemas';

const ApiRequestSchema = CreateCheckoutSessionInputSchema.extend({
  apiToken: z.string().describe("The merchant's secret API token."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ApiRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { apiToken, ...checkoutInput } = validation.data;

    // Authenticate the merchant using the API token
    const merchantResult: any[] = await executeQuery("SELECT id FROM users WHERE token = ? AND role = 'Merchant'", [apiToken]);
    const merchant = merchantResult[0];

    if (!merchant) {
      return NextResponse.json({ error: 'Authentication failed: Invalid API token.' }, { status: 401 });
    }

    // Ensure the merchantId in the request matches the authenticated merchant
    if (`user_${merchant.id}` !== checkoutInput.merchantId) {
         return NextResponse.json({ error: 'Authentication failed: Merchant ID mismatch.' }, { status: 401 });
    }

    // Call the existing server action to create the session
    const sessionResult = await createCheckoutSession(checkoutInput);

    if (sessionResult.error) {
      return NextResponse.json({ error: sessionResult.error }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        checkoutUrl: sessionResult.checkoutUrl,
        sessionToken: sessionResult.sessionToken
    });

  } catch (error: any) {
    console.error("API Error: /api/checkout/sessions", error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
