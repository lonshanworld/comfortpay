
'use server';
/**
 * @fileOverview A centralized server action for confirming payments and finalizing orders.
 *
 * This action is the single source of truth for updating an order's payment status.
 * It handles updating the status, paid amount, and payment account volume.
 */

import { runQuery, executeQuery } from '@/lib/db';
import type { Order, OrderStatus } from '@/lib/types';
import { notifyWooCommerce } from '@/app/actions/notify-woocommerce';
import { formatDateForMySQL } from '@/lib/utils';

interface ConfirmPaymentInput {
    order: Order;
    amountReceived: number;
}


export async function confirmOrderPayment({ order, amountReceived }: ConfirmPaymentInput): Promise<{ success: boolean; message: string; newStatus?: OrderStatus }> {
    console.log(`--- [Action confirmOrderPayment] Confirming payment for Order ID: ${order.id} ---`);
    console.log(`   - Amount Received: ${amountReceived}`);
    console.log(`   - Current Order Status: ${order.status}`);
    console.log(`   - Current Paid Amount: ${order.paidAmount}`);
    console.log(`   - Current Total Amount: ${order.totalAmount}`);

    try {
        const numericId = String(order.id).replace('CP', '');
        // Fetch the latest order details to prevent race conditions
        const freshOrderResult: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
        if (freshOrderResult.length === 0) {
            throw new Error("Order not found.");
        }
        const currentOrder: Order = freshOrderResult[0];
        
        // Prevent re-processing if already completed and no new amount is added
        if (currentOrder.status === 'Completed' && amountReceived <= 0) {
            console.log(`   - Skipping: Order ${order.id} is already completed.`);
            return { success: true, message: `Order ${order.id} is already completed.`, newStatus: 'Completed' };
        }

        const newPaidAmount = (Number(currentOrder.paidAmount) || 0) + amountReceived;
        
        // Check if the new paid amount is sufficient to consider the order fully paid.
        // This allows for a small underpayment tolerance of $3.00.
        // It also correctly handles overpayments (newPaidAmount > totalAmount).
        const isFullyPaid = newPaidAmount >= (currentOrder.totalAmount - 3.00);
        const newStatus: OrderStatus = isFullyPaid ? 'Completed' : 'Partially Paid';
        
        console.log(`   - Step 1: Updating order. New Paid Amount: ${newPaidAmount}. Calculated New Status: ${newStatus}`);
        
        await runQuery(
            `UPDATE orders SET status = ?, paidAmount = ?, paymentReceivedDate = ? WHERE id = ?`,
            [newStatus, newPaidAmount, new Date().toISOString().slice(0, 19).replace('T', ' '), numericId]
        );
        console.log(`   - Step 1 Succeeded.`);

        // --- Volume & Notification Logic ---
        // Only update volume and notify WooCommerce if the order is newly marked as fully paid.
        if (isFullyPaid && currentOrder.status !== 'Completed') {
            if (currentOrder.paymentAccountId && newPaidAmount > 0) {
                console.log(`   - Step 2: Order is now fully paid. Updating volume for Payment Account ID: ${currentOrder.paymentAccountId} by ${newPaidAmount}.`);
                const numericAccountId = String(currentOrder.paymentAccountId).replace('pa_', '');
                
                // Increase volume by the *total paid amount* now that it's complete.
                await runQuery(
                    `UPDATE payment_accounts SET currentVolume = currentVolume + ? WHERE id = ?`,
                    [newPaidAmount, numericAccountId]
                );
                console.log(`   - Step 2 Succeeded.`);
            } else {
                 console.warn(`   - Step 2 Skipped: Missing paymentAccountId or paid amount is zero.`);
            }

            // --- Merchant daily limits: increment dailyUsed when order becomes Completed ---
            try {
                const paymentType = currentOrder.paymentType || null;
                if (paymentType) {
                    const nowStr = formatDateForMySQL(new Date());
                    // Atomically upsert/increment dailyUsed for this merchant + paymentType
                    await runQuery('START TRANSACTION');
                    try {
                        const forUpdate = await executeQuery(`SELECT * FROM merchant_daily_limits WHERE merchantId = ? AND paymentType = ? FOR UPDATE`, [currentOrder.merchantId, paymentType]);
                        if (forUpdate && forUpdate.length > 0) {
                            const row = forUpdate[0];
                            const prev = Number(row.dailyUsed || 0);
                            const newDailyUsed = prev + newPaidAmount;
                            await runQuery(`UPDATE merchant_daily_limits SET dailyUsed = ?, updatedAt = ? WHERE merchantId = ? AND paymentType = ?`, [newDailyUsed, nowStr, currentOrder.merchantId, paymentType]);
                            console.log(`   - Step 2b: Incremented merchant_daily_limits.dailyUsed for merchant ${currentOrder.merchantId}, type ${paymentType} by ${newPaidAmount}.`);
                        } else {
                            // Insert a row with dailyUsed = newPaidAmount (dailyLimit left NULL if not configured)
                            await runQuery(`INSERT INTO merchant_daily_limits (merchantId, paymentType, dailyLimit, dailyUsed, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?, ?)`, [currentOrder.merchantId, paymentType, newPaidAmount, nowStr, nowStr]);
                            console.log(`   - Step 2b: Inserted merchant_daily_limits row for merchant ${currentOrder.merchantId}, type ${paymentType} with dailyUsed=${newPaidAmount}.`);
                        }
                        await runQuery('COMMIT');
                    } catch (txErr) {
                        await runQuery('ROLLBACK');
                        console.warn('Failed to increment merchant_daily_limits.dailyUsed after order completion:', txErr);
                    }
                }
            } catch (e) {
                console.warn('Failed to update merchant_daily_limits after completion (continuing):', e);
            }

            if (currentOrder.wooCommerceSiteUrl) {
                console.log(`   - Step 3: Triggering WooCommerce notification.`);
                const completeOrderForNotification = { ...currentOrder, id: order.id, status: newStatus };
                await notifyWooCommerce(completeOrderForNotification, 'Completed');
                console.log(`   - Step 3 Succeeded.`);
            }
        } else if (newStatus === 'Partially Paid') {
            console.log(`   - Step 2 & 3 Skipped: Order is partially paid. Volume will be updated upon completion.`);
            // Optionally, notify WooCommerce about partial payment if needed in the future.
        } else {
             console.log(`   - Steps 2 & 3 Skipped: Order was already complete or status unchanged.`);
        }
        
        const successMessage = `Order ${order.id} updated to '${newStatus}'.`;
        console.log(`--- [Action confirmOrderPayment] Finished Successfully: ${successMessage} ---`);
        return { success: true, message: successMessage, newStatus };

    } catch (error: any) {
        const errorMessage = `Failed to confirm payment for order ${order.id}: ${error.message}`;
        console.error(`--- [Action confirmOrderPayment] FAILED: ${errorMessage} ---`);
        console.error(error);
        return { success: false, message: errorMessage };
    }
}
