
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import crypto from 'crypto';
import type { User } from '@/lib/types';
import { hashPassword } from '@/lib/password-service';
import { formatDateForMySQL } from '@/lib/utils';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to generate a unique token
const generateToken = () => `cp_tok_${crypto.randomBytes(16).toString('hex')}`;

// Helper to save a base64 encoded file and return its public URL
const saveFileFromBase64 = async (base64String: string, subfolder: 'avatars' | 'documents'): Promise<string | null> => {
    if (!base64String || !base64String.startsWith('data:')) return null;

    try {
        const base64Data = base64String.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileExtension = base64String.substring(base64String.indexOf('/') + 1, base64String.indexOf(';'));
        const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
        
        // Use environment variable for base path, fallback to public/uploads for development
        const baseUploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
        const uploadDir = path.join(baseUploadDir, subfolder);

        await fs.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, imageBuffer);
        return `/uploads/${subfolder}/${fileName}`;
    } catch (error) {
        console.error('Error saving file from Base64:', error);
        return null;
    }
};


const parseDbUserAsMerchant = (dbUser: any): User | null => {
    if (!dbUser) return null;
    const merchant = { ...dbUser };
    merchant.id = `user_${merchant.id}`;
    merchant.salesAgentId = merchant.salesAgentId ? `user_${merchant.salesAgentId}` : undefined;

    // Safely handle JSON fields that might already be objects
    const safeParseJson = (field: any) => {
        if (typeof field === 'string') {
            try {
                return JSON.parse(field || '{}');
            } catch {
                return {};
            }
        }
        return field || {};
    };
    
    merchant.settlementFees = safeParseJson(merchant.settlementFees);
    merchant.paymentGatewayFees = safeParseJson(merchant.paymentGatewayFees);
    merchant.commissionRates = safeParseJson(merchant.commissionRates);
    merchant.permissions = safeParseJson(merchant.permissions);

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

    query += " ORDER BY dateJoined DESC";

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
        await runQuery(query, [userId, 'NEW_MERCHANT', title, description, 0, formatDateForMySQL(new Date()), link]);
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
        salesAgentId, commissionRates, photoId, businessDocument
    } = body;
    
    // Handle file uploads
    const photoIdUrl = await saveFileFromBase64(photoId, 'documents');
    const businessDocumentUrl = await saveFileFromBase64(businessDocument, 'documents');

    const now = new Date();
    const createdAt = formatDateForMySQL(now);
    const dateJoined = formatDateForMySQL(now);

    const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;
    const newToken = generateToken();
    const hashedPassword = await hashPassword(password);

    const userQuery = `
      INSERT INTO users 
      (name, email, password, role, createdAt, status, dateJoined, nationality, dateOfBirth, idType, token,
      orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail, 
      walletAddress, network, settlementFees, paymentGatewayFees, salesAgentId, commissionRates, websiteUrl,
      photoIdUrl, businessDocumentUrl) 
      VALUES (?, ?, ?, 'Merchant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const userParams = [
        name || null, email || null, hashedPassword, createdAt, status || 'Inactive', dateJoined,
        nationality || null, dateOfBirth || null, idType || null, newToken, orderIdPrefix || null,
        bankName || null, bankAccountNumber || null, bankAccountType || null, bankEmail || null,
        walletAddress || null, network || null,
        settlementFees ? JSON.stringify(settlementFees) : null,
        paymentGatewayFees ? JSON.stringify(paymentGatewayFees) : null,
        numericSalesAgentId || null,
        commissionRates ? JSON.stringify(commissionRates) : null,
        websiteUrl || null, photoIdUrl, businessDocumentUrl
    ];
    const userResult: any = await runQuery(userQuery, userParams);
    const newUserId = userResult.id;
    
    await createNotification(1, `New Merchant: ${name}`, `A new merchant has been added.`, `/admin/dashboard/merchants`);
    
    const newMerchant = { id: `user_${newUserId}`, ...body, dateJoined, token: newToken, photoIdUrl, businessDocumentUrl };
    delete newMerchant.password;
    delete newMerchant.photoId;
    delete newMerchant.businessDocument;
    return NextResponse.json(newMerchant, { status: 201 });

  } catch (error: any) {
     console.error("Failed to create merchant in DB:", error);
    return NextResponse.json({ message: `Failed to create merchant: ${error.message}` }, { status: 500 });
  }
}
