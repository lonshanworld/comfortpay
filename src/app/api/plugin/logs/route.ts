// src/app/api/plugin/logs/route.ts
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';

const PluginLogSchema = z.object({
  hostname: z.string(),
  plugin_status: z.string(),
  version: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  value: z.string().optional().default(''),
});

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  console.log(`📝 [${timestamp}] [Plugin API /plugin/logs] Received log request.`);
  
  try {
    const body = await request.json();
    const validation = PluginLogSchema.safeParse(body);

    if (!validation.success) {
      console.error(`❌ [${timestamp}] [Plugin API /plugin/logs] Validation failed:`, validation.error.flatten());
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: validation.error.flatten() 
      }, { status: 400 });
    }

    const { hostname, plugin_status, version, title, description, value } = validation.data;

    // Insert log into plugin_log table
    const query = `
      INSERT INTO plugin_log (hostname, plugin_status, version, title, description, value, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    await executeQuery(query, [hostname, plugin_status, version, title, description, value]);
    
    console.log(`✅ [${timestamp}] [Plugin API /plugin/logs] Log saved: ${title} (${plugin_status})`);
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(`❌ [${timestamp}] [Plugin API /plugin/logs] Error:`, error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: String(error) 
    }, { status: 500 });
  }
}
