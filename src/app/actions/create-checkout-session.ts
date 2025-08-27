
'use server';
/**
 * @fileOverview An action for creating and managing checkout sessions.
 *
 * - createCheckoutSession - Packages transaction details into a secure token.
 * - CreateCheckoutSessionInput - The input type for the createCheckoutSession function.
 * - CreateCheckoutSessionOutput - The return type for the createCheckoutSession function.
 */

import { z } from 'zod';
import { CreateCheckoutSessionInputSchema } from '@/lib/schemas';
import { executeQuery, runQuery } from '@/lib/db';
import type { PaymentAccount, User } from '@/lib/types';
import { sendOrderNotification } from '@/app/actions/send-order-notification';


export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInputSchema>;

// Define the output schema for the checkout session
const CreateCheckoutSessionOutputSchema = z.object({
  sessionToken: z.string().optional(),
  checkoutUrl: z.string().optional(),
  error: z.string().optional(),
});
export type CreateCheckoutSessionOutput = z.infer<typeof CreateCheckoutSessionOutputSchema>;

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionOutput> {
    const numericMerchantId = input.merchantId.split('_')[1];
    const merchantResult: User[] = await executeQuery("SELECT * FROM users WHERE id = ? AND role = 'Merchant'", [numericMerchantId]);
    const merchant = merchantResult[0];

    if (!merchant) {
        return { error: "Merchant not found." };
    }
    
    let paymentAccount: PaymentAccount | null = null;
    
    const merchantGatewayFees = typeof merchant.paymentGatewayFees === 'string'
        ? JSON.parse(merchant.paymentGatewayFees)
        : merchant.paymentGatewayFees;
        
    let availableProcessors: string[] = [];

    if (input.paymentMethod === 'card') {
        availableProcessors = ['Stripe', 'Square'];
    } else if (input.paymentMethod === 'zelle') {
        availableProcessors = ['Zelle'];
    } else {
        return { error: `Unsupported payment method: ${input.paymentMethod}`};
    }
    
    // Filter processors that are actually enabled for the merchant
    const enabledProcessors = availableProcessors.filter(proc => {
        const gatewayConfig = merchantGatewayFees?.[proc.toLowerCase() as 'stripe' | 'square' | 'zelle'];
        return gatewayConfig?.enabled;
    });

    if (enabledProcessors.length === 0) {
        return { error: `No payment processors enabled for this merchant for the '${input.paymentMethod}' method.` };
    }

    const placeholders = enabledProcessors.map(() => '?').join(',');
    const paymentAccountResult: any[] = await executeQuery(
        `SELECT *, (dailyLimit - currentVolume) as remainingVolume FROM payment_accounts WHERE type IN (${placeholders}) AND status = 'Active' ORDER BY remainingVolume DESC`,
        enabledProcessors
    );
    
    if (paymentAccountResult.length === 0) {
         return { error: `No active payment account found for the requested payment method.` };
    }
    // The query sorts by the highest remaining volume, so we pick the first one.
    paymentAccount = paymentAccountResult[0] as PaymentAccount;
    const selectedGateway = paymentAccount.type;

    const redirectUrl = merchant.websiteUrl || paymentAccount.websiteUrl || 'https://comfortpay.com/checkout/thank-you';

    // --- Visual ID Logic ---
    let visualId = '';
    const paymentPrefix = paymentAccount.prefix_order_name;
    const merchantPrefix = merchant.orderIdPrefix;

    if (paymentPrefix === 'USE_COMFORTPAY_ID') {
        const tempId = `CP${Math.floor(1000 + Math.random() * 9000)}`;
        visualId = `${tempId}-${input.merchantOrderId}`;
    } else if (paymentPrefix) {
        visualId = `${paymentPrefix} #${input.merchantOrderId}`;
    } else if (merchantPrefix) {
        visualId = `${merchantPrefix}-${input.merchantOrderId}`;
    } else {
        visualId = input.merchantOrderId;
    }

    // Insert the initial order record with a "Pending" status
    const orderInsertQuery = `
      INSERT INTO orders 
      (merchantId, merchantOrderId, visualOrderId, orderDate, customerName, customerEmail, status, paymentMethod, orderAmount, totalAmount, paidAmount, currency, paymentType, billingDetails) 
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 0, ?, ?, ?)
    `;
    const orderParams = [
        numericMerchantId, input.merchantOrderId, visualId, new Date().toISOString(),
        `${input.billingDetails.firstName} ${input.billingDetails.lastName}`, input.billingDetails.email,
        input.paymentMethod,
        input.totalAmount, input.totalAmount, // Assuming orderAmount and totalAmount are the same initially
        input.currency || 'USD',
        selectedGateway,
        JSON.stringify(input.billingDetails)
    ];

    const orderResult = await runQuery(orderInsertQuery, orderParams);
    const newOrderId = `CP${orderResult.id}`;

    // Add the determined redirectUrl, visualId, and internal orderId to the session data
    const sessionDataWithDetails = { 
        ...input, 
        redirectUrl, 
        visualOrderId: visualId,
        comfortPayOrderId: newOrderId, // Add our internal ID to the session
        merchantOrigin: merchant.websiteUrl, // Add merchant origin for secure postMessage
        processor: selectedGateway, // Explicitly set the chosen processor
    };
    const sessionData = JSON.stringify(sessionDataWithDetails);
    const sessionToken = Buffer.from(sessionData).toString('base64');
    
    // Construct the checkout URL reliably on the server
    const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
    const checkoutUrl = `${appUrl}/checkout/new?session=${sessionToken}`;

    return { sessionToken, checkoutUrl };
}
