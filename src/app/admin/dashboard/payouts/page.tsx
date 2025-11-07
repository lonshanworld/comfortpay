
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, Search, X, File } from "lucide-react"
import type { ColumnDef, ColumnFiltersState, ExpandedState } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PayoutData } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { MerchantFilter } from "@/components/admin/merchant-filter"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataTable } from "@/components/admin/data-table"
import { columns as payoutColumnsDefinition } from "./columns"

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}

function toLocalISOString(date: any) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + 'T' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds()) + '.000Z'
  );
}

const ExpandedComponent = ({ data }: { data: PayoutBatch }) => {
  return (
     <div className="p-4 bg-muted/50">
        <h4 className="font-semibold text-sm mb-2">Payouts in this batch:</h4>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Net</TableHead>
                 
                </TableRow>
            </TableHeader>
            <TableBody>
              {data.payouts.map(p => (
                <TableRow key={p.payoutId}>
                  <TableCell>{p.merchantOrderId}</TableCell>
                  <TableCell>{p.merchantName}</TableCell>
                  <TableCell>{formatCurrency(p.grossAmount, p.currency)}</TableCell>
                  <TableCell>{formatCurrency(p.gatewayFee, p.currency)}</TableCell>
                  <TableCell>{formatCurrency(p.netAmount, p.currency)}</TableCell>
            
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
    </div>
  )
}

export type PayoutBatch = {
  batchId: string;
  payoutStatus: string;
  payoutCount: number;
  totalNetAmount: number;
  createdAt: string;
  paidAt?: string;
   totalTransferFees: number;
  totalFinalAmount: number;
  settlementId?: string;
  payouts: PayoutData[];
}

export default function PayoutsPage() {
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);
  
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [stagedFilters, setStagedFilters] = React.useState<ColumnFiltersState>([])


  const fetchPayouts = useCallback(async (filters: ColumnFiltersState) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      filters.forEach(filter => {
        if (filter.value) {
             if ((filter.id === 'createdAt' || filter.id === 'paidAt') && typeof filter.value === 'object' && filter.value !== null) {
                const range = filter.value as { from?: Date, to?: Date };
                if (range.from) params.append(`${filter.id}_start`, toLocalISOString(range.from));
                if (range.to) params.append(`${filter.id}_end`, toLocalISOString(range.to));
            } else if (typeof filter.value === 'string' || typeof filter.value === 'number') {
                 params.append(String(filter.id), String(filter.value));
            }
        }
      });


      const response = await fetch(`/api/payouts?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch payout data");
      }

      const { data } = await response.json();
      setBatches(data);
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      toast({ variant: "destructive", title: "Fetch Error", description: error.message || "Could not fetch payout data."})
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
    
  useEffect(() => {
    fetchPayouts(columnFilters);
  }, [columnFilters, fetchPayouts]);

  const setStagedFilterValue = (id: string, value: any) => {
    setStagedFilters(prev => {
        const newFilters = prev.filter(f => f.id !== id);
        if (value !== undefined && value !== null && value !== '' && !(typeof value === 'object' && !value.from && !value.to)) {
            newFilters.push({ id, value });
        }
        return newFilters;
    });
  };

  const handleSearch = () => {
    setColumnFilters(stagedFilters);
  };

  const handleClearFilters = () => {
    setStagedFilters([]);
    setColumnFilters([]);
  };

   const handleExport = () => {
    setIsExporting(true);
    toast({
        title: "Exporting Payouts",
        description: "Your data is being prepared and will be downloaded shortly.",
    });

    try {
        const headers = [
            "Batch ID", "Payout Status", "Settlement ID", "Batch Creation Date (GMT)", "Batch Paid Date (GMT)",
            "Merchant Order ID", "ComfortPay Order ID", "Merchant Name", "Gross Amount", "Gateway Fee", "Net Amount", "Currency"
        ];
        
        const csvRows = [headers.join(',')];

        batches.forEach(batch => {
            batch.payouts.forEach(payout => {
                const row = [
                    `"${batch.batchId}"`,
                    `"${batch.payoutStatus}"`,
                    `"${batch.settlementId || 'N/A'}"`,
                    `"${batch.createdAt ? new Date(batch.createdAt).toUTCString() : 'N/A'}"`,
                    `"${batch.paidAt ? new Date(batch.paidAt).toUTCString() : 'N/A'}"`,
                    `"${payout.merchantOrderId}"`,
                    `"${payout.orderId}"`,
                    `"${payout.merchantName.replace(/"/g, '""')}"`, // Escape double quotes
                    payout.grossAmount,
                    payout.gatewayFee,
                    payout.netAmount,
                    `"${payout.currency}"`
                ];
                csvRows.push(row.join(','));
            });
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `payout-batches-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Export failed:", error);
        toast({ variant: "destructive", title: "Export Failed", description: "An unexpected error occurred during export." });
    } finally {
        setIsExporting(false);
    }
};

  const columns = useMemo(() => payoutColumnsDefinition({
    onUpdateSuccess: () => fetchPayouts(columnFilters),
  }), [fetchPayouts, columnFilters]);

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Payout Batches</CardTitle>
                <CardDescription>
                  Review and finalize payout batches. Batches marked "In-Settlement" require a final reference ID.
                </CardDescription>
                 <div className="ml-auto flex items-center gap-2">
                 <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExport} disabled={isExporting || isLoading}>
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <File className="h-3.5 w-3.5" />}
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Export
                    </span>
                    </Button>
               </div>
              </div>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-col gap-4 mb-4 p-4 border rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                       <div className="grid gap-2">
                           <Label className="text-xs">Merchant</Label>
                           <MerchantFilter column={{ setFilterValue: (value: any) => setStagedFilterValue('merchantId', value), getFilterValue: () => stagedFilters.find(f => f.id === 'merchantId')?.value }} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Creation Date</Label>
                            <DateRangePicker 
                                 date={stagedFilters.find(f => f.id === 'createdAt')?.value}
                                setDate={(value) => setStagedFilterValue('createdAt', value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Paid Date</Label>
                            <DateRangePicker 
                                 date={stagedFilters.find(f => f.id === 'paidAt')?.value}
                                setDate={(value) => setStagedFilterValue('paidAt', value)}
                            />
                        </div>
                         <div className="grid gap-2">
                           <Label className="text-xs">Status</Label>
                            <Select value={stagedFilters.find(f => f.id === 'payoutStatus')?.value as string ?? ''} onValueChange={(value) => setStagedFilterValue('payoutStatus', value === 'all' ? null : value)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="In-Settlement">In-Settlement</SelectItem>
                                    <SelectItem value="Paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid gap-2">
                           <Label className="text-xs">Batch ID</Label>
                           <Input placeholder="Batch ID" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'batchId')?.value as string ?? ''} onChange={e => setStagedFilterValue('batchId', e.target.value)} />
                        </div>
                         <div className="grid gap-2">
                           <Label className="text-xs">Settlement ID</Label>
                           <Input placeholder="Settlement ID" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'settlementId')?.value as string ?? ''} onChange={e => setStagedFilterValue('settlementId', e.target.value)} />
                        </div>
                    </div>
                    <div className="flex justify-end items-center gap-2 mt-2">
                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={handleClearFilters}>
                            <X className="h-3.5 w-3.5"/>
                                <span className="sr-only sm:not-sr-only">Clear</span>
                        </Button>
                        <Button size="sm" className="h-8 gap-1" onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                            <span className="sr-only sm:not-sr-only">Search</span>
                        </Button>
                    </div>
                </div>
              
                {isLoading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={batches}
                        showPagination={false}
                        getRowCanExpand={() => true}
                        renderSubComponent={({ row }) => <ExpandedComponent data={row.original} />}
                    />
                )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{batches.length}</strong> payout batches.
              </div>
            </CardFooter>
          </Card>
    </div>
  )
}
