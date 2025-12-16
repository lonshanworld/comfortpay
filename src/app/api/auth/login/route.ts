import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { comparePassword, hashPassword } from '@/lib/password-service';
import { signSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, role } = body || {};
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'email, password and role are required' }, { status: 400 });
    }

    // Handle super admin bootstrap
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (role === 'Admin' && email === superAdminEmail) {
      const users: any[] = await executeQuery("SELECT * FROM users WHERE email = ? AND role = 'Admin'", [email]);
      let user = users[0];
      if (!user) {
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (!superAdminPassword) return NextResponse.json({ error: 'Super admin not configured' }, { status: 500 });
        const hashed = await hashPassword(superAdminPassword);
        const now = new Date().toISOString();
        const res: any = await executeQuery("INSERT INTO users (name,email,password,role,createdAt,status,dateJoined) VALUES (?, ?, ?, 'Admin', ?, 'Active', ?)", ['Admin User', email, hashed, now, now]);
        user = { id: res.insertId || res.id, email, role: 'Admin' };
      }
      const passwordMatch = await comparePassword(password, user.password);
      if (!passwordMatch) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

      const token = signSession({ id: `user_${user.id}`, role: user.role }, '8h');
      const res = NextResponse.json({ success: true });
      res.cookies.set('cp_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
      return res;
    }

    // Standard user login
    const users: any[] = await executeQuery("SELECT * FROM users WHERE email = ? AND role = ?", [email, role]);
    if (!users || users.length === 0) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const user = users[0];
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = signSession({ id: `user_${user.id}`, role: user.role }, '8h');
    const resp = NextResponse.json({ success: true });
    resp.cookies.set('cp_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    return resp;
  } catch (err: any) {
    console.error('[API /auth/login] error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
