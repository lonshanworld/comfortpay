import { NextResponse, NextRequest } from 'next/server';
import { verifySession } from './src/lib/auth-edge';
import { isAllowed } from './src/lib/rate-limiter';
// Note: IP blacklist uses Redis (Node.js only), so we can't import it in Edge runtime
// For production, use Nginx or Cloudflare to ban IPs at the network level

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limit API routes by IP
  if (pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for') || req.ip || req.headers.get('x-real-ip') || 'unknown';
    
    // Note: For IP blacklisting in production, use:
    // - Cloudflare WAF rules (best)
    // - Nginx deny directives (good)
    // - UFW firewall on VPS (for persistent bans)
    
    const allowed = isAllowed(`api:${ip}`, 120, 60_000);
    if (!allowed) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Protect admin UI routes
  if (pathname.startsWith('/admin')) {
    const cookie = req.cookies.get('cp_session')?.value;
    if (!cookie) {
      const loginUrl = new URL('/login/admin', req.url);
      return NextResponse.redirect(loginUrl);
    }
    try {
      const payload = await verifySession(cookie);
      if (!payload || payload.role !== 'Admin') {
        const loginUrl = new URL('/login/admin', req.url);
        return NextResponse.redirect(loginUrl);
      }
      // allow
    } catch (err) {
      const loginUrl = new URL('/login/admin', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*'],
};
