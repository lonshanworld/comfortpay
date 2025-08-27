
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const numericId = id.includes('_') ? id.split('_')[1] : id;

  try {
    const query = "SELECT name, email FROM users WHERE id = ? AND role = 'Merchant'";
    const merchants: any[] = await executeQuery(query, [numericId]);

    if (merchants.length === 0) {
      return NextResponse.json({ message: 'Merchant not found' }, { status: 404 });
    }

    return NextResponse.json(merchants[0]);
  } catch (error) {
    console.error(`Failed to fetch merchant details for ${id}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
