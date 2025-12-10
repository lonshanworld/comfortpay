
import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'src', 'app', 'sdk.js');
    const fileContents = await fs.readFile(filePath, 'utf8');

    return new NextResponse(fileContents, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("Failed to serve SDK file:", error);
    return new NextResponse('Internal Server Error: Could not read SDK file.', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}

    