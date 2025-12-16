
import { NextResponse } from 'next/server';
import { parseZelleEmail } from '@/ai/flows/zelle-email-parser-flow';
import { ZelleEmailParseInputSchema, ZelleEmailParseOutput, ZelleEmailParseOutputSchema } from '@/lib/schemas/zelle-email';
import { runQuery } from '@/lib/db';
import { formatDateForMySQL } from '@/lib/utils';
import { processZelleWebhook } from '@/app/actions/process-zelle-webhook';


// The "formula" or simple regex-based parser
function fallbackZelleParser(emailContent: string): ZelleEmailParseOutput {
    console.log("⚠️ [Fallback Parser] AI failed. Running simple regex-based parser.");

    let money_amount: number | undefined;
    let name: string | undefined;
    let payment_email: string | undefined;
    let datetime: string | undefined;
    let from: string | undefined;
    let currency: string = 'USD'; // Default currency
    let status: ZelleEmailParseOutput['status'] = 'unknown';
    let failed_reason: string | undefined;

    const lowerCaseContent = emailContent.toLowerCase();

    // Priority 1: Check for disallowed payment services first.
    if (lowerCaseContent.includes('paypal')) {
        status = 'failed';
        failed_reason = 'Payment from PayPal is not accepted';
    } else if (lowerCaseContent.includes('venmo')) {
        status = 'failed';
        failed_reason = 'Payment from Venmo is not accepted';
    } else if (lowerCaseContent.includes('cash app')) {
        status = 'failed';
        failed_reason = 'Payment from Cash App is not accepted';
    } else if (lowerCaseContent.includes('sofi')) {
        status = 'failed';
        failed_reason = 'Payment from Sofi is not accepted';
    }

    // If status is not failed, determine other statuses.
    if (status !== 'failed') {
        if (lowerCaseContent.includes('sent you money') || lowerCaseContent.includes('you received')) {
            status = 'confirmation';
        }
    }
    
    // Determine Currency and Amount
    const currencySymbols: { [key: string]: string } = {
        '$': 'USD',
        '€': 'EUR',
        '£': 'GBP',
    };

    for (const symbol in currencySymbols) {
        // Look for amount like $XX.XX or €XX,XX
        const amountRegex = new RegExp(`\\${symbol}(\\d{1,3}(?:[,.]\\d{3})*(?:[.,]\\d{2})?)`);
        const amountMatch = emailContent.match(amountRegex);
        if (amountMatch && amountMatch[1]) {
            money_amount = parseFloat(amountMatch[1].replace(',', '.')); // Standardize decimal separator
            currency = currencySymbols[symbol];
            break; 
        }
    }
    
    // Extract Sender Name: Look for a common subject pattern
    const subjectMatch = emailContent.match(/Subject: (.*) sent you/);
    if (subjectMatch && subjectMatch[1]) {
        name = subjectMatch[1].trim();
    }

    // Extract Recipient Email: Find the 'To:' line in the headers
    const toMatch = emailContent.match(/^To: .*<(.+@.+)>/m);
    if (toMatch && toMatch[1]) {
        payment_email = toMatch[1];
    }

    // Extract Date: Find the 'Date:' line in the headers
    const dateMatch = emailContent.match(/^Date: (.*)/m);
    if (dateMatch && dateMatch[1]) {
        const parsedDate = new Date(dateMatch[1].trim());
        if (!isNaN(parsedDate.getTime())) {
            datetime = parsedDate.toUTCString();
        }
    }
    
    // Extract From: Find the 'From:' line in the headers
    const fromMatch = emailContent.match(/^From: (.*)/m);
    if (fromMatch && fromMatch[1]) {
        from = fromMatch[1].trim();
    }

    const result: ZelleEmailParseOutput = {
        status,
        failed_reason,
        money_amount,
        name,
        payment_email,
        datetime,
        from,
        currency,
    };
    
    console.log("✅ [Fallback Parser] Parsing complete. Result:", result);
    return result;
}


