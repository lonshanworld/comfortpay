
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import type { Order } from '@/lib/types';


async function getOrderById(numericId: string): Promise<Order | null> {
    const results = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
    if (results.length === 0) return null;

    const order = results[0];
    // Fetch merchant details from the users table now
    const merchantResult = await executeQuery("SELECT name, email, websiteUrl FROM users WHERE id = ?", [order.merchantId]);
    
    return {
        ...order,
        id: `CP${order.id}`,
        merchantId: `user_${order.merchantId}`,
        merchantName: merchantResult[0]?.name || 'N/A',
        merchantEmail: merchantResult[0]?.email,
        merchantWebsiteUrl: merchantResult[0]?.websiteUrl,
        billingDetails: order.billingDetails ? JSON.parse(order.billingDetails) : undefined,
    } as Order;
}


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const numericId = params.id.replace('CP', '');
  try {
    const order = await getOrderById(numericId);
     if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch order", error);
    return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const numericId = params.id.replace('CP', '');
  const body = await request.json();

  try {
      const existingOrderResult = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
      if (existingOrderResult.length === 0) {
          return NextResponse.json({ message: 'Order not found' }, { status: 404 });
      }

      // Build the update query dynamically
      const fieldsToUpdate: string[] = [];
      const queryParams: any[] = [];
      
      Object.entries(body).forEach(([key, value]) => {
          if (key === 'id' || key === 'merchantId' || key === 'merchantName' || key === 'merchantEmail' || key === 'merchantWebsiteUrl' || key === 'sourceWebsiteUrl') return;
          
          // Ensure we don't try to update with undefined
          if (value !== undefined) {
              fieldsToUpdate.push(`${key} = ?`);
              // Handle objects by stringifying them for the DB
              queryParams.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
          }
      });

      if (fieldsToUpdate.length === 0) {
          const currentOrder = await getOrderById(numericId);
          return NextResponse.json(currentOrder); // Nothing to update
      }

      const query = `UPDATE orders SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
      queryParams.push(numericId);

      await runQuery(query, queryParams);
      
      const updatedOrder = await getOrderById(numericId);
      return NextResponse.json(updatedOrder);

  } catch (error) {
      console.error(`Failed to update order ${params.id}:`, error);
      return NextResponse.json({ message: 'Failed to update order' }, { status: 500 });
  }
}
