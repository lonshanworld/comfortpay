
import { NextResponse } from 'next/server';
import { initialPaymentAccounts } from '@/lib/in-memory-db';
import { executeQuery, runQuery } from '@/lib/db';

// In-memory data - this will be used as a fallback if the database is not connected.
let paymentAccounts = initialPaymentAccounts;

const parseDbAccount = (dbAccount: any) => {
    if (!dbAccount) return null;
    return {
        ...dbAccount,
        id: `pa_${dbAccount.id}`
    }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  // =================================================================
  // REAL DATABASE LOGIC
  // =================================================================
  try {
    let query = "SELECT * FROM payment_accounts";
    const params = [];
    if (type) {
        query += " WHERE type = ?";
        params.push(type);
    }
    const dbAccounts = await executeQuery(query, params);
    return NextResponse.json(dbAccounts.map(parseDbAccount));
  } catch (error) {
    console.error("Failed to fetch payment accounts from DB:", error);
    // Fallback to in-memory data
    let filteredAccounts = paymentAccounts;
    if (type) {
      filteredAccounts = paymentAccounts.filter(acc => acc.type.toLowerCase() === type.toLowerCase());
    }
    
    return NextResponse.json(filteredAccounts);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, dailyLimit, prefix_order_name, websiteUrl, accountEmail } = body;
    
    // =================================================================
    // REAL DATABASE LOGIC
    // =================================================================
    try {
      const query = `
        INSERT INTO payment_accounts 
        (name, type, dailyLimit, prefix_order_name, currentVolume, status, websiteUrl, accountEmail) 
        VALUES (?, ?, ?, ?, 0, 'Active', ?, ?)
      `;
      const params = [name, type, Number(dailyLimit), prefix_order_name, websiteUrl, accountEmail];
      const result: any = await runQuery(query, params);
      
      const newAccount = { id: `pa_${result.id}`, ...body };
      return NextResponse.json(newAccount, { status: 201 });
    } catch (error) {
      console.error("Failed to create payment account in DB:", error);
      // Fallback to in-memory data
      const newAccount = {
        id: `pa_${Date.now()}`,
        currentVolume: 0,
        status: 'Active', // Default status
        ...body,
        dailyLimit: Number(body.dailyLimit) // Ensure dailyLimit is a number
      };
      paymentAccounts.unshift(newAccount); // Add to the beginning of the array
      return NextResponse.json(newAccount, { status: 201 });
    }
  } catch (error) {
     console.error("Failed to create payment account:", error);
    return NextResponse.json({ message: 'Failed to create payment account' }, { status: 500 });
  }
}
