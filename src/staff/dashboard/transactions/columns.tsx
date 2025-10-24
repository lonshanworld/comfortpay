
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Order, OrderStatus } from "@/lib/types"
import Link from "next/link"

const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Completed':
      return 'secondary';
    case 'Pending':
    case 'Requires Confirmation':
      return 'default';
    case 'Failed':
    case 'Refunded':
      return 'destructive';
    default:
      return 'outline';
  }
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "id",
    header: "Transaction",
    cell: ({ row }) => {
        const transaction = row.original;
        return (
            <div className="font-medium">
                <div>{transaction.id}</div>
                <div className="text-sm text-muted-foreground">Merchant: {transaction.merchantOrderId}</div>
            </div>
        )
    }
  },
  {
    accessorKey: "merchantName",
    header: "Merchant",
     cell: ({ row }) => {
        const transaction = row.original;
        const websiteUrl = transaction.merchantWebsiteUrl || '#';
        return (
            <Link href={websiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
                {transaction.merchantName} <ExternalLink className="h-3 w-3" />
            </Link>
        )
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
       const status = row.getValue("status") as OrderStatus;
       return <Badge variant={getStatusVariant(status)}>{status}</Badge>
    },
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => (
        <div className="text-right">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Total Amount
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </div>
    ),
    cell: ({ row }) => (
        <div className="text-right">{formatCurrency(row.original.totalAmount, row.original.currency)}</div>
    )
  },
  {
    accessorKey: "orderDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Transaction Date (GMT)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const date = new Date(row.getValue("orderDate"));
        return <div>{date.toLocaleString()}</div>
    },
  },
]
