
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      revenueResult,
      salesResult,
      merchantsResult,
      pendingResult,
      recentTransactionsResult,
      chartDataResult
    ] = await Promise.all([
      executeQuery("SELECT SUM(totalAmount) as total FROM orders WHERE status = 'Completed' AND date(orderDate) = ?", [today]),
      executeQuery("SELECT COUNT(*) as total FROM orders WHERE date(orderDate) = ?", [today]),
      executeQuery("SELECT COUNT(*) as total FROM users WHERE status = 'Active' AND role = 'Merchant'"),
      executeQuery("SELECT COUNT(*) as total FROM orders WHERE status = 'Requires Confirmation'"),
      executeQuery("SELECT customerName, customerEmail, paymentMethod, status, orderDate, totalAmount FROM orders ORDER BY orderDate DESC LIMIT 5"),
      executeQuery(`
        SELECT
          DATE_FORMAT(orderDate, '%Y-%m') as month,
          SUM(totalAmount) as revenue
        FROM orders
        WHERE status = 'Completed'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
      `)
    ]);

    const todaysRevenue = revenueResult[0]?.total || 0;
    const todaysSales = salesResult[0]?.total || 0;
    const activeMerchants = merchantsResult[0]?.total || 0;
    const pendingConfirmation = pendingResult[0]?.total || 0;

    // Simulate data from yesterday for comparison
    const revenueYesterday = todaysRevenue * 0.8; // This is a mock value for demo purposes
    const salesYesterday = Math.max(0, todaysSales - 2); // Mock value

    const revenueChangePercent = revenueYesterday > 0
      ? ((todaysRevenue - revenueYesterday) / revenueYesterday) * 100
      : (todaysRevenue > 0 ? 100 : 0);

    const salesChange = todaysSales - salesYesterday;

    const recentTransactions = recentTransactionsResult.map((order: any) => ({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      type: order.paymentMethod === 'Credit Card' ? 'Sale' : 'Transfer',
      status: order.status === 'Completed' ? 'Approved' : (order.status === 'Failed' ? 'Declined' : 'Pending'),
      date: new Date(order.orderDate).toISOString().split('T')[0],
      amount: Number(order.totalAmount),
    }));

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const chartData = chartDataResult.reverse().map((item: any) => ({
      month: monthNames[new Date(item.month + '-02').getMonth()], // Adding -02 to avoid timezone issues
      revenue: item.revenue
    }));

    const stats = {
      totalRevenue: {
        value: todaysRevenue,
        change: `${revenueChangePercent >= 0 ? '+' : ''}${revenueChangePercent.toFixed(1)}% from yesterday`,
      },
      merchants: {
        value: `+${activeMerchants}`,
        change: `total active merchants`,
      },
      sales: {
        value: `+${todaysSales}`,
        change: `${salesChange >= 0 ? '+' : ''}${salesChange} from yesterday`,
      },
      pendingConfirmation: {
        value: `${pendingConfirmation}`,
        change: 'transactions require confirmation'
      },
      recentTransactions,
      revenueChart: chartData,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch dashboard stats from DB:", error);
    const errorStats = {
      totalRevenue: { value: 0, change: "Error loading data" },
      merchants: { value: "0", change: "Error loading data" },
      sales: { value: "0", change: "Error loading data" },
      pendingConfirmation: { value: '0', change: 'Error loading data' },
      recentTransactions: [],
      revenueChart: [],
    };
    return NextResponse.json(errorStats, { status: 500 });
  }
}
