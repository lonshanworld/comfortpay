
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

  // Extract the Square location ID from the event to fetch the correct signature key
  const locationId = event.data.object.payment.location_id;
  const webhookSignatureKey = process.env[`SQUARE_WEBHOOK_SIGNATURE_KEY_FOR_${locationId}`];

  if (!webhookSignatureKey) {
     console.error(`❌ Square Webhook Error: No signature key found for location_id: ${locationId}`);
     return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }

  if (!signature || !isWebhookSignatureValid(signature, body, url, webhookSignatureKey)) {
    console.error('❌ Square Webhook Error: Invalid signature');
    return NextResponse.json({ error: 'Webhook Error: Invalid signature' }, { status: 401 });
  }

  console.log('✅ Square signature verified.');

  try {
    // Handle the event
    switch (event.type) {
      case 'payment.updated':
        const payment = event.data.object.payment;
        
        if (payment.status === 'COMPLETED') {
            const squareOrderId = payment.order_id;
            console.log(`✅ Received payment.updated for Square order: ${squareOrderId}`);
            
            // In a real app, the Square Order ID would have a reference to your
            // internal comfortPayOrderId. We retrieve this from the metadata.
            const comfortPayOrderId = payment.note; // We'll use the 'note' field for our internal ID.
            
            if (!comfortPayOrderId) {
                 console.warn(`Square Webhook Warning: No comfortPayOrderId found in payment note for Square Order ID ${squareOrderId}.`);
                 break;
            }

            const numericOrderId = comfortPayOrderId.replace('CP', '');
            
            // Update order in DB
            await runQuery(
                `UPDATE orders SET status = ?, paymentGatewayTransactionId = ?, paymentReceivedDate = ? WHERE id = ?`,
                ['Completed', payment.id, new Date().toISOString(), numericOrderId]
            );

            // Fetch order and merchant details to send emails
            const details = await getOrderDetails(numericOrderId);
            if (details) {
                const { order, merchant } = details;
                // Send notifications (don't block the response for this)
                 Promise.all([
                    sendOrderNotification({ recipientType: 'customer', customerEmail: order.customerEmail, merchantName: merchant.name, orderDetails: order }),
                    sendOrderNotification({ recipientType: 'merchant', merchantEmail: merchant.email, merchantName: merchant.name, orderDetails: order })
                ]).catch(err => console.error("Webhook email notification failed:", err));
            }

            console.log(`Order ${comfortPayOrderId} status updated to 'Completed'.`);

        } else if (payment.status === 'FAILED') {
             console.log(`❌ Payment failed for Square Order ID: ${payment.order_id}`);
             // You could also update your internal order status to 'Failed' here.
        }
        break;
      
      default:
        console.warn(`🤷‍♀️ Unhandled Square event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true });
  } catch (err: any) {
     console.error(`❌ Square Webhook Error: ${err.message}`);
     if (err instanceof ApiError) {
        console.error(err.errors);
     }
    return NextResponse.json({ error: `Webhook processing error: ${err.message}` }, { status: 500 });
  }
}
