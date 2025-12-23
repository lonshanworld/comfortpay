#!/usr/bin/env node
/**
 * scripts/init-db.js
 *
 * Idempotent helper to ensure `AUTO_INCREMENT` for tables with integer `id` PKs.
 * Usage: set `DATABASE_URL` (mysql://user:pass@host:port/dbname) and run:
 *   node scripts/init-db.js
 *
 * The script will check the `orders` and `plugin_log` tables, compute
 * MAX(id) and adjust AUTO_INCREMENT to MAX(id)+1 when the current value
 * would result in duplicate-key errors.
 */

const mysql = require('mysql2/promise');

function parseDatabaseUrl(dbUrl) {
  try {
    const u = new URL(dbUrl);
    const database = (u.pathname || '').replace(/^\//, '');
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database,
    };
  } catch (err) {
    throw new Error('DATABASE_URL is not a valid URL: ' + String(err));
  }
}

async function checkAndFixAutoIncrement(conn, database, table) {
  console.log(`\nChecking table: ${table}`);

  // Check that the table exists
  const [tableExists] = await conn.execute(
    `SELECT COUNT(1) as c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [database, table]
  );
  if (!tableExists || tableExists[0].c === 0) {
    console.warn(`  Skipping: table '${table}' does not exist in database '${database}'.`);
    return { table, skipped: true };
  }

  // Get max(id)
  const [maxRows] = await conn.execute(`SELECT MAX(id) as maxId FROM \`${table}\``);
  const maxId = (maxRows && maxRows[0] && Number(maxRows[0].maxId)) || 0;
  console.log(`  Max id in ${table}: ${maxId}`);

  // Get current AUTO_INCREMENT
  const [aiRows] = await conn.execute(
    `SELECT AUTO_INCREMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [database, table]
  );
  const currentAi = aiRows && aiRows[0] ? Number(aiRows[0].AUTO_INCREMENT || 0) : null;
  console.log(`  Current AUTO_INCREMENT for ${table}: ${currentAi}`);

  if (currentAi === null) {
    console.warn(`  Could not determine AUTO_INCREMENT for table ${table}.`);
    return { table, maxId, currentAi, changed: false };
  }

  if (currentAi <= maxId) {
    const newAi = maxId + 1;
    console.log(`  Updating AUTO_INCREMENT -> ${newAi} for table ${table} (was ${currentAi})`);
    // ALTER TABLE statements do not always accept prepared placeholders across
    // all MySQL drivers/servers; execute as a direct query with a numeric
    // interpolation (safe because newAi is derived from DB MAX(id)).
    await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${newAi}`);
    return { table, maxId, currentAi, changed: true, newAi };
  }

  console.log(`  AUTO_INCREMENT is OK for ${table} (no change needed).`);
  return { table, maxId, currentAi, changed: false };
}

async function main() {
  const dbUrl = "mysql://root:password@localhost:3306/comfortpay";
  if (!dbUrl) {
    console.error('Please set the DATABASE_URL environment variable (mysql://user:pass@host:port/db)');
    process.exit(2);
  }

  let config;
  try {
    config = parseDatabaseUrl(dbUrl);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: false,
    });
  } catch (err) {
    console.error('Failed to connect to database:', err.message || err);
    process.exit(3);
  }

  try {
    const tables = ['orders', 'plugin_log'];
    const results = [];
    for (const t of tables) {
      try {
        const r = await checkAndFixAutoIncrement(conn, config.database, t);
        results.push(r);
      } catch (err) {
        console.error(`  Error while processing table ${t}:`, err.message || err);
        results.push({ table: t, error: String(err) });
      }
    }

    console.log('\nSummary:');
    results.forEach(r => console.log(' ', JSON.stringify(r)));

    await conn.end();
    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    try { if (conn) await conn.end(); } catch (e) {}
    process.exit(4);
  }
}

if (require.main === module) {
  main();
}
