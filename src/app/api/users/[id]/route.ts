
import { NextResponse } from 'next/server';
import { initialUsers } from '@/lib/in-memory-db';
import { executeQuery, runQuery } from '@/lib/db';

let users = initialUsers;

const parseDbUser = (dbUser: any) => {
    if (!dbUser) return null;
    return {
        ...dbUser,
        id: `user_${dbUser.id}`,
    }
}


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
    const { id } = params;
    const numericId = id.split('_')[1];
    try {
        const results: any[] = await executeQuery("SELECT id, name, email, role, createdAt, status, permissions FROM users WHERE id = ?", [numericId]);
        if (results.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        return NextResponse.json(parseDbUser(results[0]));
    } catch (error) {
        // Fallback to in-memory
        const user = users.find(u => u.id === id);
        if (user) {
            const { password, ...userWithoutPassword } = user;
            return NextResponse.json(userWithoutPassword);
        }
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
}

export async function PUT(
  request: Request,
  { params: { id } }: { params: { id:string } }
) {
    const numericId = id.split('_')[1];
    const body = await request.json();
    const { name, email, password, role, status, permissions } = body;

    try {
        let query = "UPDATE users SET";
        const queryParams: any[] = [];
        const fieldsToUpdate: string[] = [];

        if (name !== undefined) {
            fieldsToUpdate.push("name = ?");
            queryParams.push(name);
        }
        if (email !== undefined) {
            fieldsToUpdate.push("email = ?");
            queryParams.push(email);
        }
        if (role !== undefined) {
            fieldsToUpdate.push("role = ?");
            queryParams.push(role);
        }
        if (status !== undefined) {
            fieldsToUpdate.push("status = ?");
            queryParams.push(status);
        }
        if (permissions !== undefined) {
            fieldsToUpdate.push("permissions = ?");
            queryParams.push(permissions);
        }
        if (password) {
            fieldsToUpdate.push("password = ?");
            queryParams.push(password); // Remember to hash the password
        }

        if (fieldsToUpdate.length === 0) {
            return NextResponse.json({ message: "No fields to update" }, { status: 400 });
        }

        query += ` ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        queryParams.push(numericId);
        
        const result: any = await runQuery(query, queryParams);

        if (result.changes === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        
        return NextResponse.json({ id, ...body });

    } catch (error) {
        console.error(`Failed to update user ${id}:`, error);
        // In-memory fallback
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index] = { ...users[index], ...body };
            const { password, ...updatedUser } = users[index];
            return NextResponse.json(updatedUser);
        }
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
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
        // In-memory fallback
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users.splice(index, 1);
            return new Response(null, { status: 204 });
        }
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
}
