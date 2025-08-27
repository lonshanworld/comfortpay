
import { NextResponse } from 'next/server';
import { initialMerchants } from '@/lib/in-memory-db';
import { executeQuery, runQuery } from '@/lib/db';

// In-memory data - this will be used as a fallback if the database is not connected.
let merchants = initialMerchants;

const parseDbMerchant = (dbMerchant: any) => {
    if (!dbMerchant) return null;
    const merchant = { ...dbMerchant };
    // SQLite stores numbers, so no need to parse from string, just ensure they are numbers
    merchant.id = `user_${merchant.id}`;
    merchant.salesAgentId = merchant.salesAgentId ? `user_${merchant.salesAgentId}` : undefined;
    try {
        merchant.settlementFees = JSON.parse(merchant.settlementFees || '{}');
    } catch(e) {
        merchant.settlementFees = {};
    }
    try {
        merchant.paymentGatewayFees = JSON.parse(merchant.paymentGatewayFees || '{}');
    } catch(e) {
        merchant.paymentGatewayFees = {};
    }
    try {
        merchant.commissionRates = JSON.parse(merchant.commissionRates || '{}');
    } catch(e) {
        merchant.commissionRates = {};
    }
    return merchant;
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const salesAgentId = searchParams.get('salesAgentId');
  const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;


  // =================================================================
  // REAL DATABASE LOGIC
  // =================================================================
  try {
    let query = "SELECT * FROM merchants WHERE 1=1";
    const params: (string | number)[] = [];
    if (status) {
        query += " AND status = ?";
        params.push(status);
    }
    if (numericSalesAgentId) {
        query += " AND salesAgentId = ?";
        params.push(numericSalesAgentId);
    }
    const dbMerchants = await executeQuery(query, params);
    return NextResponse.json(dbMerchants.map(parseDbMerchant));
  } catch (error) {
    console.error("Failed to fetch merchants from DB:", error);
    // Fallback to in-memory data for demonstration
    let filteredMerchants = merchants;
    if (status === 'active') {
      filteredMerchants = merchants.filter(m => m.status === 'Active');
    } else if (status === 'inactive') {
      filteredMerchants = merchants.filter(m => m.status === 'Inactive');
    }

    if (salesAgentId) {
      filteredMerchants = filteredMerchants.filter(m => m.salesAgentId === salesAgentId);
    }

    return NextResponse.json(filteredMerchants);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  
  // =================================================================
  // REAL DATABASE LOGIC
  // =================================================================
  try {
    const { 
        name, email, password, websiteUrl, status, nationality, dateOfBirth, idType, 
        bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, settlementFees, paymentGatewayFees,
        salesAgentId, commissionRates
    } = body;
    const dateJoined = new Date().toISOString();
    const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;


    // A merchant is a type of user, so create a user record first
    const userQuery = `INSERT INTO users (name, email, password, role, createdAt, status) VALUES (?, ?, ?, 'Merchant', ?, ?)`;
    const userResult: any = await runQuery(userQuery, [name, email, password, dateJoined, status]);
    const newUserId = userResult.id;

    // Then create the merchant record
    const merchantQuery = `
      INSERT INTO merchants 
      (id, name, email, password, websiteUrl, status, dateJoined, nationality, dateOfBirth, idType, 
      bankName, bankAccountNumber, bankAccountType, bankEmail, 
      walletAddress, network, settlementFees, paymentGatewayFees, salesAgentId, commissionRates) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const merchantParams = [
        newUserId, name, email, password, websiteUrl, status, dateJoined, nationality, dateOfBirth, idType, 
        bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, 
        JSON.stringify(settlementFees), JSON.stringify(paymentGatewayFees),
        numericSalesAgentId, JSON.stringify(commissionRates)
    ];
    await runQuery(merchantQuery, merchantParams);
    
    const newMerchant = { id: `user_${newUserId}`, ...body, dateJoined };
    return NextResponse.json(newMerchant, { status: 201 });

  } catch (error) {
     console.error("Failed to create merchant in DB:", error);
    // Fallback to in-memory data for demonstration
    const newMerchant = {
      id: `merch_${Date.now()}`,
      ...body,
      dateJoined: new Date().toISOString(),
    };
    merchants.push(newMerchant);
    return NextResponse.json(newMerchant, { status: 201 });
  }
}
