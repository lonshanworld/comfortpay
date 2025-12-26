'use server';
/**
 * Generalized processor for payment-email webhooks (Zelle / Interac / Wise).
 *
 * Reuses the same matching/confirmation flow as the Zelle processor but
 * allows the incoming `paymentType` to select orders by `paymentMethod` and
 * attempts to match against multiple payment account identifier fields
 * (email, phone, tag, qrCodeUrl) to support different channels.
 */

import { executeQuery } from '@/lib/db';
import {
  PaymentEmailParseOutputSchema,
  type PaymentEmailParseOutput,
} from '@/lib/schemas/payment-email';
import type { Order } from '@/lib/types';
import { confirmOrderPayment } from './confirm-order-payment';
import { notifyWooCommerce } from './notify-woocommerce';

export async function processPaymentWebhook(
  parsedData: PaymentEmailParseOutput
): Promise<{ status: string; reason?: string; message?: string }> {
  console.log('✅ [Action processPaymentWebhook] Starting...');

  const validation = PaymentEmailParseOutputSchema.safeParse(parsedData);
  if (!validation.success) {
    console.error(
      '❌ [Action processPaymentWebhook] Invalid parsed data:',
      validation.error.flatten()
    );
    throw new Error('Invalid parsed data provided to payment webhook processor.');
  }

  const { status, money_amount, name: nameFromEmail, payment_email, datetime, paymentType, orderId } = validation.data;

  if (status !== 'confirmation' || !money_amount || !payment_email) {
    console.warn(
      "⚠️ [Action processPaymentWebhook] Ignoring payment. Status was not 'confirmation' or key data was missing."
    );
    return {
      status: 'ignored',
      reason: `Payment status was '${status}' or amount/recipient identifier missing.`,
    };
  }

  const now = new Date();
  let paymentTime = datetime ? new Date(datetime) : now;
  if (isNaN(paymentTime.getTime())) paymentTime = now;
  // Use asymmetric window: 30 minutes before, 2 hours after the payment time
  const windowBeforeMs = 30 * 60 * 1000; // 30 minutes before
  const windowAfterMs = 2 * 60 * 60 * 1000; // 2 hours after
  const windowStart = new Date(paymentTime.getTime() - windowBeforeMs);
  const windowEnd = new Date(paymentTime.getTime() + windowAfterMs);
  const windowStartSql = windowStart.toISOString().slice(0, 19).replace('T', ' ');
  const windowEndSql = windowEnd.toISOString().slice(0, 19).replace('T', ' ');
  const amountTolerance = 3.0;
  const amountLowerBound = (money_amount ?? 0) - amountTolerance;
  const amountUpperBound = (money_amount ?? 0) + amountTolerance;


  const method = (paymentType || 'zelle').toString().toLowerCase();

  // If caller provided an orderId, prefer direct lookup using `merchantOrderId`
  // (external parser will supply a platform order identifier that maps to
  // the `merchantOrderId` column on `orders`). Short-circuit other matching.
  if (orderId) {
    const merchantOrderIdValue = String(orderId).trim();

    if (!merchantOrderIdValue) {
      return { status: 'invalid_order_id', reason: 'Provided orderId is empty.' };
    }

    const directMatches: Order[] = await executeQuery(
      `SELECT o.*, pa.accountEmail as paymentAccountEmail, u.name as merchantName, u.websiteUrl as merchantWebsiteUrl,
             JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.firstName')) as customerFirstName,
             JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.lastName')) as customerLastName
             FROM orders o
             JOIN payment_accounts pa ON o.paymentAccountId = pa.id
             LEFT JOIN users u ON o.merchantId = u.id
             WHERE o.merchantOrderId = ?
             LIMIT 1`,
      [merchantOrderIdValue]
    );

    if (!directMatches || directMatches.length === 0) {
      return { status: 'no_match', reason: `No order found with merchantOrderId ${merchantOrderIdValue}` };
    }

    const finalMatch = directMatches[0];
    const result = await confirmOrderPayment({
      order: { ...finalMatch, id: `CP${finalMatch.id}` },
      amountReceived: money_amount,
    });

    if (result.success) {
      return { status: 'success', message: `Order ${finalMatch.id} updated to '${result.newStatus}'.` };
    }

    return { status: 'update_failed', reason: result.message };
  }
  console.log('[processPaymentWebhook] incoming parsedData:', parsedData);

  console.log(`🔎 [Action processPaymentWebhook] Searching for orders with criteria:`, {
    status: ['Pending', 'Requires Confirmation', 'Partially Paid', 'On-Hold'],
    paymentMethod: method,
    timeRange: `${windowStartSql} (30m before) to ${windowEndSql} (2h after)`,
    amountRange: `${amountLowerBound} to ${amountUpperBound}`,
    recipientIdentifier: payment_email,
  });

  // Try matching against several account identifier fields to support different processors.
  const potentialMatches: Order[] = await executeQuery(
    `SELECT o.*, pa.accountEmail as paymentAccountEmail, u.name as merchantName, u.websiteUrl as merchantWebsiteUrl,
             JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.firstName')) as customerFirstName,
             JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.lastName')) as customerLastName
             FROM orders o
             JOIN payment_accounts pa ON o.paymentAccountId = pa.id
             LEFT JOIN users u ON o.merchantId = u.id
             WHERE o.status IN ('Pending', 'Requires Confirmation', 'Partially Paid', 'On-Hold')
               AND o.paymentMethod = ?
               AND o.orderDate BETWEEN ? AND ?
               AND o.totalAmount BETWEEN ? AND ?
               AND (
                   pa.accountEmail = ?
               )
             `,
    [method, windowStartSql, windowEndSql, amountLowerBound, amountUpperBound, payment_email]
  );

  if (potentialMatches.length === 0) {
    console.warn(
      `🤷 [Action processPaymentWebhook] No pending ${method} orders found matching the criteria.`
    );
    return {
      status: 'no_match',
      reason: `No pending ${method} orders found for this recipient identifier in the specified time and amount range.`,
    };
  }

  console.log(`✅ [Action processPaymentWebhook] Found ${potentialMatches.length} potential matching order(s).`);
  console.log('[processPaymentWebhook] potentialMatches summary:', potentialMatches.map((o) => ({ id: o.id, merchantOrderId: (o as any).merchantOrderId, totalAmount: o.totalAmount, orderDate: o.orderDate, paymentAccountEmail: (o as any).paymentAccountEmail })));

  let finalMatch: Order | undefined;

  // Tier 1: Exactly one match found
  if (potentialMatches.length === 1) {
    finalMatch = potentialMatches[0];
    console.log(`🎯 [Action processPaymentWebhook] Tier 1 Success: Found exactly one match: Order ID ${finalMatch.id}`);
  } else if (nameFromEmail) {
    // Tier 2: Multiple matches, try filtering by last name
    console.log(`🤔 [Action processPaymentWebhook] Tier 2: Multiple matches found. Filtering by last name: "${nameFromEmail}"`);
    const senderNameParts = nameFromEmail.toLowerCase().split(' ');
    const senderLastName = senderNameParts[senderNameParts.length - 1];

    const lastNameMatches = potentialMatches.filter(
      (o) => o.customerLastName && o.customerLastName.toLowerCase() === senderLastName
    );

    if (lastNameMatches.length === 1) {
      finalMatch = lastNameMatches[0];
      console.log(`🎯 [Action processPaymentWebhook] Tier 2 Success: Found single match by last name: Order ID ${finalMatch.id}`);
    } else if (lastNameMatches.length > 1) {
      // Tier 3: Still multiple matches, try filtering by first name
      console.log(`🤔 [Action processPaymentWebhook] Tier 3: Still multiple matches after last name filter. Filtering by first name.`);
      const senderFirstName = senderNameParts[0];
      const firstNameMatches = lastNameMatches.filter(
        (o) => o.customerFirstName && o.customerFirstName.toLowerCase() === senderFirstName
      );

      if (firstNameMatches.length === 1) {
        finalMatch = firstNameMatches[0];
        console.log(`🎯 [Action processPaymentWebhook] Tier 3 Success: Found single match by first and last name: Order ID ${finalMatch.id}`);
      } else {
        const ambiguousMatches = firstNameMatches.length > 0 ? firstNameMatches : lastNameMatches;
        if (ambiguousMatches.length > 0) {
          console.log(`🤔 [Action processPaymentWebhook] Tier 4: ${ambiguousMatches.length} ambiguous matches remain. Applying time-based tie-breaker.`);

          let closestMatch: Order | undefined;
          let smallestTimeDiff = Infinity;

          for (const order of ambiguousMatches) {
            const orderTime = new Date(order.orderDate);
            const timeDiff = Math.abs(paymentTime.getTime() - orderTime.getTime());

            // Ensure the order was created before the payment, but within our window
            if (orderTime <= paymentTime && timeDiff < smallestTimeDiff) {
              smallestTimeDiff = timeDiff;
              closestMatch = order;
            }
          }

          if (closestMatch) {
            finalMatch = closestMatch;
            console.log(`🎯 [Action processPaymentWebhook] Tier 4 Success: Found closest match by time: Order ID ${finalMatch.id} (Time diff: ${smallestTimeDiff}ms)`);
          } else {
            console.warn(`🤷 [Action processPaymentWebhook] Tier 4 Fail: Could not find a suitable match based on time. Aborting.`);
          }

        } else {
          console.warn(`🤷 [Action processPaymentWebhook] Tier 3 Fail: No matches found after first name filter. Aborting due to ambiguity.`);
        }
      }
    } else {
      console.warn(`🤷 [Action processPaymentWebhook] Tier 2 Fail: No matches found after last name filter.`);
    }
  }

  if (finalMatch) {
    const result = await confirmOrderPayment({
      order: { ...finalMatch, id: `CP${finalMatch.id}` },
      amountReceived: money_amount,
    });

    if (result.success) {
      // Trigger WooCommerce notification similar to old Zelle flow.
      try {
        await notifyWooCommerce(finalMatch);
      } catch (e) {
        console.warn('[processPaymentWebhook] notifyWooCommerce failed:', e);
      }

      return {
        status: 'success',
        message: `Order ${finalMatch.id} updated to '${result.newStatus}'.`,
      };
    } else {
      return {
        status: 'update_failed',
        reason: result.message,
      };
    }
  } else {
    console.warn('🤷 [Action processPaymentWebhook] No single, confident match found. No action taken.');
    return {
      status: 'no_confident_match',
      reason: `Could not determine a unique match from the ${potentialMatches.length} potential orders.`,
    };
  }
}
