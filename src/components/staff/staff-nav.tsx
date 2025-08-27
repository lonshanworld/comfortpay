
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  ShoppingCart,
  Users,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User, Permissions } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

const navLinks = [
    { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutGrid, permission: 'view_dashboard' },
    { href: '/staff/dashboard/transactions', label: 'Transactions', icon: ShoppingCart, permission: 'view_transactions' },
    { href: '/staff/dashboard/merchants', label: 'Merchants', icon: Users, permission: 'view_merchants' },
];

const NavSkeleton = () => (
    <div className="grid items-start px-2 text-sm font-medium lg:px-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
    </div>
)


export function StaffNav() {
    const pathname = usePathname();
    const [loading, setLoading] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

     useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (userId) {
            const fetchUser = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`/api/users/${userId}`);
                    if (response.ok) {
                        const data = await response.json();
                        setUser(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch user permissions", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchUser();
        } else {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setLoading(null);
    }, [pathname]);

    const handleClick = (href: string) => {
        if (pathname !== href) {
            setLoading(href);
        }
    };

    const userPermissions: Permissions = React.useMemo(() => {
         if (!user?.permissions) return {};
        try {
            return JSON.parse(user.permissions);
        } catch {
            return {};
        }
    }, [user]);

    if (isLoading) {
        return <NavSkeleton />;
    }

    return (
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navLinks
                .filter(link => userPermissions[link.permission as keyof Permissions])
                .map(link => {
                const isActive = link.href === '/staff/dashboard'
                    ? pathname === link.href
                    : pathname.startsWith(link.href);
                const isLinkLoading = loading === link.href;
                return (
                    <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => handleClick(link.href)}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                            isActive && "bg-muted text-primary",
                            isLinkLoading && "pointer-events-none"
                        )}
                    >
                        {isLinkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <link.icon className="h-4 w-4" />}
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    );
}
