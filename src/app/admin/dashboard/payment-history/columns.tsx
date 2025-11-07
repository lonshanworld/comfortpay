
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DailyVolumeHistory, Order } from "@/lib/types"
import React, { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

const formatCurrency = (amount: number, currency: string = "USD") => {
    const numericAmount = amount ?? 0;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(numericAmount);
};

const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A";
    
    // The date string from the API is now a reliable ISO 8601 UTC string.
    // We can safely parse it and format it for display.
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return "Invalid Date";
    }

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'GMT', // Explicitly display in GMT
        hour12: true,
    };
    return date.toLocaleString('en-US', options);
}



const ExpandedComponent = ({ row }: { row: any }) => {
    const historyItem = row.original as DailyVolumeHistory;
    const [transactions, setTransactions] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                const date = new Date(historyItem.date);
                const startDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000)).toISOString();
                const nextDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + 24 * 60 * 60 * 1000);
                const endDate = nextDate.toISOString();
                
                const params = new URLSearchParams({
                    paymentAccountId: historyItem.paymentAccountId,
                    paymentReceivedDate_start: startDate,
                    paymentReceivedDate_end: endDate,
                });

                const response = await fetch(`/api/orders?${params.toString()}`);
                const result = await response.json();
                setTransactions(result.data || []);
            } catch (error) {
                console.error("Failed to fetch transactions for history entry", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTransactions();
    }, [historyItem]);

    if (isLoading) return <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>;
    if (transactions.length === 0) return <div className="p-4 text-center text-sm text-muted-foreground">No transactions found for this day.</div>

    return (
        <div className="p-4 bg-muted/50">
            <h5 className="font-semibold text-sm mb-2">Transactions for {historyItem.accountName} on {new Date(historyItem.date + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'GMT', year: 'numeric', month: 'short', day: 'numeric' })}:</h5>
            <div className="rounded-md border bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {transactions.map(t => (
                        <TableRow key={t.id}>
                        <TableCell>{t.merchantOrderId}</TableCell>
                        <TableCell>{t.customerName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.paidAmount, t.currency)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export const columns = (): ColumnDef<DailyVolumeHistory>[] => [
  {
     accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Date
        <ChevronsUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
        const isExpanded = row.getIsExpanded();
        console.log("createat date", row.original.createdAt);
        return (
            <div className="flex items-center gap-2">
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); row.toggleExpanded(!isExpanded);}}
                    className="h-6 w-6 p-0"
                >
                    {/* <ChevronsUpDown className="h-4 w-4 text-muted-foreground transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} /> */}
                </Button>
                <span>{formatDate(row.original.createdAt)}</span>
            </div>
        )
    },
    size: 200,
  },
  {
    accessorKey: "accountName",
    header: "Account",
    cell: ({ row }) => {
        const item = row.original;
        return (
            <div>
                <div className="font-medium">{item.accountEmail || ''}</div>
                 <div className="text-xs text-muted-foreground">{item.accountType} - {item.name || 'N/A'}</div>
            </div>
        )
    },
    size: 250,
  },
  {
    accessorKey: "totalVolume",
     header: ({ column }) => (
      <div className="text-right">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total Volume
          {/* <ChevronsUpDown className="ml-2 h-4 w-4" /> */}
        </Button>
      </div>
    ),
    cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.original.totalVolume)}</div>,
    size: 150,
  },
];

export const subComponent = ExpandedComponent;
