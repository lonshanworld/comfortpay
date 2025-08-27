
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import crypto from 'crypto';
import type { User } from '@/lib/types';

// Helper to generate a unique token
const generateToken = () => `cp_tok_${crypto.randomBytes(16).toString('hex')}`;

const parseDbUserAsMerchant = (dbUser: any): User | null => {
    if (!dbUser) return null;
    const merchant = { ...dbUser };
    merchant.id = `user_${merchant.id}`;
    merchant.salesAgentId = merchant.salesAgentId ? `user_${merchant.salesAgentId}` : undefined;
    try {
        merchant.settlementFees = JSON.parse(merchant.settlementFees || '{}');
    } catch(e) { merchant.settlementFees = {}; }
    try {
        merchant.paymentGatewayFees = JSON.parse(merchant.paymentGatewayFees || '{}');
    } catch(e) { merchant.paymentGatewayFees = {}; }
    try {
        merchant.commissionRates = JSON.parse(merchant.commissionRates || '{}');
    } catch(e) { merchant.commissionRates = {}; }
    return merchant;
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const salesAgentId = searchParams.get('salesAgentId');
  const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;
  const name = searchParams.get('name');
  const email = searchParams.get('email');
  const website = searchParams.get('website');

  try {
    let query = "SELECT * FROM users WHERE role = 'Merchant'";
    const params: (string | number)[] = [];
    if (status && status !== 'all') {
        query += " AND status = ?";
        params.push(status);
    }
    if (numericSalesAgentId) {
        query += " AND salesAgentId = ?";
        params.push(numericSalesAgentId);
    }
    if (name) {
        query += " AND name LIKE ?";
        params.push(`%${name}%`);
    }
    if (email) {
        query += " AND email LIKE ?";
        params.push(`%${email}%`);
    }
    if (website) {
        query += " AND websiteUrl LIKE ?";
        params.push(`%${website}%`);
    }

    const dbMerchants = await executeQuery(query, params);
    return NextResponse.json(dbMerchants.map(parseDbUserAsMerchant));
  } catch (error) {
    console.error("Failed to fetch merchants from DB:", error);
    return NextResponse.json({ message: "Failed to fetch merchants" }, { status: 500 });
  }
}

async function createNotification(userId: number, title: string, description: string, link: string) {
    try {
        const query = `
            INSERT INTO notifications 
            (userId, type, title, description, isRead, createdAt, link) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await runQuery(query, [userId, 'NEW_MERCHANT', title, description, 0, new Date().toISOString(), link]);
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}

export async function POST(request: Request) {
  const body = await request.json();
  
  try {
    const { 
        name, email, password, websiteUrl, status, nationality, dateOfBirth, idType, 
        orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, settlementFees, paymentGatewayFees,
        salesAgentId, commissionRates
    } = body;
    const dateJoined = new Date().toISOString();
    const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;
    const newToken = generateToken();

    const userQuery = `
      INSERT INTO users 
      (name, email, password, role, createdAt, status, dateJoined, nationality, dateOfBirth, idType, token,
      orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail, 
      walletAddress, network, settlementFees, paymentGatewayFees, salesAgentId, commissionRates, websiteUrl) 
      VALUES (?, ?, ?, 'Merchant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const userParams = [
        name, email, password, new Date().toISOString(), status, dateJoined, nationality, dateOfBirth, idType, newToken,
        orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, 
        JSON.stringify(settlementFees), JSON.stringify(paymentGatewayFees),
        numericSalesAgentId, JSON.stringify(commissionRates),
        websiteUrl
    ];
    const userResult: any = await runQuery(userQuery, userParams);
    const newUserId = userResult.id;
    
    // Create a notification for the admin (user_1)
    await createNotification(1, `New Merchant: ${name}`, `A new merchant has been added.`, `/admin/dashboard/merchants`);
    
    const newMerchant = { id: `user_${newUserId}`, ...body, dateJoined, token: newToken };
    return NextResponse.json(newMerchant, { status: 201 });

  } catch (error) {
     console.error("Failed to create merchant in DB:", error);
    return NextResponse.json({ message: 'Failed to create merchant' }, { status: 500 });
  }
}
