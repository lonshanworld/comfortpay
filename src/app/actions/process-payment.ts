
'use server';

import Stripe from 'stripe';
import { z } from 'zod';
import { executeQuery, runQuery } from '@/lib/db';
import * as square from 'square/legacy';
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

  try {
    const orderResult: any[] = await executeQuery("SELECT paymentAccountId, items, totalAmount FROM orders WHERE id = ?", [numericOrderId]);
    if (orderResult.length === 0) {
      throw new Error("Order not found.");
    }
    
    const paymentAccountId = orderResult[0]?.paymentAccountId; 
    const totalAmountFromOrder = orderResult[0]?.totalAmount;

    if (!paymentAccountId) {
      throw new Error("Payment account not associated with this order.");
    }
    
    const numericPaymentAccountId = paymentAccountId.toString().replace('pa_', '');
    
    if (processor === 'Stripe') {
      const secretKey = process.env[`STRIPE_SECRET_KEY_${numericPaymentAccountId}`];
      if (!secretKey) {
        throw new Error(`API secret key for payment account ${paymentAccountId} is not configured.`);
      }
      const stripe = new Stripe(secretKey, { apiVersion: '2025-07-30.basil' });
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmountFromOrder * 100), // Use the authoritative amount from the database
        currency: currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: 'https://comfortpay.com/return', 
      });
      
      if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
        return { success: true, transactionId: paymentIntent.id };
      } else {
        return { success: false, error: paymentIntent.last_payment_error?.message || 'Stripe payment failed.' };
      }

    } else if (processor === 'Square') {
      const accessToken = process.env[`SQUARE_ACCESS_TOKEN_${numericPaymentAccountId}`];
      if (!accessToken) {
        throw new Error(`Square access token for payment account ${paymentAccountId} is not configured.`);
      }
      
      const squareEnv = process.env.SQUARE_ENVIRONMENT === 'production' 
        ? square.Environment.Production 
        : square.Environment.Sandbox;

      const squareClient = new square.Client({
        accessToken: accessToken,
        environment: squareEnv,
      });
      
      const itemsData = orderResult[0]?.items;
      const lineItems = typeof itemsData === 'string' ? JSON.parse(itemsData) : itemsData || [];

      const orderResponse = await squareClient.ordersApi.createOrder({
        order: {
          locationId: process.env[`SQUARE_LOCATION_ID_${numericPaymentAccountId}`]!,
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

      if (!orderResponse.result.order?.id || !orderResponse.result.order?.totalMoney) {
          throw new Error("Failed to create Square order or retrieve order total.");
      }
      const squareOrderId = orderResponse.result.order.id;
      const squareTotalMoney = orderResponse.result.order.totalMoney;

      const response = await squareClient.paymentsApi.createPayment({
        sourceId: paymentMethodId, // This is the nonce from the frontend
        idempotencyKey: randomUUID(),
        amountMoney: squareTotalMoney, // Use the total from the created Square order
        orderId: squareOrderId,
      });
      
      const payment = response.result.payment;
      if (payment?.status === 'COMPLETED') {
        return { success: true, transactionId: payment.id };
      } else {
         const errors = response.result.errors?.map(e => `${e.code}: ${e.detail}`).join(', ') || 'Square payment failed.';
         return { success: false, error: errors };
      }
    }

    return { success: false, error: 'Unsupported processor.' };

  } catch (error: any) {
    console.error("Payment processing error:", error);
     if (error instanceof square.ApiError) {
        const errorMessage = error.errors.map(e => e.detail).join(', ');
        return { success: false, error: errorMessage };
    }
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}
