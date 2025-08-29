

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
import type { Order, OrderStatus } from "@/lib/types"
import Link from "next/link"

const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Completed':
    case 'Reconciled':
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
    header: ({ column }) => {
        return (
            <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
            ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        )
    },
    cell: ({ row }) => <div className="font-mono">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "visualOrderId",
    header: "Visual ID",
    cell: ({ row }) => <div className="font-mono">{row.getValue("visualOrderId")}</div>
  },
  {
    accessorKey: "merchantOrderId",
    header: "Merchant ID",
    cell: ({ row }) => <div className="font-mono">{row.getValue("merchantOrderId")}</div>
  },
  {
    accessorKey: "paymentGatewayTransactionId",
    header: "Gateway ID",
    cell: ({ row }) => <div className="font-mono">{row.original.paymentGatewayTransactionId || "N/A"}</div>
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
    accessorKey: "sourceWebsiteUrl",
    header: "Source Website",
    cell: ({ row }) => {
      const sourceWebsiteUrl = row.getValue("sourceWebsiteUrl") as string | undefined
      if (!sourceWebsiteUrl) {
        return <span className="text-muted-foreground">N/A</span>
      }
      return (
        <Link href={sourceWebsiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
            {new URL(sourceWebsiteUrl).hostname} <ExternalLink className="h-3 w-3" />
        </Link>
      )
    },
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
    accessorKey: "paymentType",
    header: "Payment Method",
     cell: ({ row }) => {
        const transaction = row.original;
        return (
            <div>
                <div>{transaction.paymentType}</div>
                <div className="text-sm text-muted-foreground">{transaction.paymentMethod}</div>
            </div>
        )
    }
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
    cell: ({ row }) => (
        <div className="text-right">{formatCurrency(row.original.totalAmount, row.original.currency)}</div>
    )
  },
  {
    accessorKey: "paidAmount",
    header: ({ column }) => (
        <div className="text-right">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Paid Amount
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </div>
    ),
    cell: ({ row }) => {
      const { paidAmount, totalAmount, currency } = row.original;
      const isOverpaid = paidAmount > totalAmount;

      return (
        <div className="text-right space-y-1">
            <div>{formatCurrency(paidAmount, currency)}</div>
            {isOverpaid && <Badge variant="destructive">Refund Due</Badge>}
        </div>
      )
    }
  },
   {
    accessorKey: "currency",
    header: "Currency",
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
  {
    accessorKey: "paymentReceivedDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Payment Received (GMT)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const date = row.getValue("paymentReceivedDate") as string;
        if (!date) return <span className="text-muted-foreground">N/A</span>;
        return <div>{new Date(date).toLocaleString()}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
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
             {transaction.status === "Requires Confirmation" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onConfirmPayment(transaction)}>
                    <Check className="mr-2 h-4 w-4" />
                    <span>Confirm Payment</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
