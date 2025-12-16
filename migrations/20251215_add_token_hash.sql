-- Migration: add token_hash column to users and backfill from existing plaintext tokens
-- Run this in your MySQL environment (ensure you have a backup first).

-- Up
ALTER TABLE users
  ADD COLUMN token_hash VARCHAR(255) NULL;

-- Backfill token_hash using SHA2 of current plaintext token (if present)
UPDATE users
SET token_hash = SHA2(token, 256)
WHERE token IS NOT NULL AND token_hash IS NULL;

-- Down (rollback)
-- ALTER TABLE users DROP COLUMN token_hash;

-- Notes:
-- 1) This migration stores a SHA256 hex of the token. For stronger protection use bcrypt during rotation.
-- 2) After running this migration, you can rotate tokens with the provided script and then NULL out the
--    plaintext `token` column to remove sensitive values from the DB.
