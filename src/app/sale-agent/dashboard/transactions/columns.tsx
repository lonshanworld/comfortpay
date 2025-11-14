
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import type { Order, OrderStatus } from "@/lib/types"

const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Completed':
    case 'Over-paid Refunded':
      return 'success';
    case 'Pending':
      return 'pending';
    case 'Partially Paid':
        return 'warning'
    case 'On-Hold':
      return 'secondary';
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

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "merchantId",
    header: "Merchant ID",
    cell: ({ row }) => {
        const order = row.original;
        const numericId = order.merchantId.split('_')[1];
        if (order.merchantWebsiteUrl) {
            try {
                const hostname = new URL(order.merchantWebsiteUrl).hostname;
                const prefix = hostname.replace('www.', '').substring(0, 3).toUpperCase();
                return `${prefix}_${numericId}`;
            } catch (e) {
                return `user_${numericId}`;
            }
        }
        return `user_${numericId}`;
    },
    size : 70
  },
  {
    accessorKey: "merchantOrderId",
    header: "Order ID",
  },
  {
    accessorKey: "orderDate",
    header: "Order Date",
    cell: ({ row }) => formatDate(row.original.orderDate),
  },
  {
    accessorKey: "paymentReceivedDate",
    header: "Payment Date",
    cell: ({ row }) => formatDate(row.original.paymentReceivedDate),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const displayStatus = status === 'Over-paid Refunded' ? 'Completed' : status;
      return <Badge variant={getStatusVariant(status)}>{displayStatus}</Badge>
    },
  },
  {
    accessorKey: "totalAmount",
    header: "Order Amount",
    cell: ({ row }) => formatCurrency(row.original.totalAmount, row.original.currency),
  },
    {
    accessorKey: "currency",
    header: "Currency",
  },
  
]
