
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Order, OrderStatus } from "@/lib/types"
import Link from "next/link"

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
  onEdit: (transaction: Order) => void;
  onConfirmPayment: (transaction: Order) => void;
  isConfirmingId: string | null;
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}


export const columns = ({ onView, onEdit, onConfirmPayment, isConfirmingId }: TransactionColumnsProps): ColumnDef<Order>[] => [
  {
    accessorKey: "id",
    header: "ComfortPay ID",
    cell: ({ row }) => <div className="font-mono">{row.getValue("id")}</div>,
  },
   {
    accessorKey: "merchantId",
    header: "Merchant ID",
  },
  {
    accessorKey: "merchantName",
    header: "Merchant Name",
  },
   {
    accessorKey: "merchantWebsiteUrl",
    header: "Merchant Website",
    cell: ({ row }) => {
        const websiteUrl = row.original.merchantWebsiteUrl;
        if (!websiteUrl) return "N/A";
        return (
             <Link href={websiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
                {new URL(websiteUrl).hostname} <ExternalLink className="h-3 w-3" />
            </Link>
        )
    }
  },
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
    cell: ({ row }) => {
      const transaction = row.original;
      const status = transaction.status;
      const isConfirming = isConfirmingId === transaction.id;

      if (status === 'Requires Confirmation') {
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="default" size="sm" className="h-auto py-0.5 px-2.5">
                {isConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Requires Confirmation
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium">Confirm Payment?</p>
                <Button
                  size="sm"
                  onClick={() => onConfirmPayment(transaction)}
                  disabled={isConfirming}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirm
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      }
      return <Badge variant={getStatusVariant(status)}>{status}</Badge>
    }
  },
  {
    accessorKey: "orderAmount",
    header: "Order Amount",
    cell: ({ row }) => formatCurrency(row.original.orderAmount, row.original.currency)
  },
  {
    accessorKey: "totalAmount",
    header: "Total Amount",
    cell: ({ row }) => formatCurrency(row.original.totalAmount, row.original.currency)
  },
  {
    accessorKey: "paidAmount",
    header: "Paid Amount",
    cell: ({ row }) => formatCurrency(row.original.paidAmount, row.original.currency)
  },
  {
    accessorKey: "currency",
    header: "Currency",
  },
  {
    accessorKey: "paymentMethod",
    header: "Payment Method",
  },
  {
    accessorKey: "paymentType",
    header: "Processor",
  },
  {
    accessorKey: "paymentAccountId",
    header: "Acct. ID",
  },
  {
    accessorKey: "paymentGatewayTransactionId",
    header: "Gateway ID",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const transaction = row.original
      const isConfirming = isConfirmingId === transaction.id;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isConfirming}>
              <span className="sr-only">Open menu</span>
              {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(transaction)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(transaction)}>
              Edit Transaction
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
