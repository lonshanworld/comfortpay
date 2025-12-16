import { executeQuery } from '@/lib/db';
import { SignJWT, jwtVerify } from 'jose';

const SHA256_HEX_LENGTH = 64;

export async function sha256Hex(value: string) {
  // Use SubtleCrypto (Edge and modern Node) for SHA-256
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const enc = new TextEncoder();
    const data = enc.encode(value);
    const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // As a last resort (older Node without globalThis.crypto), throw — server-only code should use auth-server
  throw new Error('Web Crypto not available; use server-only auth-server for Node fallback');
}

export async function signSession(payload: object, expiresIn = '8h') {
  const key = process.env.SESSION_SIGNING_KEY;
  if (!key) throw new Error('SESSION_SIGNING_KEY not set');
  const secret = new TextEncoder().encode(key);
  // jose expects expiration as seconds or string; we'll accept '8h' by parsing or use seconds
  // For simplicity, support numeric seconds or '8h' style used in code by converting '8h' -> seconds
  let expSeconds: number | undefined;
  if (typeof expiresIn === 'string' && expiresIn.endsWith('h')) {
    const hours = Number(expiresIn.slice(0, -1));
    expSeconds = Math.floor(Date.now() / 1000) + hours * 3600;
  }
  const jwt = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  if (expSeconds) jwt.setExpirationTime(expSeconds);
  return await jwt.sign(secret);
}

export async function verifySession(token: string) {
  const key = process.env.SESSION_SIGNING_KEY;
  if (!key) throw new Error('SESSION_SIGNING_KEY not set');
  const secret = new TextEncoder().encode(key);
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  return payload as any;
}

// findUserByApiToken is server-only; moved to auth-server.ts
export async function findUserByApiToken(token: string) {
  // 1) Backwards-compatible: check plaintext token first (existing DB schema)
  const rowsPlain: any[] = await executeQuery("SELECT * FROM users WHERE token = ?", [token]);
  if (rowsPlain.length > 0) return rowsPlain[0];

  // 2) If token_hash column exists, pull candidates and compare.
  // We cannot compute bcrypt hashes without the salt, so query all rows with a token_hash and test each.
  try {
    const rowsHashed: any[] = await executeQuery("SELECT * FROM users WHERE token_hash IS NOT NULL");
    for (const r of rowsHashed) {
      const tokenHash: string = r.token_hash;
      if (!tokenHash) continue;

      if (tokenHash.startsWith('$2')) {
        // bcrypt hash
        try {
          const bcrypt = (await import('bcrypt')).default;
          const match = await bcrypt.compare(token, tokenHash);
          if (match) return r;
        } catch (e) {
          // ignore and continue
        }
      } else if (tokenHash.length === SHA256_HEX_LENGTH) {
        // legacy SHA256 hex backfill
        const candidate = await sha256Hex(token);
        if (candidate === tokenHash) return r;
      } else {
        // unknown format: try direct compare
        if (token === tokenHash) return r;
      }
    }
  } catch (err) {
    // token_hash column may not exist yet or DB error; ignore
  }

  return null;
}

export async function computeHmac(secret: string, payload: string) {
  // Prefer Web Crypto in Edge runtimes
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const keyData = new TextEncoder().encode(secret);
    const cryptoKey = await globalThis.crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const { createHmac } = await import('crypto');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export async function verifyHmacPayload(secret: string, payload: string, signature: string, timestamp?: string, windowSec = 300) {
  if (!signature) return false;
  // If a timestamp is provided, ensure it's recent to avoid replay
  if (timestamp) {
    const ts = Number(timestamp);
    if (Number.isNaN(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > windowSec) return false;
  }

  const candidate1 = await computeHmac(secret, payload);
  if (safeCompare(candidate1, signature)) return true;

  if (timestamp) {
    const candidate2 = await computeHmac(secret, `${timestamp}.${payload}`);
    if (safeCompare(candidate2, signature)) return true;
  }

  return false;
}

function safeCompare(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
