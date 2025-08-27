
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET() {
  try {
    const [
        revenueResult,
        salesResult,
        merchantsResult,
        recentTransactionsResult,
        chartDataResult
    ] = await Promise.all([
        executeQuery("SELECT SUM(totalAmount) as total FROM orders WHERE status = 'Completed'"),
        executeQuery("SELECT COUNT(*) as total FROM orders WHERE status = 'Completed'"),
        executeQuery("SELECT COUNT(*) as total FROM merchants"),
        executeQuery("SELECT customerName, customerEmail, paymentMethod, status, orderDate, totalAmount FROM orders ORDER BY orderDate DESC LIMIT 5"),
        executeQuery(`
            SELECT
                strftime('%Y-%m', orderDate) as month,
                SUM(totalAmount) as revenue
            FROM orders
            WHERE status = 'Completed'
            GROUP BY month
            ORDER BY month DESC
            LIMIT 6
        `)
    ]);

    const totalRevenueValue = revenueResult[0]?.total || 0;
    const totalSales = salesResult[0]?.total || 0;
    const totalMerchants = merchantsResult[0]?.total || 0;
    
    // Simulate data from the last month for comparison
    const revenueLastMonth = totalRevenueValue * 0.8;
    const merchantsLastMonth = Math.max(1, Math.round(totalMerchants * 0.9));

    const revenueChangePercent = revenueLastMonth > 0 ? ((totalRevenueValue - revenueLastMonth) / revenueLastMonth) * 100 : 0;
    const merchantsChangePercent = merchantsLastMonth > 0 ? ((totalMerchants - merchantsLastMonth) / merchantsLastMonth) * 100 : 0;

    const recentTransactions = recentTransactionsResult.map(order => ({
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        type: order.paymentMethod === 'Credit Card' ? 'Sale' : 'Transfer',
        status: order.status === 'Completed' ? 'Approved' : (order.status === 'Failed' ? 'Declined' : 'Pending'),
        date: new Date(order.orderDate).toISOString().split('T')[0],
        amount: order.totalAmount,
    }));
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const chartData = chartDataResult.reverse().map(item => ({
        month: monthNames[new Date(item.month + '-02').getMonth()], // Adding -02 to avoid timezone issues
        revenue: item.revenue
    }));


    const stats = {
      totalRevenue: {
        value: totalRevenueValue,
        change: `+${revenueChangePercent.toFixed(1)}% from last month`,
      },
      merchants: {
        value: `+${totalMerchants - merchantsLastMonth}`,
        change: `+${merchantsChangePercent.toFixed(1)}% from last month`,
      },
      sales: {
        value: `+${totalSales}`,
        change: "+19% from last month", // mock value
      },
      activeNow: {
          value: '+573',
          change: '+201 since last hour'
      },
      recentTransactions,
      revenueChart: chartData,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch dashboard stats from DB:", error);
    // Ensure a valid structure is returned on error to prevent frontend crashes
    const errorStats = {
      totalRevenue: { value: 0, change: "Error loading data" },
      merchants: { value: "0", change: "Error loading data" },
      sales: { value: "0", change: "Error loading data" },
      activeNow: { value: '0', change: 'Error loading data' },
      recentTransactions: [],
      revenueChart: [],
    };
    return NextResponse.json(errorStats, { status: 500 });
  }
}
