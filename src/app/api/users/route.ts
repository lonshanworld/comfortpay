
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { hashPassword } from '@/lib/password-service';
import { formatDateForMySQL } from '@/lib/utils';

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


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  try {
    let query = "SELECT * FROM users";
    const params: string[] = [];
    
    // If a specific role is requested (and it's not 'all'), filter by it.
    // Otherwise, fetch all users.
    if (role && role !== 'all') {
        query += " WHERE role = ?";
        params.push(role);
    }
    
    query += " ORDER BY createdAt DESC";

    const dbUsers = await executeQuery(query, params);
    return NextResponse.json(dbUsers.map(parseDbUser));
  } catch (error) {
    console.error("Failed to fetch users from DB:", error);
    return NextResponse.json({ message: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  
  try {
    const { name, email, password, role, status, permissions } = body;
    const hashedPassword = await hashPassword(password);
    const query = `
      INSERT INTO users 
      (name, email, password, role, createdAt, status, permissions, dateJoined) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const now = new Date();
    const params = [
        name, email, hashedPassword, role,  formatDateForMySQL(now), status, 
        permissions ? JSON.stringify(permissions) : JSON.stringify({}),
        formatDateForMySQL(now)
    ];
    const result: any = await runQuery(query, params);
    
    const newUser = { id: `user_${result.id}`, ...body, createdAt: now.toISOString() };
    delete newUser.password;
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
     console.error("Failed to create user in DB:", error);
    return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
  }
}
