
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateStatusInputSchema = z.object({
  siteUrl: z.string().url(),
  payload: z.object({
    order_id: z.string(),
    status: z.string(),
    note: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  // 1. Authenticate the request from our own backend
  const authHeader = request.headers.get('authorization');
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
    console.error("❌ [API /woocommerce/update-order-status] Authentication failed: Invalid internal token.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate the incoming request body
  const body = await request.json();
  const validation = UpdateStatusInputSchema.safeParse(body);
  if (!validation.success) {
    console.error("❌ [API /woocommerce/update-order-status] Invalid request body:", validation.error.flatten());
    return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
  }

  const { siteUrl, payload } = validation.data;
  const wooCommerceApiUrl = `${siteUrl}/wp-json/comfortpay/v1/update-status`;
  
  console.log(`📞 [API /woocommerce/update-order-status] Forwarding request to: ${wooCommerceApiUrl}`);
  
  try {
    const wooResponse = await fetch(wooCommerceApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WOOCOMMERCE_WEBHOOK_SECRET}`
        },
        body: JSON.stringify(payload)
    });

    if (!wooResponse.ok) {
        const errorData = await wooResponse.json();
        const errorMessage = errorData.message || `WooCommerce API responded with status ${wooResponse.status}`;
        console.error(`❌ [API /woocommerce/update-order-status] Error from WooCommerce site:`, errorMessage);
        return NextResponse.json({ message: 'Failed to update status on WooCommerce site.', error: errorMessage }, { status: wooResponse.status });
    }

    const responseData = await wooResponse.json();
    console.log(`✅ [API /woocommerce/update-order-status] Successfully updated status on WooCommerce. Response:`, responseData);
    return NextResponse.json({ success: true, message: 'WooCommerce order status updated.', response: responseData });

  } catch (error: any) {
    console.error(`❌ [API /woocommerce/update-order-status] Unhandled error forwarding request:`, error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
