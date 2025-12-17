
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import type { User } from '@/lib/types';
import { hashPassword } from '@/lib/password-service';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { getBaseUploadDir } from '@/lib/upload-utils';
import { formatDateForMySQL } from '@/lib/utils';

// Helper to save a base64 encoded file and return its public URL
const saveFileFromBase64 = async (base64String: string, subfolder: 'avatars' | 'documents'): Promise<string | null> => {
    if (!base64String || !base64String.startsWith('data:')) return null;

    try {
        const mimeType = base64String.substring(base64String.indexOf(':') + 1, base64String.indexOf(';'));
        if (!mimeType.startsWith('image/')) {
            console.warn(`Unsupported file type for upload: ${mimeType}. Only images are allowed.`);
            return null; // Or handle other file types if needed
        }
        
        const base64Data = base64String.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileExtension = mimeType.split('/')[1];
        const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
        
        // Resolve environment-aware upload directory
        const baseUploadDir = getBaseUploadDir();
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


export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const numericId = id.includes('_') ? id.split('_')[1] : id;

  try {
    const query = "SELECT * FROM users WHERE id = ? AND role = 'Merchant'";
    const dbMerchants: any[] = await executeQuery(query, [numericId]);
    if (dbMerchants.length === 0) {
      return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
    }
    const merchant = parseDbUserAsMerchant(dbMerchants[0]);

    // Fetch merchant daily limits and include them in the response
    try {
      const limitRows: any[] = await executeQuery(
        "SELECT paymentType, dailyLimit, dailyUsed FROM merchant_daily_limits WHERE merchantId = ?",
        [numericId]
      );
      const merchantDailyLimits: Record<string, any> = {};
      for (const r of limitRows) {
        merchantDailyLimits[r.paymentType] = { dailyLimit: r.dailyLimit, dailyUsed: r.dailyUsed };
      }
      (merchant as any).merchantDailyLimits = merchantDailyLimits;
    } catch (err) {
      console.warn('Failed to fetch merchant daily limits for merchant', numericId, err);
    }

    return NextResponse.json(merchant);
  } catch (error) {
    console.error(`Failed to fetch merchant ${id} from DB:`, error);
    return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const numericId = id.includes('_') ? id.split('_')[1] : id;
  const body = await request.json();
  
  try {
    const { 
        name, email, password, websiteUrl, status, nationality, dateOfBirth, idType, token,
        orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, settlementFees, paymentGatewayFees, 
      salesAgentId, commissionRates, photoId, businessDocument, merchantDailyLimits
    } = body;
    
    const numericSalesAgentId = salesAgentId ? salesAgentId.split('_')[1] : null;

    const existingUserResult: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [numericId]);
    if (existingUserResult.length === 0) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    // Handle file uploads
    const photoIdUrl = await saveFileFromBase64(photoId, 'documents');
    const businessDocumentUrl = await saveFileFromBase64(businessDocument, 'documents');

    // Build the query dynamically
    let query = "UPDATE users SET ";
    const params: any[] = [];
    const fieldsToUpdate: string[] = [];

    const updateField = (fieldName: string, value: any) => {
        // Check if the key exists in the body object to allow setting fields to null/empty
        if (Object.prototype.hasOwnProperty.call(body, fieldName)) {
            fieldsToUpdate.push(`${fieldName} = ?`);
            params.push(value);
        }
    };
    
    updateField('name', name);
    updateField('email', email);
    updateField('websiteUrl', websiteUrl);
    updateField('status', status);
    updateField('nationality', nationality);
    updateField('dateOfBirth', dateOfBirth === '' ? null : dateOfBirth);
    updateField('idType', idType);
    updateField('token', token);
    updateField('orderIdPrefix', orderIdPrefix);
    updateField('bankName', bankName);
    updateField('bankAccountNumber', bankAccountNumber);
    updateField('bankAccountType', bankAccountType);
    updateField('bankEmail', bankEmail);
    updateField('walletAddress', walletAddress);
    updateField('network', network);
    updateField('settlementFees', settlementFees ? JSON.stringify(settlementFees) : null);
    updateField('paymentGatewayFees', paymentGatewayFees ? JSON.stringify(paymentGatewayFees) : null);
    updateField('salesAgentId', numericSalesAgentId);
    updateField('commissionRates', commissionRates ? JSON.stringify(commissionRates) : null);
    
    if (photoIdUrl) updateField('photoIdUrl', photoIdUrl);
    if (businessDocumentUrl) updateField('businessDocumentUrl', businessDocumentUrl);

    if (password) {
        const hashedPassword = await hashPassword(password);
        fieldsToUpdate.push("password = ?");
        params.push(hashedPassword);
    }
    
    if (fieldsToUpdate.length === 0) {
        return NextResponse.json({ message: 'No changes to update.' });
    }

    query += fieldsToUpdate.join(', ') + " WHERE id = ?";
    params.push(numericId);

    await runQuery(query, params);
    
    // Process merchantDailyLimits if provided
    if (merchantDailyLimits && typeof merchantDailyLimits === 'object') {
      try {
        for (const [paymentType, rawValue] of Object.entries(merchantDailyLimits)) {
          // Normalize value: treat empty string or null-ish as NULL (unlimited)
          let limitValue = rawValue;
          if (limitValue === '' || limitValue === null || typeof limitValue === 'undefined') {
            limitValue = null;
          }
          // Check if a row exists
          const existing: any[] = await executeQuery(
            "SELECT id FROM merchant_daily_limits WHERE merchantId = ? AND paymentType = ?",
            [numericId, paymentType]
          );
          if (existing.length > 0) {
            await runQuery(
              "UPDATE merchant_daily_limits SET dailyLimit = ?, updatedAt = ? WHERE merchantId = ? AND paymentType = ?",
              [limitValue, formatDateForMySQL(new Date()), numericId, paymentType]
            );
          } else {
            await runQuery(
              "INSERT INTO merchant_daily_limits (merchantId, paymentType, dailyLimit, dailyUsed, updatedAt) VALUES (?, ?, ?, ?, ?)",
              [numericId, paymentType, limitValue, 0, formatDateForMySQL(new Date())]
            );
          }
        }
      } catch (err) {
        console.warn('Failed to update merchant daily limits for merchant', numericId, err);
      }
    }

    // Fetch the updated user data to return
    const updatedUser: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [numericId]);
    const merchantResp = parseDbUserAsMerchant(updatedUser[0]);
    try {
      const limitRows: any[] = await executeQuery(
        "SELECT paymentType, dailyLimit, dailyUsed FROM merchant_daily_limits WHERE merchantId = ?",
        [numericId]
      );
      const merchantDailyLimitsResp: Record<string, any> = {};
      for (const r of limitRows) {
        merchantDailyLimitsResp[r.paymentType] = { dailyLimit: r.dailyLimit, dailyUsed: r.dailyUsed };
      }
      (merchantResp as any).merchantDailyLimits = merchantDailyLimitsResp;
    } catch (err) {
      console.warn('Failed to fetch merchant daily limits after update for merchant', numericId, err);
    }

    return NextResponse.json(merchantResp);

  } catch (error) {
    console.error(`Failed to update merchant ${id} in DB:`, error);
    return NextResponse.json({ message: `Failed to update merchant ${id}` }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
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
