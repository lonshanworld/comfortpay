
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password-service';


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

const parseDbUser = (dbUser: any) => {
    if (!dbUser) return null;
    const user = { ...dbUser };
    user.id = `user_${user.id}`;
    
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

    user.permissions = safeParseJson(user.permissions);
    
    return user;
}



export async function GET(
  request: Request,
   context: { params: { id: string } }
) {
    const { id } = await context.params;
    const numericId = id.split('_')[1];
    try {
        const results: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [numericId]);
        if (results.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        // Omit password before sending
        const { password, ...userWithoutPassword } = results[0];
        return NextResponse.json(parseDbUser(userWithoutPassword));
    } catch (error) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
}


export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
    const { id } = params;
    const numericId = id.split('_')[1];
    const body = await request.json();
    
    try {
        const fieldsToUpdate: string[] = [];
        const queryParams: any[] = [];
        
        // Handle password separately
        if (body.password) {
            const hashedPassword = await hashPassword(body.password);
            fieldsToUpdate.push('password = ?');
            queryParams.push(hashedPassword);
            delete body.password; // remove from body to not process it again
        }

        for (const key in body) {
            if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
                if (key === 'id') continue; // Do not update the ID

                // For object fields, stringify them
                if (typeof body[key] === 'object' && body[key] !== null) {
                    fieldsToUpdate.push(`${key} = ?`);
                    queryParams.push(JSON.stringify(body[key]));
                } else {
                    fieldsToUpdate.push(`${key} = ?`);
                    queryParams.push(body[key]);
                }
            }
        }
        
        if (fieldsToUpdate.length === 0) {
            return NextResponse.json({ message: "No fields to update" }, { status: 400 });
        }

        let query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        queryParams.push(numericId);
        
        const result: any = await runQuery(query, queryParams);

        if (result.changes === 0) {
            return NextResponse.json({ message: 'User not found or no changes made' }, { status: 404 });
        }
        
        return NextResponse.json({ id, ...body });

    } catch (error) {
        console.error(`Failed to update user ${id}:`, error);
        return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
    const { id } = params;
    const numericId = id.split('_')[1];
    try {
        const result: any = await runQuery("DELETE FROM users WHERE id = ?", [numericId]);
        if (result.changes === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Failed to delete user ${id}:`, error);
        return NextResponse.json({ message: 'Failed to delete user' }, { status: 500 });
    }
}
