
/**
 * @fileOverview Square Webhook Handler
 *
 * This endpoint listens for events from Square and processes them.
 * It's crucial for confirming payments and other asynchronous events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiError, Client, Environment } from 'square/legacy';
import crypto from 'crypto';
import { executeQuery, runQuery } from '@/lib/db';
import { sendOrderNotification } from '@/app/actions/send-order-notification';
import type { Order, PaymentAccount } from '@/lib/types';


/**
 * Verifies the webhook signature from Square.
 * @param signature The 'x-square-signature' header value.
 * @param body The raw request body.
 * @param url The full URL of the request.
 * @returns True if the signature is valid, false otherwise.
 */
function isWebhookSignatureValid(signature: string, body: string, url: string, key: string): boolean {
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(url + body);
  const hash = hmac.digest('base64');
  return hash === signature;
}


async function getOrderDetails(orderId: string) {
    const orderResults: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (orderResults.length === 0) return null;
    const order = orderResults[0];

    const merchantResults: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [order.merchantId]);
     if (merchantResults.length === 0) return null;

    return { order, merchant: merchantResults[0] };
}


export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-square-signature');
  const body = await req.text();
  const url = req.url;
  
  const event = JSON.parse(body);
  console.log("🚀 [Square Webhook] Received event:", { type: event.type, id: event.id });
  const payment = event.data?.object?.payment;

  // Use the `note` field which we populated with our internal ID
  const comfortPayOrderIdWithPrefix = payment?.note;
  if (!comfortPayOrderIdWithPrefix) {
      console.warn(`[Square Webhook] Warning: No comfortPayOrderId found in payment note for Square Payment ID ${payment?.id}. Cannot process.`);
      // We return 200 to Square to acknowledge receipt and prevent retries for events we can't handle.
      return NextResponse.json({ received: true });
  }
  console.log(`[Square Webhook] Found ComfortPay Order ID in note: ${comfortPayOrderIdWithPrefix}`);


  const numericOrderId = comfortPayOrderIdWithPrefix.replace('CP', '');
  const orderResult: any[] = await executeQuery("SELECT paymentAccountId FROM orders WHERE id = ?", [numericOrderId]);

  if (orderResult.length === 0) {
      console.error(`❌ [Square Webhook] Error: Could not find an order with ID ${comfortPayOrderIdWithPrefix}.`);
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  
  const paymentAccountId = orderResult[0].paymentAccountId; // This is the numeric ID, e.g., 3
  if (!paymentAccountId) {
      console.error(`❌ [Square Webhook] Error: Order ${comfortPayOrderIdWithPrefix} is not associated with a payment account.`);
      return NextResponse.json({ error: 'Internal configuration error.' }, { status: 500 });
  }
  
  // Use the Payment Account ID to get the correct webhook secret.
  const webhookSignatureKey = process.env[`SQUARE_WEBHOOK_SIGNATURE_KEY_${paymentAccountId}`];

  if (!webhookSignatureKey) {
     console.error(`❌ [Square Webhook] Error: No signature key found for payment account ID: ${paymentAccountId}. Make sure the SQUARE_WEBHOOK_SIGNATURE_KEY_${paymentAccountId} environment variable is set.`);
     return NextResponse.json({ error: 'Webhook configuration error on server.' }, { status: 500 });
  }

  if (!signature || !isWebhookSignatureValid(signature, body, url, webhookSignatureKey)) {
    console.error('❌ [Square Webhook] Error: Invalid signature');
    return NextResponse.json({ error: 'Webhook Error: Invalid signature' }, { status: 401 });
  }

  console.log('✅ [Square Webhook] Signature verified.');

  try {
    // Handle the event
    switch (event.type) {
      case 'payment.updated':
        if (payment.status === 'COMPLETED') {
            console.log(`[Square Webhook] Processing COMPLETED payment.updated event for Square payment: ${payment.id}`);
            
            const updates: any[] = ['Completed', payment.id, new Date().toISOString().slice(0, 19).replace('T', ' ')];
            let updateQuery = `UPDATE orders SET status = ?, paymentGatewayTransactionId = ?, paymentReceivedDate = ?`;

            if (payment.riskEvaluation) {
                console.log("🔍 [Square Webhook] Found Risk Evaluation:", payment.riskEvaluation);
                updateQuery += `, riskDetails = ?`;
                updates.push(JSON.stringify(payment.riskEvaluation));
            }

            updateQuery += ` WHERE id = ?`;
            updates.push(numericOrderId);
            
            // Update order in DB
            const dbResult = await runQuery(updateQuery, updates);
            console.log("[Square Webhook] Database update result:", dbResult);


            // Fetch order and merchant details to send emails
            const details = await getOrderDetails(numericOrderId);
            if (details) {
                const { order, merchant } = details;
                // Send notifications (don't block the response for this)
                 Promise.all([
                    sendOrderNotification({ recipientType: 'customer', customerEmail: order.customerEmail, merchantName: merchant.name, orderDetails: order, items: order.items }),
                    sendOrderNotification({ recipientType: 'merchant', merchantEmail: merchant.email, merchantName: merchant.name, orderDetails: order, items: order.items })
                ]).catch(err => console.error("Webhook email notification failed:", err));
                console.log("[Square Webhook] Triggered customer and merchant email notifications.");
            }

            console.log(`✅ [Square Webhook] Order ${comfortPayOrderIdWithPrefix} status updated to 'Completed'.`);

        } else if (payment.status === 'FAILED') {
             console.log(`❌ [Square Webhook] Payment failed for Square Payment ID: ${payment.id}`);
             // You could also update your internal order status to 'Failed' here.
        }
        break;
      
      default:
        console.warn(`🤷‍♀️ [Square Webhook] Unhandled Square event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true });
  } catch (err: any) {
     console.error(`❌ [Square Webhook] Error: ${err.message}`);
     if (err instanceof ApiError) {
        console.error(err.errors);
     }
    return NextResponse.json({ error: `Webhook processing error: ${err.message}` }, { status: 500 });
  }
}
