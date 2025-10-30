
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, Search, X, File, CheckSquare } from "lucide-react"
import type { ColumnFiltersState, RowSelectionState } from "@tanstack/react-table"

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
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"
import { useToast } from "@/hooks/use-toast"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { MerchantFilter } from "@/components/admin/merchant-filter"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkPayoutDialog } from "@/components/admin/mark-payout-dialog"

 function toLocalISOString(date : any) {
  const pad = n => String(n).padStart(2, '0');
  return (
    date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + 'T' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds()) + '.000Z'
  );
}

export default function SettlementPage() {
  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [stagedFilters, setStagedFilters] = React.useState<ColumnFiltersState>([])

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const fetchSettlements = useCallback(async (filters: ColumnFiltersState) => {
    setIsLoading(true);
    setRowSelection({}); // Clear selection on re-fetch
    try {
      const params = new URLSearchParams();
      params.append('payoutStatus', 'Unpaid');
      filters.forEach(filter => {
        if (filter.value) {
            if ((filter.id === 'paymentReceivedDate') && typeof filter.value === 'object' && filter.value !== null) {
                const range = filter.value as { from?: Date, to?: Date };
                if (range.from) params.append(`paymentReceivedDate_start`, toLocalISOString(range.from));
                if (range.to) params.append(`paymentReceivedDate_end`, toLocalISOString(range.to));
            } else if (typeof filter.value === 'string' || typeof filter.value === 'number') {
                 params.append(String(filter.id), String(filter.value));
            }
        }
      });

      console.log("Fetching payouts with params:", params.toString());
      const response = await fetch(`/api/settlements?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch settlement data");
      }

      const { data, totalCount } = await response.json();
      setPayouts(data);
      setTotalCount(totalCount);
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      toast({ variant: "destructive", title: "Fetch Error", description: error.message || "Could not fetch settlement data."})
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
    
  useEffect(() => {
    fetchSettlements(columnFilters);
  }, [columnFilters, fetchSettlements]);

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
  
  const selectedPayouts = useMemo(() => {
    return Object.keys(rowSelection).map(index => payouts[Number(index)]).filter(Boolean);
  }, [rowSelection, payouts]);

  const handleExport = () => {
    if (selectedPayouts.length === 0) {
      toast({ variant: "destructive", title: "No Selection", description: "Please select rows to export." });
      return;
    }

    const headers = ["Merchant Name", "Bank Name", "Bank Account Number", "Net Amount", "Currency", "Wallet Address", "Network"];
    const csvContent = [
      headers.join(','),
      ...selectedPayouts.map(p => [
        `"${p.merchantName.replace(/"/g, '""')}"`,
        `"${p.bankName || ''}"`,
        `"${p.bankAccountNumber || ''}"`,
        p.netAmount,
        p.currency,
        `"${p.walletAddress || ''}"`,
        `"${p.network || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `payout_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Successful", description: `${selectedPayouts.length} rows exported.` });
  };

  const settlementColumns = useMemo(() => columns, []);

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
        <MarkPayoutDialog
          open={isMarkingPaid}
          onOpenChange={setIsMarkingPaid}
          selectedPayouts={selectedPayouts}
          onSuccess={() => fetchSettlements(columnFilters)}
        />
        <Card className="">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Settlements</CardTitle>
                <CardDescription>
                  Review unpaid transactions to calculate and process merchant payouts.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExport} disabled={selectedPayouts.length === 0}>
                  <File className="h-3.5 w-3.5" />
                  Export Selected
                </Button>
                 <Button size="sm" className="h-8 gap-1" onClick={() => setIsMarkingPaid(true)} disabled={selectedPayouts.length === 0}>
                  <CheckSquare className="h-3.5 w-3.5" />
                  Create Payout Batch
                </Button>
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
                            <Label className="text-xs">Payment Date</Label>
                            <DateRangePicker 
                                 date={stagedFilters.find(f => f.id === 'paymentReceivedDate')?.value}
                                setDate={(value) => setStagedFilterValue('paymentReceivedDate', value)}
                            />
                        </div>
           
                        <div className="grid gap-2">
                           <Label className="text-xs">Merchant Order ID</Label>
                            <Input placeholder="Merchant Order ID" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'merchantOrderId')?.value as string ?? ''} onChange={e => setStagedFilterValue('merchantOrderId', e.target.value)} />
                        </div>
                         <div className="grid gap-2">
                           <Label className="text-xs">Net Amount</Label>
                            <Input placeholder="Amount" className="h-8 text-xs" type="number" value={stagedFilters.find(f => f.id === 'netAmount')?.value as string ?? ''} onChange={e => setStagedFilterValue('netAmount', e.target.value)} />
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
                    columns={settlementColumns} 
                    data={payouts}
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    showPagination={false}
                  />
                )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{payouts.length}</strong> of <strong>{totalCount}</strong> records.
              </div>
            </CardFooter>
          </Card>
    </div>
  )
}
