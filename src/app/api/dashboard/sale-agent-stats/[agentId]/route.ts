

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
  context: { params: Promise<{ agentId: string }> }
) {
  const { agentId: agentIdWithPrefix } = await context.params;
  const agentId = agentIdWithPrefix.split('_')[1];

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
            totalCommission: { value: 0, change: "+0% from last month" },
            merchantsOnboarded: { value: 0, change: "+0 from last month" },
            totalActiveMerchants: { value: 0, change: "0 inactive" },
            monthlyVolume: { value: 0, change: "+0% from last month" },
        });
    }

    const merchantIds = merchants.map(m => m.id);
    if (merchantIds.length === 0) {
       return NextResponse.json({
            totalCommission: { value: 0, change: "+0% from last month" },
            merchantsOnboarded: { value: 0, change: "+0 from last month" },
            totalActiveMerchants: { value: 0, change: "0 inactive" },
            monthlyVolume: { value: 0, change: "+0% from last month" },
        });
    }

    const placeholders = merchantIds.map(() => '?').join(',');

    // Get all transactions for these merchants this month
    const transactions: Order[] = await executeQuery(
        `SELECT * FROM orders WHERE merchantId IN (${placeholders}) AND status = 'Completed' AND date(orderDate) BETWEEN ? AND ?`,
        [...merchantIds, firstDayOfMonth, lastDayOfMonth]
    );

    // Calculate stats
    let totalCommission = 0;
    let monthlyVolume = 0;

    transactions.forEach(tx => {
        // tx.merchantId is a number from the DB
        const merchant = merchants.find(m => m.id === tx.merchantId);
        if (merchant) {
            totalCommission += calculateCommission(tx, merchant);
            monthlyVolume += tx.totalAmount;
        }
    });

    const totalMerchants = merchants.length;
    const activeMerchants = merchants.filter(m => m.status === 'Active').length;
    const inactiveMerchants = totalMerchants - activeMerchants;

    const stats = {
        totalCommission: {
            value: totalCommission,
            change: "+15.2% from last month", // Mock change
        },
        merchantsOnboarded: {
            value: totalMerchants,
            change: "+2 from last month", // Mock change
        },
        totalActiveMerchants: {
            value: activeMerchants,
            change: `${inactiveMerchants} inactive`,
        },
        monthlyVolume: {
            value: monthlyVolume,
            change: "+5% from last month", // Mock change
        },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch sales agent stats:", error);
    const errorStats = {
      totalCommission: { value: 0, change: "Error" },
      merchantsOnboarded: { value: 0, change: "Error" },
      totalActiveMerchants: { value: 0, change: "Error" },
      monthlyVolume: { value: 0, change: "Error" },
    };
    return NextResponse.json(errorStats, { status: 500 });
  }
}
