
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { User } from '@/lib/types';

// This endpoint now checks merchant-level daily limits and disables gateways when limits reached.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiToken = searchParams.get('apiToken');

  if (!apiToken) {
    return NextResponse.json({ error: 'API token is required.' }, { status: 400 });
  }

  try {
    const merchantResult: any[] = await executeQuery(
      "SELECT paymentGatewayFees FROM users WHERE token = ? AND role = 'Merchant'", 
      [apiToken]
    );

    if (merchantResult.length === 0) {
      return NextResponse.json({ error: 'Authentication failed: Invalid API token.' }, { status: 401 });
    }

    const merchant: User = merchantResult[0];
    const gatewayFees = typeof merchant.paymentGatewayFees === 'string' 
      ? JSON.parse(merchant.paymentGatewayFees || '{}') 
      : (merchant.paymentGatewayFees || {});
      
    // Determine if card payments are enabled by checking if Stripe or Square are enabled.
    const cardEnabled = !!(gatewayFees?.stripe?.enabled || gatewayFees?.square?.enabled);
    const zelleEnabled = !!gatewayFees?.zelle?.enabled;
    const interacEnabled = !!gatewayFees?.interac?.enabled;
    const wiseEnabled = !!gatewayFees?.wise?.enabled;

    // Fetch any merchant-level daily limits and current usage
    try {
      const limitRows: any[] = await executeQuery(
        "SELECT paymentType, dailyLimit, dailyUsed FROM merchant_daily_limits WHERE merchantId = ?",
        [merchant.id]
      );

      const limitMap: Record<string, { dailyLimit: number | null; dailyUsed: number }> = {};
      for (const r of limitRows) {
        limitMap[r.paymentType] = { dailyLimit: r.dailyLimit, dailyUsed: r.dailyUsed };
      }

      // Apply limit checks per payment type
      let stripeEnabledAfterLimit = !!gatewayFees?.stripe?.enabled;
      let squareEnabledAfterLimit = !!gatewayFees?.square?.enabled;
      let zelleEnabledAfterLimit = !!gatewayFees?.zelle?.enabled;
      let interacEnabledAfterLimit = !!gatewayFees?.interac?.enabled;
      let wiseEnabledAfterLimit = !!gatewayFees?.wise?.enabled;

      const checkAndDisable = (type: string, enabledFlag: boolean) => {
        if (!enabledFlag) return false;
        const limits = limitMap[type];
        if (!limits) return true; // no limit set => allowed
        if (limits.dailyLimit === null) return true; // unlimited
        // If dailyUsed is greater than or equal to limit, disable
        if (Number(limits.dailyUsed) >= Number(limits.dailyLimit)) return false;
        return true;
      };

      stripeEnabledAfterLimit = checkAndDisable('stripe', stripeEnabledAfterLimit);
      squareEnabledAfterLimit = checkAndDisable('square', squareEnabledAfterLimit);
      zelleEnabledAfterLimit = checkAndDisable('zelle', zelleEnabledAfterLimit);
      interacEnabledAfterLimit = checkAndDisable('interac', interacEnabledAfterLimit);
      wiseEnabledAfterLimit = checkAndDisable('wise', wiseEnabledAfterLimit);

      const cardAfter = stripeEnabledAfterLimit || squareEnabledAfterLimit;

      const enabledGateways = {
        card: cardAfter,
        zelle: zelleEnabledAfterLimit,
        interac: interacEnabledAfterLimit,
        wise: wiseEnabledAfterLimit,
      };

      console.log('Enabled gateways after applying merchant daily limits:', enabledGateways);
      return NextResponse.json(enabledGateways);
    } catch (err) {
      console.error('Error while applying merchant daily limits:', err);
      // Fallback to previously computed enabledGateways without limit checks
      const enabledGateways = {
        card: cardEnabled,
        zelle: zelleEnabled,
        interac: interacEnabled,
        wise: wiseEnabled,
      };
      return NextResponse.json(enabledGateways);
    }

  } catch (error: any) {
    console.error("API Error: /api/merchants/gateways", error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
