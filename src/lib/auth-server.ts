import { executeQuery } from '@/lib/db';

const SHA256_HEX_LENGTH = 64;

export async function sha256HexNode(value: string) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(value).digest('hex');
}

export async function findUserByApiToken(token: string) {
  // 1) Backwards-compatible: check plaintext token first (existing DB schema)
  const rowsPlain: any[] = await executeQuery("SELECT * FROM users WHERE token = ?", [token]);
  if (rowsPlain.length > 0) return rowsPlain[0];

  try {
    const rowsHashed: any[] = await executeQuery("SELECT * FROM users WHERE token_hash IS NOT NULL");
    for (const r of rowsHashed) {
      const tokenHash: string = r.token_hash;
      if (!tokenHash) continue;

      if (tokenHash.startsWith('$2')) {
        // bcrypt
        try {
          const bcrypt = (await import('bcrypt')).default;
          const match = await bcrypt.compare(token, tokenHash);
          if (match) return r;
        } catch (e) {
          // ignore
        }
      } else if (tokenHash.length === SHA256_HEX_LENGTH) {
        const candidate = await sha256HexNode(token);
        if (candidate === tokenHash) return r;
      } else {
        if (token === tokenHash) return r;
      }
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export { sha256HexNode };

export default { findUserByApiToken, sha256HexNode };
