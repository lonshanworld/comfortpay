
'use server';
/**
 * @fileOverview A centralized server action for confirming payments and finalizing orders.
 *
 * This action is the single source of truth for updating an order's payment status.
 * It handles updating the status, paid amount, payment account volume, and notifying WooCommerce.
 */

import { runQuery, executeQuery } from '@/lib/db';
import type { Order, OrderStatus } from '@/lib/types';
import { notifyWooCommerce } from '@/app/actions/notify-woocommerce';

interface ConfirmPaymentInput {
    order: Order;
    amountReceived: number;
}

export async function confirmOrderPayment({ order, amountReceived }: ConfirmPaymentInput): Promise<{ success: boolean; message: string; newStatus?: OrderStatus }> {
    console.log(`--- [Action confirmOrderPayment] Confirming payment for Order ID: ${order.id} ---`);
    console.log(`   - Amount Received: ${amountReceived}`);

    try {
        const numericId = String(order.id).replace('CP', '');
        // Fetch the latest order details to prevent race conditions
        const freshOrderResult: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
        if (freshOrderResult.length === 0) {
            throw new Error("Order not found.");
        }
        const currentOrder: Order = freshOrderResult[0];
        
        // Prevent re-processing if already completed
        if (currentOrder.status === 'Completed' && amountReceived <= 0) {
            console.log(`   - Skipping: Order ${order.id} is already completed.`);
            return { success: true, message: `Order ${order.id} is already completed.`, newStatus: 'Completed' };
        }

        const newPaidAmount = (Number(currentOrder.paidAmount) || 0) + amountReceived;
        
        // Use a small tolerance for floating point comparisons
        const isFullyPaid = Math.abs(newPaidAmount - currentOrder.totalAmount) < 3.00;
        const newStatus: OrderStatus = isFullyPaid ? 'Completed' : 'Partially Paid';
        
        console.log(`   - Step 1: Updating order. New Status: ${newStatus}, New Paid Amount: ${newPaidAmount}`);
        
        await runQuery(
            `UPDATE orders SET status = ?, paidAmount = ?, paymentReceivedDate = ? WHERE id = ?`,
            [newStatus, newPaidAmount, new Date().toISOString().slice(0, 19).replace('T', ' '), numericId]
        );
        console.log(`   - Step 1 Succeeded.`);

        // Only update volume and notify WooCommerce if the order is newly marked as fully paid.
        // This prevents double-counting if the action is run again on an already completed order.
        if (isFullyPaid && currentOrder.status !== 'Completed') {
            if (currentOrder.paymentAccountId && typeof currentOrder.totalAmount !== 'undefined') {
                console.log(`   - Step 2: Order is fully paid. Updating volume for Payment Account ID: ${currentOrder.paymentAccountId}.`);
                const numericAccountId = String(currentOrder.paymentAccountId).replace('pa_', '');
                
                await runQuery(
                    `UPDATE payment_accounts SET currentVolume = currentVolume + ? WHERE id = ?`,
                    [Number(currentOrder.totalAmount), numericAccountId]
                );
                console.log(`   - Step 2 Succeeded.`);
            } else {
                 console.warn(`   - Step 2 Skipped: Missing paymentAccountId or totalAmount for volume update.`);
            }

            if (currentOrder.wooCommerceSiteUrl) {
                console.log(`   - Step 3: Triggering WooCommerce notification.`);
                // We need to pass the *full* order object to the notification function, including the new status
                const completeOrderForNotification = { ...currentOrder, id: order.id, status: newStatus };
                await notifyWooCommerce(completeOrderForNotification, 'Completed');
                console.log(`   - Step 3 Succeeded.`);
            }
        }
        //  else if (newStatus === 'Partially Paid' && currentOrder.wooCommerceSiteUrl) {
        //     console.log(`   - Step 3: Triggering WooCommerce 'Partially Paid' notification.`);
        //     const partialOrderForNotification = { ...currentOrder, id: order.id, status: newStatus };
        //     await notifyWooCommerce(partialOrderForNotification, 'Partially Paid');
        //     console.log(`   - Step 3 Succeeded.`);
        // }
         else {
             console.log(`   - Steps 2 & 3 Skipped or not applicable.`);
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
