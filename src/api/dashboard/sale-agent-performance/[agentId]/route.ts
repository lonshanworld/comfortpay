
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { User, Order, Fee } from '@/lib/types';

// A helper function to calculate commission for a single transaction
const calculateCommission = (transaction: Order, merchant: User) => {
    const commissionRates = typeof merchant.commissionRates === 'string' 
        ? JSON.parse(merchant.commissionRates) 
        : merchant.commissionRates;
        
    const processor = transaction.paymentType.toLowerCase() as keyof typeof commissionRates;
    const commission: Fee | undefined = commissionRates?.[processor];
    
    if (!commission || !commission.value) {
        return 0;
    }
    
    if (commission.type === 'percentage') {
        return transaction.totalAmount * (commission.value / 100);
    }
    if (commission.type === 'flat') {
        return commission.value;
    }

    return 0;
};

export async function GET(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  const agentId = params.agentId.split('_')[1];

  if (!agentId) {
    return NextResponse.json({ message: 'Agent ID is required' }, { status: 400 });
  }

  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Get all merchants assigned to this agent from the users table
    const merchants: User[] = await executeQuery("SELECT * FROM users WHERE salesAgentId = ? AND role = 'Merchant'", [agentId]);
    if (merchants.length === 0) {
        return NextResponse.json({
            commissionStatement: [],
            historicalVolume: [],
        });
    }

    const merchantIds = merchants.map(m => m.id);
    if (merchantIds.length === 0) {
        return NextResponse.json({
            commissionStatement: [],
            historicalVolume: [],
        });
    }

    const placeholders = merchantIds.map(() => '?').join(',');

    // 1. Commission Statement Data (current month)
    const monthlyTransactions: Order[] = await executeQuery(
        `SELECT * FROM orders WHERE merchantId IN (${placeholders}) AND status = 'Completed' AND date(orderDate) BETWEEN ? AND ?`,
        [...merchantIds, firstDayOfMonth, lastDayOfMonth]
    );
    
    const commissionStatement = merchants.map(merchant => {
        const merchantTxs = monthlyTransactions.filter(tx => tx.merchantId === merchant.id);
        const volume = merchantTxs.reduce((acc, tx) => acc + tx.totalAmount, 0);
        const commission = merchantTxs.reduce((acc, tx) => acc + calculateCommission(tx, merchant), 0);
        
        const commissionRates = typeof merchant.commissionRates === 'string' 
            ? JSON.parse(merchant.commissionRates) 
            : merchant.commissionRates;
        const stripeRate: Fee | undefined = commissionRates?.stripe;
        
        return {
            merchant: merchant.name,
            volume: volume,
            rate: stripeRate ? `${stripeRate.value}${stripeRate.type === 'percentage' ? '%' : '$'}` : 'N/A', 
            commission: commission
        };
    });
    
    // 2. Historical Volume Data (last 6 months)
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0];

    const historicalTransactions: any[] = await executeQuery(`
        SELECT
            strftime('%Y-%m', orderDate) as month,
            SUM(totalAmount) as volume
        FROM orders
        WHERE merchantId IN (${placeholders}) AND status = 'Completed' AND date(orderDate) >= ?
        GROUP BY month
        ORDER BY month ASC
    `, [...merchantIds, sixMonthsAgo]);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const historicalVolume = historicalTransactions.map(item => ({
        month: monthNames[new Date(item.month + '-02').getMonth()],
        revenue: item.volume
    }));


    return NextResponse.json({ commissionStatement, historicalVolume });

  } catch (error) {
    console.error("Failed to fetch sales agent performance data:", error);
    return NextResponse.json({ message: "Failed to fetch performance data" }, { status: 500 });
  }
}
