
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { formatDateForMySQL } from '@/lib/utils';
import type { PaymentAccount } from '@/lib/types';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("Starting daily volume reset cron job...");

  try {
    // Start a transaction
    await runQuery('START TRANSACTION');

    // 1. Get all payment accounts
    const accounts: PaymentAccount[] = await executeQuery("SELECT id, currentVolume FROM payment_accounts");
    console.log(`Found ${accounts.length} payment accounts to process.`);
    // Prepare counters for response
    let archivedCount = 0;
    let merchantsReset = 0;

    if (accounts.length > 0) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const now = formatDateForMySQL(new Date());
      const historyValues: any[] = [];

      for (const account of accounts) {
        // Only create a history record if the volume is greater than 0
        if (Number(account.currentVolume) > 0) {
            historyValues.push([account.id, today, account.currentVolume, now]);
        }
      }
      
      // 2. Insert into history table if there's anything to insert
      if (historyValues.length > 0) {
        const historyQuery = `
          INSERT INTO daily_volume_history (paymentAccountId, date, totalVolume, createdAt) 
          VALUES ?
        `;
        // For bulk inserts with mysql2, the parameters need to be wrapped in an array.
        await runQuery(historyQuery, [historyValues]);
        archivedCount = historyValues.length;
        console.log(`Archived volume for ${historyValues.length} accounts.`);
      } else {
        console.log("No accounts had volume to archive. Skipping history insertion.");
      }
      
      // 3. Reset currentVolume on all accounts
      const resetQuery = "UPDATE payment_accounts SET currentVolume = 0";
      await runQuery(resetQuery);
      console.log("Reset currentVolume to 0 for all accounts.");

      // 3b. Archive current merchant daily limits into history table
      try {
        const merchantRows = await executeQuery(`SELECT merchantId, paymentType, dailyLimit, dailyUsed FROM merchant_daily_limits`);
        const merchantHistoryValues: any[] = [];
        for (const r of merchantRows) {
          // Only record if there's a limit set or there was usage
          if (r.dailyLimit !== null || Number(r.dailyUsed || 0) > 0) {
            merchantHistoryValues.push([r.merchantId, r.paymentType, today, r.dailyLimit, r.dailyUsed || 0, now]);
          }
        }
        if (merchantHistoryValues.length > 0) {
          const mHistoryQuery = `
            INSERT INTO daily_volume_history_merchant_limit (merchantId, paymentType, date, dailyLimit, dailyUsed, createdAt)
            VALUES ?
          `;
          await runQuery(mHistoryQuery, [merchantHistoryValues]);
          console.log(`Archived merchant limit history for ${merchantHistoryValues.length} records.`);
        } else {
          console.log('No merchant limits to archive.');
        }
      } catch (archiveErr) {
        console.warn('Failed to archive merchant_daily_limits into history table:', archiveErr);
      }

      // 4. Reset migrated merchant_daily_limits.dailyUsed and updatedAt where needed
      // If the table uses the new schema, reset `dailyUsed` for rows that are not for today
      // or that currently have usage recorded. This handles both fresh installs and migrated schemas.
      const merchantResult = await runQuery(
        `UPDATE merchant_daily_limits
         SET dailyUsed = 0, updatedAt = NOW()
         WHERE DATE(updatedAt) < CURRENT_DATE() OR updatedAt IS NULL OR dailyUsed <> 0`,
        []
      );
      merchantsReset = merchantResult.affectedRows || merchantResult.changes || 0;
      console.log(`Reset merchant daily limits, rows affected: ${merchantsReset}`);
    }

    // Commit the transaction
    await runQuery('COMMIT');
    
    console.log("Cron job finished successfully.");
    return NextResponse.json({ success: true, message: `Processed ${accounts.length} accounts.`, archived: archivedCount, merchantsReset });

  } catch (error: any) {
    console.error("Error during cron job:", error);
    // Rollback transaction on error
    await runQuery('ROLLBACK');
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
