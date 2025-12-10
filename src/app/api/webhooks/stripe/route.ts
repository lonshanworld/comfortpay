
/**
 * @fileOverview Stripe Webhook Handler
 *
 * This endpoint listens for events from Stripe and processes them.
 * It's crucial for confirming payments, handling subscriptions, and other
 * asynchronous events from Stripe.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { executeQuery, runQuery } from '@/lib/db';
import { sendOrderNotification } from '@/app/actions/send-order-notification';


async function getOrderDetails(orderId: string) {
    const orderResults: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (orderResults.length === 0) return null;
    const order = orderResults[0];

    const merchantResults: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [order.merchantId]);
     if (merchantResults.length === 0) return null;

    return { order, merchant: merchantResults[0] };
}


export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;
  
  let event: Stripe.Event;
  try {
    // We cannot verify yet, we need to parse the event to get the account ID
    event = JSON.parse(body);
    console.log("🚀 [Stripe Webhook] Received event:", { type: event.type, id: event.id });
  } catch (err: any) {
    console.error("❌ [Stripe Webhook] Invalid JSON body:", err.message);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Determine the account ID from the event metadata
  let paymentAccountId: string | undefined;

  if (event.type.startsWith('payment_intent.')) {
     const paymentIntent = event.data.object as Stripe.PaymentIntent;
     // This assumes you add payment_account_id to payment intent metadata, which is good practice.
     paymentAccountId = paymentIntent.metadata?.payment_account_id;
     console.log(`[Stripe Webhook] Found payment_account_id in metadata: ${paymentAccountId}`);
  }
  
  if (!paymentAccountId) {
    console.error(`❌ [Stripe Webhook] Error: No payment_account_id in event metadata. Event type: ${event.type}`);
    return NextResponse.json({ error: 'Webhook Error: Missing payment account ID' }, { status: 400 });
  }

  // The ID from metadata is the numeric ID, e.g., '1'
  const numericId = paymentAccountId;
  
  const webhookSecret = process.env[`STRIPE_WEBHOOK_SECRET_${numericId}`];
  if (!webhookSecret) {
    console.error(`❌ [Stripe Webhook] Error: No webhook secret found for payment account ${numericId}.`);
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }
  
  const stripeSecretKey = process.env[`STRIPE_SECRET_KEY_${numericId}`];
   if (!stripeSecretKey) {
    console.error(`❌ [Stripe Webhook] Error: No secret key found for payment account ${numericId}.`);
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }
  
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-07-30.basil' });

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log("✅ [Stripe Webhook] Signature verified.");
  } catch (err: any) {
    console.error(`❌ [Stripe Webhook] Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const comfortPayOrderId = paymentIntent.metadata?.comfortPayOrderId;

      if (comfortPayOrderId) {
        console.log(`[Stripe Webhook] Processing payment_intent.succeeded for transaction: ${comfortPayOrderId}`);
        const numericOrderId = comfortPayOrderId.replace('CP', '');

        // Update the order status to 'Completed' and store risk details in your database
        const dbResult = await runQuery(
            `UPDATE orders SET status = ?, paymentGatewayTransactionId = ?, paymentReceivedDate = ?, riskDetails = ? WHERE id = ? AND status != 'Completed'`,
            ['Completed', paymentIntent.id, new Date(paymentIntent.created * 1000).toISOString().slice(0, 19).replace('T', ' '), JSON.stringify(paymentIntent.outcome), numericOrderId]

        );
        console.log("[Stripe Webhook] Database update result:", dbResult);


        // Fetch order and merchant details to send emails
        const details = await getOrderDetails(numericOrderId);
        if (details) {
            const { order, merchant } = details;
             // Send notifications (don't block the response for this)
            Promise.all([
                sendOrderNotification({ recipientType: 'customer', customerEmail: order.customerEmail, merchantName: merchant.name, orderDetails: order }),
                sendOrderNotification({ recipientType: 'merchant', merchantEmail: merchant.email, merchantName: merchant.name, orderDetails: order })
            ]).catch(err => console.error("Webhook email notification failed:", err));
             console.log("[Stripe Webhook] Triggered customer and merchant email notifications.");
        }

        console.log(`✅ [Stripe Webhook] Transaction ${comfortPayOrderId} status updated to 'Completed'.`);

      } else {
        console.warn('[Stripe Webhook] Webhook received for payment_intent.succeeded but no comfortPayOrderId was found in metadata.');
      }
      break;
    
    case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`❌ [Stripe Webhook] Payment failed for transaction associated with payment intent: ${failedPaymentIntent.id}`);
        // Here you would find the transaction associated with the payment intent and update its status to 'Failed'
      break;

    default:
      console.warn(`🤷‍♀️ [Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
