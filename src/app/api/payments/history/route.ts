
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { DailyVolumeHistory } from '@/lib/types';
import type { DateRange } from 'react-day-picker';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    let query = `
      SELECT 
        h.id,
        h.date,
        h.totalVolume,
        pa.id as paymentAccountId,
        pa.name as accountName,
        pa.type as accountType,
        pa.accountEmail,
        pa.dailyLimit
      FROM daily_volume_history h
      JOIN payment_accounts pa ON h.paymentAccountId = pa.id
      WHERE h.totalVolume > 0
    `;
    const params: any[] = [];
    
    searchParams.forEach((value, key) => {
        if (value) {
           switch(key) {
                case 'accountId':
                    query += ` AND h.paymentAccountId = ?`;
                    params.push(value.replace('pa_',''));
                    break;
                case 'date':
                    const dateRange = JSON.parse(value) as DateRange;
                    if (dateRange.from) {
                        query += ` AND h.date >= ?`;
                        // Adjust for timezone differences by just taking the date part
                        params.push(new Date(dateRange.from).toISOString().split('T')[0]);
                    }
                    if (dateRange.to) {
                        query += ` AND h.date <= ?`;
                        params.push(new Date(dateRange.to).toISOString().split('T')[0]);
                    }
                    break;
           }
        }
    });

    query += ` ORDER BY h.date DESC, pa.name ASC`;
    
    const results: any[] = await executeQuery(query, params);

    const history: DailyVolumeHistory[] = results.map(row => ({
      id: row.id,
      date: new Date(row.date).toISOString().split('T')[0],
      totalVolume: row.totalVolume,
      paymentAccountId: `pa_${row.paymentAccountId}`,
      accountName: row.accountName,
      accountType: row.accountType,
      accountEmail: row.accountEmail,
      dailyLimit: row.dailyLimit
    }));

    return NextResponse.json({ data: history });
  } catch (error: any) {
    console.error("❌ [API /payments/history] Failed to fetch payment history:", error);
    return NextResponse.json({ message: `Failed to fetch payment history: ${error.message}` }, { status: 500 });
  }
}
