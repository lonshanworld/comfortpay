
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { executeQuery } from '@/lib/db';
import { CreateCheckoutSessionInputSchema } from '@/lib/schemas';

// The API request schema makes merchantId optional, as it will be derived from the token.
const ApiRequestSchema = CreateCheckoutSessionInputSchema.omit({ merchantId: true }).extend({
  apiToken: z.string().describe("The merchant's secret API token."),
});

export async function POST(request: Request) {
  console.log("==========================================", request);
  try {
    const body = await request.json();
    console.log("API Request Body:", body); // Debug log
    const validation = ApiRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { apiToken, ...checkoutInputWithoutId } = validation.data;

    // Authenticate the merchant using only the API token
    const merchantResult: any[] = await executeQuery(
        "SELECT * FROM users WHERE token = ? AND role = 'Merchant'", 
        [apiToken]
    );
    console.log("Merchant Query Result:", merchantResult); // Debug log
    if (merchantResult.length === 0) {
      return NextResponse.json({ error: 'Authentication failed: Invalid API token.' }, { status: 401 });
    }

    const merchant = merchantResult[0];

    // Add the authenticated merchant's ID to the checkout input
    const completeCheckoutInput = {
      ...checkoutInputWithoutId,
      merchantId: `user_${merchant.id}`,
    };

    // Call the existing server action to create the session
    const sessionResult = await createCheckoutSession(completeCheckoutInput);
    console.log("Checkout Session Result:", sessionResult); // Debug log
    if (sessionResult.error) {
      return NextResponse.json({ error: sessionResult.error }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        checkoutUrl: sessionResult.checkoutUrl,
        sessionToken: sessionResult.sessionToken
    });

  } catch (error: any) {
    console.log("API Error: /api/checkout/sessions", error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
