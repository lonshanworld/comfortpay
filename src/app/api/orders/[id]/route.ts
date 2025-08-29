
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { formatDateForMySQL } from '@/lib/utils';
import type { Order } from '@/lib/types';

export async function GET(
  request: Request,
  context: { params: Promise<{ id:string }> }
) {
  const { id } = await context.params;
  const numericId = id.replace('CP', '');
  try {
    const results: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
    if (results.length === 0) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    const order = results[0];
    order.id = `CP${order.id}`;
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const numericId = id.replace('CP', '');
  const body = await request.json();

  try {
    const validColumns = [
      'merchantId', 'merchantOrderId', 'visualOrderId', 'orderDate', 'paymentReceivedDate',
      'customerName', 'customerEmail', 'status', 'paymentMethod', 'orderAmount', 'totalAmount',
      'paidAmount', 'currency', 'paymentType', 'paymentGatewayTransactionId', 'billingDetails'
    ];

    const fieldsToUpdate: string[] = [];
    const queryParams: any[] = [];

    for (const key of validColumns) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        let value = body[key];
        
        // Fix: Strip the 'user_' prefix from merchantId if it exists
        if (key === 'merchantId' && typeof value === 'string' && value.startsWith('user_')) {
          value = value.split('_')[1];
        }
        
        if (key === 'orderDate' || key === 'paymentReceivedDate') {
          value = value ? formatDateForMySQL(new Date(value)) : null;
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        } else if (value === undefined || value === '') {
           value = null;
        }
        
        fieldsToUpdate.push(`${key} = ?`);
        queryParams.push(value);
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ message: "No valid fields to update." }, { status: 400 });
    }

    const query = `
      UPDATE orders SET
      ${fieldsToUpdate.join(', ')}
      WHERE id = ?
    `;
    queryParams.push(numericId);
    
    await runQuery(query, queryParams);

    // Fetch the fully updated order to return
    const finalOrderResult: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
    
    if (finalOrderResult.length === 0) {
      return NextResponse.json({ message: 'Failed to retrieve updated order' }, { status: 500 });
    }
    
    const finalOrder = finalOrderResult[0];
    finalOrder.id = `CP${finalOrder.id}`;
    return NextResponse.json(finalOrder);
    
  } catch (error: any) {
    console.error(`Failed to update order ${id}:`, error);
    return NextResponse.json({ message: `Error updating order: ${error.message}` }, { status: 500 });
  }
}
