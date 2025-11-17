
'use server';

import { runQuery } from '@/lib/db';
import { formatDateForMySQL } from '@/lib/utils';
import { z } from 'zod';

const LogSchema = z.object({
  hostname: z.string().optional(),
  plugin_status: z.enum(['error', 'success', 'info']).optional().default('info'),
  version: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  value: z.string().optional(),
  raw_request: z.any().optional(),
});

type AppLogInput = z.infer<typeof LogSchema>;

export async function appLog(input: AppLogInput) {
    try {
        const validation = LogSchema.safeParse(input);

        if (!validation.success) {
            console.error("Internal log validation failed:", validation.error);
            return;
        }

        const { hostname, plugin_status, version, title, description, value, raw_request } = validation.data;
        
        const rawRequestString = raw_request ? (typeof raw_request === 'string' ? raw_request : JSON.stringify(raw_request)) : null;
        
        const query = `
            INSERT INTO plugin_log 
            (hostname, plugin_status, version, title, description, value, is_solved, raw_request, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const now = formatDateForMySQL(new Date());

        await runQuery(query, [
            hostname || null, 
            plugin_status, 
            version || null,
            title || null, 
            description || null, 
            value || null, 
            false, 
            rawRequestString,
            now
        ]);
    } catch (dbError: any) {
        console.error("FATAL: Failed to write to appLog:", dbError.message);
    }
}
