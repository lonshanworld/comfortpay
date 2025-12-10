
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Loader2, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PaymentAccount } from "@/lib/types"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { cn } from "@/lib/utils"

type PaymentAccountColumnsProps = {
  onManage: (account: PaymentAccount) => void;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}


export const columns = ({ onManage }: PaymentAccountColumnsProps): ColumnDef<PaymentAccount>[] => [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="font-mono">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const account = row.original;
        return (
             <div className="font-medium">
                <div>{account.name}</div>
                <div className="text-sm text-muted-foreground">{account.type}</div>
            </div>
        )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
       const status = row.getValue("status") as string;
       return <Badge variant={status === 'Active' ? "secondary" : "destructive"}>{status}</Badge>
    },
  },
  {
    accessorKey: "currentVolume",
    header: "Daily Volume",
    cell: ({ row }) => {
        const account = row.original;
        const currentVolume = Number(account.currentVolume);
        const dailyLimit = Number(account.dailyLimit);
        const isOverLimit = dailyLimit > 0 && currentVolume >= dailyLimit;
        const progressValue = dailyLimit > 0 ? (currentVolume / dailyLimit) * 100 : 0;
        
        return (
            <div className="w-48">
                <div className={cn("flex justify-between text-xs mb-1", isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground")}>
                    <span>{formatCurrency(currentVolume)}</span>
                    <span>{formatCurrency(dailyLimit)}</span>
                </div>
                <Progress value={progressValue} className={cn("h-2", isOverLimit && "[&>div]:bg-destructive")} />
            </div>
        )
    },
  },
   {
    accessorKey: "websiteUrl",
    header: "Details",
    cell: ({ row }) => {
        const account = row.original;
        if (account.type === "Zelle" || account.type === "Interac" || account.type === "Wise") {
            return <div className="text-sm">{account.accountEmail}</div>
        }
        if (account.websiteUrl) {
            return (
                 <Link href={account.websiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline text-sm">
                    {new URL(account.websiteUrl).hostname} <ExternalLink className="h-3 w-3" />
                </Link>
            )
        }
        return <span className="text-muted-foreground text-xs">N/A</span>
    }
  },
  {
    accessorKey: "prefix_order_name",
    header: "Order Prefix",
    cell: ({ row }) => row.getValue("prefix_order_name") || <span className="text-muted-foreground text-xs">Not Set</span>
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const account = row.original

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
            <DropdownMenuItem onClick={() => onManage(account)}>
                Manage Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
