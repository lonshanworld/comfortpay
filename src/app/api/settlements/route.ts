
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Order, Merchant, Fee, PayoutData, GatewayFee } from '@/lib/types';

// Helper to calculate gateway fee for a single transaction
const calculateGatewayFee = (order: Order, merchant: Merchant): number => {
    const DEBUG_ORDER_ID = '540';
    const isDebugOrder = order.merchantOrderId === DEBUG_ORDER_ID;

    if (isDebugOrder) console.log(`[calculateGatewayFee] 1. Starting fee calculation for Order ID: ${order.id}`);
    
    // The incoming `paymentGatewayFees` is now guaranteed to be an object.
    const paymentGatewayFees = merchant.paymentGatewayFees;
    
    if (!paymentGatewayFees) {
        if (isDebugOrder) console.log(`[calculateGatewayFee] 2. No paymentGatewayFees object found for merchant ID: ${merchant.id}. Returning 0.`);
        return 0;
    }
     if (isDebugOrder) console.log(`[calculateGatewayFee] 2. Found paymentGatewayFees for merchant:`, paymentGatewayFees);

    const processorKey = order.paymentType?.toLowerCase() as keyof typeof paymentGatewayFees;
    if (!processorKey) {
        if (isDebugOrder) console.log(`[calculateGatewayFee] 3. Order paymentType is missing or invalid: '${order.paymentType}'. Returning 0.`);
        return 0;
    }
    if (isDebugOrder) console.log(`[calculateGatewayFee] 3. Determined processor key: '${processorKey}'`);
    
    const config = paymentGatewayFees[processorKey];
    if (!config || !config.enabled) {
        if (isDebugOrder) console.log(`[calculateGatewayFee] 4. Gateway '${processorKey}' is not configured or not enabled for this merchant. Returning 0.`);
        return 0;
    }
    if (isDebugOrder) console.log(`[calculateGatewayFee] 4. Found active config for '${processorKey}':`, config);
    
    let totalFee = 0;
    const paidAmount = Number(order.paidAmount); // Ensure it's a number

    if (isNaN(paidAmount)) {
        if (isDebugOrder) console.log(`[calculateGatewayFee] 5. paidAmount is NaN. Returning 0.`);
        return 0;
    }

    // Calculate percentage fee if it exists.
    if (config.transactionFee && typeof config.transactionFee.value === 'number') {
        const percentageFee = paidAmount * (config.transactionFee.value / 100);
        totalFee += percentageFee;
        if (isDebugOrder) console.log(`[calculateGatewayFee] 5a. Calculated percentage fee: ${paidAmount} * (${config.transactionFee.value} / 100) = ${percentageFee.toFixed(4)}`);
    } else {
        if (isDebugOrder) console.log(`[calculateGatewayFee] 5a. No percentage fee (transactionFee) found or value is not a number.`);
    }
    
    // Calculate fixed fee if it exists.
    if (config.transactionFeeFixed && typeof config.transactionFeeFixed.value === 'number') {
        const fixedFee = config.transactionFeeFixed.value;
        totalFee += fixedFee;
        if (isDebugOrder) console.log(`[calculateGatewayFee] 5b. Added fixed fee (transactionFeeFixed): ${fixedFee.toFixed(2)}`);
    } else {
         if (isDebugOrder) console.log(`[calculateGatewayFee] 5b. No fixed fee (transactionFeeFixed) found or value is not a number.`);
    }

    if (isDebugOrder) console.log(`[calculateGatewayFee] 6. Final calculated total fee for Order ID ${order.id}: ${totalFee.toFixed(2)}`);
    return totalFee;
};


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const DEBUG_ORDER_ID = '540';
  console.log("----------------------------------------");
  console.log("🚀 [API /settlements] Received GET request.");

  try {
    // 1. Build a query to get all orders that are completed but not yet in the payouts table.
    let baseQuery = `
      SELECT
        o.id,
        o.paidAmount,
        o.merchantOrderId,
        u.name as merchantName,
        o.paymentReceivedDate,
        o.currency,
        o.paymentType,
        o.merchantId,
        u.paymentGatewayFees,
        u.bankName,
        u.bankAccountNumber,
        u.walletAddress,
        u.network
      FROM orders o
      JOIN users u ON o.merchantId = u.id
      WHERE o.id NOT IN (SELECT orderId FROM payouts)
      AND (o.status = 'Completed' OR o.status = 'Over-paid Refunded')
    `;
    
    const params: (string | number)[] = [];
    const appliedFilters: any = {};

    searchParams.forEach((value, key) => {
        if (!['page', 'pageSize'].includes(key) && value) appliedFilters[key] = value;
    });

    if (Object.keys(appliedFilters).length > 0) {
      console.log(`[API /settlements] Applied Filters:`, appliedFilters);
    }


    const merchantId = searchParams.get('merchantId');
    if (merchantId) {
        baseQuery += " AND o.merchantId = ?";
        params.push(merchantId.replace('user_', ''));
    }
    
    const merchantOrderIdFilter = searchParams.get('merchantOrderId');
    if (merchantOrderIdFilter) {
        baseQuery += " AND o.merchantOrderId = ?";
        params.push(merchantOrderIdFilter);
    }
    
    const netAmount = searchParams.get('netAmount');
    
    const paymentReceivedStart = searchParams.get('paymentReceivedDate_start');
    if (paymentReceivedStart) {
        baseQuery += ` AND o.paymentReceivedDate >= ?`;
        params.push(new Date(paymentReceivedStart).toISOString());
    }
    const paymentReceivedEnd = searchParams.get('paymentReceivedDate_end');
    if (paymentReceivedEnd) {
        baseQuery += ` AND o.paymentReceivedDate <= ?`;
        params.push(new Date(paymentReceivedEnd).toISOString());
    }

    baseQuery += " ORDER BY o.paymentReceivedDate DESC";

    const ordersToSettle: any[] = await executeQuery(baseQuery, params);

    const isDebugOrder = (row: any) => row.merchantOrderId === DEBUG_ORDER_ID;

    console.log(`[API /settlements] Found ${ordersToSettle.length} raw order rows from database to process for settlement.`);

    // 2. Process the results to calculate fees and net amounts.
    let processedPayouts: PayoutData[] = ordersToSettle.map((orderRow, index) => {
        if (isDebugOrder(orderRow)) {
            console.log(`\n[API /settlements] ---- Processing Row ${index + 1} (Order ID: ${orderRow.id}) ----`);
            console.log(`   - Raw DB Row:`, orderRow);
        }
        
        const parsedGatewayFees = typeof orderRow.paymentGatewayFees === 'string'
            ? JSON.parse(orderRow.paymentGatewayFees || '{}')
            : (orderRow.paymentGatewayFees || {});

        if (isDebugOrder(orderRow)) console.log(`   - Parsed paymentGatewayFees JSON:`, parsedGatewayFees);

        const merchantForFeeCalc: Merchant = {
            id: `user_${orderRow.merchantId}`,
            name: orderRow.merchantName,
            email: '', 
            role: 'Merchant',
            createdAt: '',
            status: 'Active',
            paymentGatewayFees: parsedGatewayFees,
        };

        const gatewayFee = calculateGatewayFee(orderRow as Order, merchantForFeeCalc);
        const grossAmountValue = Number(orderRow.paidAmount);
        const netAmountValue = grossAmountValue - gatewayFee;

        const payoutData: PayoutData = {
            payoutId: null,
            orderId: `CP${orderRow.id}`,
            merchantId: `user_${orderRow.merchantId}`,
            merchantOrderId: orderRow.merchantOrderId,
            merchantName: orderRow.merchantName,
            paymentReceivedDate: orderRow.paymentReceivedDate,
            grossAmount: grossAmountValue,
            gatewayFee: gatewayFee,
            netAmount: netAmountValue,
            payoutStatus: 'Unpaid',
            currency: orderRow.currency,
            bankName: orderRow.bankName,
            bankAccountNumber: orderRow.bankAccountNumber,
            walletAddress: orderRow.walletAddress,
            network: orderRow.network,
        };
        if (isDebugOrder(orderRow)) console.log(`   - Final PayoutData Object:`, payoutData);
        return payoutData;
    });
    
    // 3. If a netAmount filter was passed, apply it now.
    if (netAmount) {
      console.log(`[API /settlements] Filtering by netAmount: ${netAmount}`);
      const numericNetAmount = Number(netAmount);
      processedPayouts = processedPayouts.filter(p => Math.abs(p.netAmount - numericNetAmount) < 0.01);
    }
    
    // 4. If a payoutStatus filter is passed, it must be 'Unpaid' for this logic to return anything
    const payoutStatus = searchParams.get('payoutStatus');
    if (payoutStatus && payoutStatus !== 'Unpaid') {
      console.log(`[API /settlements] Filtering by payoutStatus: ${payoutStatus}. Since it's not 'Unpaid', returning empty array.`);
      processedPayouts = [];
    }

    console.log(`[API /settlements] Responding with ${processedPayouts.length} processed payout records.`);
    console.log("----------------------------------------");

    return NextResponse.json({
      data: processedPayouts,
      totalCount: processedPayouts.length,
    });

  } catch (error: any) {
    console.error("❌ [API /settlements] Failed to fetch settlements from DB:", error);
    return NextResponse.json({ message: `Failed to fetch settlements: ${error.message}` }, { status: 500 });
  }
}
