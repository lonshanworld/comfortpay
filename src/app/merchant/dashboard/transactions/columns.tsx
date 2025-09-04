
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

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}


export const columns = ({ onView }: TransactionColumnsProps): ColumnDef<Order>[] => [
  {
    accessorKey: "merchantOrderId",
    header: "Order Number",
  },
  {
    accessorKey: "orderDate",
    header: "Order Date",
    cell: ({ row }) => new Date(row.original.orderDate).toLocaleString()
  },
   {
    accessorKey: "paymentReceivedDate",
    header: "Payment Date",
    cell: ({ row }) => row.original.paymentReceivedDate ? new Date(row.original.paymentReceivedDate).toLocaleString() : "N/A"
  },
  {
    accessorKey: "customerFirstName",
    header: "Cust. First Name",
  },
  {
    accessorKey: "customerLastName",
    header: "Cust. Last Name",
  },
  {
    accessorKey: "customerEmail",
    header: "Customer Email",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant={getStatusVariant(row.original.status)}>{row.original.status}</Badge>
  },
  {
    accessorKey: "totalAmount",
    header: "Total Amount",
    cell: ({ row }) => formatCurrency(row.original.totalAmount, row.original.currency)
  },
   {
    accessorKey: "currency",
    header: "Currency",
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