export async function POST(request: Request) {
  console.log("🚀 [API /ai/parse-zelle-email] Received a request.");
  
  // 1. Authenticate the request from the Rust script
  const authHeader = request.headers.get('authorization');
  const zelleSecret = process.env.ZELLE_WEBHOOK_SECRET;

  if (!zelleSecret || authHeader !== `Bearer ${zelleSecret}`) {
    console.error("❌ [API /ai/parse-zelle-email] Authentication failed: Invalid token.");
    return NextResponse.json({ error: 'Unauthorized: Invalid token.' }, { status: 401 });
  }
  console.log("✅ [API /ai/parse-zelle-email] Authentication successful.");

  let parsedData: ZelleEmailParseOutput;

  try {
    // 2. Validate the incoming request body
    const body = await request.json();
    let emailContent = body.email_content || '';
    
    // 2a. Check email size to prevent large payload attacks (500KB limit)
    if (emailContent.length > 500000) {
      console.error("❌ [API /ai/parse-zelle-email] Email too large:", emailContent.length, "bytes");
      return NextResponse.json({ error: 'Email content too large (max 500KB)' }, { status: 413 });
    }
    
    // 3. Pre-scan the email content for the word "Zelle" before calling the AI.
    if (!emailContent || !emailContent.toLowerCase().includes('zelle')) {
        console.log("✅ [API /ai/parse-zelle-email] Email does not contain 'Zelle'. Skipping AI processing.");
        return NextResponse.json({ success: true, message: 'Email skipped: Not a Zelle notification.' });
    }
    
    // 4. Remove file attachments from the email content to reduce tokens.
    // This regex finds MIME parts with a "Content-Disposition: attachment" header and removes them.
    const attachmentRegex = /(--[a-zA-Z0-9_.-]+\\r?\\n(?:Content-Type:[\\s\\S]*?Content-Disposition: attachment;[\\s\\S]*?)(?=\\r?\\n--[a-zA-Z0-9_.-]+))/g;
    const cleanEmailContent = emailContent.replace(attachmentRegex, '');

    console.log(`[API /ai/parse-zelle-email] Original length: ${emailContent.length}, Cleaned length: ${cleanEmailContent.length}`);

    const validation = ZelleEmailParseInputSchema.safeParse({ emailContent: cleanEmailContent });

    if (!validation.success) {
      console.error("❌ [API /ai/parse-zelle-email] Invalid request body:", validation.error.flatten());
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }
    
    // 5. Call the Genkit AI flow to parse the email
    try {
        console.log("📞 [API /ai/parse-zelle-email] Calling AI flow to parse Zelle email content...");
        parsedData = await parseZelleEmail(validation.data);
        console.log("✅ [API /ai/parse-zelle-email] AI parsing complete. Result:", parsedData);
    } catch(aiError: any) {
        console.error("❌ [API /ai/parse-zelle-email] AI flow failed:", aiError.message, validation.data);
        console.error("⚠️ [API /ai/parse-zelle-email] Falling back to simple parser.", cleanEmailContent);
        // If AI fails, run the fallback parser
        parsedData = fallbackZelleParser(cleanEmailContent);
    }

    // 6. Log the AI response (or fallback response) to the database for auditing
    try {
        const logQuery = "INSERT INTO zelle_email_ai_record (ai_response_json, created_at) VALUES (?, ?)";
        await runQuery(logQuery, [JSON.stringify(parsedData), formatDateForMySQL(new Date())]);
        console.log("✅ [API /ai/parse-zelle-email] Parser response successfully logged to the database.");
    } catch (dbError: any) {
        // Log the error but don't stop the process. It's more important to process the payment.
        console.error("❌ [API /ai/parse-zelle-email] Failed to log parser response to database:", dbError);
    }

    // 7. Directly call the server action to process the parsed data
    console.log(`📞 [API /ai/parse-zelle-email] Calling internal action to process parsed data...`);
    const webhookResult = await processZelleWebhook(parsedData);
    console.log("✅ [API /ai/parse-zelle-email] Internal Zelle webhook action result:", webhookResult);

    // 8. Return a success response to the Rust script
    return NextResponse.json({ success: true, message: 'Email parsed and processed.', result: webhookResult });

  } catch (error: any) {
    console.error("❌ [API /ai/parse-zelle-email] Internal Server Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
