
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';

const parseDbUser = (dbUser: any) => {
    if (!dbUser) return null;
    const user = { ...dbUser };
    user.id = `user_${user.id}`;
    // Safely parse JSON fields
    try { user.permissions = JSON.parse(user.permissions || '{}'); } catch (e) { user.permissions = {}; }
    return user;
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  try {
    let query = "SELECT id, name, email, role, createdAt, status, permissions FROM users";
    const params: string[] = [];
    
    // Filter by role, but exclude 'Merchant' role as they are handled by the '/api/merchants' endpoint
    if (role && role !== 'all') {
      if (role === 'Merchant') {
         // This case should be handled by the frontend calling /api/merchants, but as a safeguard:
         query += " WHERE role = 'Merchant'";
      } else {
        query += " WHERE role = ?";
        params.push(role);
      }
    } else {
      // 'all' tab should fetch all non-merchant users
      query += " WHERE role != 'Merchant'";
    }

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
    const query = `
      INSERT INTO users 
      (name, email, password, role, createdAt, status, permissions) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        name, email, password, role, new Date().toISOString(), status, 
        permissions ? JSON.stringify(permissions) : JSON.stringify({})
    ];
    const result: any = await runQuery(query, params);
    
    const newUser = { id: `user_${result.id}`, ...body, createdAt: new Date().toISOString() };
    delete newUser.password;
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
     console.error("Failed to create user in DB:", error);
    return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
  }
}
