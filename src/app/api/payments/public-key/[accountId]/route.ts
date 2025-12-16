
import { NextResponse, NextRequest } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await context.params;
  const numericId = accountId.replace('pa_', '');

  try {
    const accounts: any[] = await executeQuery("SELECT type FROM payment_accounts WHERE id = ?", [numericId]);

    if (accounts.length === 0) {
      return NextResponse.json({ message: 'Payment account not found' }, { status: 404 });
    }
    
    const accountType = accounts[0].type;
    
    if (accountType === 'Stripe') {
        const publicKey = process.env[`STRIPE_PUBLIC_KEY_${numericId}`];
         if (!publicKey) {
            console.error(`Stripe public key not configured for account ${numericId}. Env var STRIPE_PUBLIC_KEY_${numericId} not set.`);
            return NextResponse.json({ message: `Stripe public key not configured for this account.` }, { status: 500 });
        }
        return NextResponse.json({ publicKey });

    } else if (accountType === 'Square') {
        const applicationId = process.env[`SQUARE_APP_ID_${numericId}`];
        const locationId = process.env[`SQUARE_LOCATION_ID_${numericId}`];

        if (!applicationId || !locationId) {
             console.error(`Square application or location ID not configured for account ${numericId}. Env vars SQUARE_APP_ID_${numericId} or SQUARE_LOCATION_ID_${numericId} not set.`);
            return NextResponse.json({ message: 'Square Application ID or Location ID not configured for this account.' }, { status: 500 });
        }
        return NextResponse.json({ applicationId, locationId });
    }

    return NextResponse.json({ message: 'This payment provider does not require a public key.' }, { status: 400 });

  } catch (error) {
    console.error(`Failed to fetch public key for account ${accountId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
