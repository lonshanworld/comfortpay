
import { NextResponse, NextRequest } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Order, PaymentAccount } from '@/lib/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const numericId = id.replace('CP', '');

  if (!numericId) {
    return NextResponse.json({ message: 'Valid Order ID is required' }, { status: 400 });
  }

  try {
    const orderQuery = `
      SELECT 
        o.visualOrderId, 
        o.paymentAccountId,
        pa.accountEmail 
      FROM orders o
      LEFT JOIN payment_accounts pa ON o.paymentAccountId = pa.id
      WHERE o.id = ?
    `;
    const orders: any[] = await executeQuery(orderQuery, [numericId]);

    if (orders.length === 0) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    
    const orderDetails = orders[0];
    
    if (!orderDetails.accountEmail || !orderDetails.visualOrderId) {
        return NextResponse.json({ message: 'Payment details not available for this order.' }, { status: 404 });
    }

    return NextResponse.json({
        accountEmail: orderDetails.accountEmail,
        visualOrderId: orderDetails.visualOrderId
    });

  } catch (error) {
    console.error(`Failed to fetch payment details for order ${id}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
