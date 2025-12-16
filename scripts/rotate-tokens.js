#!/usr/bin/env node
/**
 * rotate-tokens.js
 *
 * Script to rotate merchant API tokens. By default runs in dry-run mode.
 * Usage:
 *   NODE_ENV=production node scripts/rotate-tokens.js --rotate
 *   NODE_ENV=production node scripts/rotate-tokens.js --dry-run
 *
 * Requirements: set DB connection env vars: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

async function main() {
  const argv = process.argv.slice(2);
  const rotate = argv.includes('--rotate');
  const dryRun = argv.includes('--dry-run') || !rotate;

  // Simple CLI args parsing for known flags: --db-host, --db-user, --db-pass, --db-name, --batch
  function getArg(flag) {
    const idx = argv.indexOf(flag);
    if (idx === -1) return undefined;
    return argv[idx + 1];
  }

  const host = getArg('--db-host') || process.env.DB_HOST || '127.0.0.1';
  const user = getArg('--db-user') || process.env.DB_USER || 'root';
  const password = getArg('--db-pass') || getArg('--db-password') || process.env.DB_PASSWORD || process.env.DB_PASS || '';
  const database = getArg('--db-name') || process.env.DB_NAME || 'comfortpay';
  const batchSize = Number(getArg('--batch') || process.env.ROTATE_BATCH || 100);

  if (!host || !user || !database) {
    console.error('Please provide DB connection info via flags or env: --db-host --db-user --db-pass --db-name');
    process.exit(2);
  }

  const conn = await mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 5 });

  console.log(`Connected to ${host}/${database} as ${user}`);

  try {
    // Process in batches to avoid long-running transactions.
    let offset = 0;
    const created = [];
    while (true) {
      const [rows] = await conn.query("SELECT id, email, token FROM users WHERE role = 'Merchant' LIMIT ? OFFSET ?", [batchSize, offset]);
      if (!rows || rows.length === 0) break;
      console.log(`Processing batch offset=${offset} size=${rows.length}`);

      if (dryRun) {
        console.log('Dry run mode: will show which rows in this batch would be updated. Use --rotate to perform changes.');
        for (const r of rows) {
          if (r.token) {
            const hashed = crypto.createHash('sha256').update(r.token).digest('hex');
            console.log(`id=${r.id} email=${r.email} existing_plain_token_len=${String(r.token).length} -> legacy_sha256=${hashed.slice(0,16)}...`);
          } else {
            console.log(`id=${r.id} email=${r.email} no plaintext token present`);
          }
        }
      } else {
        console.log('Rotate mode: generating new tokens in this batch and updating token_hash (bcrypt), clearing plaintext token column.');
        for (const r of rows) {
          // Generate a new 32-byte hex token
          const newToken = crypto.randomBytes(32).toString('hex');
          const newHash = await bcrypt.hash(newToken, Number(process.env.BCRYPT_SALT_ROUNDS || 12));

          // Update token_hash and clear plaintext token
          await conn.query('UPDATE users SET token_hash = ?, token = NULL WHERE id = ?', [newHash, r.id]);
          created.push({ id: r.id, email: r.email, token: newToken });
          console.log(`Rotated token for id=${r.id} email=${r.email}`);
        }
      }

      if (rows.length < batchSize) break;
      offset += batchSize;
    }

    if (!dryRun) {
      console.log('\n=== GENERATED TOKENS (one-time display) ===');
      console.log('Store these securely and distribute to merchants as needed. Tokens are shown ONCE.');
      for (const c of created) {
        console.log(`id=${c.id} email=${c.email} token=${c.token}`);
      }
      console.log('==========================================');
    }

    console.log('Rotation complete. Remember to remove any backups of plaintext tokens and restart services.');

  } catch (err) {
    console.error('Error during rotation:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
