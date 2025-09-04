
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { User } from '@/lib/types';

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
      ? JSON.parse(merchant.paymentGatewayFees) 
      : merchant.paymentGatewayFees;
      
    // Determine if card payments are enabled by checking if Stripe or Square are enabled.
    const cardEnabled = !!(gatewayFees?.stripe?.enabled || gatewayFees?.square?.enabled);
    const zelleEnabled = !!gatewayFees?.zelle?.enabled;

    const enabledGateways = {
        card: cardEnabled,
        zelle: zelleEnabled,
    };

    return NextResponse.json(enabledGateways);

  } catch (error: any) {
    console.error("API Error: /api/merchants/gateways", error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
