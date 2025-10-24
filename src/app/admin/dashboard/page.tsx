
"use client"
import { useState, useEffect, useCallback } from "react"
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
import { RevenueChart } from "@/components/admin/revenue-chart"
import type { DashboardStats } from "@/lib/types"

const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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

    if (isLoading || !stats) {
        return (
            <div className="flex flex-1 justify-center items-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

  return (
      <div className="flex flex-col gap-4 w-svw overflow-x-clip">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 w-11/12">
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
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 w-11/12">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  The last 5 transactions from across the platform.
                </CardDescription>
              </div>
              <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="/admin/dashboard/transactions">
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
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
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="text-right">${Number(tx.amount).toFixed(2)}</TableCell>
                    </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
               <CardDescription>
                  Revenue from the last 6 months.
                </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <RevenueChart data={stats.revenueChart} />
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
