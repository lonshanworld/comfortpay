
'use server';

import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

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

  try {
    let query = "SELECT * FROM payment_accounts";
    const params = [];
    
    if (type) {
        query += " WHERE type = ?";
        params.push(type);
    }
    
    query += " ORDER BY id DESC";

    const dbAccounts = await executeQuery(query, params);
    return NextResponse.json(dbAccounts.map(parseDbAccount));

  } catch (error) {
    console.error("Failed to fetch payment accounts from DB:", error);
    return NextResponse.json({ message: "Failed to fetch payment accounts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { name, type, dailyLimit, prefix_order_name, websiteUrl, accountEmail, qrCode } = body;
    
    let qrCodeUrl = null;

    if (qrCode && typeof qrCode === 'string') {
        const base64Data = qrCode.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileExtension = qrCode.substring(qrCode.indexOf('/') + 1, qrCode.indexOf(';'));
        const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
        
        // Use environment variable for base path, fallback to public/uploads for development
        const baseUploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
        const uploadDir = path.join(baseUploadDir, 'qrcodes');

        await fs.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, imageBuffer);
        qrCodeUrl = `/uploads/qrcodes/${fileName}`;
    }

    // Ensure that only Zelle accounts have an email.
    if (type !== 'Zelle') {
        accountEmail = null;
    }

    try {
        const query = `
            INSERT INTO payment_accounts 
            (name, type, dailyLimit, prefix_order_name, currentVolume, status, websiteUrl, accountEmail, qrCodeUrl) 
            VALUES (?, ?, ?, ?, 0, 'Active', ?, ?, ?)
        `;
        const params = [name, type, Number(dailyLimit), prefix_order_name, websiteUrl, accountEmail, qrCodeUrl];
        const result: any = await runQuery(query, params);
        
        const newAccount = { id: `pa_${result.id}`, ...body, qrCodeUrl };
        delete newAccount.qrCode; // Don't send back the base64 data
        return NextResponse.json(newAccount, { status: 201 });
    } catch (error: any) {
        console.error("Failed to create payment account in DB:", error);
        return NextResponse.json({ message: `Failed to create payment account in DB: ${error.message}` }, { status: 500 });
    }
  } catch (error: any) {
      console.error("Failed to create payment account:", error);
      return NextResponse.json({ message: `Failed to create payment account: ${error.message}` }, { status: 500 });
  }
}
