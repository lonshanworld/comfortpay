
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import type { User } from '@/lib/types';


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
     try {
        merchant.permissions = JSON.parse(merchant.permissions || '{}');
    } catch(e) { merchant.permissions = {}; }
    return merchant;
}


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const numericId = id.includes('_') ? id.split('_')[1] : id;

  try {
    const query = "SELECT * FROM users WHERE id = ? AND role = 'Merchant'";
    const dbMerchants: any[] = await executeQuery(query, [numericId]);
    if (dbMerchants.length === 0) {
      return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
    }
    return NextResponse.json(parseDbUserAsMerchant(dbMerchants[0]));
  } catch (error) {
    console.error(`Failed to fetch merchant ${id} from DB:`, error);
    return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params: { id } }: { params: { id: string } }
) {
  const numericId = id.includes('_') ? id.split('_')[1] : id;
  const body = await request.json();
  
  try {
    const { 
        name, email, password, websiteUrl, status, nationality, dateOfBirth, idType, token,
        bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, settlementFees, paymentGatewayFees, 
        salesAgentId, commissionRates
    } = body;
    
    const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;

    // Fetch current user data to fill in any missing fields in the body if needed
    const existingUserResult: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [numericId]);
    if (existingUserResult.length === 0) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    const existingUser = parseDbUserAsMerchant(existingUserResult[0]);
    
    let query = `UPDATE users SET 
        name = ?, email = ?, websiteUrl = ?, status = ?, nationality = ?, dateOfBirth = ?, idType = ?, token = ?,
        bankName = ?, bankAccountNumber = ?, bankAccountType = ?, bankEmail = ?, 
        walletAddress = ?, network = ?, settlementFees = ?, paymentGatewayFees = ?, 
        salesAgentId = ?, commissionRates = ?`;
      
    const params: any[] = [
        name ?? existingUser.name, 
        email ?? existingUser.email, 
        websiteUrl ?? existingUser.websiteUrl, 
        status ?? existingUser.status, 
        nationality ?? existingUser.nationality, 
        dateOfBirth ?? existingUser.dateOfBirth, 
        idType ?? existingUser.idType, 
        token ?? existingUser.token,
        bankName ?? existingUser.bankName, 
        bankAccountNumber ?? existingUser.bankAccountNumber, 
        bankAccountType ?? existingUser.bankAccountType, 
        bankEmail ?? existingUser.bankEmail, 
        walletAddress ?? existingUser.walletAddress, 
        network ?? existingUser.network, 
        JSON.stringify(settlementFees ?? existingUser.settlementFees), 
        JSON.stringify(paymentGatewayFees ?? existingUser.paymentGatewayFees),
        numericSalesAgentId === undefined ? (existingUser.salesAgentId ? existingUser.salesAgentId.split('_')[1] : null) : numericSalesAgentId,
        JSON.stringify(commissionRates ?? existingUser.commissionRates)
    ];

    if (password) {
        query += ", password = ?";
        params.push(password); // Remember to hash the password
    }

    query += " WHERE id = ?";
    params.push(numericId);

    const result: any = await runQuery(query, params);
    
    if (result.changes === 0) {
       return NextResponse.json({ message: 'Merchant not found or no changes made' }, { status: 404 });
    }
    
    return NextResponse.json({ id, ...body });

  } catch (error) {
    console.error(`Failed to update merchant ${id} in DB:`, error);
    return NextResponse.json({ message: `Failed to update merchant ${id}` }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const numericId = id.split('_')[1];
  
  try {
    const result: any = await runQuery("DELETE FROM users WHERE id = ? AND role = 'Merchant'", [numericId]);
    
    if (result.changes === 0) {
      return NextResponse.json({ message: 'User/Merchant not found' }, { status: 404 });
    }
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`Failed to delete merchant ${id} from DB:`, error);
    return NextResponse.json({ message: 'Failed to delete merchant' }, { status: 500 });
  }
}
