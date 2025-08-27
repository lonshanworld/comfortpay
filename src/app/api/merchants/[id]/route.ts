
import { NextResponse } from 'next/server';
import { initialMerchants } from '@/lib/in-memory-db';
import { executeQuery, runQuery } from '@/lib/db';

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


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const numericId = id.includes('_') ? id.split('_')[1] : id;


  // =================================================================
  // REAL DATABASE LOGIC
  // =================================================================
  try {
    const query = "SELECT * FROM merchants WHERE id = ?";
    const dbMerchants: any[] = await executeQuery(query, [numericId]);
    if (dbMerchants.length === 0) {
      return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
    }
    return NextResponse.json(parseDbMerchant(dbMerchants[0]));
  } catch (error) {
    console.error(`Failed to fetch merchant ${id} from DB:`, error);
    // Fallback to in-memory data
    const merchant = merchants.find(m => m.id === id);
    if (merchant) {
      return NextResponse.json(merchant);
    }
    return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params: { id } }: { params: { id: string } }
) {
  const numericId = id.includes('_') ? id.split('_')[1] : id;
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
    
    // First, update the merchants table
    const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;

    let merchantQuery = `
      UPDATE merchants SET 
      name = ?, email = ?, websiteUrl = ?, status = ?, nationality = ?, dateOfBirth = ?, idType = ?, 
      bankName = ?, bankAccountNumber = ?, bankAccountType = ?, bankEmail = ?, 
      walletAddress = ?, network = ?, settlementFees = ?, paymentGatewayFees = ?, 
      salesAgentId = ?, commissionRates = ? 
      WHERE id = ?`;
    const merchantParams: any[] = [
        name, email, websiteUrl, status, nationality, dateOfBirth, idType, 
        bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, 
        JSON.stringify(settlementFees), JSON.stringify(paymentGatewayFees),
        numericSalesAgentId, JSON.stringify(commissionRates),
        numericId
    ];

    const merchantResult: any = await runQuery(merchantQuery, merchantParams);
    
    if (merchantResult.changes === 0) {
       return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
    }
    
    // Also update the corresponding user entry
    let userQuery = `UPDATE users SET name = ?, email = ?, status = ?`;
    const userParams: any[] = [name, email, status];
    if (password) {
      userQuery += ", password = ?";
      userParams.push(password); // Remember to hash the password
    }
    userQuery += " WHERE id = ?";
    userParams.push(numericId);
    await runQuery(userQuery, userParams);

    
    return NextResponse.json({ id, ...body });

  } catch (error) {
    console.error(`Failed to update merchant ${id} in DB:`, error);
    // Fallback to in-memory data
    const index = merchants.findIndex(m => m.id === id);
    if (index !== -1) {
      merchants[index] = { ...merchants[index], ...body };
      return NextResponse.json(merchants[index]);
    }
    return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const numericId = id.split('_')[1];
  
  // =================================================================
  // REAL DATABASE LOGIC
  // =================================================================
  try {
    await runQuery("DELETE FROM merchants WHERE id = ?", [numericId]);
    const result: any = await runQuery("DELETE FROM users WHERE id = ?", [numericId]);
    
    if (result.changes === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`Failed to delete merchant ${id} from DB:`, error);
    // Fallback to in-memory data
    merchants = merchants.filter(m => m.id !== id);
    return new Response(null, { status: 204 });
  }
}
