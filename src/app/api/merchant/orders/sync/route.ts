
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';

const SyncRequestSchema = z.object({
  apiToken: z.string(),
  merchantOrderIds: z.array(z.union([z.string(), z.number()])),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = SyncRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request', details: validation.error.flatten() }, { status: 400 });
    }

    const { apiToken, merchantOrderIds } = validation.data;

    // 1. Authenticate
    const merchantResult: any[] = await executeQuery(
        "SELECT id FROM users WHERE token = ? AND role = 'Merchant'",
        [apiToken]
    );

    if (merchantResult.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const merchantId = `user_${merchantResult[0].id}`;

    if (merchantOrderIds.length === 0) {
        return NextResponse.json({ orders: [] });
    }

    // 2. Query Orders
    // Convert all IDs to string to match DB schema
    const idsToCheck = merchantOrderIds.map(id => String(id));
    
    const placeholders = idsToCheck.map(() => '?').join(',');
    const query = `
        SELECT merchantOrderId as merchant_order_id, status, id as transaction_id, paymentMethod as payment_method
        FROM orders
        WHERE merchantId = ? AND merchantOrderId IN (${placeholders})
    `;

    const params = [merchantId, ...idsToCheck];
    const orders = await executeQuery(query, params);

    // 3. Return
    return NextResponse.json({ orders });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
