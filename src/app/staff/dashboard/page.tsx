
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Users,
  Loader2,
} from "lucide-react"


import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import type { DashboardStats, User, Permissions } from "@/lib/types"

export default function StaffDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

     useEffect(() => {
        const userRole = localStorage.getItem('userRole');
        let id;
        if (userRole === 'Admin') {
            id = localStorage.getItem('impersonatingUserId');
        } else {
            id = localStorage.getItem('userId');
        }

        const fetchUser = async () => {
            if (id) {
                 try {
                    const response = await fetch(`/api/users/${id}`);
                    const data = await response.json();
                    setUser(data);
                } catch (error) {
                    console.error("Failed to fetch user data", error);
                }
            }
        };
        fetchUser();
    }, []);

    const fetchStats = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) {
            setIsLoading(true);
        }
        try {
            const response = await fetch('/api/dashboard/stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
        } finally {
            if (isInitialLoad) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchStats(true); // Initial fetch
        const intervalId = setInterval(() => fetchStats(false), 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [fetchStats]);
    
    const permissions: Permissions = useMemo(() => {
        if (!user?.permissions) return {};
        // The API now guarantees this is an object, but a safeguard is good practice.
        if (typeof user.permissions === 'string') {
            try {
                return JSON.parse(user.permissions);
            } catch {
                return {};
            }
        }
        return user.permissions;
    }, [user]);

    if (isLoading || !stats) {
        return (
            <div className="flex flex-1 justify-center items-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

  return (
      <div className="flex flex-col gap-4">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Dashboard</h1>
            <p className="text-muted-foreground">
                An overview of platform activity based on your permissions.
            </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {permissions.view_dashboard ? (
            <>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Today's Revenue
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">${Number(stats.totalRevenue.value).toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                        {stats.totalRevenue.change}
                    </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">+{stats.sales.value}</div>
                    <p className="text-xs text-muted-foreground">
                        {stats.sales.change}
                    </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Active Merchants
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{stats.merchants.value}</div>
                    <p className="text-xs text-muted-foreground">
                        {stats.merchants.change}
                    </p>
                    </CardContent>
                </Card>
                {stats.pendingConfirmation && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Confirmation</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingConfirmation.value}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.pendingConfirmation.change}
                        </p>
                        </CardContent>
                    </Card>
                )}
            </>
          ) : (
             <Card className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-10 md:col-span-4">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                    No Access to Dashboard Stats
                    </h3>
                    <p className="text-sm text-muted-foreground">
                    You do not have permission to view dashboard summary data.
                    </p>
                </div>
            </Card>
          )}
        </div>
        <div>
          {permissions.view_transactions ? (
            <Card>
                <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>
                    A view of the latest transactions.
                    </CardDescription>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="/staff/dashboard/transactions">
                    View All
                    <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
                </CardHeader>
                <CardContent>
                {/* <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden xl:table-column">
                        Type
                        </TableHead>
                        <TableHead className="hidden xl:table-column">
                        Status
                        </TableHead>
                        <TableHead className="hidden xl:table-column">
                        Date
                        </TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {stats.recentTransactions.map((tx, i) => (
                    <TableRow key={i}>
                        <TableCell>
                        <div className="font-medium">{tx.customerName}</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">
                            {tx.customerEmail}
                        </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-column">
                        {tx.type}
                        </TableCell>
                        <TableCell className="hidden xl:table-column">
                        <Badge className="text-xs" variant="outline">
                            {tx.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell lg:hidden xl:table-column">
                        {tx.date}
                        </TableCell>
                        <TableCell className="text-right">${Number(tx.amount).toFixed(2)}</TableCell>
                    </TableRow>
                    ))}
                    </TableBody>
                </Table> */}
                 <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            Type
                          </TableHead>
                          <TableHead className="hidden sm:table-cell">
                            Status
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Date
                          </TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.recentTransactions.map((tx, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="font-medium">{tx.customerName}</div>
                              <div className="hidden text-sm text-muted-foreground md:inline">
                                {tx.customerEmail}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {tx.type}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge className="text-xs" variant="outline">
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {tx.date}
                            </TableCell>
                            <TableCell className="text-right">${Number(tx.amount).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
            </Card>
          ) : (
             <Card className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-20">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">
                    No Access to Transactions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                    You do not have permission to view transaction data.
                    </p>
                </div>
            </Card>
          )}
        </div>
      </div>
  )
}
