
"use client"
import * as React from "react"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink, MoreHorizontal, Check, Loader2, ShieldQuestion } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      return 'success';
    case 'Pending':
      return 'outline';
    case 'Partially Paid':
        return 'warning'
    case 'Requires Confirmation':
      return 'info';
    case 'Failed':
    case 'Refunded':
      return 'destructive';
    default:
      return 'outline';
  }
};
const getRiskVariant = (riskLevel: string) => {
    const level = riskLevel.toLowerCase();
    if (level.includes('high')) return 'destructive';
    if (level.includes('elevated')) return 'default';
    if (level.includes('normal')) return 'secondary';
    return 'outline';
}


type TransactionColumnsProps = {
  onView: (transaction: Order) => void;
  onEdit: (transaction: Order) => void;
  onConfirmPayment: (transaction: Order, paidAmount: number) => void;
  isConfirmingId: string | null;
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}

const formatDate = (dateString: string | undefined | null) => {
    console.log("Formatting date:", dateString);
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

const ConfirmationPopover = ({ transaction, onConfirmPayment, isConfirming }: { transaction: Order, onConfirmPayment: (transaction: Order, paidAmount: number) => void, isConfirming: boolean}) => {
    const [amount, setAmount] = React.useState<string>('');

    const getTitle = () => {
        if (transaction.status === 'Partially Paid') return "Confirm Additional Payment";
        return "Confirm Payment";
    }

    const getRemaining = () => transaction.totalAmount - transaction.paidAmount;

    return (
        <Popover>
            <PopoverTrigger asChild>
              <Button variant="default" size="sm" className="h-auto py-0.5 px-2.5">
                {isConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {transaction.status}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 space-y-4">
                <div className="space-y-1">
                    <p className="text-sm font-medium">{getTitle()}</p>
                    <p className="text-xs text-muted-foreground">
                        Order Total: {formatCurrency(transaction.totalAmount, transaction.currency)}
                    </p>
                    {transaction.status === 'Partially Paid' && (
                         <p className="text-xs text-muted-foreground">
                            Paid: {formatCurrency(transaction.paidAmount, transaction.currency)} | Remaining: <span className="font-bold">{formatCurrency(getRemaining(), transaction.currency)}</span>
                        </p>
                    )}
                </div>
              <div className="grid gap-2">
                 <Label htmlFor="paid-amount" className="text-xs">
                    {transaction.status === 'Partially Paid' ? 'Additional Amount Received' : 'Amount Received'}
                 </Label>
                 <Input 
                    id="paid-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-8"
                    placeholder="e.g., 50.00"
                 />
              </div>
              <Button
                  size="sm"
                  onClick={() => onConfirmPayment(transaction, parseFloat(amount))}
                  disabled={isConfirming || !amount}
                  className="w-full"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Payment
                </Button>
            </PopoverContent>
          </Popover>
    )
}


export const columns = ({ onView, onEdit, onConfirmPayment, isConfirmingId }: TransactionColumnsProps): ColumnDef<Order>[] => [
    {
    accessorKey: "orderDate",
    header: "Order Date",
    cell: ({ row }) =>{
      console.log("Order Date Cell:", JSON.stringify(row));  
      return  formatDate(row.original.orderDate);
    }
  },
  {
    accessorKey: "id",
    header: "ComfortPay ID",
    cell: ({ row }) => <div className="font-mono">{row.getValue("id")}</div>,
  },
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
    }
  },
  // {
  //   accessorKey: "merchantName",
  //   header: "Merchant Name",
  // },
  //  {
  //   accessorKey: "merchantWebsiteUrl",
  //   header: "Merchant Website",
  //   cell: ({ row }) => {
  //       const websiteUrl = row.original.merchantWebsiteUrl;
  //       if (!websiteUrl) return "N/A";
  //       return (
  //            <Link href={websiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
  //               {new URL(websiteUrl).hostname} <ExternalLink className="h-3 w-3" />
  //           </Link>
  //       )
  //   }
  // },
  {
    accessorKey: "merchantOrderId",
    header: "Order Number",
  },

  {
    accessorKey: "paymentReceivedDate",
    header: "Payment Date",
    cell: ({ row }) => formatDate(row.original.paymentReceivedDate)
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

      if (status === 'Requires Confirmation' || status === 'Partially Paid') {
        return (
          <ConfirmationPopover transaction={transaction} onConfirmPayment={onConfirmPayment} isConfirming={isConfirming} />
        );
      }
      return <Badge variant={getStatusVariant(status)}>{status}</Badge>
    }
  },
   {
    accessorKey: "riskDetails",
    header: "Risk Level",
    cell: ({ row }) => {
        const riskDetails = row.original.riskDetails;
        if (!riskDetails) return <span className="text-xs text-muted-foreground">N/A</span>;
        
        const riskLevel = riskDetails.risk_level || riskDetails.riskLevel; // Stripe or Square
        if (!riskLevel) return <span className="text-xs text-muted-foreground">Unknown</span>;

        return (
             <Popover>
                <PopoverTrigger asChild>
                    <Badge variant={getRiskVariant(riskLevel)} className="cursor-pointer">
                        <ShieldQuestion className="mr-1.5 h-3.5 w-3.5" />
                        {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase()}
                    </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Risk Details</h4>
                        <pre className="mt-2 w-full text-xs overflow-auto rounded-md bg-muted p-2 font-mono">
                           {JSON.stringify(riskDetails, null, 2)}
                        </pre>
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
  },
  // {
  //   accessorKey: "orderAmount",
  //   header: "Order Amount",
  //   cell: ({ row }) => formatCurrency(row.original.orderAmount, row.original.currency)
  // },
  {
    accessorKey: "totalAmount",
    header: "Order Amount",
    cell: ({ row }) => formatCurrency(row.original.totalAmount, row.original.currency)
  },
  {
    accessorKey: "currency",
    header: "Currency",
  },
  {
    accessorKey: "paidAmount",
    header: "Paid Amount",
    cell: ({ row }) => formatCurrency(row.original.paidAmount, row.original.currency)
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
    header: "Account Info",
    cell: ({ row }) => {
        const order = row.original;
        return order.paymentAccountEmail || order.paymentAccountId || "N/A";
    }
  },
  // {
  //   accessorKey: "paymentGatewayTransactionId",
  //   header: "Gateway ID",
  // },
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
