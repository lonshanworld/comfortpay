
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Users,
  BarChart,
  Loader2,
  Package2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

const navLinks = [
    { href: '/sale-agent/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { href: '/sale-agent/dashboard/merchants', label: 'My Merchants', icon: Users },
    { href: '/sale-agent/dashboard/performance', label: 'Performance', icon: BarChart },
];

export function SaleAgentNav() {
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
                const isActive = link.href === '/sale-agent/dashboard'
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

export function SaleAgentNavMobile() {
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
             <Link
                  href="#"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Package2 className="h-6 w-6 text-primary" />
                  <span className="sr-only">ComfortPay Sales</span>
            </Link>
            {navLinks.map(link => {
                const isActive = link.href === '/sale-agent/dashboard'
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
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    );
}
