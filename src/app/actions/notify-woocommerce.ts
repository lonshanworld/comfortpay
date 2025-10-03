
'use server';

import { executeQuery } from '@/lib/db';
import type { Order, User } from '@/lib/types';
import { z } from 'zod';

const UpdateStatusInputSchema = z.object({
  siteUrl: z.string().url(),
  payload: z.object({
    order_id: z.string(),
    status: z.string(),
    note: z.string().optional(),
  }),
});

async function sendStatusUpdate(siteUrl: string, apiToken: string, payload: object) {
  const wooCommerceApiUrl = `${siteUrl}/wp-json/comfortpay/v1/update-status`;
  
  console.log(`📞 [Action sendStatusUpdate] Preparing to send status update.`);
  console.log(`   - Target URL: ${wooCommerceApiUrl}`);
  console.log(`   - Payload:`, payload);

  try {
    const wooResponse = await fetch(wooCommerceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use the specific merchant's API token for authentication
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(payload)
    });

    const responseBodyText = await wooResponse.text();

    if (!wooResponse.ok) {
      console.error(`❌ [Action sendStatusUpdate] WooCommerce API responded with status ${wooResponse.status}. Body:`, responseBodyText);
      const errorMessage = JSON.parse(responseBodyText).message || `WooCommerce API call failed.`;
      throw new Error(errorMessage);
    }
    
    const responseData = JSON.parse(responseBodyText);
    console.log(`✅ [Action sendStatusUpdate] Successfully updated status on WooCommerce. Response:`, responseData);
    return { success: true, message: 'WooCommerce order status updated.' };

  } catch (error: any) {
    console.error(`❌ [Action sendStatusUpdate] Error sending status update to ${siteUrl}:`, error.message);
    // Don't re-throw to avoid crashing the calling process. Log the failure.
    return { success: false, message: error.message };
  }
}

export async function notifyWooCommerce(order: Order, newStatus: 'Completed' | 'Partially Paid') {
  console.log(`[Action notifyWooCommerce] Initiating notification for Order ID: ${order.id}`);

  if (!order.wooCommerceSiteUrl || !order.merchantOrderId) {
    console.warn(`[Action notifyWooCommerce] Skipping: Missing site URL or merchant order ID.`);
    return;
  }
  console.log('check order first before split', order);
  const numericMerchantId = String(order.merchantId).replace('user_', '');
  if (!numericMerchantId) {
    console.error(`[Action notifyWooCommerce] Skipping: Invalid merchant ID format.`);
    return;
  }

  // 1. Fetch the merchant's API token from the database
  let merchant: User;
  try {
      const merchantResult: any[] = await executeQuery("SELECT token FROM users WHERE id = ? AND role = 'Merchant'", [numericMerchantId]);
      if (merchantResult.length === 0 || !merchantResult[0].token) {
          console.error(`[Action notifyWooCommerce] Skipping: Could not find merchant or API token for ID ${numericMerchantId}.`);
          return;
      }
      merchant = merchantResult[0];
      console.log(`   - Step 1: Successfully fetched API token for merchant ${numericMerchantId}.`);
  } catch (error: any) {
      console.error(`[Action notifyWooCommerce] Skipping: Database error fetching merchant token.`, error.message);
      return;
  }

    const statusForWoo = newStatus === 'Completed' ? 'processing' : 'on-hold';


  // 2. Prepare the payload
  const payload = {
    order_id: order.merchantOrderId,
    status: statusForWoo, // e.g., 'completed'
    note: `Payment confirmed via Zelle by ComfortPay. ComfortPay ID: ${order.id}.`,
  };
  console.log(`   - Step 2: Payload prepared.`);

  // 3. Validate the full input before sending
  const validation = UpdateStatusInputSchema.safeParse({ siteUrl: order.wooCommerceSiteUrl, payload });
  if (!validation.success) {
      console.error(`[Action notifyWooCommerce] Skipping: Invalid data for notification.`, validation.error.flatten());
      return;
  }
  console.log(`   - Step 3: Data validation passed.`);

  // 4. Fire and forget the secure status update
  console.log(`   - Step 4: Dispatching sendStatusUpdate.`);
  const checkresult = await sendStatusUpdate(validation.data.siteUrl, merchant.token!, validation.data.payload);
  console.log(`   - Step 5: sendStatusUpdate completed with result:`, checkresult);
  return;
}
