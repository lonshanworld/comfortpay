"use server";

import bcrypt from 'bcrypt';

const saltRounds = 10;

/**
 * Hashes a plaintext password using bcrypt.
 * @param plaintextPassword The password to hash.
 * @returns A promise that resolves to the hashed password.
 */
export async function hashPassword(plaintextPassword: string): Promise<string> {
  const hashedPassword = await bcrypt.hash(plaintextPassword, saltRounds);
  return hashedPassword;
}

/**
 * Compares a plaintext password with a hashed password.
 * @param plaintextPassword The password provided by the user.
 * @param hashedPassword The stored hashed password from the database.
 * @returns A promise that resolves to true if the passwords match, false otherwise.
 */
export async function comparePassword(plaintextPassword: string, hashedPassword: string): Promise<boolean> {
  const match = await bcrypt.compare(plaintextPassword, hashedPassword);
  return match;
}
