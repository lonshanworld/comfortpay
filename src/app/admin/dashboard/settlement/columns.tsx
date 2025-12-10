
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PayoutData } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"


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

// const getStatusVariant = (status: string) => {
//   switch (status) {
//     case 'Paid':
//       return 'success';
//     case 'Unpaid':
//       return 'warning';
//     case 'In-Settlement':
//       return 'info';
//     default:
//       return 'outline';
//   }
// };

export const columns: ColumnDef<PayoutData>[] = [
       {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
        
    },
    // {
    //     accessorKey: "payoutId",
    //     header: "Payout ID",
    // },
    {
        accessorKey: "merchantOrderId",
        header: "Merchant Order ID",
    },
    {
        accessorKey: "merchantName",
        header: "Merchant",
    },
    {
        accessorKey: "paymentReceivedDate",
        header: ({ column }) => {
            return (
                <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                Payment Date
                <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => formatDate(row.getValue("paymentReceivedDate")),
    },
    {
        accessorKey: "grossAmount",
        header: "Gross Amount",
        cell: ({ row }) => formatCurrency(row.original.grossAmount, row.original.currency),
    },
    {
        accessorKey: "gatewayFee",
        header: "Gateway Fee",
        cell: ({ row }) => formatCurrency(row.original.gatewayFee, row.original.currency),
    },
    {
        accessorKey: "netAmount",
        header: "Net Amount",
        cell: ({ row }) => formatCurrency(row.original.netAmount, row.original.currency),
    },
    // {
    //     accessorKey: "payoutStatus",
    //     header: "Status",
    //     cell: ({ row }) => {
    //          const status = row.getValue("payoutStatus") as string;
    //         return <Badge variant={getStatusVariant(status)}>{status}</Badge>
    //     }
    // },
]
