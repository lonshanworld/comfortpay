import { NextRequest, NextResponse } from 'next/server';
import { isIPBlacklisted, blacklistIP, unblacklistIP, listBlacklistedIPs } from '@/lib/ip-blacklist';
import { runQuery } from '@/lib/db';

// Verify admin authentication
async function verifyAdmin(req: NextRequest) {
  const sessionCookie = req.cookies.get('session')?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(sessionCookie.split('.')[1], 'base64').toString());
    const users = await runQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.userId]);
    
    if (users.length > 0 && users[0].role === 'admin') {
      return users[0];
    }
  } catch {
    return null;
  }
  
  return null;
}

// GET /api/admin/blacklist - List all blacklisted IPs
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const blacklist = await listBlacklistedIPs();
    return NextResponse.json({ blacklist });
  } catch (error) {
    console.error('Failed to list blacklisted IPs:', error);
    return NextResponse.json({ error: 'Failed to fetch blacklist' }, { status: 500 });
  }
}

// POST /api/admin/blacklist - Ban an IP
// Body: { ip: string, duration?: number, reason?: string }
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ip, duration, reason } = body;

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    await blacklistIP(ip, duration, reason || `Manually banned by admin ${admin.email}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `IP ${ip} has been blacklisted`,
      duration: duration || 86400
    });
  } catch (error) {
    console.error('Failed to blacklist IP:', error);
    return NextResponse.json({ error: 'Failed to blacklist IP' }, { status: 500 });
  }
}

// DELETE /api/admin/blacklist - Unban an IP
// Body: { ip: string }
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ip } = body;

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    await unblacklistIP(ip);
    
    return NextResponse.json({ 
      success: true, 
      message: `IP ${ip} has been removed from blacklist`
    });
  } catch (error) {
    console.error('Failed to unblacklist IP:', error);
    return NextResponse.json({ error: 'Failed to unblacklist IP' }, { status: 500 });
  }
}
