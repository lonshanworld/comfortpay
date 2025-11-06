
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Order } from '@/lib/types';

// Helper to parse database order into the correct Order type
const parseDbOrder = (dbOrder: any): Order => {
    const billingDetails = typeof dbOrder.billingDetails === 'string' 
        ? JSON.parse(dbOrder.billingDetails || '{}') 
        : dbOrder.billingDetails || {};
    return {
        ...dbOrder,
        id: `CP${dbOrder.id}`,
        merchantId: `user_${dbOrder.merchantId}`,
        totalAmount: Number(dbOrder.totalAmount),
        paidAmount: Number(dbOrder.paidAmount),
        billingDetails: billingDetails,
        customerName: billingDetails?.firstName ? `${billingDetails.firstName} ${billingDetails.lastName}`.trim() : dbOrder.customerName,
        customerEmail: billingDetails?.email || dbOrder.customerEmail,
    };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchantIdParam = searchParams.get('merchantId');
  
  if (!merchantIdParam) {
    return NextResponse.json({ message: 'Merchant ID is required' }, { status: 400 });
  }

  const merchantId = merchantIdParam.replace('user_', '');

  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      statsResult,
      recentTransactionsResult,
    ] = await Promise.all([
        executeQuery(`
            SELECT
                (SELECT SUM(totalAmount) FROM orders WHERE merchantId = ? AND status IN ('Completed', 'Over-paid Refunded') AND DATE(paymentReceivedDate) = CURDATE()) as todaysRevenue,
                (SELECT COUNT(*) FROM orders WHERE merchantId = ? AND DATE(orderDate) = CURDATE()) as todaysSales,
                (SELECT COUNT(*) FROM orders WHERE merchantId = ? AND status = 'Requires Confirmation') as pendingConfirmation
        `, [merchantId, merchantId, merchantId]),
      
        executeQuery(`
            SELECT * FROM orders 
            WHERE merchantId = ? AND DATE(orderDate) = CURDATE()
            ORDER BY orderDate DESC 
            LIMIT 5
        `, [merchantId])
    ]);

    const stats = {
      todaysRevenue: statsResult[0]?.todaysRevenue || 0,
      todaysSales: statsResult[0]?.todaysSales || 0,
      pendingConfirmation: statsResult[0]?.pendingConfirmation || 0,
      recentTransactions: recentTransactionsResult.map(parseDbOrder)
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch merchant dashboard stats:", error);
    return NextResponse.json({ message: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
