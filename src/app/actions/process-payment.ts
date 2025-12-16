
'use server';

import Stripe from 'stripe';
import { z } from 'zod';
import { executeQuery, runQuery } from '@/lib/db';
import { Client, Environment, ApiError } from 'square/legacy';
import { randomUUID } from 'crypto';

const PaymentInputSchema = z.object({
  processor: z.enum(['Stripe', 'Square']),
  paymentMethodId: z.string(),
  comfortPayOrderId: z.string(),
  amount: z.number(),
  currency: z.string(),
});

type PaymentInput = z.infer<typeof PaymentInputSchema>;

export async function processPayment(input: PaymentInput): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const validation = PaymentInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Invalid payment input." };
  }

  const { processor, paymentMethodId, comfortPayOrderId, currency } = validation.data;
  const numericOrderId = comfortPayOrderId.replace('CP', '');
  
  console.log("🚀 [processPayment] Starting payment process...");
  console.log("   Input data:", input);


  try {
    const orderResult: any[] = await executeQuery("SELECT paymentAccountId, items, totalAmount FROM orders WHERE id = ?", [numericOrderId]);
    if (orderResult.length === 0) {
      throw new Error("Order not found.");
    }
    
    const paymentAccountId = orderResult[0]?.paymentAccountId; 
    const totalAmountFromOrder = orderResult[0]?.totalAmount;

    console.log("[processPayment] Fetched order details from DB:", { paymentAccountId, totalAmountFromOrder });

    if (!paymentAccountId) {
      throw new Error("Payment account not associated with this order.");
    }
    
    if (processor === 'Stripe') {
      const secretKey = process.env[`STRIPE_SECRET_KEY_${paymentAccountId}`];
      if (!secretKey) {
        throw new Error(`API secret key for payment account ${paymentAccountId} is not configured.`);
      }
      const stripe = new Stripe(secretKey, { apiVersion: '2025-07-30.basil' });
      
      console.log("[processPayment] Creating Stripe PaymentIntent...");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmountFromOrder * 100), // Use the authoritative amount from the database
        currency: currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: 'https://comfortpay.com/return', 
        metadata: {
          comfortPayOrderId: comfortPayOrderId,
          payment_account_id: paymentAccountId,
        }
      });
      
      console.log("[processPayment] Stripe PaymentIntent creation result:", { status: paymentIntent.status, id: paymentIntent.id });
      // `paymentIntent` is a Stripe response object; some properties like `outcome` may live
      // under nested charge objects or not be present on the typed Response wrapper.
      // Use a safe any-cast to log any available outcome/radar info without a type error.
      const stripeOutcome: any = (paymentIntent as any).outcome || (paymentIntent as any).charges?.data?.[0]?.outcome;
      console.log("🔍 [processPayment] Stripe Radar Risk Evaluation:", stripeOutcome);


      if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
        console.log("✅ [processPayment] Stripe payment successful. Updating order with risk details...");
        const riskDetails = stripeOutcome ? JSON.stringify(stripeOutcome) : null;
        await runQuery(
            `UPDATE orders SET riskDetails = ? WHERE id = ?`,
            [riskDetails, numericOrderId]
        );
        return { success: true, transactionId: paymentIntent.id };
      } else {
        console.error("❌ [processPayment] Stripe payment failed. Last error:", paymentIntent.last_payment_error);
        return { success: false, error: paymentIntent.last_payment_error?.message || 'Stripe payment failed.' };
      }

    } else if (processor === 'Square') {
      const accessToken = process.env[`SQUARE_ACCESS_TOKEN_${paymentAccountId}`];
      if (!accessToken) {
        throw new Error(`Square access token for payment account ${paymentAccountId} is not configured.`);
      }
      
      const squareEnv = process.env.SQUARE_ENVIRONMENT === 'production' 
        ? Environment.Production 
        : Environment.Sandbox;

      const squareClient = new Client({
        accessToken: accessToken,
        environment: squareEnv,
      });
      
      const itemsData = orderResult[0]?.items;
      const lineItems = typeof itemsData === 'string' ? JSON.parse(itemsData) : itemsData || [];

      console.log("[processPayment] Creating Square order...");
      const orderResponse = await squareClient.ordersApi.createOrder({
        order: {
          locationId: process.env[`SQUARE_LOCATION_ID_${paymentAccountId}`]!,
          lineItems: lineItems.map((item: any) => ({
            name: item.name,
            quantity: item.quantity.toString(),
            basePriceMoney: {
              amount: BigInt(Math.round(item.price * 100)),
              currency: currency.toUpperCase()
            }
          })),
          referenceId: comfortPayOrderId,
        },
        idempotencyKey: randomUUID()
      });
      console.log("[processPayment] Square createOrder result:", orderResponse.result);


      if (!orderResponse.result.order?.id || !orderResponse.result.order?.totalMoney) {
          throw new Error("Failed to create Square order or retrieve order total.");
      }
      const squareOrderId = orderResponse.result.order.id;
      const squareTotalMoney = orderResponse.result.order.totalMoney;

      console.log("[processPayment] Creating Square payment...");
      const response = await squareClient.paymentsApi.createPayment({
        sourceId: paymentMethodId, // This is the nonce from the frontend
        idempotencyKey: randomUUID(),
        amountMoney: squareTotalMoney, // Use the total from the created Square order
        orderId: squareOrderId,
        note: comfortPayOrderId, // Pass our internal ID here to retrieve in the webhook
      });
      console.log("[processPayment] Square createPayment result:", response.result);
      
      const payment = response.result.payment;
      if (payment?.status === 'COMPLETED') {
        console.log("✅ [processPayment] Square payment successful. Updating order with risk details...");
        if (payment.riskEvaluation) {
            console.log("🔍 [processPayment] Square Risk Evaluation:", payment.riskEvaluation);
            await runQuery(
                `UPDATE orders SET riskDetails = ? WHERE id = ?`,
                [JSON.stringify(payment.riskEvaluation), numericOrderId]
            );
        }
        return { success: true, transactionId: payment.id };
      } else {
         const errors = response.result.errors?.map(e => `${e.code}: ${e.detail}`).join(', ') || 'Square payment failed.';
         console.error("❌ [processPayment] Square payment failed:", errors);
         return { success: false, error: errors };
      }
    }

    return { success: false, error: 'Unsupported processor.' };

  } catch (error: any) {
    console.error("❌ [processPayment] General error:", error);
    // Handle Stripe-specific card errors for better user feedback
    if (error.type === 'StripeCardError') {
        return { success: false, error: error.message };
    }
    // Handle Square API errors
    if (error instanceof ApiError) {
        const errorMessage = error.errors.map(e => e.detail).join(', ');
        console.error("❌ [processPayment] Square API error details:", errorMessage);
        return { success: false, error: errorMessage };
    }
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}
