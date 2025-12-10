
import { NextResponse } from 'next/server';
import { executeQuery, runQuery } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get('group');

  try {
    let query = "SELECT `key`, `value` FROM settings";
    const params: string[] = [];

    if (group === 'email') {
      query += " WHERE `key` LIKE '%Email%' OR `key` LIKE '%Smtp%' OR `key` = 'emailProvider' OR `key` = 'sendgrid' OR `key` = 'sendToCustomer' OR `key` = 'sendToMerchant' OR `key` = 'emailEnabled'";
    }
    
    const settings = await executeQuery(query, params);
    
    const settingsObject = settings.reduce((acc, { key, value }) => {
        try {
            // Check for booleans first
             if (value === 'true' || value === 'false') {
                acc[key] = value === 'true';
            } else {
                 // Attempt to parse JSON strings
                acc[key] = JSON.parse(value);
            }
        } catch (e) {
            // If not JSON, just assign the string value
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    return NextResponse.json(settingsObject);

  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ message: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Begin a transaction
    await runQuery('START TRANSACTION');

    for (const [key, value] of Object.entries(body)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const query = `
        INSERT INTO settings (\`key\`, \`value\`)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`);
      `;
      await runQuery(query, [key, stringValue]);
    }

    // Commit the transaction
    await runQuery('COMMIT');

    return NextResponse.json({ success: true, message: 'Settings updated successfully.' });

  } catch (error) {
    // Rollback the transaction in case of an error
    await runQuery('ROLLBACK');
    console.error("Failed to update settings:", error);
    return NextResponse.json({ message: `Failed to update settings: ${error.message}` }, { status: 500 });
  }
}
