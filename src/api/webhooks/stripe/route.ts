
/**
 * @fileOverview Stripe Webhook Handler
 *
 * This endpoint listens for events from Stripe and processes them.
 * It's crucial for confirming payments, handling subscriptions, and other
 * asynchronous events from Stripe.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { runQuery, executeQuery } from '@/lib/db';
import { sendOrderNotification } from '@/app/actions/send-order-notification';


async function getOrderDetails(orderId: string) {
    const orderResults = await executeQuery("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (orderResults.length === 0) return null;
    const order = orderResults[0];

    const merchantResults = await executeQuery("SELECT * FROM users WHERE id = ? AND role = 'Merchant'", [order.merchantId]);
     if (merchantResults.length === 0) return null;

    return { order, merchant: merchantResults[0] };
}


export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;
  
  // The webhook secret is now retrieved based on the payment account, but we don't have that info yet.
  // We'll parse the event without the signature first, get the account, then verify.
  let event: Stripe.Event;
  try {
    event = JSON.parse(body);
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const paymentAccountId = session.metadata?.payment_account_id;
  
  if (!paymentAccountId) {
    console.error(`❌ Stripe Webhook Error: No payment_account_id in metadata.`);
    return NextResponse.json({ error: 'Webhook Error: Missing payment account ID' }, { status: 400 });
  }

  // Now, get the specific webhook secret for this payment account
  const webhookSecret = process.env[`STRIPE_WEBHOOK_SECRET_${paymentAccountId}`];
  if (!webhookSecret) {
    console.error(`❌ Stripe Webhook Error: No webhook secret found for payment account ${paymentAccountId}.`);
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }
  
  const stripe = new Stripe(process.env[`SECRET_KEY_${paymentAccountId}`]!, { apiVersion: '2024-06-20' });

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Stripe Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      
      const comfortPayOrderId = session.metadata?.comfortPayOrderId;

      if (comfortPayOrderId) {
        console.log(`✅ Received checkout.session.completed for transaction: ${comfortPayOrderId}`);
        const numericOrderId = comfortPayOrderId.replace('CP', '');

        // Update the order status to 'Completed' in your database
        await runQuery(
            `UPDATE orders SET status = ?, paymentGatewayTransactionId = ?, paymentReceivedDate = ? WHERE id = ?`,
            ['Completed', session.payment_intent, new Date().toISOString(), numericOrderId]
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

        console.log(`Transaction ${comfortPayOrderId} status updated to 'Completed'.`);

      } else {
        console.warn('Webhook received for checkout.session.completed but no comfortPayOrderId was found in metadata.');
      }
      break;
    
    case 'payment_intent.payment_failed':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`❌ Payment failed for transaction associated with payment intent: ${paymentIntent.id}`);
        // Here you would find the transaction associated with the payment intent and update its status to 'Failed'
      break;

    default:
      console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
