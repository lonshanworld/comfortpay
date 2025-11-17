
import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/db';
import { z } from 'zod';

const UpdateSchema = z.object({
  is_solved: z.boolean(),
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
    const { id } = await params;
    
    try {
        const body = await request.json();
        const validation = UpdateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { is_solved } = validation.data;

        const result = await runQuery(
            "UPDATE plugin_log SET is_solved = ? WHERE id = ?",
            [is_solved, id]
        );

        if (result.changes === 0) {
            return NextResponse.json({ message: "Log not found or status is already the same." }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Log status updated." });

    } catch (error) {
        console.error(`Failed to update log ${id}:`, error);
        return NextResponse.json({ message: 'Failed to update log' }, { status: 500 });
    }
}
