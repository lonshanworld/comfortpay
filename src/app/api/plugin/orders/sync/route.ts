// src/app/api/plugin/orders/sync/route.ts
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';
import { findUserByApiToken } from '@/lib/auth-server';
import { extractRequestHost, merchantHostFromUrl, domainMatches } from '@/lib/verify-origin';

const SyncRequestSchema = z.object({
  apiToken: z.string(),
  merchantOrderIds: z.array(z.union([z.string(), z.number()])),
});

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  console.log(`📞 [${timestamp}] [Plugin API /plugin/orders/sync] Received sync request.`);
  
  try {
    const body = await request.json();
    console.log(`📥 [${timestamp}] [Plugin API /plugin/orders/sync] Request body:`, JSON.stringify(body));
    
    const validation = SyncRequestSchema.safeParse(body);

    if (!validation.success) {
      console.error(`❌ [${timestamp}] [Plugin API /plugin/orders/sync] Validation failed:`, validation.error.flatten());
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validation.error.flatten() 
      }, { status: 400 });
    }

    // Support Authorization header as Bearer token for API tokens (preferred)
    const authHeader = request.headers.get('authorization');
    let apiTokenFromHeader: string | undefined = undefined;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      apiTokenFromHeader = authHeader.slice(7).trim();
    }

    const { apiToken: apiTokenFromBody, merchantOrderIds } = validation.data;
    const apiToken = apiTokenFromHeader || apiTokenFromBody;
    
    console.log(`🔍 [${timestamp}] [Plugin API /plugin/orders/sync] Auth token (first 10 chars): ${apiToken.substring(0, 10)}...`);
    console.log(`🔍 [${timestamp}] [Plugin API /plugin/orders/sync] Order IDs to check: ${merchantOrderIds.join(', ')}`);

    // 1. Validate token and get merchant
    const merchant = await findUserByApiToken(apiToken);
    if (!merchant || merchant.role !== 'Merchant') {
      console.error(`❌ [${timestamp}] [Plugin API /plugin/orders/sync] Invalid token or not a merchant`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`✅ [${timestamp}] [Plugin API /plugin/orders/sync] Token authenticated for merchant id ${merchant.id}`);

    // 2. Verify domain matches merchant's websiteUrl. If this request used a
    // Bearer token (server-side plugin), require X-Merchant-Site header and
    // validate it against the merchant record.
    const reqHost = extractRequestHost(request);
    const mHost = merchantHostFromUrl(merchant.websiteUrl);
    const usedBearerToken = !!apiTokenFromHeader;
    if (usedBearerToken) {
      const xMerchantSite = request.headers.get('x-merchant-site') || request.headers.get('x-merchant-url');
      if (!xMerchantSite) {
        console.warn(`⚠️ [${timestamp}] [Plugin API /plugin/orders/sync] Missing X-Merchant-Site header`, { merchantId: merchant.id });
        return NextResponse.json({ error: 'Missing X-Merchant-Site header' }, { status: 400 });
      }
      const reportedHost = merchantHostFromUrl(xMerchantSite);
      if (!reportedHost || reportedHost !== mHost) {
        console.warn(`⚠️ [${timestamp}] [Plugin API /plugin/orders/sync] Merchant site header mismatch`, { merchantId: merchant.id, reportedHost, merchantHost: mHost });
        return NextResponse.json({ error: 'Merchant site mismatch' }, { status: 403 });
      }
      console.info(`🔒 [${timestamp}] [Plugin API /plugin/orders/sync] Bearer token + X-Merchant-Site validated`, { merchantId: merchant.id, reportedHost });
    } else {
      const match = domainMatches(reqHost, mHost);
      if (!match.ok) {
        console.warn(`⚠️ [${timestamp}] [Plugin API /plugin/orders/sync] Domain mismatch`, {
          merchantId: merchant.id,
          requestHost: reqHost,
          merchantHost: mHost,
          reason: match.reason
        });
        return NextResponse.json({ error: 'Origin domain mismatch' }, { status: 403 });
      }
    }

    if (merchantOrderIds.length === 0) {
      console.log(`⚠️ [${timestamp}] [Plugin API /plugin/orders/sync] No order IDs provided, returning empty list.`);
      return NextResponse.json({ orders: [] });
    }

    // 3. Query Orders by order ID only
    const idsToCheck = merchantOrderIds.map(id => String(id));
    
    const placeholders = idsToCheck.map(() => '?').join(',');
    const query = `
      SELECT merchantOrderId as merchant_order_id, status, id as transaction_id, paymentMethod as payment_method
      FROM orders
      WHERE merchantOrderId IN (${placeholders})
    `;

    const params = idsToCheck;
    console.log(`📋 [${timestamp}] [Plugin API /plugin/orders/sync] Querying orders with IDs: ${idsToCheck.join(', ')}`);
    
    const orders = await executeQuery(query, params);
    console.log(`📊 [${timestamp}] [Plugin API /plugin/orders/sync] Query returned ${orders.length} order(s):`, JSON.stringify(orders));

    // 4. Return
    const response = { orders };
    console.log(`📤 [${timestamp}] [Plugin API /plugin/orders/sync] Sending response:`, JSON.stringify(response));
    return NextResponse.json(response);

  } catch (error) {
    console.error(`❌ [${timestamp}] [Plugin API /plugin/orders/sync] Error:`, error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: String(error) 
    }, { status: 500 });
  }
}
