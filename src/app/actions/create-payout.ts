
'use server';

import { runQuery } from '@/lib/db';
import { formatDateForMySQL } from '@/lib/utils';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const CreatePayoutInputSchema = z.object({
  payouts: z.array(z.object({
    orderId: z.string(),
    merchantId: z.string(),
    grossAmount: z.number(),
    gatewayFee: z.number(),
    netAmount: z.number(),
  })),
  settlementId: z.string().optional(),
  transferFees: z.number().optional().default(0),
});

const UpdatePayoutBatchSchema = z.object({
  batchId: z.string(),
  settlementId: z.string(),
  transferFees: z.number().optional().default(0),
})

export async function createPayouts(input: z.infer<typeof CreatePayoutInputSchema>) {
  const validation = CreatePayoutInputSchema.safeParse(input);

  if (!validation.success) {
    return { success: false, message: 'Invalid input for creating payouts.' };
  }

  const { payouts, settlementId, transferFees } = validation.data;
  const now = formatDateForMySQL(new Date());
  
  if (payouts.length === 0) {
      return { success: false, message: 'No payouts to process.' };
  }

  const payoutStatus = settlementId ? 'Paid' : 'In-Settlement';
  const batchId = randomUUID();
  
  const totalNetAmount = payouts.reduce((sum, p) => sum + p.netAmount, 0);
  const totalFinalAmount = totalNetAmount - transferFees;

  try {
    await runQuery('START TRANSACTION');
    
    // Create the batch record first
    const batchQuery = `
      INSERT INTO payout_batches 
      (batchId, payoutStatus, payoutCount, totalNetAmount, transferFees, totalFinalAmount, settlementId, createdAt, paidAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(batchQuery, [
        batchId,
        payoutStatus,
        payouts.length,
        totalNetAmount,
        transferFees,
        totalFinalAmount,
        settlementId || null,
        now,
        payoutStatus === 'Paid' ? now : null,
    ]);

    const payoutValues = payouts.map(p => [
        p.orderId.replace('CP', ''),
        p.merchantId.replace('user_', ''),
        batchId,
        p.grossAmount,
        p.gatewayFee,
        p.netAmount,
        now,
    ]);

    const payoutInsertQuery = `
        INSERT INTO payouts 
        (orderId, merchantId, batchId, grossAmount, gatewayFee, netAmount, createdAt) 
        VALUES ?
    `;
    await runQuery(payoutInsertQuery, [payoutValues]);

    await runQuery('COMMIT');
    return { success: true, message: `Successfully created payout batch with ${payouts.length} transactions.` };

  } catch (error: any) {
    await runQuery('ROLLBACK');
    console.error("Failed to create payouts batch:", error);
    return { success: false, message: 'Database error while creating payouts batch.' };
  }
}


export async function updatePayoutBatch(input: z.infer<typeof UpdatePayoutBatchSchema>) {
  const validation = UpdatePayoutBatchSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input for updating payout batch.' };
  }
  const { batchId, settlementId, transferFees } = validation.data;
  const now = formatDateForMySQL(new Date());

  try {
    await runQuery('START TRANSACTION');

    const result = await runQuery(
      `UPDATE payout_batches 
       SET payoutStatus = 'Paid', 
           settlementId = ?, 
           paidAt = ?,
           transferFees = ?,
           totalFinalAmount = totalNetAmount - ?
       WHERE batchId = ? AND payoutStatus = 'In-Settlement'`,
      [settlementId, now, transferFees, transferFees, batchId]
    );

    await runQuery('COMMIT');
    
    if (result.changes === 0) {
      return { success: false, message: 'No payouts in this batch were in a state that could be updated.' };
    }

    return { success: true, message: `Batch ${batchId} has been marked as paid.` };

  } catch (error: any) {
    await runQuery('ROLLBACK');
    console.error(`Failed to update payout batch ${batchId}:`, error);
    return { success: false, message: 'Database error while updating payout batch.' };
  }
}
