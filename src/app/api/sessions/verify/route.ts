import { NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body?.token;

    if (!token) {
      return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
    }

    const signingKey = process.env.SESSION_SIGNING_KEY;
    if (!signingKey) {
      console.error('❌ [API /sessions/verify] SESSION_SIGNING_KEY is not configured.');
      return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
    }

    try {
      const payload = jwt.verify(token, signingKey, { algorithms: ['HS256'] });
      return NextResponse.json({ success: true, payload });
    } catch (err: any) {
      console.error('❌ [API /sessions/verify] Token verification failed:', err?.message || err);
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }
  } catch (err: any) {
    console.error('❌ [API /sessions/verify] Error processing request:', err?.message || err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
