
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Merchant } from "@/lib/types"
import Link from "next/link"

export const columns: ColumnDef<Merchant>[] = [
   {
    accessorKey: "merchantId",
    header: "Merchant ID",
    cell: ({ row }) => {
        const merchant = row.original;
        const numericId = merchant.id.split('_')[1];
        if (merchant.websiteUrl) {
            try {
                const hostname = new URL(merchant.websiteUrl).hostname;
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
  // {
  //   accessorKey: "commissionRates",
  //   header: "Commission Rates",
  //   cell: ({ row }) => {
  //       const rates = row.original.commissionRates;
  //       return (
  //           <div className="text-sm">
  //               <div>Stripe: <span className="font-semibold">{rates?.stripe?.value ?? 'N/A'}%</span></div>
  //               <div>Square: <span className="font-semibold">{rates?.square?.value ?? 'N/A'}%</span></div>
  //               <div>Zelle: <span className="font-semibold">{rates?.zelle?.value ?? 'N/A'}%</span></div>
  //           </div>
  //       )
  //   }
  // },
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
         const dateString = row.getValue("dateJoined") as string;
        if (!dateString) return "N/A";
        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'GMT',
            hour12: true,
        };
        return <div>{date.toLocaleString('en-US', options)}</div>
    },
  },
]
