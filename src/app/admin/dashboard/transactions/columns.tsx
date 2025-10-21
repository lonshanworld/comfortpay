
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"


const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Completed':
      return 'success';
    case 'Over-paid Refunded':
        return 'success-dark';
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
  onStatusChange: (transaction: Order, newStatus: OrderStatus) => void;
  isConfirmingId: string | null;
  isUpdatingStatusId: string | null;
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

    // const getTitle = () => {
    //     if (transaction.status === 'Partially Paid') return "Confirm Additional Payment";
    //     return "Confirm Payment";
    // }

    const getRemaining = () => transaction.totalAmount - transaction.paidAmount;

    return (
        <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto">
                {isConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                  <Badge variant={getStatusVariant(transaction.status)} className="cursor-pointer hover:opacity-80">
                        {transaction.status}
                    </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 space-y-4">
                <div className="space-y-1">
                     <p className="text-sm font-medium">
                        {transaction.status === 'Partially Paid' ? "Confirm Additional Payment" : "Confirm Payment"}
                    </p>
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

const OverpaymentPopover = ({ transaction, onStatusChange }: { transaction: Order, onStatusChange: (transaction: Order, newStatus: OrderStatus) => void }) => {
    const overpaidAmount = transaction.paidAmount - transaction.totalAmount;
    console.log("Overpaid Amount:", overpaidAmount);
    return (
        <Popover>
            <PopoverTrigger asChild>
                 <Badge className="h-auto py-0.5 px-1.5 text-xs border-green-500 text-green-500 bg-transparent hover:bg-green-500/10 cursor-pointer">
                    + {formatCurrency(overpaidAmount, transaction.currency)}
                </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 space-y-4">
                 <div className="space-y-1">
                    <p className="text-sm font-medium">Handle Overpayment</p>
                    <p className="text-xs text-muted-foreground">
                       Mark this order to indicate the overpayment has been refunded or handled.
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={() => onStatusChange(transaction, 'Over-paid Refunded')}
                    className="w-full"
                >
                    Change to Over-paid Refunded
                </Button>
            </PopoverContent>
        </Popover>
    );
};

const StatusDropdown = ({ transaction, onStatusChange, isUpdating }: { transaction: Order, onStatusChange: (transaction: Order, newStatus: OrderStatus) => void, isUpdating: boolean}) => {
    const statuses: OrderStatus[] = ["Pending","On-Hold", "Completed", "Failed", "Requires Confirmation", "Partially Paid", "Refunded",  "Over-paid Refunded"];

   const isOverpaid = transaction.status === 'Completed' && transaction.paidAmount > transaction.totalAmount;

    return (
        <div className="flex flex-row items-start gap-1">
            {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
            <Select 
                value={transaction.status} 
                onValueChange={(newStatus: OrderStatus) => onStatusChange(transaction, newStatus)}
                disabled={isUpdating}
            >
                <SelectTrigger className={cn(
                    "h-auto w-auto border-none p-0 shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:hidden",
                    "bg-transparent hover:bg-transparent"
                )}>
                     <SelectValue asChild>
                        <Badge variant={getStatusVariant(transaction.status)} className="cursor-pointer">
                            {transaction.status}
                        </Badge>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {statuses.map(s => (
                        <SelectItem key={s} value={s}>
                            {s}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
             {isOverpaid && (
                <OverpaymentPopover transaction={transaction} onStatusChange={onStatusChange} />
            )}
        </div>
    )
}


export const columns = ({ onView, onEdit, onConfirmPayment, onStatusChange, isConfirmingId, isUpdatingStatusId }: TransactionColumnsProps): ColumnDef<Order>[] => [
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
  {
    accessorKey: "orderDate",
    header: "Order Date",
    cell: ({ row }) =>{
      console.log("Order Date Cell:", JSON.stringify(row));  
      return  formatDate(row.original.orderDate);
    }
  },
  // {
  //   accessorKey: "id",
  //   header: "ComfortPay ID",
  //   cell: ({ row }) => <div className="font-mono">{row.getValue("id")}</div>,
  // },
  
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
      const isUpdating = isUpdatingStatusId === transaction.id;

      if (status === 'Requires Confirmation' || status === 'Partially Paid' || status === 'On-Hold') {
        return (
          <ConfirmationPopover transaction={transaction} onConfirmPayment={onConfirmPayment} isConfirming={isConfirming} />
        );
      }
       return <StatusDropdown transaction={transaction} onStatusChange={onStatusChange} isUpdating={isUpdating} />;
    }
  },
  //  {
  //   accessorKey: "riskDetails",
  //   header: "Risk Level",
  //   cell: ({ row }) => {
  //       const riskDetails = row.original.riskDetails;
  //       if (!riskDetails) return <span className="text-xs text-muted-foreground">N/A</span>;
        
  //       const riskLevel = riskDetails.risk_level || riskDetails.riskLevel; // Stripe or Square
  //       if (!riskLevel) return <span className="text-xs text-muted-foreground">Unknown</span>;

  //       return (
  //            <Popover>
  //               <PopoverTrigger asChild>
  //                   <Badge variant={getRiskVariant(riskLevel)} className="cursor-pointer">
  //                       <ShieldQuestion className="mr-1.5 h-3.5 w-3.5" />
  //                       {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase()}
  //                   </Badge>
  //               </PopoverTrigger>
  //               <PopoverContent className="w-80">
  //                   <div className="space-y-2">
  //                       <h4 className="font-medium leading-none">Risk Details</h4>
  //                       <pre className="mt-2 w-full text-xs overflow-auto rounded-md bg-muted p-2 font-mono">
  //                          {JSON.stringify(riskDetails, null, 2)}
  //                       </pre>
  //                   </div>
  //               </PopoverContent>
  //           </Popover>
  //       )
  //   }
  // },
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
  // {
  //   accessorKey: "paymentMethod",
  //   header: "Payment Method",
  // },
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
