
// import { NextRequest, NextResponse } from 'next/server';
// import { executeQuery, runQuery } from '@/lib/db';
// import { z } from 'zod';
// import { formatDateForMySQL } from '@/lib/utils';

// const LogSchema = z.object({
//   hostname: z.string().optional(),
//   plugin_status: z.enum(['error', 'success', 'info']).optional().default('info'),
//   version: z.string().optional(),
//   title: z.string().optional(),
//   description: z.string().optional(),
//   value: z.string().optional(),
// });

// export async function POST(request: NextRequest) {
//   try {
//     // Clone the request so we can read the body without consuming the original
//     const clone = request.clone();

//     // Read clone's body as text (safe: doesn't affect original request)
//     const rawBodyText = await clone.text();

//     // Try to parse JSON; if not JSON, keep raw text
//     let parsedBody: any;
//     try {
//       parsedBody = rawBodyText ? JSON.parse(rawBodyText) : {};
//     } catch {
//       parsedBody = rawBodyText;
//     }

//     // Validate parsed body using existing Zod schema
//     const validation = LogSchema.safeParse(parsedBody);
//     if (!validation.success) {
//       return NextResponse.json(
//         { error: 'Invalid request body', details: validation.error.flatten() },
//         { status: 400 }
//       );
//     }

//     const { hostname, plugin_status, version, title, description, value } = validation.data;

//     // Build a serializable rawRequest with headers + raw body
//     const headersObj = Object.fromEntries(request.headers.entries());
//     // Redact sensitive headers before storing
//     if (headersObj.authorization) headersObj.authorization = '[REDACTED]';
//     if (headersObj.cookie) headersObj.cookie = '[REDACTED]';

//     const MAX_BODY_LEN = 10000; // truncate very large bodies
//     let storedBody = rawBodyText ?? '';
//     if (storedBody.length > MAX_BODY_LEN) {
//       storedBody = storedBody.slice(0, MAX_BODY_LEN) + '...[truncated]';
//     }

//     const rawRequest = {
//       url: request.url,
//       method: request.method,
//       headers: headersObj,
//       body: storedBody,
//     };

//     const query = `
//       INSERT INTO plugin_log 
//       (hostname, plugin_status, version, title, description, value, is_solved, raw_request, createdAt) 
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const now = formatDateForMySQL(new Date());
//     await runQuery(query, [
//       hostname || null,
//       plugin_status,
//       version || null,
//       title || null,
//       description || null,
//       value || null,
//       false,
//       JSON.stringify(rawRequest),
//       now,
//     ]);

//     return NextResponse.json({ success: true, message: 'Log created successfully.' }, { status: 201 });
//   } catch (error: any) {
//     console.error('Failed to create plugin log:', error);
//     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
//   }
// }


// export async function GET(request: Request) {
//     const { searchParams } = new URL(request.url);
//     const page = parseInt(searchParams.get('page') || '1', 10);
//     const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
//     const offset = (page - 1) * pageSize;

//     try {
//         const dataQuery = `SELECT *, DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s.000Z') as createdAt FROM plugin_log ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`;
//         const countQuery = `SELECT COUNT(*) as totalCount FROM plugin_log`;

//         const [data, countResult] = await Promise.all([
//             executeQuery(dataQuery, []),
//             executeQuery(countQuery, [])
//         ]);

//         const totalCount = countResult[0].totalCount;
//         const pageCount = Math.ceil(totalCount / pageSize);

//         // Process the raw_request field
//            const processedData = data.map(log => {
//             if (log.raw_request && typeof log.raw_request === 'string') {
//                 try {
//                     log.raw_request = JSON.parse(log.raw_request);
//                 } catch (e) {
//                     console.error(`Failed to parse raw_request for log ID ${log.id}:`, e);
//                 }
//             } else if (log.raw_request instanceof Buffer) {
//                  try {
//                     log.raw_request = JSON.parse(log.raw_request.toString('utf-8'));
//                 } catch (e) {
//                     console.error(`Failed to parse raw_request buffer for log ID ${log.id}:`, e);
//                     log.raw_request = log.raw_request.toString('utf-8');
//                 }
//             }
//             return log;
//         });

//         return NextResponse.json({ data: processedData, pageCount, totalCount });
//     } catch (error: any) {
//         console.error("Failed to fetch plugin logs:", error);
//         return NextResponse.json({ message: 'Failed to fetch logs' }, { status: 500 });
//     }
// }
