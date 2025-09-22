
"use client"
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react"
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
import type { Order } from "@/lib/types"
import { ViewTransactionDialog } from "@/components/admin/view-transaction-dialog";
import { DollarSign, CreditCard, Users, Activity } from "lucide-react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface MerchantStats {
  todaysRevenue: number;
  todaysSales: number;
  pendingConfirmation: number;
}

export default function MerchantDashboard() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    let id;
    if (userRole === 'Admin') {
      id = localStorage.getItem('impersonatingUserId');
    } else {
      id = localStorage.getItem('userId');
    }
    setMerchantId(id);
  }, []);

  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (!merchantId) return;
    if (isInitialLoad) {
        setIsLoading(true);
    }
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const transactionsParams = new URLSearchParams({ 
        merchantId,
        startDate: today.toISOString(),
        status: 'NOT_PENDING',
      });
      
      const [statsRes, transactionsRes] = await Promise.all([
         fetch(`/api/dashboard/merchant-stats/${merchantId}`),
         fetch(`/api/orders?${transactionsParams.toString()}`)
      ]);

      const statsData = await statsRes.json();
      const transactionsData = await transactionsRes.json();
      
      setStats(statsData);
      setTransactions(transactionsData);

    } catch (error) {
      console.error("Failed to fetch merchant data", error);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [merchantId]);

  useEffect(() => {
    if (merchantId) {
      fetchData(true); // Initial fetch
      const intervalId = setInterval(() => fetchData(false), 30000); // Refresh every 30 seconds
      return () => clearInterval(intervalId); // Cleanup on unmount
    }
  }, [merchantId, fetchData]);


  const handleViewClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  }

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
  }

   if (isLoading) {
    return (
      <div className="flex flex-1 justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid flex-1 items-start gap-4">
       {selectedTransaction && (
            <ViewTransactionDialog
              open={isViewDialogOpen}
              onOpenChange={setIsViewDialogOpen}
              transaction={selectedTransaction}
            />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today&apos;s Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.todaysRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Total revenue from completed sales today.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today&apos;s Sales
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{stats?.todaysSales || 0}</div>
              <p className="text-xs text-muted-foreground">
                Total number of transactions created today.
              </p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Confirmation</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingConfirmation || 0}</div>
              <p className="text-xs text-muted-foreground">
                Transactions awaiting manual payment verification.
              </p>
            </CardContent>
          </Card>
        </div>
      
          <Card>
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Today&apos;s Transactions</CardTitle>
                <CardDescription>
                  A list of transactions received today.
                </CardDescription>
              </div>
               <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="/merchant/dashboard/transactions">
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length > 0 ? transactions.map(tx => (
                        <TableRow key={tx.id} onClick={() => handleViewClick(tx)} className="cursor-pointer">
                          <TableCell>
                            <div className="font-medium">{tx.customerName}</div>
                            <div className="text-sm text-muted-foreground">{tx.customerEmail}</div>
                          </TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge>{tx.status}</Badge></TableCell>
                          <TableCell className="hidden sm:table-cell">{tx.paymentMethod}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.totalAmount, tx.currency)}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No transactions today.
                            </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </div>
            
          </Card>
    </div>
  )
}
