
'use server';
/**
 * @fileOverview An action for sending transaction notification emails.
 *
 * This action generates and "sends" (logs to console) email notifications
 * for both customers and merchants after a transaction.
 */

import { getCustomerEmailContent, getMerchantEmailContent } from '@/lib/email-templates';
import { executeQuery, } from '@/lib/db';
import type {  SendOrderNotificationInput, SendOrderNotificationOutput } from '@/lib/types';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';


async function getEmailConfig() {
    const settings = await executeQuery("SELECT `key`, `value` FROM settings WHERE `key` IN ('emailEnabled', 'emailProvider', 'cpanelSmtp', 'titanSmtp', 'sendgrid', 'fromEmail', 'sendToCustomer', 'sendToMerchant')");
    
    const config: any = {};
    for (const setting of settings) {
        try {
            // Attempt to parse JSON, handle booleans, otherwise use the value as is.
            if (setting.value === 'true' || setting.value === 'false') {
                 config[setting.key] = setting.value === 'true';
            } else {
                 config[setting.key] = JSON.parse(setting.value);
            }
        } catch (e) {
            config[setting.key] = setting.value;
        }
    }
    return config;
}

// The main exported function that clients will call
export async function sendOrderNotification(input: SendOrderNotificationInput): Promise<SendOrderNotificationOutput> {
    const emailConfig = await getEmailConfig();

    if (!emailConfig.emailEnabled) {
        console.log("Skipping email notification as the feature is globally disabled by the admin.");
        return { success: true, message: "Email notifications are globally disabled." };
    }

    if (input.recipientType === 'customer' && !emailConfig.sendToCustomer) {
        console.log("Skipping customer email notification as it is disabled by admin.");
        return { success: true, message: "Customer email skipped by admin setting." };
    }
    if (input.recipientType === 'merchant' && !emailConfig.sendToMerchant) {
        console.log("Skipping merchant email notification as it is disabled by admin.");
        return { success: true, message: "Merchant email skipped by admin setting." };
    }

    const recipient = input.recipientType === 'customer' ? input.customerEmail : input.merchantEmail;

    if (!recipient) {
         return { success: false, message: `Recipient email not provided for ${input.recipientType}.` };
    }
    
    // Ensure items are part of the orderDetails passed to templates
    const orderDetailsWithItems = {
        ...input.orderDetails,
        items: input.items || [], // Ensure items is always an array
    };

    // Safely parse billingDetails if it's a string
    if (typeof orderDetailsWithItems.billingDetails === 'string') {
        try {
            orderDetailsWithItems.billingDetails = JSON.parse(orderDetailsWithItems.billingDetails);
        } catch (e) {
            console.error("Failed to parse billingDetails JSON in sendOrderNotification, setting to null.");
            orderDetailsWithItems.billingDetails = null; // Set to null if parsing fails
        }
    }


    const { subject, body } = input.recipientType === 'customer' 
        ? getCustomerEmailContent({ ...input, orderDetails: orderDetailsWithItems })
        : getMerchantEmailContent({ ...input, orderDetails: orderDetailsWithItems });

    try {
        const activeProviderKey = emailConfig.emailProvider || 'cpanel'; // 'cpanel', 'titan', or 'sendgrid'
        const fromEmail = emailConfig.fromEmail || 'noreply@yourdomain.com';

        if (activeProviderKey === 'sendgrid') {
            if (!emailConfig.sendgrid?.apiKey) {
                 throw new Error('SendGrid API key is not configured.');
            }
            sgMail.setApiKey(emailConfig.sendgrid.apiKey);
            await sgMail.send({
                to: recipient,
                from: {
                    name: `${input.merchantName} via ComfortPay`,
                    email: fromEmail,
                },
                subject: subject,
                html: body,
            });

        } else { // cPanel or Titan (SMTP)
            const smtpConfig = emailConfig[`${activeProviderKey}Smtp`];
            if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
                console.error('SMTP configuration is incomplete. Falling back to console log.');
                throw new Error('Email service is not configured.');
            }

            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: smtpConfig.port || 465,
                secure: smtpConfig.port === 465, // true for 465, false for other ports
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.pass,
                },
                 tls: {
                    rejectUnauthorized: false
                }
            });

            await transporter.sendMail({
                from: `"${input.merchantName} via ComfortPay" <${fromEmail}>`,
                to: recipient,
                subject: subject,
                html: body,
            });
        }
        
        console.log(`Email successfully sent to ${recipient} via ${activeProviderKey}`);
        return { success: true, message: `Email successfully sent to ${recipient}` };

    } catch (error) {
        console.error('====================================');
        console.error('🚨 FAILED TO SEND EMAIL 🚨');
        console.error(error);
        console.log('--- FALLBACK: LOGGING EMAIL TO CONSOLE ---');
        console.log(`  TO: ${recipient}`);
        console.log(`  SUBJECT: ${subject}`);
        console.log('---------------- BODY ----------------');
        console.log(body); // Log the HTML body for debugging
        console.log('====================================');

        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return { success: false, message: `Failed to send email: ${errorMessage}` };
    }
}
