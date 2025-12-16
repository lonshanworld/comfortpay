
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
import * as jwt from 'jsonwebtoken';
import { appLog } from '@/lib/logger';


export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInputSchema>;

// Define the output schema for the checkout session
const CreateCheckoutSessionOutputSchema = z.object({
  sessionToken: z.string().optional(),
  checkoutUrl: z.string().optional(),
  error: z.string().optional(),
});
export type CreateCheckoutSessionOutput = z.infer<typeof CreateCheckoutSessionOutputSchema>;


export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionOutput> {
  try {
    console.log("==========================================");
    console.log("🚀 [createCheckoutSession] Starting...");
    console.log("   Input Data:", JSON.stringify(input, null, 2));

    const logContext = {
      title: "Create Checkout Session",
      hostname: "ComfortPay-Hub",
      value: JSON.stringify({ merchantOrderId: input.merchantOrderId, totalAmount: input.totalAmount, paymentMethod: input.paymentMethod }, null, 2),
    };

    await appLog({ ...logContext, description: "Step 1: Received and validating initial input.", plugin_status: 'info' });

    if (!input.merchantId) {
        console.error("❌ [createCheckoutSession] Error: Merchant ID is required.");
        return { error: "Merchant ID is required." };
    }
    const numericMerchantId = input.merchantId.split('_')[1];
    const merchantResult: any[] = await executeQuery("SELECT * FROM users WHERE id = ? AND role = 'Merchant'", [numericMerchantId]);
    
    if (merchantResult.length === 0) {
        console.error(`❌ [createCheckoutSession] Error: Merchant not found with ID ${numericMerchantId}.`);
        const errorMsg = `Merchant with ID ${numericMerchantId} not found.`;
        await appLog({ ...logContext, description: `Error at Step 2: ${errorMsg}`, plugin_status: 'error' });
        return { error: "Merchant not found." };
    }
    const merchant: User = merchantResult[0];
    console.log(`✅ [createCheckoutSession] Found Merchant:`, { id: merchant.id, name: merchant.name });
    await appLog({ ...logContext, description: `Step 2: Merchant validated successfully. ID: ${merchant.id}, Name: ${merchant.name}`, plugin_status: 'info' });

    if (!input.redirectUrl) {
        const errorMsg = "A redirect URL was not provided by the merchant's site.";
        await appLog({ ...logContext, description: `No redirect URL Error: ${errorMsg}`, plugin_status: 'error' });
        return { error: errorMsg };
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
       await appLog({ ...logContext, description: `Error at Step 3: Unsupported payment method: ${input.paymentMethod}`, plugin_status: 'error' });
        return { error: `Unsupported payment method: ${input.paymentMethod}`};
    }
    
    // Filter down to only the processors the merchant has explicitly enabled
    const enabledProcessors = availableProcessorsForMethod.filter(proc => {
        const gatewayConfig = merchantGatewayFees?.[proc.toLowerCase() as 'stripe' | 'square' | 'zelle'];
        return gatewayConfig?.enabled;
    });

    console.log(`[createCheckoutSession] Merchant's enabled processors for this method:`, enabledProcessors);
        await appLog({ ...logContext, description: `Step 3: Enabled processors for method '${input.paymentMethod}': ${enabledProcessors.join(', ')}`, plugin_status: 'info' });

    if (enabledProcessors.length === 0) {
        console.error(`❌ [createCheckoutSession] Error: No payment processors enabled for this merchant for the '${input.paymentMethod}' method.`);
        await appLog({ ...logContext, description: `Error at Step 4: No payment processors enabled for method '${input.paymentMethod}'.`, plugin_status: 'error' });
        return { error: `No payment processors enabled for this merchant for the '${input.paymentMethod}' method.` };
    }
    
    // 2. Query for all active payment accounts of the enabled types that are NOT already over their limit.
    let selectedAccount: PaymentAccount | null = null;
    
    if (input.paymentMethod === 'zelle') {
        console.log(`[createCheckoutSession] Zelle method detected. Using round-robin selection.`);
        await appLog({ ...logContext, description: `Step 4: Selecting Zelle account via round-robin.`, plugin_status: 'info' });
        const eligibleZelleAccounts: PaymentAccount[] = await executeQuery(
            `SELECT * FROM payment_accounts 
             WHERE type = 'Zelle' AND status = 'Active' AND currentVolume < dailyLimit 
             ORDER BY last_used_at ASC, id ASC`, // Fallback to id for deterministic order
            []
        );
        if (eligibleZelleAccounts.length > 0) {
            selectedAccount = eligibleZelleAccounts[0]; // Pick the least recently used one
             console.log(`[createCheckoutSession] Selected Zelle account via round-robin: ID ${selectedAccount.id}`);
             await appLog({ ...logContext, description: `Step 4: Selected Zelle account ID ${selectedAccount.id} via round-robin.`, plugin_status: 'info' });
        } else {
            console.error(`❌ [createCheckoutSession] Error: No Zelle accounts available that are under their daily processing limit.`);
            await appLog({ ...logContext, description: `Error at Step 5: No Zelle accounts available under daily limit.`, plugin_status: 'error' });
        }
    } else { // Card payments (Stripe/Square)
        const placeholders = enabledProcessors.map(() => '?').join(',');
        console.log(`[createCheckoutSession] Card method detected. Querying for eligible accounts with types: ${enabledProcessors.join(', ')}`);
        const eligiblePaymentAccounts: PaymentAccount[] = await executeQuery(
            `SELECT * FROM payment_accounts WHERE type IN (${placeholders}) AND status = 'Active' AND currentVolume < dailyLimit`,
            [...enabledProcessors]
        );
        
        if (eligiblePaymentAccounts.length > 0) {
            console.log(`[createCheckoutSession] Found ${eligiblePaymentAccounts.length} eligible card accounts under their limit.`);
            const minCurrentVolume = Math.min(...eligiblePaymentAccounts.map(acc => Number(acc.currentVolume)));
            const bestAccounts = eligiblePaymentAccounts.filter(acc => Number(acc.currentVolume) === minCurrentVolume);
            
            if (bestAccounts.length > 0) {
                const randomIndex = Math.floor(Math.random() * bestAccounts.length);
                selectedAccount = bestAccounts[randomIndex];
            }
        } else {
             console.error(`❌ [createCheckoutSession] Error: No card payment accounts available that are under their daily processing limit.`);
        }
    }
    
    if (!selectedAccount) {
         console.error(`❌ [createCheckoutSession] Error: No payment accounts available for method '${input.paymentMethod}'.`);
        await appLog({ ...logContext, description: `Error at Step 5: No payment accounts available for method '${input.paymentMethod}'.`, plugin_status: 'error' });
        return { error: `This payment method is temporarily unavailable due to high volume. Please try again later or contact support. (Ref: ALL_ACCOUNTS_AT_CAPACITY)` };
    }
    console.log(`✅ [createCheckoutSession] Final Selected Account result:`, {id: selectedAccount.id, type: selectedAccount.type});
    await appLog({ ...logContext, description: `Step 5: Selected payment account ID ${selectedAccount.id} of type ${selectedAccount.type}.`, plugin_status: 'info' });
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
    await appLog({ ...logContext, description: `Step 6: Generated visual order ID: ${visualId}`, plugin_status: 'info' });
    
    const orderAmount = (input.items || []).reduce((acc, item) => acc + ((item.price ?? 0) * (item.quantity ?? 0)), 0);
    const now = new Date();
    
     const wooSiteUrl = input.wooCommerceOrderReceivedUrl 
        ? new URL(input.wooCommerceOrderReceivedUrl).origin
        : null;
    
    const initialStatus = input.paymentMethod === 'zelle' ? 'On-Hold' : 'Pending';
    
    const orderInsertQuery = `
      INSERT INTO orders 
      (merchantId, merchantOrderId, visualOrderId, orderDate, customerName, customerEmail, status, paymentMethod, subtotal, taxAmount, shippingAmount, discountAmount, totalAmount, paidAmount, currency, paymentType, paymentAccountId, items, billingDetails, wooCommerceSiteUrl, orderAmount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `;
    const orderParams = [
        numericMerchantId,
        input.merchantOrderId, 
        visualId, 
        formatDateForMySQL(now),
        // Safely build customer name if billingDetails exists, otherwise store null
        (() => {
            const name = `${input.billingDetails?.firstName ?? ''} ${input.billingDetails?.lastName ?? ''}`.trim();
            return name || null;
        })(),
        // Safely use email if available
        input.billingDetails?.email ?? null,
        initialStatus,
        input.paymentMethod === 'card' ? 'Credit Card' : 'Zelle',
        input.subtotal ?? 0,
        input.taxAmount ?? 0,
        input.shippingAmount ?? 0,
        input.discountAmount ?? 0,
        input.totalAmount, // from WooCommerce (subtotal + shipping/tax)
        input.currency || 'USD',
        selectedGateway, // e.g. \"Stripe\", \"Square\"
        selectedAccount.id,
        input.items ? JSON.stringify(input.items) : null, // Store items as a JSON string
        JSON.stringify(input.billingDetails || {}), // Store billing details as a JSON string
        wooSiteUrl,
        orderAmount
    ];
    await appLog({ ...logContext, description: `Step 7: Inserting order into DB with visual ID ${visualId}.`, plugin_status: 'info' });
    const orderResult = await runQuery(orderInsertQuery, orderParams);
    await appLog({ ...logContext, description: `Step 8: Order inserted successfully with DB ID ${orderResult.id}.`, plugin_status: 'info' });
    const newOrderId = `CP${orderResult.id}`;
    console.log(`📝 [createCheckoutSession] Order created in DB. Result:`, { newComfortPayId: newOrderId, dbInsertId: orderResult.id });
    // If a Zelle account was used, update its last_used_at timestamp.
    if (selectedAccount.type === 'Zelle') {
        console.log(`[createCheckoutSession] Updating last_used_at for Zelle account ID: ${selectedAccount.id}`);
        await runQuery(
            `UPDATE payment_accounts SET last_used_at = ? WHERE id = ?`,
            [formatDateForMySQL(now), selectedAccount.id]
        );
        await appLog({ ...logContext, description: `Step 9: Updated last_used_at for Zelle account ID ${selectedAccount.id}.`, plugin_status: 'info' });
        console.log(`[createCheckoutSession] Timestamp updated successfully.`);
    }
    
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
            accountEmail: selectedAccount.accountEmail,
            zelleName: selectedAccount.name ?? ''
        }
    };
    await appLog({ ...logContext, description: `Step 10: Created session data with all details for order ID ${newOrderId}.`, raw_request: sessionDataWithDetails, plugin_status: 'info' });
        const sessionData = sessionDataWithDetails;

        const signingKey = process.env.SESSION_SIGNING_KEY;
        if (!signingKey) {
            console.error('❌ [createCheckoutSession] SESSION_SIGNING_KEY is not configured in the environment.');
            return { error: 'Server misconfiguration: missing session signing key.' };
        }

        // Sign the session payload as a JWT with a short expiry
        const sessionToken = jwt.sign(sessionData as object, signingKey, { algorithm: 'HS256', expiresIn: '15m' });
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutUrl = `${appUrl}/checkout/new?session=${sessionToken}`;
    await appLog({ ...logContext, description: `Step 11: Generated checkout URL for order ID ${newOrderId}.`, plugin_status: 'info' });
    const finalResult = { sessionToken, checkoutUrl };
    console.log(`✅ [createCheckoutSession] Session created successfully. Final result:`, finalResult);
    console.log("==========================================");
    
    return finalResult;
  } catch (error: any) {
    console.error('Unhandled error in createCheckoutSession:', error);
    try {
      await appLog({ title: 'Create Checkout Session', hostname: 'ComfortPay-Hub', value: JSON.stringify({ error: String(error) }), description: 'Unhandled exception', plugin_status: 'error' });
    } catch (logErr) {
      console.error('Failed to appLog during error handling:', logErr);
    }
    return { error: 'Internal Server Error' };
  }
}
