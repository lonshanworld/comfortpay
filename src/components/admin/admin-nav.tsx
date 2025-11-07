
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  ShoppingCart,
  Users,
  CreditCard,
  Package2,
  Loader2,
  Settings,
  Users2,
  Mail,
  DollarSign,
  History,
  Banknote,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SheetClose, SheetDescription, SheetTitle } from '../ui/sheet';

const navLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { href: '/admin/dashboard/transactions', label: 'Transactions', icon: ShoppingCart, badge: 6 },
    { href: '/admin/dashboard/merchants', label: 'Merchants', icon: Users },
    { href: '/admin/dashboard/users', label: 'Users', icon: Users2 },
    
    { href: '/admin/dashboard/settlement', label: 'Settlement', icon: DollarSign },
    { href: '/admin/dashboard/payouts', label: 'Payouts', icon: Banknote },
    { href: '/admin/dashboard/payments', label: 'Payment Accounts', icon: CreditCard },
    { href: '/admin/dashboard/payment-history', label: 'Payment History', icon: History },
    // { href: '/admin/dashboard/email', label: 'Email', icon: Mail },
    { href: '/admin/dashboard/settings', label: 'Settings', icon: Settings },
];

export function AdminNav() {
    const pathname = usePathname();
    const [loading, setLoading] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

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
                const isActive = isClient && (link.href === '/admin/dashboard'
                  ? pathname === link.href
                  : pathname.startsWith(link.href));
                const isLoading = loading === link.href;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => handleClick(link.href)}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                            (isActive && !isLoading) && "bg-muted text-primary",
                            isLoading && "pointer-events-none"
                        )}
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <link.icon className="h-4 w-4" />}
                        {link.label}
                        {/* {link.badge && !isLoading && (
                            <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                                {link.badge}
                            </Badge>
                        )} */}
                    </Link>
                )
            })}
        </nav>
    );
}

export function AdminNavMobile() {
    const pathname = usePathname();
    const [loading, setLoading] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

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
            <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
            <SheetDescription className="sr-only">A list of links to navigate the admin dashboard.</SheetDescription>
             <Link
                  href="#"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Package2 className="h-6 w-6 text-primary" />
                  <span className="sr-only">ComfortPay Admin</span>
            </Link>
            {navLinks.map(link => {
                const isActive = isClient && (link.href === '/admin/dashboard'
                  ? pathname === link.href
                  : pathname.startsWith(link.href));
                 const isLoading = loading === link.href;
                return (
                     <SheetClose asChild key={link.href}>
                        <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => handleClick(link.href)}
                        className={cn(
                            "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground",
                            (isActive && !isLoading) && "bg-muted text-foreground",
                            isLoading && "pointer-events-none"
                        )}
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <link.icon className="h-5 w-5" />}
                       
                         <span className="flex-1">{link.label}</span>
                    </Link>
                     </SheetClose>
                )
            })}
        </nav>
    );
}
