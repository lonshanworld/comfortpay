// src/app/api/plugin/orders/route.ts
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { findUserByApiToken } from '@/lib/auth-server';
import { extractRequestHost, merchantHostFromUrl, domainMatches } from '@/lib/verify-origin';

const parseDbOrder = (dbOrder: any) => {
  if (!dbOrder) return null;
  try {
    const billingDetails = typeof dbOrder.billingDetails === 'string' 
      ? JSON.parse(dbOrder.billingDetails) 
      : dbOrder.billingDetails;

    return {
      ...dbOrder,
      id: `CP${dbOrder.id}`,
      merchantId: `user_${dbOrder.merchantId}`,
      paymentAccountId: dbOrder.paymentAccountId ? `pa_${dbOrder.paymentAccountId}` : null,
      billingDetails: billingDetails || null,
      customerFirstName: billingDetails?.firstName || '',
      customerLastName: billingDetails?.lastName || '',
      customerEmail: billingDetails?.email || dbOrder.customerEmail,
      customerPhone: billingDetails?.phone || '',
    };
  } catch(e) {
    console.error(`[Plugin API] Failed to parse billing details for order ${dbOrder.id}`, e);
    return {
      ...dbOrder,
      id: `CP${dbOrder.id}`,
      merchantId: `user_${dbOrder.merchantId}`,
      paymentAccountId: dbOrder.paymentAccountId ? `pa_${dbOrder.paymentAccountId}` : null,
      billingDetails: null,
      customerFirstName: '',
      customerLastName: '',
      customerEmail: dbOrder.customerEmail,
      customerPhone: '',
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  console.log('[Plugin API] GET /api/plugin/orders');

  // Extract merchant authentication - no apiToken means unauthorized
  const merchantOrderId = searchParams.get('merchantOrderId');
  const wooCommerceSiteUrl = searchParams.get('wooCommerceSiteUrl');

  if (!merchantOrderId || !wooCommerceSiteUrl) {
    return NextResponse.json({ 
      error: 'merchantOrderId and wooCommerceSiteUrl are required' 
    }, { status: 400 });
  }

  try {
    // Verify domain matches the wooCommerceSiteUrl
    const reqHost = extractRequestHost(request);
    const siteHost = merchantHostFromUrl(wooCommerceSiteUrl);
    const match = domainMatches(reqHost, siteHost);
    
    if (!match.ok) {
      console.warn('[Plugin API] Domain mismatch', {
        requestHost: reqHost,
        siteHost: siteHost,
        reason: match.reason
      });
      return NextResponse.json({ error: 'Origin domain mismatch' }, { status: 403 });
    }

    // Query orders by merchantOrderId and wooCommerceSiteUrl
    const query = `
      SELECT 
        o.*, 
        DATE_FORMAT(o.orderDate, '%Y-%m-%dT%H:%i:%s.000Z') as orderDate,
        DATE_FORMAT(o.paymentReceivedDate, '%Y-%m-%dT%H:%i:%s.000Z') as paymentReceivedDate,
        u.name as merchantName, 
        u.websiteUrl as merchantWebsiteUrl,
        pa.accountEmail as paymentAccountEmail,
        pa.name as paymentAccountName,
        pa.accountEmail as paymentAccountZelleEmail
      FROM orders o
      LEFT JOIN users u ON o.merchantId = u.id AND u.role = 'Merchant'
      LEFT JOIN payment_accounts pa ON o.paymentAccountId = pa.id
      WHERE o.merchantOrderId = ? AND o.wooCommerceSiteUrl LIKE ?
      ORDER BY o.orderDate DESC 
      LIMIT 1
    `;

    const params = [merchantOrderId, `%${wooCommerceSiteUrl}%`];
    const dbOrders = await executeQuery(query, params);
    
    console.log(`[Plugin API] Fetched ${dbOrders.length} order(s) for merchantOrderId=${merchantOrderId}`);
    
    return NextResponse.json(dbOrders.map(parseDbOrder));

  } catch (error) {
    console.error('[Plugin API] Failed to fetch orders:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch orders', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
