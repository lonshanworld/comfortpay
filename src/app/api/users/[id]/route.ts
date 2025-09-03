
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';


// Helper to save a base64 encoded file and return its public URL
const saveQrCodeFromBase64 = async (base64String: string): Promise<string | null> => {
    if (!base64String || !base64String.startsWith('data:')) return null;

    try {
        const base64Data = base64String.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileExtension = base64String.substring(base64String.indexOf('/') + 1, base64String.indexOf(';'));
        const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
        
        // Use environment variable for base path. It MUST be set in production.
        const baseUploadDir = process.env.UPLOADS_DIR;
        if (!baseUploadDir) {
            console.error("UPLOADS_DIR environment variable is not set. Cannot save file.");
            throw new Error("File upload directory is not configured on the server.");
        }
        
        const uploadDir = path.join(baseUploadDir, 'qrcodes');
        
        await fs.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, imageBuffer);
        return `/uploads/qrcodes/${fileName}`;
    } catch (error) {
        console.error('Error saving QR code from Base64:', error);
        return null;
    }
};


export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const numericId = id.split('_')[1];
  const body = await request.json();

  try {
    const { name, status, dailyLimit, prefix_order_name, websiteUrl, accountEmail, qrCode, type } = body;

    let qrCodeUrl = undefined;
    if (qrCode) {
        qrCodeUrl = await saveQrCodeFromBase64(qrCode);
    }
    
    // Build query dynamically
    let query = "UPDATE payment_accounts SET ";
    const params: any[] = [];
    const fieldsToUpdate: string[] = [];

    const updateField = (fieldName: string, value: any, isSet: boolean) => {
        if (isSet) {
            let finalValue = value;
            // Specifically handle accountEmail to convert empty string to NULL
            if (fieldName === 'accountEmail' && value === '') {
                finalValue = null;
            }
            fieldsToUpdate.push(`${fieldName} = ?`);
            params.push(finalValue);
        }
    };

    updateField('name', name, 'name' in body);
    updateField('status', status, 'status' in body);
    updateField('dailyLimit', Number(dailyLimit), 'dailyLimit' in body);
    updateField('prefix_order_name', prefix_order_name, 'prefix_order_name' in body);
    updateField('websiteUrl', websiteUrl, 'websiteUrl' in body);
    
    // Only update accountEmail if it's a Zelle account. Otherwise, ensure it's null.
    if (type === 'Zelle') {
        updateField('accountEmail', accountEmail, 'accountEmail' in body);
    } else {
        updateField('accountEmail', null, true); // Force to null if not Zelle
    }

    updateField('qrCodeUrl', qrCodeUrl, 'qrCode' in body);
    
    if (fieldsToUpdate.length === 0) {
        return NextResponse.json({ message: "No fields to update." }, { status: 400 });
    }

    query += fieldsToUpdate.join(', ') + " WHERE id = ?";
    params.push(numericId);

    const result = await runQuery(query, params);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Payment account not found' }, { status: 404 });
    }

    return NextResponse.json({ id: id, ...body });
  } catch (error) {
    console.error(`Failed to update payment account ${id}:`, error);
    return NextResponse.json({ message: 'Error updating payment account' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const numericId = id.split('_')[1];

  try {
    const result = await runQuery("DELETE FROM payment_accounts WHERE id = ?", [numericId]);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Payment account not found' }, { status: 404 });
    }

    return new Response(null, { status: 204 }); // Success, no content
  } catch (error) {
    console.error(`Failed to delete payment account ${id}:`, error);
    return NextResponse.json({ message: 'Error deleting payment account' }, { status: 500 });
  }
}
