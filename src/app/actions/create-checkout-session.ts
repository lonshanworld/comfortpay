
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
import { formatDateForMySQL } from '@/lib/utils';


export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInputSchema>;

// Define the output schema for the checkout session
const CreateCheckoutSessionOutputSchema = z.object({
  sessionToken: z.string().optional(),
  checkoutUrl: z.string().optional(),
  error: z.string().optional(),
});
export type CreateCheckoutSessionOutput = z.infer<typeof CreateCheckoutSessionOutputSchema>;


export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionOutput> {
    console.log("==========================================");
    console.log("🚀 [createCheckoutSession] Starting...");
    console.log("   Input Data:", JSON.stringify(input, null, 2));

    if (!input.merchantId) {
        console.error("❌ [createCheckoutSession] Error: Merchant ID is required.");
        return { error: "Merchant ID is required." };
    }
    const numericMerchantId = input.merchantId.split('_')[1];
    const merchantResult: any[] = await executeQuery("SELECT * FROM users WHERE id = ? AND role = 'Merchant'", [numericMerchantId]);
    
    if (merchantResult.length === 0) {
        console.error(`❌ [createCheckoutSession] Error: Merchant not found with ID ${numericMerchantId}.`);
        return { error: "Merchant not found." };
    }
    const merchant: User = merchantResult[0];
    console.log(`✅ [createCheckoutSession] Found Merchant:`, { id: merchant.id, name: merchant.name });
    
    if (!input.redirectUrl) {
        console.error("❌ [createCheckoutSession] Error: A redirect URL was not provided by the merchant's site.");
        return { error: "A redirect URL was not provided by the merchant's site." };
    }
    
    // 1. Determine which processors are allowed for this payment method based on merchant settings
    const merchantGatewayFees = typeof merchant.paymentGatewayFees === 'string'
        ? JSON.parse(merchant.paymentGatewayFees)
        : merchant.paymentGatewayFees;
        
    let availableProcessorsForMethod: string[] = [];
    if (input.paymentMethod === 'card') {
        availableProcessorsForMethod = ['Stripe', 'Square'];
    } else if (input.paymentMethod === 'zelle') {
        availableProcessorsForMethod = ['Zelle'];
    } else {
        console.error(`❌ [createCheckoutSession] Error: Unsupported payment method: ${input.paymentMethod}`);
        return { error: `Unsupported payment method: ${input.paymentMethod}`};
    }
    
    // Filter down to only the processors the merchant has explicitly enabled
    const enabledProcessors = availableProcessorsForMethod.filter(proc => {
        const gatewayConfig = merchantGatewayFees?.[proc.toLowerCase() as 'stripe' | 'square' | 'zelle'];
        return gatewayConfig?.enabled;
    });

    console.log(`[createCheckoutSession] Merchant's enabled processors for this method:`, enabledProcessors);

    if (enabledProcessors.length === 0) {
        console.error(`❌ [createCheckoutSession] Error: No payment processors enabled for this merchant for the '${input.paymentMethod}' method.`);
        return { error: `No payment processors enabled for this merchant for the '${input.paymentMethod}' method.` };
    }
    
    // 2. Query for all active payment accounts of the enabled types that are NOT already over their limit.
    const placeholders = enabledProcessors.map(() => '?').join(',');
    const eligiblePaymentAccounts: PaymentAccount[] = await executeQuery(
        `SELECT * FROM payment_accounts WHERE type IN (${placeholders}) AND status = 'Active' AND currentVolume < dailyLimit`,
        [...enabledProcessors]
    );

    if (eligiblePaymentAccounts.length === 0) {
        console.error(`❌ [createCheckoutSession] Error: No payment accounts available for method '${input.paymentMethod}' that are under their daily processing limit.`);
        return { error: `This payment method is temporarily unavailable due to high volume. Please try again later or contact support. (Ref: ALL_ACCOUNTS_AT_CAPACITY)` };
    }
    console.log(`[createCheckoutSession] Found ${eligiblePaymentAccounts.length} eligible accounts under their limit.`);
    console.log(`[createCheckoutSession] Eligible accounts result:`, eligiblePaymentAccounts.map(a => ({id: a.id, type: a.type, currentVolume: a.currentVolume, dailyLimit: a.dailyLimit})));

    // 3. From the eligible accounts, select the best one.
    let selectedAccount: PaymentAccount | null = null;
    
    if (eligiblePaymentAccounts.length === 1) {
        selectedAccount = eligiblePaymentAccounts[0];
    } else {
        // Find the account with the lowest current volume to balance the load.
        const minCurrentVolume = Math.min(...eligiblePaymentAccounts.map(acc => Number(acc.currentVolume)));
        const bestAccounts = eligiblePaymentAccounts.filter(acc => Number(acc.currentVolume) === minCurrentVolume);
        
        if (bestAccounts.length > 0) {
            const randomIndex = Math.floor(Math.random() * bestAccounts.length);
            selectedAccount = bestAccounts[randomIndex];
        }
    }
    
    if (!selectedAccount) {
        console.error(`❌ [createCheckoutSession] Error: Could not select a payment account after filtering.`);
        return { error: `Could not select a payment account.` };
    }
    console.log(`✅ [createCheckoutSession] Final Selected Account result:`, {id: selectedAccount.id, type: selectedAccount.type});

    const selectedGateway = selectedAccount.type;
    const paymentAccountId = selectedAccount.id;

    let visualId = '';
    const paymentPrefix = selectedAccount.prefix_order_name;
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
    console.log(`[createCheckoutSession] Generated Visual ID: ${visualId}`);
    
    const orderAmount = (input.items || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const now = new Date();

     const wooSiteUrl = input.wooCommerceOrderReceivedUrl 
        ? new URL(input.wooCommerceOrderReceivedUrl).origin
        : null;

    const orderInsertQuery = `
      INSERT INTO orders 
      (merchantId, merchantOrderId, visualOrderId, orderDate, customerName, customerEmail, status, paymentMethod, orderAmount, totalAmount, paidAmount, currency, paymentType, paymentAccountId, items, billingDetails, wooCommerceSiteUrl) 
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `;
    const orderParams = [
        numericMerchantId, input.merchantOrderId, visualId, formatDateForMySQL(now),
        `${input.billingDetails.firstName} ${input.billingDetails.lastName}`, input.billingDetails.email,
        input.paymentMethod === 'card' ? 'Credit Card' : 'Zelle',
        orderAmount,
        input.totalAmount, // from WooCommerce (subtotal + shipping/tax)
        input.currency || 'USD',
        selectedGateway, // e.g. "Stripe", "Square"
        selectedAccount.id,
        null, // Store items as a JSON string
        JSON.stringify(input.billingDetails || {}), // Store billing details as a JSON string
        wooSiteUrl,
    ];

    const orderResult = await runQuery(orderInsertQuery, orderParams);
    const newOrderId = `CP${orderResult.id}`;
    console.log(`📝 [createCheckoutSession] Order created in DB. Result:`, { newComfortPayId: newOrderId, dbInsertId: orderResult.id });

    const sessionDataWithDetails = { 
        ...input,
        wooCommerceOrderReceivedUrl: input.wooCommerceOrderReceivedUrl || input.redirectUrl,
        visualOrderId: visualId,
        comfortPayOrderId: newOrderId,
        merchantOrigin: merchant.websiteUrl,
        processor: selectedGateway,
        paymentDetails: {
            ...input.paymentDetails, // Spread incoming details first
            paymentAccountId: `pa_${paymentAccountId}`, // Then overwrite/add our secure details
            qrCodeUrl: selectedAccount.qrCodeUrl,
            accountEmail: selectedAccount.accountEmail
        }
    };
    const sessionData = JSON.stringify(sessionDataWithDetails);
    const sessionToken = Buffer.from(sessionData).toString('base64');
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutUrl = `${appUrl}/checkout/new?session=${sessionToken}`;
    
    const finalResult = { sessionToken, checkoutUrl };
    console.log(`✅ [createCheckoutSession] Session created successfully. Final result:`, finalResult);
    console.log("==========================================");

    return finalResult;
}
