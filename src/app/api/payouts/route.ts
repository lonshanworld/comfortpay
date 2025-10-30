
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { PayoutData } from '@/lib/types';
import { PayoutBatch } from '@/app/admin/dashboard/payouts/page';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  console.log("🚀 [API /payouts] Received GET request.");

  try {
    let query = `
      SELECT 
        pb.batchId,
        pb.payoutStatus,
        pb.payoutCount,
        pb.totalNetAmount,
        pb.transferFees,
        pb.totalFinalAmount,
        pb.createdAt,
        pb.paidAt,
        pb.settlementId,
        p.id as payoutId,
        p.orderId,
        p.merchantId,
        p.grossAmount,
        p.gatewayFee,
        p.netAmount,
        o.merchantOrderId,
        o.currency,
        u.name as merchantName
      FROM payout_batches pb
      JOIN payouts p ON pb.batchId = p.batchId
      JOIN orders o ON p.orderId = o.id
      JOIN users u ON p.merchantId = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
     
    searchParams.forEach((value, key) => {
        if (value && !['page', 'pageSize'].includes(key)) {
            switch(key) {
                case 'merchantId':
                    // This is tricky as a batch can have multiple merchants.
                    // This will filter batches that contain AT LEAST ONE payout from the specified merchant.
                    query += ` AND pb.batchId IN (SELECT DISTINCT batchId FROM payouts WHERE merchantId = ?)`;
                    params.push(value.replace('user_', ''));
                    break;
                case 'payoutStatus':
                    query += ` AND pb.payoutStatus = ?`;
                    params.push(value);
                    break;
                case 'batchId':
                case 'settlementId':
                    query += ` AND pb.${key} LIKE ?`;
                    params.push(`%${value}%`);
                    break;
                case 'createdAt_start':
                    query += ` AND pb.createdAt >= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                case 'createdAt_end':
                     query += ` AND pb.createdAt <= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                 case 'paidAt_start':
                    query += ` AND pb.paidAt >= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                case 'paidAt_end':
                     query += ` AND pb.paidAt <= ?`;
                    params.push(new Date(value).toISOString());
                    break;
            }
        }
    });


    query += ` ORDER BY pb.createdAt DESC`;

    const results: any[] = await executeQuery(query, params);

    // Group by batchId
    const batches = results.reduce((acc, row) => {
      const batchId = row.batchId;
      if (!acc[batchId]) {
        acc[batchId] = {
          batchId: batchId,
          payoutStatus: row.payoutStatus,
          payoutCount: row.payoutCount,
          totalNetAmount: row.totalNetAmount,
          totalTransferFees: row.transferFees,
          totalFinalAmount: row.totalFinalAmount,
          createdAt: row.createdAt,
          paidAt: row.paidAt,
          settlementId: row.settlementId,
          payouts: []
        };
      }
      
      const payout: PayoutData = {
          payoutId: row.payoutId,
          orderId: `CP${row.orderId}`,
          merchantId: `user_${row.merchantId}`,
          merchantOrderId: row.merchantOrderId,
          merchantName: row.merchantName,
          paymentReceivedDate: '', // Not needed for this view
          grossAmount: row.grossAmount,
          gatewayFee: row.gatewayFee,
          netAmount: row.netAmount,
          currency: row.currency,
      };

      acc[batchId].payouts.push(payout);

      return acc;
    }, {} as Record<string, PayoutBatch>);

    return NextResponse.json({
      data: Object.values(batches),
    });

  } catch (error: any) {
    console.error("❌ [API /payouts] Failed to fetch payouts:", error);
    return NextResponse.json({ message: `Failed to fetch payouts: ${error.message}` }, { status: 500 });
  }
}
