
'use server';

import { executeQuery, runQuery } from '@/lib/db';
import { comparePassword, hashPassword } from '@/lib/password-service';
import { formatDateForMySQL } from '@/lib/utils';
import type { User, UserRole } from '@/lib/types';
import { z } from 'zod';

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  role: z.enum(['Admin', 'Merchant', 'Sale Agent', 'Staff']),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

async function createSuperAdmin(email: string, password: string): Promise<User> {
  const hashedPassword = await hashPassword(password);
  const now = new Date();
  const query = `
      INSERT INTO users 
      (name, email, password, role, createdAt, status, dateJoined) 
      VALUES (?, ?, ?, 'Admin', ?, 'Active', ?)
  `;
  const params = ['Admin User', email, hashedPassword, formatDateForMySQL(now), formatDateForMySQL(now)];
  const result = await runQuery(query, params);
  
  // Return a user object that includes the newly created hashed password for immediate verification
  return {
    id: `user_${result.id}`,
    name: 'Admin User',
    email: email,
    role: 'Admin',
    status: 'Active',
    createdAt: now.toISOString(),
    password: hashedPassword, // Include hashed password
  };
}

export async function login(input: LoginInput): Promise<{ success: boolean; message: string; user?: { id: string; role: UserRole } }> {
  const validation = LoginInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.' };
  }

  const { email, password, role } = validation.data;
  
  // Handle Super Admin creation and login
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (role === 'Admin' && email === superAdminEmail) {
    try {
      const adminUsers: any[] = await executeQuery("SELECT * FROM users WHERE email = ? AND role = 'Admin'", [email]);
      
      let adminUser;

      if (adminUsers.length === 0) {
        console.log(`Super Admin user ${email} not found. Creating...`);
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (!superAdminPassword) {
          return { success: false, message: 'Super admin is not configured on the server.' };
        }
        
        // The createSuperAdmin function now returns the full user object including the hashed password.
        adminUser = await createSuperAdmin(email, superAdminPassword);
      } else {
        adminUser = adminUsers[0];
      }
      
      // Always compare against the hashed password from the database (or the one just created)
      const passwordMatch = await comparePassword(password, adminUser.password);
      
      if (passwordMatch) {
        return { 
          success: true, 
          message: 'Login successful.',
          user: { id: `user_${adminUser.id}`, role: adminUser.role }
        };
      } else {
        return { success: false, message: 'Invalid credentials for admin account.' };
      }
    } catch (error: any) {
      console.error(`Super Admin login/creation error:`, error);
      return { success: false, message: 'An error occurred during admin authentication.' };
    }
  }

  // Standard user login
  try {
    const users: any[] = await executeQuery("SELECT * FROM users WHERE email = ? AND role = ?", [email, role]);
      
    if (users.length === 0) {
      return { success: false, message: `Invalid credentials for a ${role.toLowerCase()} account.` };
    }

    const user = users[0];
    const passwordMatch = await comparePassword(password, user.password);

    if (passwordMatch) {
      return { 
        success: true, 
        message: 'Login successful.',
        user: {
          id: `user_${user.id}`,
          role: user.role
        }
      };
    } else {
      return { success: false, message: `Invalid credentials for a ${role.toLowerCase()} account.` };
    }
  } catch (error: any) {
    console.error(`Login error for role ${role}:`, error);
    return { success: false, message: 'An internal server error occurred.' };
  }
}
