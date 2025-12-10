
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
        DATE_FORMAT(h.createdAt, '%Y-%m-%dT%H:%i:%s.000Z') as createdAt,
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
                 case 'date_start':
                    query += ` AND h.createdAt >= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                case 'date_end':
                     query += ` AND h.createdAt <= ?`;
                    params.push(new Date(value).toISOString());
                    break;
           }
        }
    });

    query += ` ORDER BY h.createdAt DESC, pa.name ASC`;
    
    const results: any[] = await executeQuery(query, params);
    
    const history: DailyVolumeHistory[] = results.map(row => {
      // The `createdAt` from mysql2 is a Date object in the server's local time,
      // but its value represents the UTC time from the database.
      // toISOString() correctly converts it to a UTC ISO 8601 string.
      const createdAtISO = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
      console.log("Row createdAt:", row.createdAt);
      console.log("Parsed createdAt ISO:", createdAtISO);
      return {
        id: row.id,
        date: new Date(row.date).toISOString().split('T')[0],
        createdAt: createdAtISO, // Pass the reliable ISO string to the frontend
        totalVolume: row.totalVolume,
        paymentAccountId: `pa_${row.paymentAccountId}`,
        accountName: row.accountName,
        accountType: row.accountType,
        accountEmail: row.accountEmail,
        dailyLimit: row.dailyLimit
      };
    });

    return NextResponse.json({ data: history });
  } catch (error: any) {
    console.error("❌ [API /payments/history] Failed to fetch payment history:", error);
    return NextResponse.json({ message: `Failed to fetch payment history: ${error.message}` }, { status: 500 });
  }
}
