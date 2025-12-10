

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink, MoreHorizontal, Check, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Order, OrderStatus, Permissions } from "@/lib/types"
import Link from "next/link"

const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Completed':
      return 'success';
    case 'Pending':
      return 'outline';
    case 'Partially Paid':
      return 'warning';
    case 'Requires Confirmation':
      return 'info';
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


const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'GMT',
        hour12: true,
    };
    return date.toLocaleString('en-US', options);
}


type TransactionColumnsProps = {
  permissions: Permissions;
  onView: (transaction: Order) => void;
  onEdit: (transaction: Order) => void;
};


export const columns = ({ permissions, onView, onEdit }: TransactionColumnsProps): ColumnDef<Order>[] => ([
  {
    accessorKey: "id",
    header: "Transaction",
    cell: ({ row }) => {
        const order = row.original;
        return (
            <div className="font-medium">
                <div>{order.id}</div>
                <div className="text-sm text-muted-foreground">Merchant: {order.merchantOrderId}</div>
            </div>
        )
    }
  },
  {
    accessorKey: "merchantName",
    header: "Merchant",
     cell: ({ row }) => {
        const order = row.original;
        const websiteUrl = order.merchantWebsiteUrl || '#';
        return (
            <Link href={websiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
                {order.merchantName} <ExternalLink className="h-3 w-3" />
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
          Order Date (GMT)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div>{formatDate(row.original.orderDate)}</div>

    },
  },
   {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const transaction = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(transaction)}>
              View Details
            </DropdownMenuItem>
            {permissions.edit_transactions && (
                <DropdownMenuItem onClick={() => onEdit(transaction)}>
                Edit Transaction
                </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
])
