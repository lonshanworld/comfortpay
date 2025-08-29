
/**
 * @fileOverview Email template generators for transactional emails.
 *
 * This file contains functions that produce the subject and body
 * for various email notifications sent by the platform.
 */

import type { SendOrderNotificationInput } from "@/lib/types";

// Basic inline styles for email compatibility
const styles = {
    body: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f2f2f2; margin: 0; padding: 0;`,
    container: `max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;`,
    header: `background-color: #6699CC; color: #ffffff; padding: 20px; text-align: center;`,
    headerTitle: `margin: 0; font-size: 24px;`,
    content: `padding: 30px;`,
    p: `font-size: 16px; line-height: 1.5; color: #333333;`,
    h3: `font-size: 20px; color: #333333; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #eeeeee; padding-bottom: 5px;`,
    table: `width: 100%; border-collapse: collapse; margin-bottom: 20px;`,
    th: `border: 1px solid #dddddd; text-align: left; padding: 8px; background-color: #f9f9f9;`,
    td: `border: 1px solid #dddddd; text-align: left; padding: 8px;`,
    footer: `text-align: center; padding: 20px; font-size: 12px; color: #777777;`,
    strong: `color: #6699CC;`
};


export const getCustomerEmailContent = (input: SendOrderNotificationInput) => {
    const { orderDetails, merchantName } = input;
    const { visualOrderId, totalAmount, billingDetails, items, customerName } = orderDetails;

    const subject = `Invoice for Transaction ${visualOrderId} from ${merchantName}`;
    
    const itemsHtml = (items || []).map(item => `
        <tr>
            <td style="${styles.td}">${item.name}</td>
            <td style="${styles.td}">${item.quantity}</td>
            <td style="${styles.td}">$${Number(item.price).toFixed(2)}</td>
            <td style="${styles.td}">$${(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
        </tr>
    `).join('');
    
    const billingInfoHtml = billingDetails ? `
        ${billingDetails.firstName} ${billingDetails.lastName}<br>
        ${billingDetails.address1}${billingDetails.address2 ? `, ${billingDetails.address2}` : ''}<br>
        ${billingDetails.city}, ${billingDetails.state} ${billingDetails.postcode}<br>
        ${billingDetails.country}<br>
        Email: ${billingDetails.email}<br>
        Phone: ${billingDetails.phone || 'N/A'}
    ` : `
        ${customerName}
    `;

    const body = `
<body style="${styles.body}">
    <div style="${styles.container}">
        <div style="${styles.header}">
            <h1 style="${styles.headerTitle}">Thank You For Your Transaction!</h1>
        </div>
        <div style="${styles.content}">
            <p style="${styles.p}">Dear ${billingDetails?.firstName || customerName},</p>
            <p style="${styles.p}">This email confirms your payment processed by ComfortPay on behalf of <strong>${merchantName}</strong>.</p>
            
            <h3 style="${styles.h3}">Invoice Summary</h3>
            <p style="${styles.p}">
                <strong>Transaction ID:</strong> ${visualOrderId}<br>
                <strong>Total Amount:</strong> $${Number(totalAmount).toFixed(2)}<br>
                <strong>Payment Method:</strong> ${orderDetails.paymentMethod}
            </p>

            <h3 style="${styles.h3}">Transaction Items</h3>
            <table style="${styles.table}">
                <thead>
                    <tr>
                        <th style="${styles.th}">Item</th>
                        <th style="${styles.th}">Quantity</th>
                        <th style="${styles.th}">Unit Price</th>
                        <th style="${styles.th}">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                     <tr>
                        <td colspan="3" style="${styles.td} text-align: right; font-weight: bold;"><strong>Grand Total</strong></td>
                        <td style="${styles.td} font-weight: bold;"><strong>$${Number(totalAmount).toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>
            
            <h3 style="${styles.h3}">Billing Information</h3>
            <p style="${styles.p}">
                ${billingInfoHtml}
            </p>
            
            <p style="${styles.p}">If you have any questions about your transaction, please contact ${merchantName} directly.</p>
        </div>
        <div style="${styles.footer}">
            <p>ComfortPay | Secure & Seamless Payments</p>
        </div>
    </div>
</body>
`;

    return { subject, body };
}

export const getMerchantEmailContent = (input: SendOrderNotificationInput) => {
    const { orderDetails, merchantName } = input;
    const { visualOrderId, totalAmount, billingDetails, items, customerName } = orderDetails;

    const subject = `New Transaction Notification: ${visualOrderId}`;
    
    const itemsHtml = (items || []).map(item => `
        <tr>
            <td style="${styles.td}">${item.name}</td>
            <td style="${styles.td}">${item.quantity}</td>
            <td style="${styles.td}">$${Number(item.price).toFixed(2)}</td>
            <td style="${styles.td}">$${(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
        </tr>
    `).join('');

    const billingInfoHtml = billingDetails ? `
        ${billingDetails.firstName} ${billingDetails.lastName}<br>
        ${billingDetails.address1}${billingDetails.address2 ? `, ${billingDetails.address2}` : ''}<br>
        ${billingDetails.city}, ${billingDetails.state} ${billingDetails.postcode}<br>
        ${billingDetails.country}<br>
        Email: ${billingDetails.email}<br>
        Phone: ${billingDetails.phone || 'N/A'}
    ` : `
        ${customerName}
    `;

    const body = `
<body style="${styles.body}">
    <div style="${styles.container}">
        <div style="${styles.header}">
            <h1 style="${styles.headerTitle}">New Transaction Received!</h1>
        </div>
        <div style="${styles.content}">
            <p style="${styles.p}">Hello ${merchantName},</p>
            <p style="${styles.p}">A payment of <strong style="${styles.strong}">$${Number(totalAmount).toFixed(2)}</strong> for transaction <strong style="${styles.strong}">${visualOrderId}</strong> has been successfully processed by ComfortPay. Please prepare for fulfillment.</p>
            
            <h3 style="${styles.h3}">Transaction & Customer Details</h3>
             <p style="${styles.p}">
                <strong>ComfortPay Transaction ID:</strong> ${visualOrderId}<br>
                <strong>Your Transaction ID:</strong> ${orderDetails.merchantOrderId}<br>
                <strong>Payment Method:</strong> ${orderDetails.paymentMethod}
            </p>

            <h3 style="${styles.h3}">Transaction Items</h3>
            <table style="${styles.table}">
                 <thead>
                    <tr>
                        <th style="${styles.th}">Item</th>
                        <th style="${styles.th}">Quantity</th>
                        <th style="${styles.th}">Unit Price</th>
                        <th style="${styles.th}">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                     <tr>
                        <td colspan="3" style="${styles.td} text-align: right; font-weight: bold;"><strong>Grand Total</strong></td>
                        <td style="${styles.td} font-weight: bold;"><strong>$${Number(totalAmount).toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>
            
            <h3 style="${styles.h3}">Customer Billing Information</h3>
            <p style="${styles.p}">
                ${billingInfoHtml}
            </p>
        </div>
        <div style="${styles.footer}">
            <p>This is an automated notification from ComfortPay.</p>
        </div>
    </div>
</body>
`;

    return { subject, body };
}
