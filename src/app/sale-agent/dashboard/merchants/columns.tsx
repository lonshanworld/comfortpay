
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Merchant } from "@/lib/types"
import Link from "next/link"

export const columns: ColumnDef<Merchant>[] = [
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
       return <Badge variant={status === 'Active' ? "secondary" : "destructive"}>{status}</Badge>
    },
  },
  {
    accessorKey: "commissionRates",
    header: "Commission Rates",
    cell: ({ row }) => {
        const rates = row.original.commissionRates;
        return (
            <div className="text-sm">
                <div>Stripe: <span className="font-semibold">{rates?.stripe?.value ?? 'N/A'}%</span></div>
                <div>Square: <span className="font-semibold">{rates?.square?.value ?? 'N/A'}%</span></div>
                <div>Zelle: <span className="font-semibold">{rates?.zelle?.value ?? 'N/A'}%</span></div>
            </div>
        )
    }
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
]
