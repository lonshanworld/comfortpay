
"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/types';
import { useToast } from './use-toast';

const roleRedirects: Record<UserRole, string> = {
    'Admin': '/login/admin',
    'Merchant': '/login/merchant',
    'Sale Agent': '/login/sale-agent',
    'Staff': '/login/staff',
}

/**
 * A client-side hook to enforce role-based authorization for a page or layout.
 * It checks for a user role in localStorage and redirects if the role is
 * incorrect or missing.
 *
 * @param {UserRole} requiredRole The role required to access the component.
 */
export function useAuthorization(requiredRole: UserRole) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // This code runs only on the client, after the component has mounted.
    const userRole = localStorage.getItem('userRole') as UserRole | null;
    const impersonatingRole = localStorage.getItem('impersonatingRole') as UserRole | null;

    if (impersonatingRole && userRole === 'Admin') {
        if (impersonatingRole === requiredRole) {
            // Admin is correctly viewing the impersonated dashboard.
            return;
        } else {
            // Admin is navigating away from an impersonated dashboard, so clear the state.
            localStorage.removeItem('impersonatingRole');
            localStorage.removeItem('impersonatingUserId');
        }
    }


    if (!userRole) {
      // If no role is found, the user is not authenticated.
      // Redirect them to the login page for the required role.
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You must be logged in to view this page.",
      });
      router.replace(roleRedirects[requiredRole]);
      return;
    }
    
    // Check if the user has the required role.
    // The Admin role is a special case that is allowed to view other dashboards.
    const isAuthorized = userRole === requiredRole || userRole === 'Admin';
    
    if (!isAuthorized) {
        // If not authorized, redirect to their own role's login page.
        // This prevents, for example, a Merchant from accessing the Staff dashboard.
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You do not have permission to access this page.",
        });
        router.replace(roleRedirects[userRole]);
    }
  
  }, [router, requiredRole, toast]);
}
