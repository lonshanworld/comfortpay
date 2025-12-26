
import { NextResponse, NextRequest } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import type { User } from '@/lib/types';
import { hashPassword } from '@/lib/password-service';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

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


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    // Fetch per-payment-type merchant daily limits and attach as merchantDailyLimits
    try {
      const limitRows: any[] = await executeQuery(
        `SELECT paymentType, dailyLimit, dailyUsed FROM merchant_daily_limits WHERE merchantId = ?`,
        [numericId]
      );
      const merchantDailyLimits: Record<string, any> = {};
      for (const r of limitRows) {
        // Normalize paymentType keys to lowercase so front-end and other
        // server code can reliably access `merchantDailyLimits.zelle` etc.
        const paymentTypeRaw = (r.paymentType || '').toString();
        const key = paymentTypeRaw.trim().toLowerCase() || 'merchant';
        merchantDailyLimits[key] = { dailyLimit: r.dailyLimit, dailyUsed: r.dailyUsed };
      }
      console.debug(`merchants GET: fetched ${limitRows.length} merchant_daily_limits rows for merchant ${numericId}`, limitRows);
      (merchant as any).merchantDailyLimits = merchantDailyLimits;
      console.debug('merchants GET: attached merchantDailyLimits', merchantDailyLimits);
    } catch (e) {
      console.warn('Could not fetch merchant daily limits for merchant', numericId, e);
    }

    // Diagnostic: check merchant payload for Zod-like objects before returning
    try {
      const findZodLike = (v: any, path = ''): string[] => {
        const out: string[] = [];
        if (!v || typeof v !== 'object') return out;
        if ((v as any)._def || (v as any)._zod) {
          out.push(path || '<root>');
          return out;
        }
        for (const k of Object.keys(v)) {
          try { out.push(...findZodLike(v[k], path ? `${path}.${k}` : k)); } catch (_e) {}
        }
        return out;
      };
      const zodPaths = findZodLike(merchant);
      if (zodPaths.length > 0) console.warn('merchants/[id] GET detected Zod-like objects at paths:', zodPaths);
    } catch (e) {
      console.warn('merchants/[id] GET diagnostics failed', e);
    }

    return NextResponse.json(merchant);
  } catch (error) {
    console.error(`Failed to fetch merchant ${id} from DB:`, error);
    return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const numericId = id.includes('_') ? id.split('_')[1] : id;
  const body = await request.json();
  // Diagnostic: log incoming body shallow info and detect any Zod-like values
  try {
    console.debug(`merchants/[id] PUT incoming body for ${id}:`, Object.keys(body || {}));
    const findZodLike = (v: any, path = ''): string[] => {
      const out: string[] = [];
      if (!v || typeof v !== 'object') return out;
      if ((v as any)._def || (v as any)._zod) {
        out.push(path || '<root>');
        return out;
      }
      for (const k of Object.keys(v)) {
        try { out.push(...findZodLike(v[k], path ? `${path}.${k}` : k)); } catch (_e) {}
      }
      return out;
    };
    const zodPaths = findZodLike(body);
    if (zodPaths.length > 0) console.warn('merchants/[id] PUT detected Zod-like objects at paths:', zodPaths);
  } catch (e) {
    console.warn('merchants/[id] PUT diagnostics failed', e);
  }
  
  try {
    const { 
        name, email, password, websiteUrl, status, nationality, dateOfBirth, idType, token,
        orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail, 
        walletAddress, network, settlementFees, paymentGatewayFees, 
        salesAgentId, commissionRates, photoId, businessDocument
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
    
    // Fetch the updated user data to return
    const updatedUser: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [numericId]);
    // Diagnostic: inspect the updated DB row for Zod-like objects
    try {
      if (updatedUser && updatedUser[0]) {
        console.debug(`merchants/[id] PUT updated DB row keys:`, Object.keys(updatedUser[0] || {}));
        const findZodLike2 = (v: any, path = ''): string[] => {
          const out: string[] = [];
          if (!v || typeof v !== 'object') return out;
          if ((v as any)._def || (v as any)._zod) {
            out.push(path || '<root>');
            return out;
          }
          for (const k of Object.keys(v)) {
            try { out.push(...findZodLike2(v[k], path ? `${path}.${k}` : k)); } catch (_e) {}
          }
          return out;
        };
        const zodPaths2 = findZodLike2(updatedUser[0]);
        if (zodPaths2.length > 0) console.warn('merchants/[id] PUT found Zod-like objects in DB row at paths:', zodPaths2);
      }
    } catch (e) {
      console.warn('merchants/[id] PUT post-update diagnostics failed', e);
    }
    // Process merchantDailyLimits per payment type if provided
    try {
        if (Object.prototype.hasOwnProperty.call(body, 'merchantDailyLimits') && body.merchantDailyLimits && typeof body.merchantDailyLimits === 'object') {
        const merchantDailyLimits = body.merchantDailyLimits as Record<string, any>;
        for (const [paymentType, rawValue] of Object.entries(merchantDailyLimits)) {
          // Normalize incoming paymentType to lowercase to keep DB canonical
          const normalizedPaymentType = (paymentType || '').toString().trim().toLowerCase();
          let limitValue = rawValue;
          // If the value is an object with dailyLimit property, normalize
          if (limitValue && typeof limitValue === 'object' && 'dailyLimit' in limitValue) {
            limitValue = limitValue.dailyLimit;
          }
          if (limitValue === '' || limitValue === null || typeof limitValue === 'undefined') {
            limitValue = null;
          }
          const nowStr = new Date().toISOString().slice(0,19).replace('T',' ');
          // Try to match existing rows case-insensitively and update them. Use LOWER() in WHERE to be resilient
          const existing: any[] = await executeQuery(
            `SELECT id FROM merchant_daily_limits WHERE merchantId = ? AND LOWER(paymentType) = ?`,
            [numericId, normalizedPaymentType]
          );
          if (existing && existing.length > 0) {
            await runQuery(`UPDATE merchant_daily_limits SET dailyLimit = ?, updatedAt = ?, paymentType = ? WHERE merchantId = ? AND LOWER(paymentType) = ?`, [limitValue, nowStr, normalizedPaymentType, numericId, normalizedPaymentType]);
          } else {
            await runQuery(`INSERT INTO merchant_daily_limits (merchantId, paymentType, dailyLimit, dailyUsed, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)`, [numericId, normalizedPaymentType, limitValue, nowStr, nowStr]);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to upsert merchant daily limits for merchant', numericId, e);
    }

    return NextResponse.json(parseDbUserAsMerchant(updatedUser[0]));

  } catch (error) {
    console.error(`Failed to update merchant ${id} in DB:`, error);
    return NextResponse.json({ message: `Failed to update merchant ${id}` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
