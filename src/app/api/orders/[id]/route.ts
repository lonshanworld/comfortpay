
import { NextResponse } from 'next/server';
import { initialOrders } from '@/lib/in-memory-db';
import { executeQuery, runQuery } from '@/lib/db';

let orders = initialOrders;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const numericId = params.id.replace('CP', '');
  try {
    const results = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
     if (results.length === 0) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    const order = results[0];
    order.id = `CP${order.id}`;
    return NextResponse.json(order);
  } catch (error) {
    // Fallback
    const order = orders.find(o => o.id === params.id);
    if (order) {
      return NextResponse.json(order);
    }
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
      const { 
          merchantOrderId, customerName, customerEmail, status, orderAmount, 
          totalAmount, paidAmount, paymentMethod, paymentType, 
          orderDate, paymentReceivedDate 
      } = body;
      
      const query = `
          UPDATE orders SET
          merchantOrderId = ?, customerName = ?, customerEmail = ?, status = ?, 
          orderAmount = ?, totalAmount = ?, paidAmount = ?, paymentMethod = ?, 
          paymentType = ?, orderDate = ?, paymentReceivedDate = ?
          WHERE id = ?
      `;
      const queryParams = [
          merchantOrderId, customerName, customerEmail, status, orderAmount,
          totalAmount, paidAmount, paymentMethod, paymentType,
          orderDate, paymentReceivedDate, numericId
      ];

      const result = await runQuery(query, queryParams);

      if (result.changes === 0) {
          return NextResponse.json({ message: 'Order not found' }, { status: 404 });
      }

      return NextResponse.json({ id: params.id, ...body });
  } catch (error) {
      // Fallback
      const index = orders.findIndex(o => o.id === params.id);
      if (index !== -1) {
        orders[index] = { ...orders[index], ...body };
        return NextResponse.json(orders[index]);
      }
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  }
}
