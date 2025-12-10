
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, Search, X } from "lucide-react"
import type { ColumnFiltersState } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DailyVolumeHistory } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { DataTable } from "@/components/admin/data-table"
import { columns as historyColumnsDefinition, subComponent as ExpandedComponent } from "./columns"
import { DateRange } from "react-day-picker"
import { AccountInfoFilterPaymentHistory } from "@/components/admin/account-info-filter-payment-history"

export default function PaymentHistoryPage() {
  const [history, setHistory] = useState<DailyVolumeHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [stagedFilters, setStagedFilters] = React.useState<ColumnFiltersState>([])

  const fetchHistory = useCallback(async (filters: ColumnFiltersState) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      filters.forEach(filter => {
        if (filter.value) {
            if (filter.id === 'date' && typeof filter.value === 'object' && filter.value !== null) {
                const range = filter.value as DateRange;
                if (range.from) params.append('date_start', range.from.toISOString());
                if (range.to) params.append('date_end', range.to.toISOString());
            } else if (typeof filter.value === 'string' || typeof filter.value === 'number') {
                 params.append(String(filter.id), String(filter.value));
            }
        }
      });

      const response = await fetch(`/api/payments/history?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch payment history");
      }

      const { data } = await response.json();
      setHistory(data);

    } catch (error: any) {
      console.error("Failed to fetch data", error);
      toast({ variant: "destructive", title: "Fetch Error", description: error.message || "Could not fetch payment history."})
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
    
  useEffect(() => {
    fetchHistory(columnFilters);
  }, [columnFilters, fetchHistory]);

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

  const columns = useMemo(() => historyColumnsDefinition(), []);

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Payment Account History</CardTitle>
                <CardDescription>
                  Review historical daily transaction volumes. Each row represents a specific account on a specific day.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-col gap-4 mb-4 p-4 border rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <AccountInfoFilterPaymentHistory 
                          value={stagedFilters.find(f => f.id === 'accountId')?.value}
                          onChange={(value: any) => setStagedFilterValue('accountId', value)} 
                        />
                        <DateRangePicker 
                            date={stagedFilters.find(f => f.id === 'date')?.value}
                            setDate={(value: DateRange | undefined) => setStagedFilterValue('date', value)}
                        />
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
                        data={history}
                        showPagination={true}
                        getRowCanExpand={() => true}
                        renderSubComponent={ExpandedComponent}
                   
                    />
                )}
            </CardContent>
          </Card>
    </div>
  )
}
