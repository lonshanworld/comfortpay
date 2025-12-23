// src/app/api/plugin/gateways/route.ts
import { NextResponse } from 'next/server';
import { findUserByApiToken } from '@/lib/auth-server';
import { extractRequestHost, merchantHostFromUrl, domainMatches } from '@/lib/verify-origin';
import { executeQuery } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Prefer Authorization header but support legacy query param
  const authHeader = request.headers.get('authorization');
  let apiTokenFromHeader: string | undefined = undefined;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    apiTokenFromHeader = authHeader.slice(7).trim();
  }

  const apiToken = apiTokenFromHeader || searchParams.get('apiToken');

  if (!apiToken) {
    return NextResponse.json({ error: 'API token is required.' }, { status: 400 });
  }

  try {
    // Authenticate merchant
    const merchant = await findUserByApiToken(apiToken);
    if (!merchant || merchant.role !== 'Merchant') {
      return NextResponse.json({ error: 'Authentication failed: Invalid API token.' }, { status: 401 });
    }

    // Verify domain matches merchant's websiteUrl. If the request used a
    // bearer API token (server-to-server plugin auth), skip the origin check
    // because server-side requests won't include a browser Origin header.
    const reqHost = extractRequestHost(request);
    const mHost = merchantHostFromUrl(merchant.websiteUrl);

    const usedBearerToken = !!apiTokenFromHeader;
    if (usedBearerToken) {
      // For server-to-server calls authenticated with a Bearer token, require
      // an explicit X-Merchant-Site header that indicates the merchant's site.
      // This prevents unauthenticated callers from spoofing merchant identity.
      const xMerchantSite = request.headers.get('x-merchant-site') || request.headers.get('x-merchant-url');
      if (!xMerchantSite) {
        console.warn('[Plugin API] Missing X-Merchant-Site header on bearer request', { merchantId: merchant.id });
        return NextResponse.json({ error: 'Missing X-Merchant-Site header' }, { status: 400 });
      }

      const reportedHost = merchantHostFromUrl(xMerchantSite);
      if (!reportedHost) {
        console.warn('[Plugin API] Invalid X-Merchant-Site header value', { merchantId: merchant.id, xMerchantSite });
        return NextResponse.json({ error: 'Invalid X-Merchant-Site header' }, { status: 400 });
      }

      // Verify reported merchant host matches the merchant record tied to the token
      if (reportedHost !== mHost) {
        console.warn('[Plugin API] Merchant site header does not match token owner', {
          merchantId: merchant.id,
          reportedHost,
          merchantHost: mHost
        });
        return NextResponse.json({ error: 'Merchant site mismatch' }, { status: 403 });
      }

      console.info('[Plugin API] Bearer token + X-Merchant-Site validated', { merchantId: merchant.id, reportedHost });
    } else {
      const match = domainMatches(reqHost, mHost);
      if (!match.ok) {
        console.warn('[Plugin API] Domain mismatch', {
          merchantId: merchant.id,
          requestHost: reqHost,
          merchantHost: mHost,
          reason: match.reason
        });
        return NextResponse.json({ error: 'Origin domain mismatch' }, { status: 403 });
      }
    }

    // Return gateway availability
    const gatewayFees = typeof merchant.paymentGatewayFees === 'string'
      ? JSON.parse(merchant.paymentGatewayFees)
      : merchant.paymentGatewayFees;

    const cardEnabled = !!(gatewayFees?.stripe?.enabled || gatewayFees?.square?.enabled);
    const zelleEnabled = !!gatewayFees?.zelle?.enabled;
    const interacEnabled = !!gatewayFees?.interac?.enabled;
    const wiseEnabled = !!gatewayFees?.wise?.enabled;

    // Default enabled map (will be adjusted by limits below)
    const enabledGateways: Record<string, boolean> = {
      card: cardEnabled,
      zelle: zelleEnabled,
      interac: interacEnabled,
      wise: wiseEnabled,
    };

    // Load per-merchant limits from `merchant_daily_limits` (preferred source)
    try {
      const rows: any[] = await executeQuery(
        `SELECT paymentType, dailyLimit, dailyUsed FROM merchant_daily_limits WHERE merchantId = ?`,
        [merchant.id]
      );

      const limitsMap: Record<string, { dailyLimit: number | null; dailyUsed: number }> = {};
      for (const r of rows) {
        const paymentTypeRaw = (r.paymentType || '').toString();
        const key = paymentTypeRaw.trim().toLowerCase() || 'merchant'; // 'merchant' for site-wide row
        const dailyLimit = r.dailyLimit === null ? null : Number(r.dailyLimit);
        const dailyUsed = Number(r.dailyUsed || 0);
        limitsMap[key] = { dailyLimit, dailyUsed };
      }

      // Helper to evaluate a gateway's allowed status using limitsMap
      const evaluateAllowed = (gatewayKey: string) => {
        // If gateway already disabled by settings, keep it disabled
        if (!enabledGateways[gatewayKey]) return false;

        // Exact gateway limit row (e.g., 'card','zelle','interac','wise')
        const gRow = limitsMap[gatewayKey];
        if (gRow && typeof gRow.dailyLimit === 'number') {
          return gRow.dailyUsed < gRow.dailyLimit;
        }

        // Fallback to a merchant-wide limit row (key 'merchant' or empty)
        const merchantRow = limitsMap['merchant'] || limitsMap[''];
        if (merchantRow && typeof merchantRow.dailyLimit === 'number') {
          return merchantRow.dailyUsed < merchantRow.dailyLimit;
        }

        // No limit configured -> allowed
        return true;
      };

      for (const k of Object.keys(enabledGateways)) {
        try {
          const allowed = evaluateAllowed(k);
          if (!allowed) {
            enabledGateways[k] = false;
            console.info('[Plugin API] Gateway disabled by merchant_daily_limits', { merchantId: merchant.id, gateway: k, row: limitsMap[k] || limitsMap['merchant'] });
          }
        } catch (e) {
          console.warn('[Plugin API] Error evaluating limit for gateway', { merchantId: merchant.id, gateway: k, err: e });
        }
      }
    } catch (e) {
      console.warn('[Plugin API] Could not load merchant_daily_limits; treating as unlimited', { merchantId: merchant.id, err: e });
      // If DB fails, keep service permissive (do not disable gateways)
    }

    return NextResponse.json(enabledGateways);

  } catch (error: any) {
    console.error('[Plugin API] Error: /api/plugin/gateways', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
