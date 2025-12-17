
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';
import { formatDateForMySQL } from '@/lib/utils';
import type { Order } from '@/lib/types';
import { notifyWooCommerce } from '@/app/actions/notify-woocommerce';
import { confirmOrderPayment } from '@/app/actions/confirm-order-payment';

export async function GET(
  request: Request,
  context: { params: Promise<{ id:string }> }
) {
  const { id } = await context.params;
  const numericId = id.replace('CP', '');
  try {
    const results: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
    if (results.length === 0) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    const order = results[0];
    order.id = `CP${order.id}`;
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ message: 'Order not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const numericId = id.replace('CP', '');
  const body = await request.json();

  try {
    const [currentOrder]: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
    if (!currentOrder) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const wasCompleted = currentOrder.status === 'Completed';
    const isNowBeingCompleted = body.status === 'Completed';
    const isNowOverpaidRefunded = body.status === 'Over-paid Refunded';

    // If the order is being manually marked as 'Completed' for the first time
    if (isNowBeingCompleted && !wasCompleted) {
        console.log(`[API Order PUT] Manual status change to 'Completed' detected for order ${id}.`);
        
        // The amount received is the difference between the total and what was already paid.
        const amountReceived = Math.max(0, currentOrder.totalAmount - currentOrder.paidAmount);

        // Use the centralized action to ensure all logic (volume update, etc.) is run.
        const result = await confirmOrderPayment({
            order: { ...currentOrder, id: `CP${numericId}` },
            amountReceived: amountReceived
        });

        if (!result.success) {
            throw new Error(`Failed to confirm payment via action: ${result.message}`);
        }
        
    } else if (isNowOverpaidRefunded && wasCompleted) {
      const overpaidAmount = currentOrder.paidAmount - currentOrder.totalAmount;
        if (overpaidAmount > 0 && currentOrder.paymentAccountId) {
            await runQuery('START TRANSACTION');
            try {
                // Correct the volume on the payment account
                await runQuery('UPDATE payment_accounts SET currentVolume = currentVolume - ? WHERE id = ?', [overpaidAmount, currentOrder.paymentAccountId]);
                // Update the order status and paid amount
                await runQuery("UPDATE orders SET status = ?, paidAmount = ? WHERE id = ?", [body.status, currentOrder.totalAmount, numericId]);
          // Also decrement merchant-level daily usage for this payment type
          try {
            if (currentOrder.merchantId && currentOrder.paymentType) {
              await runQuery(
                'UPDATE merchant_daily_limits SET dailyUsed = GREATEST(0, dailyUsed - ?) WHERE merchantId = ? AND paymentType = ?',
                [overpaidAmount, currentOrder.merchantId, currentOrder.paymentType]
              );
              console.log(`[API Order PUT] Decremented merchant_daily_limits for merchant ${currentOrder.merchantId}, type ${currentOrder.paymentType} by ${overpaidAmount}.`);
            }
          } catch (err) {
            console.warn('Failed to decrement merchant_daily_limits.dailyUsed during overpaid-refund handling:', err);
          }
                await runQuery('COMMIT');
                console.log(`[API Order PUT] Corrected volume for account ${currentOrder.paymentAccountId} by ${overpaidAmount} due to overpayment refund.`);
            } catch (e) {
                await runQuery('ROLLBACK');
                console.error("Error during overpayment refund transaction:", e);
                throw new Error("Database error while processing overpayment refund.");
            }
        } else {
            // If no overpayment or no account, just update the status
            await runQuery("UPDATE orders SET status = ? WHERE id = ?", [body.status, numericId]);
        }
    }else {
        // For all other status updates, or if it was already complete, just update the fields.
        const validColumns = [
          'merchantId', 'merchantOrderId', 'visualOrderId', 'orderDate', 'paymentReceivedDate',
          'customerName', 'customerEmail', 'status', 'paymentMethod', 'orderAmount', 'totalAmount',
          'paidAmount', 'currency', 'paymentType', 'paymentGatewayTransactionId', 'billingDetails',
          'paymentAccountId'
        ];

        const fieldsToUpdate: string[] = [];
        const queryParams: any[] = [];
           // If the status is being changed to 'Over-paid Refunded', adjust the paidAmount
        // if (body.status === 'Over-paid Refunded' && currentOrder.status !== 'Over-paid Refunded') {
        //     body.paidAmount = currentOrder.totalAmount;
        // }

        const newPaymentAccountId = body.paymentAccountId ? String(body.paymentAccountId).replace('pa_', '') : null;
        const oldPaymentAccountId = currentOrder.paymentAccountId;

        // Check if the payment account has been changed
        if ('paymentAccountId' in body && newPaymentAccountId != oldPaymentAccountId && oldPaymentAccountId && wasCompleted) {
            console.log(`[API Order PUT] Reassigning completed order ${id} from account ${oldPaymentAccountId} to ${newPaymentAccountId}.`);
            
            await runQuery('START TRANSACTION');
            try {

                // Increment volume on the new account
                //  await runQuery(
                //     'UPDATE payment_accounts SET currentVolume = currentVolume + ? WHERE id = ?',
                //     [currentOrder.totalAmount, newPaymentAccountId]
                // );


                 // Decrement volume from the old account
                  const [oldAccountResult]: any[] = await executeQuery('SELECT currentVolume FROM payment_accounts WHERE id = ?', [oldPaymentAccountId]);
                 const oldAccountVolume = oldAccountResult[0]?.currentVolume || 0;

                 await runQuery('UPDATE payment_accounts SET currentVolume = currentVolume + ? WHERE id = ?', [currentOrder.totalAmount, newPaymentAccountId]);

                console.log(`[API Order PUT] Incremented volume on new account ${newPaymentAccountId}.`);

                // Only decrement from the old account if it has enough volume to cover the transaction
                if (oldAccountVolume >= currentOrder.totalAmount) {
                    console.log(`[API Order PUT] Old account has sufficient volume. Decrementing volume from old account ${oldPaymentAccountId}.`);
                    // await runQuery(
                    //     'UPDATE payment_accounts SET currentVolume = currentVolume - ? WHERE id = ?',
                    //     [currentOrder.totalAmount, oldPaymentAccountId]
                    // );
                     await runQuery('UPDATE payment_accounts SET currentVolume = currentVolume - ? WHERE id = ?', [currentOrder.totalAmount, oldPaymentAccountId]);
                } else {
                    console.log(`[API Order PUT] Old account volume (${oldAccountVolume}) is less than transaction amount (${currentOrder.totalAmount}). Skipping decrement.`);
                }
                

                
                
                await runQuery('COMMIT');
                console.log(`[API Order PUT] Volume transfer logic completed successfully.`);


            } catch (error) {
                await runQuery('ROLLBACK');
                console.error(`[API Order PUT] Error during volume transfer, transaction rolled back.`, error);
                throw new Error("Failed to transfer payment volume between accounts.");
            }
        }

        for (const key of validColumns) {
          if (Object.prototype.hasOwnProperty.call(body, key)) {
            let value = body[key];
            
            if (key === 'merchantId' && typeof value === 'string' && value.startsWith('user_')) {
              value = value.split('_')[1];
            }

             if (key === 'paymentAccountId' && typeof value === 'string' && value.startsWith('pa_')) {
              value = value.split('_')[1];
            }
            
            if (key === 'orderDate' || key === 'paymentReceivedDate') {
              value = value ? formatDateForMySQL(new Date(value)) : null;
            } else if (typeof value === 'object' && value !== null) {
              value = JSON.stringify(value);
            } else if (value === undefined || value === '') {
               value = null;
            }
            
            fieldsToUpdate.push(`${key} = ?`);
            queryParams.push(value);
          }
        }

        if (fieldsToUpdate.length > 0) {
            const query = `UPDATE orders SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
            queryParams.push(numericId);
            await runQuery(query, queryParams);
        }
    }

    // Fetch the fully updated order to return
    const finalOrderResult: any[] = await executeQuery("SELECT * FROM orders WHERE id = ?", [numericId]);
    
    if (finalOrderResult.length === 0) {
      return NextResponse.json({ message: 'Failed to retrieve updated order' }, { status: 500 });
    }
    
    const finalOrder = finalOrderResult[0];
    finalOrder.id = `CP${finalOrder.id}`;
    return NextResponse.json(finalOrder);
    
  } catch (error: any) {
    console.error(`Failed to update order ${id}:`, error);
    return NextResponse.json({ message: `Error updating order: ${error.message}` }, { status: 500 });
  }
}
