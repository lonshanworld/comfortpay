
"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Order, Merchant } from "@/lib/types"
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"

export default function StaffTransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true)
      try {
        const [ordersRes, merchantsRes] = await Promise.all([
          fetch(`/api/orders`),
          fetch('/api/merchants'),
        ]);
        const ordersData = await ordersRes.json();
        const merchantsData = await merchantsRes.json();
        
        const transactionsWithDetails = ordersData.map((transaction: Order) => {
            const merchant = merchantsData.find((m: Merchant) => m.id === transaction.merchantId);
            return {
                ...transaction,
                merchantName: merchant?.name || 'N/A',
                merchantWebsiteUrl: merchant?.websiteUrl,
            }
        });
        
        setTransactions(transactionsWithDetails);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions()
  }, [])

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
        <Card>
            <CardHeader>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                  A read-only view of all transactions on the platform.
                </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataTable columns={columns} data={transactions} filterColumnId="merchantName" filterPlaceholder="Filter by merchant..."/>
              )}
            </CardContent>
          </Card>
    </div>
  )
}
