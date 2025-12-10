

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Loader2 } from "lucide-react"

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

type TransactionColumnsProps = {
  onView: (transaction: Order) => void;
};


export const columns = ({ onView }: TransactionColumnsProps): ColumnDef<Order>[] => [
  {
    accessorKey: "id",
    header: "Transaction",
    cell: ({ row }) => {
        const transaction = row.original;
         const dateString = transaction.orderDate;
        if (!dateString) return <div>{transaction.id}</div>;

        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'GMT',
            hour12: true,
        };
        return (
            <div className="font-medium">
                <div>{transaction.id}</div>
                <div className="text-sm text-muted-foreground hidden sm:block">
                    {date.toLocaleString('en-US', options)}
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
    accessorKey: "totalAmount",
    header: "Amount",
    cell: ({ row }) => {
      const { totalAmount, currency } = row.original;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
      }).format(totalAmount)
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
