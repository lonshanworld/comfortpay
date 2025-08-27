
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink, MoreHorizontal, LayoutGrid, Loader2, KeyRound } from "lucide-react"

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
import type { Merchant } from "@/lib/types"
import Link from "next/link"

type MerchantColumnsProps = {
  onView: (merchant: Merchant) => void;
  onEdit: (merchant: Merchant) => void;
  onDelete: (merchant: Merchant) => void;
  onViewDashboard: (merchant: Merchant) => void;
  onManageToken: (merchant: Merchant) => void;
  isDeletingId: string | null;
};

export const columns = ({ onView, onEdit, onDelete, onViewDashboard, onManageToken, isDeletingId }: MerchantColumnsProps): ColumnDef<Merchant>[] => [
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
    accessorKey: "email",
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
        const merchant = row.original;
        return (
             <div className="font-medium">
                <div>{merchant.name}</div>
                <div className="text-sm text-muted-foreground">{merchant.email}</div>
            </div>
        )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
       const merchant = row.original;
       const status = merchant.status;

        if (status === 'Active' && !merchant.bankName && !merchant.walletAddress) {
            return <Badge variant="default">Billing Info Required</Badge>;
        }

       return <Badge variant={status === 'Active' ? "secondary" : "destructive"}>{status}</Badge>
    },
  },
  {
    accessorKey: "websiteUrl",
    header: "Website",
    cell: ({ row }) => {
      const websiteUrl = row.getValue("websiteUrl") as string | undefined
      if (!websiteUrl) {
        return <span className="text-muted-foreground">N/A</span>
      }
      return (
        <Link href={websiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
            {new URL(websiteUrl).hostname} <ExternalLink className="h-3 w-3" />
        </Link>
      )
    },
  },
  {
    accessorKey: "bankName",
    header: "Bank",
    cell: ({ row }) => row.getValue("bankName") || <span className="text-muted-foreground">N/A</span>,
  },
  {
    accessorKey: "network",
    header: "Wallet",
    cell: ({ row }) => row.getValue("network") || <span className="text-muted-foreground">N/A</span>,
  },
  {
    accessorKey: "dateJoined",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date Joined (GMT)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const date = new Date(row.getValue("dateJoined"));
        return <div>{date.toLocaleString()}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const merchant = row.original
      const isDeleting = isDeletingId === merchant.id;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
              <span className="sr-only">Open menu</span>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewDashboard(merchant)}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>View Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onView(merchant)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(merchant)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageToken(merchant)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Manage Token
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(merchant)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
