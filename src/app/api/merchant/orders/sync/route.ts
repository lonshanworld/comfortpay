
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';

const SyncRequestSchema = z.object({
  apiToken: z.string(),
  merchantOrderIds: z.array(z.union([z.string(), z.number()])),
});

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  console.log(`📞 [${timestamp}] [API /merchant/orders/sync] Received sync request.`);
  try {
    const body = await request.json();
    console.log(`📥 [${timestamp}] [API /merchant/orders/sync] Request body:`, JSON.stringify(body));
    
    const validation = SyncRequestSchema.safeParse(body);

    if (!validation.success) {
      console.error(`❌ [${timestamp}] [API /merchant/orders/sync] Validation failed:`, validation.error.flatten());
      return NextResponse.json({ error: 'Invalid request', details: validation.error.flatten() }, { status: 400 });
    }

    const { apiToken, merchantOrderIds } = validation.data;
    console.log(`🔍 [${timestamp}] [API /merchant/orders/sync] Auth token (first 10 chars): ${apiToken.substring(0, 10)}...`);
    console.log(`🔍 [${timestamp}] [API /merchant/orders/sync] Order IDs to check: ${merchantOrderIds.join(', ')}`);

    // 1. Validate token exists
    const tokenResult: any[] = await executeQuery(
        "SELECT id FROM users WHERE token = ?",
        [apiToken]
    );

    if (tokenResult.length === 0) {
      console.error(`❌ [${timestamp}] [API /merchant/orders/sync] Invalid token: ${apiToken.substring(0, 10)}...`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`✅ [${timestamp}] [API /merchant/orders/sync] Token authenticated`);

    if (merchantOrderIds.length === 0) {
        console.log(`⚠️ [${timestamp}] [API /merchant/orders/sync] No order IDs provided, returning empty list.`);
        return NextResponse.json({ orders: [] });
    }

    // 2. Query Orders by order ID only
    // Convert all IDs to string to match DB schema
    const idsToCheck = merchantOrderIds.map(id => String(id));
    
    const placeholders = idsToCheck.map(() => '?').join(',');
    const query = `
        SELECT merchantOrderId as merchant_order_id, status, id as transaction_id, paymentMethod as payment_method
        FROM orders
        WHERE merchantOrderId IN (${placeholders})
    `;

    const params = idsToCheck;
    console.log(`📋 [${timestamp}] [API /merchant/orders/sync] Querying orders with IDs: ${idsToCheck.join(', ')}`);
    
    const orders = await executeQuery(query, params);
    console.log(`📊 [${timestamp}] [API /merchant/orders/sync] Query returned ${orders.length} order(s):`, JSON.stringify(orders));

    // 3. Return
    const response = { orders };
    console.log(`📤 [${timestamp}] [API /merchant/orders/sync] Sending response:`, JSON.stringify(response));
    return NextResponse.json(response);

  } catch (error) {
    console.error(`❌ [${timestamp}] [API /merchant/orders/sync] Error:`, error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
