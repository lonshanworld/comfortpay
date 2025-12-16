
'use server';

import { NextResponse, NextRequest } from 'next/server';
import { runQuery } from '@/lib/db';
import { z } from 'zod';

const UpdateVolumeSchema = z.object({
  amount: z.number().positive("Amount must be a positive number."),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  // Handle both 'pa_1' and '1' formats
  const numericId = id.startsWith('pa_') ? id.split('_')[1] : id;
  
  console.log(`DEBUG API [1]: update-volume called for account ID: ${id} (numeric: ${numericId})`);

  if (!numericId) {
    return NextResponse.json({ message: 'Invalid payment account ID.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    console.log("DEBUG API [2]: Received request body:", body);

    const validation = UpdateVolumeSchema.safeParse(body);
    console.log("DEBUG API [3]: Zod validation result:", validation);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { amount } = validation.data;
    console.log(`DEBUG API [4]: Validation successful. Amount to update: ${amount}`);


    const query = `
      UPDATE payment_accounts SET
      currentVolume = currentVolume + ?
      WHERE id = ?
    `;
    const queryParams = [amount, numericId];

    const result = await runQuery(query, queryParams);
    console.log("DEBUG API [5]: Database query result:", result);


    if (result.changes === 0) {
      return NextResponse.json({ message: 'Payment account not found or no changes made' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Volume updated for account ${id}` });
  } catch (error) {
    console.error(`Failed to update volume for payment account ${id}:`, error);
    return NextResponse.json({ message: 'Error updating payment account volume' }, { status: 500 });
  }
}
