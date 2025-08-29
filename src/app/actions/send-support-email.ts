
'use server';

import { z } from 'zod';
import { SendSupportEmailInputSchema } from '@/lib/schemas';
import { executeQuery } from '@/lib/db';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';


export type SendSupportEmailInput = z.infer<typeof SendSupportEmailInputSchema>;

const SendSupportEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was sent successfully.'),
  message: z.string().optional(),
});
export type SendSupportEmailOutput = z.infer<typeof SendSupportEmailOutputSchema>;


async function getEmailConfig() {
    const settings = await executeQuery("SELECT `key`, `value` FROM settings WHERE `key` IN ('emailEnabled', 'emailProvider', 'cpanelSmtp', 'titanSmtp', 'sendgrid', 'fromEmail')");
    
    const config: any = {};
    for (const setting of settings) {
        try {
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

export async function sendSupportEmail(input: SendSupportEmailInput): Promise<SendSupportEmailOutput> {
    const emailConfig = await getEmailConfig();
    
    if (!emailConfig.emailEnabled) {
        console.log("Skipping support email as the feature is globally disabled by the admin.");
        // Still return success to the user, but note that it wasn't sent.
        return { success: true, message: "Your request has been logged. Email notifications are currently disabled." };
    }

    const validation = SendSupportEmailInputSchema.safeParse(input);
    if (!validation.success) {
        return { success: false, message: "Invalid input." };
    }

    const { recipient, title, description } = validation.data;
    const subject = `Support Request: ${title}`;
    const body = `
        <h1>New Support Request</h1>
        <p>A new support request has been submitted from the merchant dashboard.</p>
        <hr>
        <h2>Details:</h2>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Description:</strong></p>
        <p>${description.replace(/\n/g, '<br>')}</p>
    `;

    try {
        const activeProviderKey = emailConfig.emailProvider || 'cpanel';
        const fromEmail = emailConfig.fromEmail || 'noreply@yourdomain.com';

        if (activeProviderKey === 'sendgrid') {
            if (!emailConfig.sendgrid?.apiKey) {
                 throw new Error('SendGrid API key is not configured.');
            }
            sgMail.setApiKey(emailConfig.sendgrid.apiKey);
            await sgMail.send({
                to: recipient,
                from: {
                    name: `ComfortPay Support`,
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
                secure: smtpConfig.port === 465,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.pass,
                },
                 tls: {
                    rejectUnauthorized: false
                }
            });

            await transporter.sendMail({
                from: `"ComfortPay Support" <${fromEmail}>`,
                to: recipient,
                subject: subject,
                html: body,
            });
        }
        
        console.log(`Support email successfully sent to ${recipient} via ${activeProviderKey}`);
        return { success: true, message: `Email successfully sent.` };

    } catch (error) {
        console.error('====================================');
        console.error('🚨 FAILED TO SEND SUPPORT EMAIL 🚨');
        console.error(error);
        console.log('--- FALLBACK: LOGGING EMAIL TO CONSOLE ---');
        console.log(`  TO: ${recipient}`);
        console.log(`  SUBJECT: ${subject}`);
        console.log('---------------- BODY ----------------');
        console.log(body);
        console.log('====================================');

        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return { success: false, message: `Failed to send email: ${errorMessage}` };
    }
}
