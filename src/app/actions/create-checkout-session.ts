
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
import type { GatewayFee, PaymentAccount, User } from '@/lib/types';
import { sendOrderNotification } from '@/app/actions/send-order-notification';
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
    console.log("🚀 Starting createCheckoutSession...");
    console.log("Input Data:", JSON.stringify(input, null, 2));

    if (!input.merchantId) {
        console.error("❌ Error: Merchant ID is required.");
        return { error: "Merchant ID is required." };
    }
    const numericMerchantId = input.merchantId.split('_')[1];
    const merchantResult: any[] = await executeQuery("SELECT * FROM users WHERE id = ? AND role = 'Merchant'", [numericMerchantId]);
    
    if (merchantResult.length === 0) {
        console.error(`❌ Error: Merchant not found with ID ${numericMerchantId}.`);
        return { error: "Merchant not found." };
    }
    const merchant: User = merchantResult[0];
    console.log(`✅ Found Merchant: ${merchant.name} (ID: ${merchant.id})`);
    
    if (!input.wooCommerceOrderReceivedUrl && !input.redirectUrl) {
        console.error("❌ Error: A redirect URL was not provided by the merchant's site.");
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
        console.error(`❌ Error: Unsupported payment method: ${input.paymentMethod}`);
        return { error: `Unsupported payment method: ${input.paymentMethod}`};
    }
    console.log(`Initial processors for method '${input.paymentMethod}':`, availableProcessorsForMethod);
    
    // Filter down to only the processors the merchant has explicitly enabled
    const enabledProcessors = availableProcessorsForMethod.filter(proc => {
        const gatewayConfig = merchantGatewayFees?.[proc.toLowerCase() as 'stripe' | 'square' | 'zelle'];
        return gatewayConfig?.enabled;
    });

    console.log(`Merchant's enabled processors for this method:`, enabledProcessors);

    if (enabledProcessors.length === 0) {
        console.error(`❌ Error: No payment processors enabled for this merchant for the '${input.paymentMethod}' method.`);
        return { error: `No payment processors enabled for this merchant for the '${input.paymentMethod}' method.` };
    }
    
    // 2. Query for all active, available payment accounts of the enabled types that can handle the transaction amount.
    const placeholders = enabledProcessors.map(() => '?').join(',');
    const paymentAccountResults: PaymentAccount[] = await executeQuery(
        `SELECT * FROM payment_accounts WHERE type IN (${placeholders}) AND status = 'Active' AND (currentVolume + ?) <= dailyLimit`,
        [...enabledProcessors, input.totalAmount]
    );

    console.log(`Found ${paymentAccountResults.length} payment accounts with capacity:`, paymentAccountResults.map(p => ({id: p.id, type: p.type, currentVolume: p.currentVolume, dailyLimit: p.dailyLimit})));
    
    if (paymentAccountResults.length === 0) {
        console.error(`❌ Error: No active and available payment account found with enough capacity.`);
         return { error: `No active and available payment account found with enough capacity for the requested payment method.` };
    }

    // 3. Implement the refined selection logic.
    let selectedAccount: PaymentAccount | null = null;
    
    if (paymentAccountResults.length === 1) {
        selectedAccount = paymentAccountResults[0];
        console.log(`Only one account available. Selected:`, {id: selectedAccount.id, type: selectedAccount.type});
    } else {
        console.log("Multiple Payment Accounts Found, applying selection logic.");
        const minCurrentVolume = Math.min(...paymentAccountResults.map(acc => Number(acc.currentVolume)));
        console.log(`Minimum current volume found: ${minCurrentVolume}`);
        
        const bestAccounts = paymentAccountResults.filter(acc => Number(acc.currentVolume) === minCurrentVolume);
        console.log(`Found ${bestAccounts.length} best accounts with that volume:`, bestAccounts.map(p => ({id: p.id, type: p.type})));
        
        if (bestAccounts.length > 0) {
            const randomIndex = Math.floor(Math.random() * bestAccounts.length);
            console.log(`randomIndex: ${randomIndex}`);
            selectedAccount = bestAccounts[randomIndex];
        }
    }
    
    if (!selectedAccount) {
        console.error(`❌ Error: Could not select a payment account after filtering.`);
        return { error: `Could not select a payment account.` };
    }
    console.log(`✅ Final Selected Account:`, {id: selectedAccount.id, type: selectedAccount.type});

    const selectedGateway = selectedAccount.type;
    const paymentAccountId = selectedAccount.id; // This is now correct, e.g. 3

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
    console.log(`Generated Visual ID: ${visualId}`);
    
    const orderAmount = (input.items || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const orderInsertQuery = `
      INSERT INTO orders 
      (merchantId, merchantOrderId, visualOrderId, orderDate, customerName, customerEmail, status, paymentMethod, orderAmount, totalAmount, paidAmount, currency, paymentType, paymentAccountId) 
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 0, ?, ?, ?)
    `;
    const orderParams = [
        numericMerchantId, input.merchantOrderId, visualId, formatDateForMySQL(new Date()),
        `${input.billingDetails.firstName} ${input.billingDetails.lastName}`, input.billingDetails.email,
        input.paymentMethod === 'card' ? 'Credit Card' : 'Zelle',
        orderAmount, // Pure item subtotal
        input.totalAmount, // from WooCommerce (subtotal + shipping/tax)
        input.currency || 'USD',
        selectedGateway, // e.g. "Stripe", "Square"
        selectedAccount.id // Save the numeric ID to the database
    ];

    const orderResult = await runQuery(orderInsertQuery, orderParams);
    const newOrderId = `CP${orderResult.id}`;
    console.log(`📝 Order created in DB with ComfortPay ID: ${newOrderId}`);

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
    
    const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const checkoutUrl = `${appUrl}/checkout/new?session=${sessionToken}`;
    console.log(`✅ Session created successfully. Checkout URL: ${checkoutUrl}`);
    console.log("==========================================");

    return { sessionToken, checkoutUrl };
}
