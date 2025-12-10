
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
  }

  const numericUserId = userId.split('_')[1];

  try {
    const query = "SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC";
    const notifications = await executeQuery(query, [numericUserId]);
    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ message: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const numericUserId = userId.split('_')[1];

    try {
        const query = "UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0";
        await runQuery(query, [numericUserId]);
        return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        console.error("Failed to mark notifications as read:", error);
        return NextResponse.json({ message: 'Failed to update notifications' }, { status: 500 });
    }
}
