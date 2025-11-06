
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
import type { Order } from "@/lib/types"
import { DataTableWithColumnFilters } from "@/components/admin/data-table-with-column-filters"
import { columns as merchantTransactionColumns } from "./columns"
import { ViewTransactionDialog } from "@/components/admin/view-transaction-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


// Helper to download files on the client side
const downloadFile = (content: string, fileName: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const convertArrayOfObjectsToCSV = (data: any[], columnOrder: (keyof Order)[], headers: { [key: string]: string }): string => {
  if (data.length === 0) return "";
  const headerRow = columnOrder.map(key => `"${headers[key]}"`).join(',');
  const csvRows = [
      headerRow,
      ...data.map(row => {
          return columnOrder.map(key => {
              let value = row[key];
              if (key === 'status' && row[key] === 'Over-paid Refunded') {
                value = 'Completed';
              }
              if (value === null || value === undefined) {
                  value = '';
              } else if (typeof value === 'object') {
                  value = JSON.stringify(value);
              }
              return JSON.stringify(String(value));
          }).join(',');
      })
  ];
  return csvRows.join('\n');
};

const toLocalISOString = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000Z`;
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

export default function MerchantTransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [stagedFilters, setStagedFilters] = React.useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 75,
  })

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    let id;
    if (userRole === 'Admin') {
      id = localStorage.getItem('impersonatingUserId');
    } else {
      id = localStorage.getItem('userId');
    }
    setMerchantId(id);
  }, []);

  const fetchTransactions = useCallback(async (filters: ColumnFiltersState, pageState: PaginationState) => {
    if (!merchantId) return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({ merchantId });
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

      const response = await fetch(`/api/merchant/dashboard/transactions?${params.toString()}`);
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
  }, [merchantId, toast]);
  
  useEffect(() => {
    if (merchantId) {
      fetchTransactions(columnFilters, pagination);
    }
  }, [merchantId, columnFilters, pagination, fetchTransactions]);
  
  const handleViewClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  }

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

  const handleExport = (format: 'csv') => {
    setIsExporting(true);
    toast({
      title: "Exporting Data",
      description: `Your transaction data is being prepared as a CSV file.`,
    });

    try {
        const columnOrder: (keyof Order)[] = ['merchantOrderId', 'orderDate', 'paymentReceivedDate', 'customerFirstName', 'customerLastName', 'customerEmail', 'customerPhone', 'status', 'totalAmount', 'currency'];
        const headers: { [key: string]: string } = {
            merchantOrderId: "Order Number",
            orderDate: "Order Date",
            paymentReceivedDate: "Payment Date",
            customerFirstName: "Customer First Name",
            customerLastName: "Customer Last Name",
            customerEmail: "Customer Email",
            customerPhone: "Customer Phone",
            status: "Status",
            totalAmount: "Total Amount",
            currency: "Currency",
        };

        const csvData = convertArrayOfObjectsToCSV(transactions, columnOrder, headers);
        downloadFile(csvData, `transactions-${new Date().toISOString()}.csv`, 'text/csv;charset=utf-8;');
        
        toast({
            title: "Export Successful",
            description: "Your file has been downloaded.",
        });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: error.message || "There was an issue exporting your data.",
        });
    } finally {
        setIsExporting(false);
    }
  };

  const columns = useMemo(() => merchantTransactionColumns({
    onView: handleViewClick,
    
  }), []);

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
      {selectedTransaction && (
        <ViewTransactionDialog
          open={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          transaction={selectedTransaction}
        />
      )}

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle>Completed Transactions</CardTitle>
            <CardDescription>
              Search and filter through all of your completed transactions.
            </CardDescription>
          </div>
            <div className="flex flex-wrap items-center gap-2">
                 <Button size="sm" className="h-8 gap-1" onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    <span className="sr-only sm:not-sr-only">Search</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={handleClearFilters}>
                    <X className="h-3.5 w-3.5"/>
                    <span className="sr-only sm:not-sr-only">Clear</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 gap-1" disabled={isExporting}>
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <File className="h-3.5 w-3.5" />}
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        {isExporting ? "Exporting..." : "Export"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col gap-4 mb-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                        <Label htmlFor="merchantOrderId" className="text-xs">Order ID</Label>
                        <Input placeholder="Order ID" id="merchantOrderId" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'merchantOrderId')?.value as string ?? ''} onChange={e => setStagedFilterValue('merchantOrderId', e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="customerEmail" className="text-xs">Customer Email</Label>
                        <Input placeholder="Email" id="customerEmail" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'customerEmail')?.value as string ?? ''} onChange={e => setStagedFilterValue('customerEmail', e.target.value)} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="customerFirstName" className="text-xs">Customer First Name</Label>
                        <Input placeholder="First Name" id="customerFirstName" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'customerFirstName')?.value as string ?? ''} onChange={e => setStagedFilterValue('customerFirstName', e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="customerLastName" className="text-xs">Customer Last Name</Label>
                        <Input placeholder="Last Name" id="customerLastName" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'customerLastName')?.value as string ?? ''} onChange={e => setStagedFilterValue('customerLastName', e.target.value)} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="totalAmount" className="text-xs">Total Amount</Label>
                        <Input placeholder="Amount" id="totalAmount" className="h-8 text-xs" type="number" value={stagedFilters.find(f => f.id === 'totalAmount')?.value as string ?? ''} onChange={e => setStagedFilterValue('totalAmount', e.target.value)} />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <DataTableWithColumnFilters
                    tableId="merchant-transactions"
                    columns={columns}
                    data={transactions}
                    pageCount={pageCount}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    pagination={pagination}
                    setPagination={setPagination}
                    customFilterComponents={{ 
                        orderDate: DateRangeColumnFilter,
                        paymentReceivedDate: DateRangeColumnFilter,
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

    