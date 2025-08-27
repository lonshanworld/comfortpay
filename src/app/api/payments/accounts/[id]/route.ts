
import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const numericId = params.id.split('_')[1];
  const body = await request.json();

  try {
    const { name, status, dailyLimit, prefix_order_name, websiteUrl, accountEmail } = body;

    const query = `
      UPDATE payment_accounts SET
      name = ?, status = ?, dailyLimit = ?, prefix_order_name = ?, websiteUrl = ?, accountEmail = ?
      WHERE id = ?
    `;
    const queryParams = [
      name, status, Number(dailyLimit), prefix_order_name, websiteUrl, accountEmail, numericId
    ];

    const result = await runQuery(query, queryParams);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Payment account not found' }, { status: 404 });
    }

    return NextResponse.json({ id: params.id, ...body });
  } catch (error) {
    console.error(`Failed to update payment account ${params.id}:`, error);
    return NextResponse.json({ message: 'Error updating payment account' }, { status: 500 });
  }
}
