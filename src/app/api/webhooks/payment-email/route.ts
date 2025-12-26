import { NextResponse } from 'next/server';
import { PaymentEmailParseOutputSchema, type PaymentEmailParseOutput } from '@/lib/schemas/payment-email';
import { processPaymentWebhook } from '@/app/actions/process-payment-webhook';
import crypto from 'crypto';

const AUTH_HEADER_NAME = 'authorization';
const EXPECTED_TOKEN = process.env.PAYMENT_EMAIL_PARSER_TOKEN || process.env.CRON_SECRET;
const PARSIO_SIGNING_SECRET = process.env.PARSIO_SIGNING_SECRET;

export async function POST(request: Request) {
  try {
    // Read raw body for signature verification
    const rawBuffer = Buffer.from(await request.arrayBuffer());
    console.log('[webhook route] Received request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[webhook route] Raw body length:', rawBuffer.length);

    // Verify parsio signature (if secret is configured)
    const receivedSignature = request.headers.get('parsio-signature');
    let signatureValid = false;
    if (PARSIO_SIGNING_SECRET && receivedSignature) {
      const computed = crypto
        .createHmac('sha256', PARSIO_SIGNING_SECRET)
        .update(rawBuffer)
        .digest('base64');
      signatureValid = computed === receivedSignature;
      console.log('[webhook route] Parsio signature received:', receivedSignature);
      console.log('[webhook route] Parsio signature computed:', computed);
    }

    // Also allow bearer token auth as before
    const auth = request.headers.get(AUTH_HEADER_NAME);
    let tokenValid = false;
    if (auth && auth.toLowerCase().startsWith('bearer ') && EXPECTED_TOKEN) {
      const token = auth.slice(7).trim();
      tokenValid = token === EXPECTED_TOKEN;
      console.log('[webhook route] Authorization header present, tokenValid=', tokenValid);
    }

    if (!signatureValid && !tokenValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse JSON from raw buffer after verification
    let body: any;
    try {
      body = JSON.parse(rawBuffer.toString('utf8'));
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    console.log('[webhook route] Parsed JSON body:', body);

    // Parsio wraps the parsed document under `payload.parsed`.
    // Accept both shapes: top-level parsed object or Parsio wrapper.
    const candidate = body && body.payload && body.payload.parsed ? body.payload.parsed : body;

    const parsed = PaymentEmailParseOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      console.warn('[webhook route] Payload did not validate against PaymentEmailParseOutputSchema, returning 400.');
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const payload: PaymentEmailParseOutput = parsed.data;

    // Call the generalized processor which accepts `paymentType` and supports
    // zelle, interac, and wise.
    console.log('[webhook route] Forwarding payload to processor (async), paymentType=', payload.paymentType, 'orderId=', payload.orderId);
    // Fire-and-forget processing so we always return 200 as soon as we received data.
    processPaymentWebhook(payload as any)
      .then((res) => console.log('[webhook route] Async processor result:', res))
      .catch((err) => console.error('[webhook route] Async processor error:', err));

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (err: any) {
    console.error('[payment-email webhook] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
