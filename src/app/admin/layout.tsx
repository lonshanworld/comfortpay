

'use client';

import Link from 'next/link';
import {
  Bell,
  Home,
  Package2,
  Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Image from 'next/image';
import { AdminNav, AdminNavMobile } from '@/components/admin/admin-nav';
import { useAuthorization } from '@/hooks/use-authorization';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Notification {
    id: number;
    title: string;
    description: string;
    isRead: number;
    link: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAuthorization('Admin');
  const router = useRouter();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  useEffect(() => {
    // This code runs on the client, so localStorage is available.
    const impersonatingRole = localStorage.getItem('impersonatingRole');
    const userId = localStorage.getItem('userId');
    setAdminUserId(userId);
    setIsImpersonating(!!impersonatingRole);
  }, []);


  const fetchNotifications = async () => {
    // if (!adminUserId) return;
    // try {
    //     const response = await fetch(`/api/notifications?userId=${adminUserId}`);
    //     if(response.ok) {
    //         const data = await response.json();
    //         setNotifications(data);
    //         setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
    //     }
    // } catch (error) {
    //     console.error("Failed to fetch notifications:", error);
    // }
  };

  // useEffect(() => {
  //   if (adminUserId) {
  //       fetchNotifications();
  //       const intervalId = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
  //       return () => clearInterval(intervalId);
  //   }
  // }, [adminUserId]);

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('impersonatingRole');
    localStorage.removeItem('impersonatingUserId');
    router.push('/login/admin');
  };
  
  const handleEndImpersonation = () => {
    localStorage.removeItem('impersonatingRole');
    localStorage.removeItem('impersonatingUserId');
    router.push('/admin/dashboard/users');
  }

  const handleMarkAllAsRead = async () => {
    //   if (!adminUserId) return;
    //   try {
    //     await fetch(`/api/notifications?userId=${adminUserId}`, { method: 'PUT' });
    //     fetchNotifications(); // Refresh notifications
    //   } catch (error) {
    //     console.error("Failed to mark notifications as read:", error);
    //   }
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-card md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Package2 className="h-6 w-6 text-primary" />
              <span className="">ComfortPay Admin</span>
            </Link>
             {isImpersonating && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant="outline" size="icon" className="ml-auto h-7 w-7" onClick={handleEndImpersonation}>
                        <Undo2 className="h-4 w-4" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>End Impersonation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex-1">
            <AdminNav />
          </div>
        </div>
      </div>
      <div className="flex flex-col ">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Home className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <AdminNavMobile />
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
             {isImpersonating && (
                <Button variant="outline" size="sm" onClick={handleEndImpersonation}>
                    <Undo2 className="mr-2 h-4 w-4" />
                    <span>End Impersonation</span>
                </Button>
            )}
          </div>
          <DropdownMenu onOpenChange={(open) => open && unreadCount > 0 && handleMarkAllAsRead()}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative hidden">
                <Bell className="h-4 w-4"/>
                <span className="sr-only">Toggle notifications</span>
                 {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                 )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length > 0 ? notifications.map(n => (
                <DropdownMenuItem key={n.id} asChild>
                  <Link href={n.link || '#'}>
                    <div className="flex flex-col">
                      <p className="font-semibold">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Image
                  src={`https://placehold.co/36x36.png`}
                  alt="Admin Avatar"
                  width={36}
                  height={36}
                  className="rounded-full"
                  data-ai-hint="user avatar"
                />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/dashboard/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
               <DropdownMenuItem onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background w-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
