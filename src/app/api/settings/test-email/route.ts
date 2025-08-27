
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { executeQuery } from '@/lib/db';
import sgMail from '@sendgrid/mail';


async function getEmailConfig() {
    const settings = await executeQuery("SELECT key, value FROM settings WHERE key IN ('emailProvider', 'cpanelSmtp', 'titanSmtp', 'sendgrid', 'fromEmail')");
    
    const config: any = {};
    for (const setting of settings) {
        try {
            config[setting.key] = JSON.parse(setting.value);
        } catch (e) {
            config[setting.key] = setting.value;
        }
    }
    return config;
}

export async function POST(request: Request) {
  try {
    const emailConfig = await getEmailConfig();
    const activeProviderKey = emailConfig.emailProvider;
    const fromEmail = emailConfig.fromEmail;
    
    if (!fromEmail) {
      return NextResponse.json({ message: "The 'From Email' address is not configured." }, { status: 400 });
    }

    const subject = 'ComfortPay SMTP Test Successful!';
    const html = `
        <h1>Success!</h1>
        <p>This is a test email from your ComfortPay application.</p>
        <p>Your settings for the <strong>${activeProviderKey}</strong> provider appear to be configured correctly.</p>
      `;

    if (activeProviderKey === 'sendgrid') {
        const sgApiKey = emailConfig.sendgrid?.apiKey;
        if (!sgApiKey) {
            return NextResponse.json({ message: 'SendGrid API Key is not configured.' }, { status: 400 });
        }
        sgMail.setApiKey(sgApiKey);
        await sgMail.send({
            to: fromEmail,
            from: { name: 'ComfortPay Test', email: fromEmail },
            subject,
            html,
        });

    } else { // cPanel or Titan
        const smtpConfig = emailConfig[`${activeProviderKey}Smtp`];
        if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
          return NextResponse.json({ message: `SMTP settings for the active provider (${activeProviderKey}) are incomplete.` }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.port === 465,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
           tls: {
              rejectUnauthorized: false // This is often necessary for local/cPanel servers
          }
        });
        
        await transporter.verify();

        await transporter.sendMail({
          from: `"ComfortPay Test" <${fromEmail}>`,
          to: fromEmail, // Send the test to the 'from' address itself
          subject: subject,
          html: `
            ${html}
            <hr>
            <p><strong>Host:</strong> ${smtpConfig.host}</p>
            <p><strong>Port:</strong> ${smtpConfig.port}</p>
            <p><strong>User:</strong> ${smtpConfig.user}</p>
          `,
        });
    }

    return NextResponse.json({ success: true, message: 'Test email sent successfully!' });

  } catch (error: any) {
    console.error("Failed to send test email:", error);
    if(error.response) {
      console.error(error.response.body);
    }
    return NextResponse.json({ message: `Failed to send test email: ${error.message}` }, { status: 500 });
  }
}

    