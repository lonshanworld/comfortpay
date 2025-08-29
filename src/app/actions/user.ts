'use server';

import { z } from 'zod';
import { executeQuery, runQuery } from '@/lib/db';
import { comparePassword, hashPassword } from '@/lib/password-service';
import type { User } from '@/lib/types';

const ChangePasswordInputSchema = z.object({
  userId: z.string(),
  currentPassword: z.string(),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export async function changePassword(input: ChangePasswordInput): Promise<{ success: boolean; message: string }> {
  const validation = ChangePasswordInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.' };
  }

  const { userId, currentPassword, newPassword } = validation.data;
  const numericId = userId.split('_')[1];

  try {
    const users: any[] = await executeQuery("SELECT * FROM users WHERE id = ?", [numericId]);
    
    if (users.length === 0) {
      return { success: false, message: 'User not found.' };
    }

    const user = users[0];
    const passwordMatch = await comparePassword(currentPassword, user.password);

    if (!passwordMatch) {
      return { success: false, message: 'Incorrect current password.' };
    }

    const newHashedPassword = await hashPassword(newPassword);
    await runQuery("UPDATE users SET password = ? WHERE id = ?", [newHashedPassword, numericId]);

    return { success: true, message: 'Password updated successfully. Please log in again.' };

  } catch (error: any) {
    console.error(`Password change error for user ${userId}:`, error);
    return { success: false, message: 'An internal server error occurred.' };
  }
}
