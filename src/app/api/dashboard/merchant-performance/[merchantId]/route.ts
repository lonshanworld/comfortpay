
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
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0];

    // Get monthly revenue for the last 6 months
    const historicalTransactions: any[] = await executeQuery(`
        SELECT
            DATE_FORMAT(orderDate, '%Y-%m') as month,
            SUM(totalAmount) as revenue
        FROM orders
        WHERE merchantId = ? AND status = 'Completed' AND date(orderDate) >= ?
        GROUP BY month
        ORDER BY month ASC
    `, [merchantId, sixMonthsAgo]);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const revenueChart = historicalTransactions.map(item => ({
        month: monthNames[new Date(item.month + '-02').getMonth()],
        revenue: item.revenue
    }));
    
    // Get this month's revenue and sales count
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthlyStatsResult: any[] = await executeQuery(
        `SELECT SUM(totalAmount) as revenue, COUNT(*) as sales FROM orders WHERE merchantId = ? AND status = 'Completed' AND date(orderDate) >= ?`,
        [merchantId, firstDayOfMonth]
    );

    const performanceData = {
        monthlyRevenue: monthlyStatsResult[0]?.revenue || 0,
        monthlySales: monthlyStatsResult[0]?.sales || 0,
        revenueChart: revenueChart,
    };

    return NextResponse.json(performanceData);

  } catch (error) {
    console.error("Failed to fetch merchant performance data:", error);
    return NextResponse.json({ message: "Failed to fetch performance data" }, { status: 500 });
  }
}
