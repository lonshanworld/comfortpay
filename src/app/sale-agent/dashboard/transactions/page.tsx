
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  File,
  Loader2,
  Search,
  X,
  ChevronDown,
} from "lucide-react"
import type { ColumnFiltersState, PaginationState } from "@tanstack/react-table"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Order, OrderStatus } from "@/lib/types"
import { DataTableWithColumnFilters } from "@/components/admin/data-table-with-column-filters"
import { columns } from "./columns"

import { useToast } from "@/hooks/use-toast"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { MerchantFilter } from "@/components/admin/merchant-filter"
import { useDebounce, useDebouncedCallback } from "use-debounce"


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

const DateRangeColumnFilter = ({ column }: { column: { id: string; setFilterValue: (value: any) => void; getFilterValue: () => any } }) => {
    const value = column.getFilterValue() as DateRange | undefined;
    
    return (
        <DateRangePicker
            date={value}
            setDate={(date) => {
                column.setFilterValue(date);
            }}
            className="h-8"
        />
    )
}

const StatusFilter = ({ column }: { column: any }) => {
  const statuses: OrderStatus[] = ["Pending", "On-Hold", "Completed", "Requires Confirmation", "Partially Paid", "Failed", "Refunded"];
  return (
    <Select
      value={(column.getFilterValue() ?? '') as string}
      onValueChange={value => column.setFilterValue(value === 'all' ? '' : value)}
    >
      <SelectTrigger className="h-8 text-xs max-w-sm">
        <SelectValue placeholder="Filter by status..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Statuses</SelectItem>
        {statuses.map(status => (
          <SelectItem key={status} value={status}>{status}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};




export default function SaleAgentTransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saleAgentId, setSaleAgentId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [stagedFilters, setStagedFilters] = React.useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 200,
  })

  

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    let id;
    if (userRole === 'Admin') {
      id = localStorage.getItem('impersonatingUserId');
    } else {
      id = localStorage.getItem('userId');
    }
    setSaleAgentId(id);
  }, []);

  const debouncedFetchTransactions = useDebouncedCallback(async (filters: ColumnFiltersState, pageState: PaginationState) => {
    if (!saleAgentId) return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({ saleAgentId });
      params.append('page', String(pageState.pageIndex + 1));
      params.append('pageSize', String(pageState.pageSize));
      
      filters.forEach(filter => {
         if (filter.value) {
            if ((filter.id === 'orderDate' || filter.id === 'paymentReceivedDate') && typeof filter.value === 'object' && filter.value !== null) {
                const range = filter.value as DateRange;
                if (range.from) params.append(`${filter.id}_start`, toLocalISOString(range.from));
                if (range.to) params.append(`${filter.id}_end`, toLocalISOString(range.to));
            } else if (typeof filter.value === 'string' || typeof filter.value === 'number') {
                params.append(String(filter.id), String(filter.value));
            }
        }
      })

      const response = await fetch(`/api/sale-agent/dashboard/transactions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const { data, pageCount, totalCount } = await response.json();
      
      setTransactions(data);
      setPageCount(pageCount);
      setTotalCount(totalCount);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch transactions." });
    } finally {
       setIsLoading(false);
    }
  },5000);
  
 useEffect(() => {
    if (saleAgentId) {
      debouncedFetchTransactions(columnFilters, pagination);
    }
  }, [saleAgentId, columnFilters, pagination, debouncedFetchTransactions]);



  
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
    debouncedFetchTransactions.flush(); // Call the debounced function immediately
  };

  const handleClearFilters = () => {
    setStagedFilters(prev => prev.map(f => 
        (f.id === 'orderDate' || f.id === 'paymentReceivedDate') 
            ? { id: f.id, value: undefined } 
            : { id: f.id, value: '' }
    ));
    setColumnFilters([]);
    debouncedFetchTransactions.flush(); // Call the debounced function immediately
  };


  const transactionColumns = useMemo(() => columns, []);

  const summaryStats = React.useMemo(() => {
      const completedOrders = transactions.filter(
        (t) => t.status === 'Completed' || t.status === 'Over-paid Refunded'
      );
      const onHoldOrders = transactions.filter((t) => t.status === 'On-Hold');
      const cancelledOrders = transactions.filter((t) => t.status === 'Refunded' || t.status === 'Failed');
  
      const completedAmount = completedOrders.reduce(
        (acc, order) => acc + Number(order.totalAmount),
        0
      );
  
      const completionPercentage =
        transactions.length > 0
          ? (completedOrders.length / transactions.length) * 100
          : 0;
  
      return {
        completedAmount,
        completedCount: completedOrders.length,
        completionPercentage,
        onHoldCount: onHoldOrders.length,
        cancelledCount: cancelledOrders.length,
      };
    }, [transactions]);

     

    return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle>My Merchants' Transactions</CardTitle>
            <CardDescription>
              Search and filter through all transactions for the merchants you manage.
            </CardDescription>
          </div>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 px-4 mb-4 w-11/12">
              <div
              className="bg-green-800 rounded-sm px-3 py-1 flex flex-col items-center text-white">
                <p className="text-xs">Completed Amount</p>
                <p className="text-sm font-bold">${parseFloat(summaryStats.completedAmount.toString()).toFixed(2)}</p>
              </div>
              <div
              className="bg-green-300 rounded-sm px-3 py-1 flex flex-col items-center text-white">
                <p className="text-xs">Completed Count</p>
                <p className="text-sm font-bold">{summaryStats.completedCount}</p>
              </div>
              <div
              className="bg-gray-500 rounded-sm px-3 py-1 flex flex-col items-center text-white">
                <p className="text-xs">Completion Rate</p>
                <p className="text-sm font-bold">{parseFloat(summaryStats.completionPercentage.toString()).toFixed(2)}%</p>
              </div>
              <div
              className="bg-yellow-400 rounded-sm px-3 py-1 flex flex-col items-center text-white">
                <p className="text-xs">On-Hold</p>
                <p className="text-sm font-bold">{summaryStats.onHoldCount}</p>
              </div>
              <div
              className="bg-red-500 rounded-sm px-3 py-1 flex flex-col items-center text-white">
                <p className="text-xs">Refunded/Failed</p>
                <p className="text-sm font-bold">{summaryStats.cancelledCount}</p>
              </div>
            </div>
        <CardContent>
            <div className="flex flex-col gap-4 mb-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="merchantId" className="text-xs">Merchant</Label>
                        <MerchantFilter 
                            salesAgentId={saleAgentId}
                            column={{ 
                                getFilterValue: () => stagedFilters.find(f => f.id === 'merchantId')?.value, 
                                setFilterValue: (value: any) => setStagedFilterValue('merchantId', value) 
                            }} 
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="orderDate" className="text-xs">Order Date</Label>
                        <DateRangePicker 
                            id="orderDate"
                            date={stagedFilters.find(f => f.id === 'orderDate')?.value}
                            setDate={(value) => setStagedFilterValue('orderDate', value)}
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="paymentReceivedDate" className="text-xs">Payment Date</Label>
                        <DateRangePicker 
                            id="paymentReceivedDate"
                            date={stagedFilters.find(f => f.id === 'paymentReceivedDate')?.value}
                            setDate={(value) => setStagedFilterValue('paymentReceivedDate', value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status" className="text-xs">Status</Label>
                        <Select value={stagedFilters.find(f => f.id === 'status')?.value as string ?? ''} onValueChange={(value) => setStagedFilterValue('status', value === 'all' ? null : value)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="On-Hold">On-Hold</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="Requires Confirmation">Requires Confirmation</SelectItem>
                                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                <SelectItem value="Failed">Failed</SelectItem>
                                <SelectItem value="Refunded">Refunded</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="merchantOrderId" className="text-xs">Order ID</Label>
                        <Input placeholder="Order ID" id="merchantOrderId" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'merchantOrderId')?.value as string ?? ''} onChange={e => setStagedFilterValue('merchantOrderId', e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="totalAmount" className="text-xs">Order Amount</Label>
                        <Input placeholder="Amount" id="totalAmount" className="h-8 text-xs" type="number" value={stagedFilters.find(f => f.id === 'totalAmount')?.value as string ?? ''} onChange={e => setStagedFilterValue('totalAmount', e.target.value)} />
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
                <DataTableWithColumnFilters
                    tableId="sale-agent-transactions"
                    columns={transactionColumns}
                    data={transactions}
                    pageCount={pageCount}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    pagination={pagination}
                    setPagination={setPagination}
                    customFilterComponents={{ 
                        orderDate: DateRangeColumnFilter,
                        paymentReceivedDate: DateRangeColumnFilter,
                        status: StatusFilter,
                        merchantId: (props: any) => <MerchantFilter {...props} salesAgentId={saleAgentId} />,
                    }}
                />
            )}
        </CardContent>
         <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{transactions.length}</strong> of <strong>{totalCount}</strong> transactions.
              </div>
            </CardFooter>
      </Card>
    </div>
  )
}
