
"use client"

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './use-toast';

const IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

export function useIdleLogout() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = useCallback(() => {
    // Use a more generic logout message and clear local storage
    const role = localStorage.getItem('userRole');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');

    toast({
      title: "Session Expired",
      description: "You have been logged out due to inactivity.",
    });

    // Redirect to the appropriate login page based on the role they had
    if (role === 'Admin') router.push('/login/admin');
    else if (role === 'Merchant') router.push('/login/merchant');
    else if (role === 'Sale Agent') router.push('/login/sale-agent');
    else if (role === 'Staff') router.push('/login/staff');
    else router.push('/'); // Fallback to home if role is unknown

  }, [router, toast]);

  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(handleLogout, IDLE_TIMEOUT);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    const addEventListeners = () => {
      events.forEach(event => window.addEventListener(event, resetTimer));
    };

    const removeEventListeners = () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };

    addEventListeners();
    resetTimer(); // Initialize timer

    return () => {
      clearTimeout(idleTimer);
      removeEventListeners();
    };
  }, [handleLogout]);
}
