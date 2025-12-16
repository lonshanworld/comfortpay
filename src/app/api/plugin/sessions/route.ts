// src/app/api/plugin/sessions/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { findUserByApiToken } from '@/lib/auth-server';
import { CreateCheckoutSessionInputSchema } from '@/lib/schemas';
import { extractRequestHost, merchantHostFromUrl, domainMatches } from '@/lib/verify-origin';

// The API request schema makes merchantId optional, as it will be derived from the token.
const ApiRequestSchema = CreateCheckoutSessionInputSchema.omit({ merchantId: true }).extend({
  apiToken: z.string().describe("The merchant's secret API token."),
});

export async function POST(request: Request) {
  console.log('[Plugin API] POST /api/plugin/sessions');
  
  try {
    const body = await request.json();
    console.log('[Plugin API] Request body:', body);
    
    const validation = ApiRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: validation.error.flatten() 
      }, { status: 400 });
    }

    // Prefer Authorization header
    const authHeader = request.headers.get('authorization');
    let apiTokenFromHeader: string | undefined = undefined;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      apiTokenFromHeader = authHeader.slice(7).trim();
    }

    const { apiToken: apiTokenFromBody, ...checkoutInputWithoutId } = validation.data;
    const apiToken = apiTokenFromHeader || apiTokenFromBody;

    // Authenticate merchant via helper that supports hashed token migration
    const merchant = await findUserByApiToken(apiToken);
    if (!merchant || merchant.role !== 'Merchant') {
      return NextResponse.json({ error: 'Authentication failed: Invalid API token.' }, { status: 401 });
    }

    // Verify domain matches merchant's websiteUrl. For server-side plugin calls
    // authenticated via Authorization Bearer, require `X-Merchant-Site` header
    // and validate it against the merchant's registered URL.
    const reqHost = extractRequestHost(request);
    const mHost = merchantHostFromUrl(merchant.websiteUrl);

    const usedBearerToken = !!apiTokenFromHeader;
    if (usedBearerToken) {
      const xMerchantSite = request.headers.get('x-merchant-site') || request.headers.get('x-merchant-url');
      if (!xMerchantSite) {
        console.warn('[Plugin API] Missing X-Merchant-Site header on bearer request', { merchantId: merchant.id });
        return NextResponse.json({ error: 'Missing X-Merchant-Site header' }, { status: 400 });
      }
      const reportedHost = merchantHostFromUrl(xMerchantSite);
      if (!reportedHost || reportedHost !== mHost) {
        console.warn('[Plugin API] Merchant site header mismatch', { merchantId: merchant.id, reportedHost, merchantHost: mHost });
        return NextResponse.json({ error: 'Merchant site mismatch' }, { status: 403 });
      }
      console.info('[Plugin API] Bearer token + X-Merchant-Site validated', { merchantId: merchant.id, reportedHost });
    } else {
      const match = domainMatches(reqHost, mHost);
      if (!match.ok) {
        console.warn('[Plugin API] Domain mismatch', {
          merchantId: merchant.id,
          requestHost: reqHost,
          merchantHost: mHost,
          reason: match.reason
        });
        return NextResponse.json({ error: 'Origin domain mismatch' }, { status: 403 });
      }
    }

    // Add the authenticated merchant's ID to the checkout input
    const completeCheckoutInput = {
      ...checkoutInputWithoutId,
      merchantId: `user_${merchant.id}`,
    };

    // Call the existing server action to create the session
    const sessionResult = await createCheckoutSession(completeCheckoutInput);
    console.log('[Plugin API] Checkout session result:', sessionResult);
    
    if (sessionResult.error) {
      return NextResponse.json({ error: sessionResult.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: sessionResult.checkoutUrl,
      sessionToken: sessionResult.sessionToken
    });

  } catch (error: any) {
    console.error('[Plugin API] Error: /api/plugin/sessions', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
