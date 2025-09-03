
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

    if (accounts.length > 0) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const now = formatDateForMySQL(new Date());
      const historyValues = [];

      for (const account of accounts) {
        // Only create a history record if the volume is greater than 0
        if (account.currentVolume > 0) {
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
        console.log(`Archived volume for ${historyValues.length} accounts.`);
      } else {
        console.log("No accounts had volume to archive. Skipping history insertion.");
      }
      
      // 3. Reset currentVolume on all accounts
      const resetQuery = "UPDATE payment_accounts SET currentVolume = 0";
      await runQuery(resetQuery);
      console.log("Reset currentVolume to 0 for all accounts.");
    }

    // Commit the transaction
    await runQuery('COMMIT');
    
    console.log("Cron job finished successfully.");
    return NextResponse.json({ success: true, message: `Processed ${accounts.length} accounts.` });

  } catch (error: any) {
    console.error("Error during cron job:", error);
    // Rollback transaction on error
    await runQuery('ROLLBACK');
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
