
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';

const parseDbUser = (dbUser: any) => {
    if (!dbUser) return null;
    const user = { ...dbUser };
    user.id = `user_${user.id}`;
    // Safely parse JSON fields
    try { user.permissions = JSON.parse(user.permissions || '{}'); } catch (e) { user.permissions = {}; }
    try { user.settlementFees = JSON.parse(user.settlementFees || '{}'); } catch (e) { user.settlementFees = {}; }
    try { user.paymentGatewayFees = JSON.parse(user.paymentGatewayFees || '{}'); } catch (e) { user.paymentGatewayFees = {}; }
    try { user.commissionRates = JSON.parse(user.commissionRates || '{}'); } catch (e) { user.commissionRates = {}; }
    return user;
}


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
    const { id } = params;
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
  { params: { id } }: { params: { id:string } }
) {
    const numericId = id.split('_')[1];
    const body = await request.json();
    
    try {
        const fieldsToUpdate: string[] = [];
        const queryParams: any[] = [];

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
