

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Order, OrderStatus } from "@/lib/types"

const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Completed':
    case 'Reconciled':
      return 'secondary';
    case 'Pending':
      return 'outline';
    case 'Requires Confirmation':
      return 'default';
    case 'Failed':
    case 'Refunded':
      return 'destructive';
    default:
      return 'outline';
  }
};

type TransactionColumnsProps = {
  onView: (transaction: Order) => void;
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}


export const columns = ({ onView }: TransactionColumnsProps): ColumnDef<Order>[] => [
  {
    accessorKey: "id",
    header: "Transaction",
    cell: ({ row }) => {
        const transaction = row.original;
        return (
            <div className="font-medium">
                <div>{transaction.id}</div>
                <div className="text-sm text-muted-foreground hidden sm:block">
                    {new Date(transaction.orderDate).toLocaleString()}
                </div>
            </div>
        )
    },
  },
  {
    accessorKey: "customerName",
    header: "Customer",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant={getStatusVariant(status)}>
            {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "paymentMethod",
    header: "Payment Method",
  },
  {
    accessorKey: "orderAmount",
    header: ({ column }) => (
        <div className="text-right">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Order Amount
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </div>
    ),
    cell: ({ row }) => (
        <div className="text-right">{formatCurrency(row.original.orderAmount, row.original.currency)}</div>
    )
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
    cell: ({ row }) => {
      const { totalAmount, currency } = row.original;
      return <div className="text-right">{formatCurrency(totalAmount, currency)}</div>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const transaction = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-haspopup="true"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(transaction)}>View Details</DropdownMenuItem>
            <DropdownMenuItem disabled>Issue Refund</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
