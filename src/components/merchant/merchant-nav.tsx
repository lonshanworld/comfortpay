
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  BarChart,
  LayoutGrid,
  Package2,
  ShoppingCart,
  Loader2,
  Settings,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SheetDescription, SheetTitle } from '../ui/sheet';

const navLinks = [
    // { href: '/merchant/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { href: '/merchant/dashboard/transactions', label: 'Transactions', icon: ShoppingCart },
    // { href: '/merchant/dashboard/reports', label: 'Reports', icon: BarChart },
    { href: '/merchant/dashboard/settings', label: 'Settings', icon: Settings },
];

export function MerchantNav() {
    const pathname = usePathname();
    const [loading, setLoading] = useState<string | null>(null);

    useEffect(() => {
        setLoading(null);
    }, [pathname]);

    const handleClick = (href: string) => {
        if (pathname !== href) {
            setLoading(href);
        }
    };

    return (
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navLinks.map(link => {
                const isActive = link.href === '/merchant/dashboard'
                    ? pathname === link.href
                    : pathname.startsWith(link.href);
                const isLoading = loading === link.href;
                return (
                    <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => handleClick(link.href)}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                            isActive && "bg-muted text-primary",
                             isLoading && "pointer-events-none"
                        )}
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <link.icon className="h-4 w-4" />}
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    );
}

export function MerchantNavMobile() {
    const pathname = usePathname();
    const [loading, setLoading] = useState<string | null>(null);

    useEffect(() => {
        setLoading(null);
    }, [pathname]);

    const handleClick = (href: string) => {
        if (pathname !== href) {
            setLoading(href);
        }
    };


    return (
        <nav className="grid gap-2 text-lg font-medium">
             <SheetTitle className="sr-only">Merchant Navigation</SheetTitle>
            <SheetDescription className="sr-only">A list of links to navigate the merchant dashboard.</SheetDescription>
             <Link
                  href="/merchant/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Package2 className="h-6 w-6 text-primary" />
                  <span className="sr-only">ComfortPay</span>
            </Link>
            {navLinks.map(link => {
                const isActive = link.href === '/merchant/dashboard'
                    ? pathname === link.href
                    : pathname.startsWith(link.href);
                const isLoading = loading === link.href;
                return (
                     <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => handleClick(link.href)}
                        className={cn(
                            "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground",
                            isActive && "bg-muted text-foreground",
                            isLoading && "pointer-events-none"
                        )}
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <link.icon className="h-5 w-5" />}
                        <span className="flex-1 break-words">{link.label}</span>
                    </Link>
                )
            })}
        </nav>
    );
}
