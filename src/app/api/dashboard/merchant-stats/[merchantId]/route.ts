
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId: merchantIdWithPrefix } = await context.params;
  const merchantId = merchantIdWithPrefix.split('_')[1];

  if (!merchantId) {
    return NextResponse.json({ message: 'Merchant ID is required' }, { status: 400 });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      revenueResult,
      salesResult,
      pendingResult
    ] = await Promise.all([
      executeQuery("SELECT SUM(totalAmount) as total FROM orders WHERE merchantId = ? AND status = 'Completed' AND date(orderDate) = ?", [merchantId, today]),
      executeQuery("SELECT COUNT(*) as total FROM orders WHERE merchantId = ? AND date(orderDate) = ?", [merchantId, today]),
      executeQuery("SELECT COUNT(*) as total FROM orders WHERE merchantId = ? AND status = 'Requires Confirmation'", [merchantId])
    ]);

    const stats = {
      todaysRevenue: revenueResult[0]?.total || 0,
      todaysSales: salesResult[0]?.total || 0,
      pendingConfirmation: pendingResult[0]?.total || 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch merchant stats:", error);
    return NextResponse.json({ message: "Failed to fetch merchant stats" }, { status: 500 });
  }
}
