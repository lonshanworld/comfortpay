
"use client"

import React, { useState } from 'react';
import { ColumnDef } from "@tanstack/react-table"
import { ChevronsUpDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PayoutBatch } from "./page"
import { UpdateSettlementDialog } from "@/components/admin/update-settlement-dialog"

const formatCurrency = (amount: number | null | undefined, currency: string = "USD") => {
    // Ensure that if amount is null or undefined, it defaults to 0.
    const numericAmount = amount ?? 0;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(numericAmount);
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

type PayoutColumnsProps = {
  onUpdateSuccess: () => void;
};


export const columns = ({ onUpdateSuccess }: PayoutColumnsProps): ColumnDef<PayoutBatch>[] => [
  {
    accessorKey: "batchId",
    header: "Batch ID",
    cell: ({ row }) => {
        const isExpanded = row.getIsExpanded();
        return (
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                     onClick={(e) => { e.stopPropagation(); row.toggleExpanded(!isExpanded);}}
                    className="h-6 w-6 p-0"
                >
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                </Button>
                <span className="font-mono">{row.original.batchId}</span>
            </div>
        )
    },
  },
  {
    accessorKey: "payoutStatus",
    header: "Status",
    cell: ({ row }) => {
        const isSettled = row.original.payoutStatus === 'Paid';
        return <Badge variant={isSettled ? "success" : "warning"}>{row.original.payoutStatus}</Badge>
    },
  },
  {
    accessorKey: "payoutCount",
    header: "Transactions",
  },
   {
    accessorKey: "totalNetAmount",
    header: "Net Amount",
     cell: ({ row }) => {
        const firstPayoutCurrency = row.original.payouts[0]?.currency || 'USD';
        return formatCurrency(row.original.totalNetAmount, firstPayoutCurrency);
    },
  },
   {
    accessorKey: "transferFees",
    header: "Transfer Fees",
    cell: ({ row }) => {
        const firstPayoutCurrency = row.original.payouts[0]?.currency || 'USD';
        return formatCurrency(row.original.totalTransferFees, firstPayoutCurrency);
    },
  },
   {
    accessorKey: "totalFinalAmount",
    header: "Final Amount",
    cell: ({ row }) => {
        const firstPayoutCurrency = row.original.payouts[0]?.currency || 'USD';
        return formatCurrency(row.original.totalFinalAmount, firstPayoutCurrency);
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: "paidAt",
    header: "Paid At",
    cell: ({ row }) => formatDate(row.original.paidAt),
  },
  {
    id: 'settlementId',
    header: 'Settlement ID / Action',
    cell: ({ row }) => {
        const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
        const batch = row.original;
        const isSettled = batch.payoutStatus === 'Paid';

        if (isSettled) {
            return <span className="font-mono text-xs">{batch.settlementId}</span>
        }

        return (
            <>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setIsUpdateDialogOpen(true); }}>
                    Update
                </Button>
                <UpdateSettlementDialog 
                    open={isUpdateDialogOpen}
                    onOpenChange={setIsUpdateDialogOpen}
                    batchId={batch.batchId}
                    currentTransferFees={batch.totalTransferFees}
                    onSuccess={onUpdateSuccess}
                />
            </>
        )
    },
  }
];
