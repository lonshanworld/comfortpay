

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

export default function MerchantDashboard() {
  const [transactions, setTransactions] = useState<Order[]>([]);
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

  const fetchTodaysTransactions = useCallback(async () => {
    if (!merchantId) return;
    setIsLoading(true);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const params = new URLSearchParams({ 
        merchantId,
        startDate: today.toISOString(),
      });

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
    } finally {
      setIsLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    if (merchantId) {
      fetchTodaysTransactions();
    }
  }, [merchantId, fetchTodaysTransactions]);


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

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
       {selectedTransaction && (
            <ViewTransactionDialog
              open={isViewDialogOpen}
              onOpenChange={setIsViewDialogOpen}
              transaction={selectedTransaction}
            />
        )}

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$4,250.50</div>
              <p className="text-xs text-muted-foreground">
                +15.2% from yesterday
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Sales
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12</div>
              <p className="text-xs text-muted-foreground">
                +2 from yesterday
              </p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Confirmation</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                Awaiting payment verification
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+5</div>
              <p className="text-xs text-muted-foreground">
                +1 since yesterday
              </p>
            </CardContent>
          </Card>
        </div>
      
          <Card>
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Today's Transactions</CardTitle>
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
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length > 0 ? transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="font-medium">{tx.customerName}</div>
                            <div className="text-sm text-muted-foreground">{tx.customerEmail}</div>
                          </TableCell>
                          <TableCell><Badge>{tx.status}</Badge></TableCell>
                          <TableCell>{tx.paymentMethod}</TableCell>
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
              )}
            </CardContent>
          </Card>
    </div>
  )
}
