
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
    } else if (input.paymentMethod === 'interac') {
        availableProcessorsForMethod = ['Interac'];
    } else if (input.paymentMethod === 'wise') {
        availableProcessorsForMethod = ['Wise'];
    } else {
        console.error(`❌ [createCheckoutSession] Error: Unsupported payment method: ${input.paymentMethod}`);
       await appLog({ ...logContext, description: `Error at Step 3: Unsupported payment method: ${input.paymentMethod}`, plugin_status: 'error' });
        return { error: `Unsupported payment method: ${input.paymentMethod}`};
    }
    
    // Filter down to only the processors the merchant has explicitly enabled
    const enabledProcessors = availableProcessorsForMethod.filter(proc => {
        const key = proc.toLowerCase();
        const gatewayConfig = merchantGatewayFees?.[key as 'stripe' | 'square' | 'zelle' | 'interac' | 'wise'];
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
    
    if (input.paymentMethod === 'zelle' || input.paymentMethod === 'interac' || input.paymentMethod === 'wise') {
        const methodType = input.paymentMethod === 'zelle' ? 'Zelle' : (input.paymentMethod === 'interac' ? 'Interac' : 'Wise');
        console.log(`[createCheckoutSession] ${methodType} method detected. Selecting account atomically.`);
        await appLog({ ...logContext, description: `Step 4: Selecting ${methodType} account (atomic).`, plugin_status: 'info' });
        // Atomically pick the least-recently-used account and update its last_used_at to avoid races
        try {
            await runQuery('START TRANSACTION');
            const forUpdateRows: any[] = await executeQuery(
                `SELECT * FROM payment_accounts WHERE type = ? AND status = 'Active' AND currentVolume < dailyLimit ORDER BY last_used_at ASC, id ASC LIMIT 1 FOR UPDATE`,
                [methodType]
            );
            if (forUpdateRows && forUpdateRows.length > 0) {
                const candidate = forUpdateRows[0];
                const nowStr = formatDateForMySQL(new Date());
                try {
                    await runQuery(`UPDATE payment_accounts SET last_used_at = ? WHERE id = ?`, [nowStr, candidate.id]);
                    await runQuery('COMMIT');
                    // Reload the selected account row to ensure we have the latest values
                    const reloaded = await executeQuery(`SELECT * FROM payment_accounts WHERE id = ? LIMIT 1`, [candidate.id]);
                    selectedAccount = reloaded && reloaded.length > 0 ? reloaded[0] : candidate;
                    console.log(`[createCheckoutSession] Atomically selected account ID ${selectedAccount.id} for ${methodType}`);
                    await appLog({ ...logContext, description: `Step 4: Atomically selected account ID ${selectedAccount.id} for ${methodType}.`, plugin_status: 'info' });
                } catch (updErr) {
                    await runQuery('ROLLBACK');
                    console.warn('[createCheckoutSession] Failed to update last_used_at for selected account (rollback):', updErr);
                }
            } else {
                await runQuery('ROLLBACK');
                console.error(`❌ [createCheckoutSession] Error: No ${methodType} accounts available that are under their daily processing limit.`);
                await appLog({ ...logContext, description: `Error at Step 5: No ${methodType} accounts available under daily limit.`, plugin_status: 'error' });
            }
        } catch (txErr) {
            try { await runQuery('ROLLBACK'); } catch (e) {}
            console.warn('[createCheckoutSession] Account selection transaction failed (continuing):', txErr);
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
    
    const initialStatus = (input.paymentMethod === 'zelle' || input.paymentMethod === 'interac' || input.paymentMethod === 'wise') ? 'On-Hold' : 'Pending';
    
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
        input.paymentMethod === 'card' ? 'Credit Card' : (input.paymentMethod === 'zelle' ? 'Zelle' : (input.paymentMethod === 'interac' ? 'Interac' : 'Wise')),
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
    // Idempotency: check for existing order with same merchantOrderId + wooCommerceSiteUrl
    let orderResult: any;
    try {
        const existingQuery = `SELECT id, totalAmount, status, paymentAccountId, visualOrderId FROM orders WHERE merchantOrderId = ? AND wooCommerceSiteUrl LIKE ? LIMIT 1`;
        const existingParams = [input.merchantOrderId, wooSiteUrl ? `%${wooSiteUrl}%` : '%'];
        const existingRows = await executeQuery(existingQuery, existingParams as any[]);
        if (existingRows && existingRows.length > 0) {
            const existing = existingRows[0];
            const existingTotal = Number(existing.totalAmount || 0);
            const existingStatus = (existing.status || '').toString();
            // If the existing order is already completed, do not create/return a new session
            if (existingStatus.toLowerCase() === 'completed') {
                const errMsg = `Order ${input.merchantOrderId} has already been completed (order id=${existing.id}).`;
                console.warn(`❌ [createCheckoutSession] ${errMsg}`);
                await appLog({ ...logContext, description: `Attempt to create session for already completed order id=${existing.id}.`, plugin_status: 'error' });
                return { error: errMsg };
            }
            const requestedTotal = Number(input.totalAmount || 0);
            const diff = Math.abs(existingTotal - requestedTotal);
            // Allow tiny rounding differences (1 cent)
            if (diff <= 0.01) {
                console.log(`⚠️ [createCheckoutSession] Existing order found (id=${existing.id}) matching merchantOrderId=${input.merchantOrderId}. Reusing existing order.`);
                await appLog({ ...logContext, description: `Existing order reused id=${existing.id} for merchantOrderId=${input.merchantOrderId}.`, plugin_status: 'warning' });
                // Try to load the original payment account used for this order to keep session details consistent
                let accountForSession: any = null;
                try {
                    if (existing.paymentAccountId) {
                        const paRows = await executeQuery(`SELECT * FROM payment_accounts WHERE id = ? LIMIT 1`, [existing.paymentAccountId]);
                        if (paRows && paRows.length > 0) accountForSession = paRows[0];
                    }
                } catch (paErr) {
                    console.warn('[createCheckoutSession] Failed to load original payment account for reused order:', paErr);
                }
                // If we couldn't load original account, fall back to the account we selected earlier
                if (!accountForSession) accountForSession = selectedAccount;
                orderResult = { id: existing.id, paymentAccountForSession: accountForSession, visualOrderId: existing.visualOrderId };
            } else {
                const errMsg = `Existing order found with different totalAmount (existing=${existingTotal}, requested=${requestedTotal}).`;
                console.warn(`❌ [createCheckoutSession] ${errMsg}`);
                await appLog({ ...logContext, description: `Idempotency rejected: ${errMsg}`, plugin_status: 'error' });
                return { error: errMsg };
            }
        } else {
                await appLog({ ...logContext, description: `Step 7: Preparing to insert order into DB with visual ID ${visualId}. Enforcing merchant limits if applicable.`, plugin_status: 'info' });
                // Enforce per-merchant daily limits atomically using merchant_daily_limits table (if configured per payment type)
                try {
                                // Determine paymentType to check limits for: use selected gateway (e.g., 'Stripe','Square','Zelle','Interac','Wise')
                                // Use the stored `dailyUsed` value as the authoritative counter. The system updates `dailyUsed`
                                // only when an order is completed (or overpaid/refunded), so session creation should only
                                // block if `dailyUsed` is already at or above the `dailyLimit`.
                                const paymentType = selectedGateway;
                                const limitRows = await executeQuery(`SELECT * FROM merchant_daily_limits WHERE merchantId = ? AND paymentType = ? LIMIT 1`, [numericMerchantId, paymentType]);
                                if (limitRows && limitRows.length > 0) {
                                    const limitRow = limitRows[0];
                                    const dailyLimit = limitRow.dailyLimit === null ? null : Number(limitRow.dailyLimit || 0);
                                    const dailyUsed = limitRow.dailyUsed === null ? 0 : Number(limitRow.dailyUsed || 0);
                                    if (dailyLimit !== null && dailyLimit > 0) {
                                        // Block only when the merchant has already used up their allocation.
                                        if (dailyUsed >= dailyLimit) {
                                            const errMsg = 'This merchant has exceeded their daily processing limit for this payment type. Please try again tomorrow or contact support.';
                                            await appLog({ ...logContext, description: `Merchant daily limit exceeded for merchantId=${numericMerchantId}, paymentType=${paymentType}. limit=${dailyLimit}, dailyUsed=${dailyUsed}`, plugin_status: 'error' });
                                            return { error: errMsg };
                                        }
                                        // Otherwise allow the session. `dailyUsed` will be updated when the order reaches completed status.
                                    }
                                }
                } catch (limitErr) {
                    console.warn('[createCheckoutSession] Could not enforce merchant_daily_limits (continuing):', limitErr);
                }

                orderResult = await runQuery(orderInsertQuery, orderParams);
                await appLog({ ...logContext, description: `Step 8: Order inserted successfully with DB ID ${orderResult.id}.`, plugin_status: 'info' });
        }
    } catch (err) {
        console.error('[createCheckoutSession] Idempotency check failed, proceeding with insert:', err);
        await appLog({ ...logContext, description: `Idempotency check failed: ${String(err)}. Proceeding to insert.`, plugin_status: 'error' });
        orderResult = await runQuery(orderInsertQuery, orderParams);
        await appLog({ ...logContext, description: `Step 8: Order inserted successfully with DB ID ${orderResult.id}.`, plugin_status: 'info' });
    }
    const newOrderId = `CP${orderResult.id}`;
    console.log(`📝 [createCheckoutSession] Order created or reused in DB. Result:`, { newComfortPayId: newOrderId, dbInsertId: orderResult.id });
    // If a Zelle/Interac/Wise account was used, update its last_used_at timestamp.
    if (['Zelle', 'Interac', 'Wise'].includes(selectedAccount.type)) {
        console.log(`[createCheckoutSession] Updating last_used_at for account ID (${selectedAccount.type}): ${selectedAccount.id}`);
        await runQuery(
            `UPDATE payment_accounts SET last_used_at = ? WHERE id = ?`,
            [formatDateForMySQL(now), selectedAccount.id]
        );
        await appLog({ ...logContext, description: `Step 9: Updated last_used_at for account ID ${selectedAccount.id}.`, plugin_status: 'info' });
        console.log(`[createCheckoutSession] Timestamp updated successfully.`);
    }
    
    // Decide which account object to use for session payload (original order's account when reusing)
    const accountForSession = orderResult?.paymentAccountForSession ? orderResult.paymentAccountForSession : selectedAccount;

    const sessionDataWithDetails = { 
        ...input,
        wooCommerceOrderReceivedUrl: input.wooCommerceOrderReceivedUrl || input.redirectUrl,
        visualOrderId: orderResult?.visualOrderId || visualId,
        comfortPayOrderId: newOrderId,
        merchantOrigin: merchant.websiteUrl,
        processor: selectedGateway,
        paymentDetails: {
            ...input.paymentDetails, // Spread incoming details first
            paymentAccountId: `pa_${paymentAccountId}`, // Then overwrite/add our secure details
            qrCodeUrl: accountForSession?.qrCodeUrl || selectedAccount.qrCodeUrl,
            accountEmail: accountForSession?.accountEmail || selectedAccount.accountEmail,
            accountName: accountForSession?.name || selectedAccount.name || null,
            accountTag: accountForSession?.tag || selectedAccount.tag || null,
            zelleName: accountForSession?.name ?? '',
            // Backwards-compat: also expose `name` for older plugin templates
            name: accountForSession?.name ?? ''
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
