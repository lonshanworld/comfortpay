
import { NextResponse, NextRequest } from 'next/server';
import { runQuery } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const numericId = id; // Assuming ID is already numeric

  try {
    const query = "UPDATE notifications SET isRead = 1 WHERE id = ?";
    const result = await runQuery(query, [numericId]);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error(`Failed to update notification ${id}:`, error);
    return NextResponse.json({ message: 'Failed to update notification' }, { status: 500 });
  }
}
