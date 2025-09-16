'use server';
/**
 * @fileOverview A server action for processing parsed Zelle webhook data.
 *
 * This action contains the core logic for matching a parsed Zelle email
 * to a pending order and updating the order status.
 */

import { executeQuery, runQuery } from '@/lib/db';
import {
  ZelleEmailParseOutputSchema,
  type ZelleEmailParseOutput,
} from '@/lib/schemas/zelle-email';
import type { Order } from '@/lib/types';

export async function processZelleWebhook(
  parsedData: ZelleEmailParseOutput
): Promise<{ status: string; reason?: string; message?: string }> {
  console.log('✅ [Action processZelleWebhook] Starting...');

  const validation = ZelleEmailParseOutputSchema.safeParse(parsedData);
  if (!validation.success) {
    console.error(
      '❌ [Action processZelleWebhook] Invalid parsed data:',
      validation.error.flatten()
    );
    throw new Error('Invalid parsed data provided to webhook processor.');
  }

  const { status, money_amount, name: nameFromEmail, payment_email } = validation.data;

  // If AI determined the email was invalid or key info is missing, stop processing.
  if (status !== 'confirmation' || !money_amount || !payment_email) {
    console.warn(
      "⚠️ [Action processZelleWebhook] Ignoring payment. Status was not 'confirmation' or key data was missing."
    );
    return {
      status: 'ignored',
      reason: `Payment status was '${status}' or amount/recipient email was missing.`,
    };
  }

  // Find potential matching orders within a +/- 30-minute window and amount tolerance.
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const amountLowerBound = money_amount - 3.0;

  console.log(`🔎 [Action processZelleWebhook] Searching for orders with criteria:`, {
    status: ['Pending', 'Requires Confirmation'],
    paymentMethod: 'Zelle',
    timeRange: `${thirtyMinutesAgo} to ${thirtyMinutesFromNow}`,
    amountRange: `>= ${amountLowerBound}`,
    recipientEmail: payment_email,
  });

  const potentialMatches: Order[] = await executeQuery(
    `SELECT o.*, JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.firstName')) as customerFirstName, JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.lastName')) as customerLastName
             FROM orders o
             JOIN payment_accounts pa ON o.paymentAccountId = pa.id
             WHERE o.status IN ('Pending', 'Requires Confirmation')
               AND o.paymentMethod = 'Zelle'
               AND o.orderDate BETWEEN ? AND ?
               AND o.totalAmount >= ?
               AND pa.accountEmail = ?`,
    [thirtyMinutesAgo, thirtyMinutesFromNow, amountLowerBound, payment_email]
  );

  if (potentialMatches.length === 0) {
    console.warn(
      '🤷 [Action processZelleWebhook] No pending Zelle orders found matching the criteria.'
    );
    return {
      status: 'no_match',
      reason:
        'No pending Zelle orders found for this recipient email in the specified time and amount range.',
    };
  }

  console.log(
    `✅ [Action processZelleWebhook] Found ${potentialMatches.length} potential matching order(s).`
  );

  let finalMatch: Order | undefined;

  // Tier 1: Exactly one match found
  if (potentialMatches.length === 1) {
    finalMatch = potentialMatches[0];
    console.log(
      `🎯 [Action processZelleWebhook] Tier 1 Success: Found exactly one match: Order ID ${finalMatch.id}`
    );
  } else if (nameFromEmail) {
    // Tier 2: Multiple matches, try filtering by last name
    console.log(
      `🤔 [Action processZelleWebhook] Tier 2: Multiple matches found. Filtering by last name: "${nameFromEmail}"`
    );
    const senderNameParts = nameFromEmail.toLowerCase().split(' ');
    const senderLastName = senderNameParts[senderNameParts.length - 1];

    const lastNameMatches = potentialMatches.filter(
      (o) => o.customerLastName && o.customerLastName.toLowerCase() === senderLastName
    );

    if (lastNameMatches.length === 1) {
      finalMatch = lastNameMatches[0];
      console.log(
        `🎯 [Action processZelleWebhook] Tier 2 Success: Found single match by last name: Order ID ${finalMatch.id}`
      );
    } else if (lastNameMatches.length > 1) {
      // Tier 3: Still multiple matches, try filtering by first name
      console.log(
        `🤔 [Action processZelleWebhook] Tier 3: Still multiple matches after last name filter. Filtering by first name.`
      );
      const senderFirstName = senderNameParts[0];
      const firstNameMatches = lastNameMatches.filter(
        (o) => o.customerFirstName && o.customerFirstName.toLowerCase() === senderFirstName
      );

      if (firstNameMatches.length === 1) {
        finalMatch = firstNameMatches[0];
        console.log(
          `🎯 [Action processZelleWebhook] Tier 3 Success: Found single match by first and last name: Order ID ${finalMatch.id}`
        );
      } else {
        console.warn(
          `🤷 [Action processZelleWebhook] Tier 3 Fail: ${firstNameMatches.length} matches found after first name filter. Aborting due to ambiguity.`
        );
      }
    } else {
      console.warn(`🤷 [Action processZelleWebhook] Tier 2 Fail: No matches found after last name filter.`);
    }
  }

  if (finalMatch) {
    const newPaidAmount = (Number(finalMatch.paidAmount) || 0) + money_amount;
    const newStatus = newPaidAmount >= finalMatch.totalAmount ? 'Completed' : 'Partially Paid';

    console.log(
      `✍️ [Action processZelleWebhook] Updating Order ID ${finalMatch.id}. New status: ${newStatus}, New paid amount: ${newPaidAmount}`
    );
    await runQuery(
      `UPDATE orders SET status = ?, paidAmount = ?, paymentReceivedDate = ? WHERE id = ?`,
      [newStatus, newPaidAmount, new Date().toISOString().slice(0, 19).replace('T', ' '), finalMatch.id]
    );

    return {
      status: 'success',
      message: `Order ${finalMatch.id} updated to '${newStatus}'.`,
    };
  } else {
    console.warn("🤷 [Action processZelleWebhook] No single, confident match found. No action taken.");
    return {
      status: 'no_confident_match',
      reason: `Could not determine a unique match from the ${potentialMatches.length} potential orders.`,
    };
  }
}
