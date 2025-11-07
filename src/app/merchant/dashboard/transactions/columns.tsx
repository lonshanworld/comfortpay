
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
import { tr } from "date-fns/locale"


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

   const isOverpaid = transaction.status === 'Completed' && Number(transaction.paidAmount) > Number(transaction.totalAmount);
    console.log('Rendering StatusDropdown for transaction', transaction.merchantOrderId, 'isOverpaid:', isOverpaid, 'paidAmount:', transaction.paidAmount, 'totalAmount:', transaction.totalAmount, 'status:', transaction.status);
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
    accessorKey: "merchantOrderId",
    header: "Order No:",
    size: 80,
  },
  {
    accessorKey: "orderDate",
    header: "Order Date",
    cell: ({ row }) =>{
      return  formatDate(row.original.orderDate);
    },
    size : 90
  },


  {
    accessorKey: "paymentReceivedDate",
    header: "Pymnt Date",
    cell: ({ row }) => formatDate(row.original.paymentReceivedDate),
    size : 90
  },
  {
    accessorKey: "customerFirstName",
    header: "Cust. First Name",
    size : 70
  },
  {
    accessorKey: "customerLastName",
    header: "Cust. Last Name",
    size : 70
  },
  {
    accessorKey: "customerEmail",
    header: "Customer Email",
    size : 180
  },
  {
    accessorKey: "customerPhone",
    header: "Phone",
    size : 80
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {

       const status = row.original.status;
      const displayStatus = status === 'Over-paid Refunded' ? 'Completed' : status;
      return <Badge variant={getStatusVariant(displayStatus)}>{displayStatus}</Badge>
    },
    size : 160
  },

  {
    accessorKey: "totalAmount",
    header: "Total Amount",
    cell: ({ row }) => formatCurrency(row.original.totalAmount, row.original.currency),
    size : 80
  },
  {
    accessorKey: "currency",
    header: "Curr:",
    size : 50
  },

]
