
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  File,
  Loader2,
  Search,
  X,
  ChevronDown,
   DollarSign,
  CheckCircle,
  TrendingUp,
  Clock,
} from "lucide-react"
import type { ColumnFiltersState, PaginationState } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Order, Merchant, PaymentAccount, OrderStatus } from "@/lib/types"
import { DataTableWithColumnFilters } from "@/components/admin/data-table-with-column-filters"
import { columns } from "./columns"
import { ViewTransactionDialog } from "@/components/admin/view-transaction-dialog"
import { EditOrderDialog } from "@/components/admin/edit-order-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { sendOrderNotification } from "@/app/actions/send-order-notification"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { notifyWooCommerce } from "@/app/actions/notify-woocommerce"
import { confirmOrderPayment } from "@/app/actions/confirm-order-payment"
import { useDebounce } from "use-debounce"
import { DateRange } from "react-day-picker"
import { MerchantFilter } from "@/components/admin/merchant-filter"
import { AccountInfoFilter } from "@/components/admin/account-info-filter"
import { Input } from "@/components/ui/input"
import type { VisibilityState } from "@tanstack/react-table"
import { Label } from "@/components/ui/label"


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

const convertToCSV = (data: any[], keys: string[], headers: string[]): string => {
    if (data.length === 0) return "";
    const csvRows = [
        headers.join(','),
        ...data.map(row =>
            keys.map(key => {
                let value = row[key];
                if (value === null || value === undefined) {
                    value = '';
                } else if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                return JSON.stringify(String(value));
            }).join(',')
        )
    ];
    return csvRows.join('\n');
};


// Helper to convert array of objects to an HTML table string
const convertToHtmlTable = (data: any[], headers: string[], keys: string[]): string => {
    if (data.length === 0) return "<p>No data to export.</p>";
    const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    const bodyRows = data.map(row =>
        `<tr>${keys.map(key => `<td>${row[key] ?? ''}</td>`).join('')}</tr>`
    ).join('');
    return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'/><style>table, th, td { border: 1px solid black; border-collapse: collapse; } th, td { padding: 5px; }</style></head><body><table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
};


const StatusFilter = ({ column }: { column: any }) => {
  const statuses: OrderStatus[] = ["Pending", "Completed", "Failed", "Requires Confirmation", "Refunded", "Partially Paid", "On-Hold", "Over-paid Refunded"];
  return (
    <Select
      value={(column.getFilterValue() ?? '') as string}
      onValueChange={value => column.setFilterValue(value === 'all' ? '' : value)}
    >
      <SelectTrigger className="h-8 text-xs max-w-sm">
        <SelectValue placeholder="Filter..." />
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const { toast } = useToast();
  
  // State for temporary filters in inputs
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [stagedFilters, setStagedFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ id: false });
     const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 200,
  })

   const [debouncedFilters] = useDebounce(columnFilters, 1000);



const fetchTransactions = useCallback(async (filters: ColumnFiltersState, pageState: PaginationState) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
       params.append('page', String(pageState.pageIndex + 1));
      params.append('pageSize', String(pageState.pageSize));
      
     filters.forEach(filter => {
        if (filter.value) {
            if (filter.id === 'orderDate' || filter.id === 'paymentReceivedDate') {
                const dateValue = filter.value as DateRange;

                 if (dateValue.from) params.append(`${filter.id}_start`, toLocalISOString(dateValue.from));
                if (dateValue.to) params.append(`${filter.id}_end`, toLocalISOString(dateValue.to));
            } else if (typeof filter.value === 'string' || typeof filter.value === 'number') {
                 params.append(String(filter.id), String(filter.value))
            }
        }
      })

      console.log("Fetching transactions with params:", params.toString());
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

     const { data, pageCount, totalCount } = await response.json();
      setTransactions(data);
      setPageCount(pageCount);
      setTotalCount(totalCount);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast({ variant: "destructive", title: "Fetch Error", description: "Could not fetch transactions."})
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

    
  // const getActiveFilters = useCallback(() => {
  //   // This function now correctly combines filters, giving stagedFilters precedence
  //   const activeFiltersMap = new Map(stagedFilters.map(f => [f.id, f.value]));
  //   debouncedFilters.forEach(f => {
  //     if (!activeFiltersMap.has(f.id)) {
  //       activeFiltersMap.set(f.id, f.value);
  //     }
  //   });
  //   return Array.from(activeFiltersMap, ([id, value]) => ({ id, value }));
  // }, [debouncedFilters, stagedFilters]);

  useEffect(() => {
    fetchTransactions(debouncedFilters, pagination);
  }, [debouncedFilters, fetchTransactions]);

  
  useEffect(() => {
    const intervalId = setInterval(() => {
        fetchTransactions(columnFilters, pagination);
    }, 3 * 60 * 1000); // 3 minutes

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [columnFilters, fetchTransactions]);

  const handleViewClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };
  
  const handleEditClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleTransactionUpdated = () => {
    fetchTransactions(columnFilters, pagination);
  }

  const handleConfirmPayment = async (transaction: Order, amount: number) => {
   
    setIsConfirming(transaction.id);

     const result = await confirmOrderPayment({ order: transaction, amountReceived: amount });

    if (result.success) {
      fetchTransactions(columnFilters, pagination);
      toast({
        title: "Payment Confirmed",
        description: result.message
      });
     } else {
      toast({
        variant: 'destructive',
        title: "Confirmation Failed",
        description: result.message
      });
    }
    setIsConfirming(null);
  }

   const handleStatusUpdate = async (transaction: Order, newStatus: OrderStatus) => {
    if (transaction.status === newStatus) return;

    setIsUpdatingStatus(transaction.id);
    try {
      const response = await fetch(`/api/orders/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      toast({
        title: "Status Updated",
        description: `Order ${transaction.id} status changed to ${newStatus}.`,
      });

      // Refresh the data in the background to show the update
      fetchTransactions(columnFilters, pagination);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsUpdatingStatus(null);
    }
  };


 const handleSearch = () => {
    // Combine staged filters with existing column filters, giving staged precedence
    const activeColumnFilters = columnFilters.filter(f => !stagedFilters.some(sf => sf.id === f.id));
    const newFilters = [...activeColumnFilters, ...stagedFilters];
    setColumnFilters(newFilters);
  }

  const handleClearFilters = () => {
    setStagedFilters([]);
    setColumnFilters([]);
  }
const handleExport = (format: 'csv' | 'docs' | 'excel') => {
      setIsExporting(true);
      toast({
        title: "Exporting Data",
        description: `Your transaction data is being prepared as a ${format.toUpperCase()} file.`,
      });

      try {
        const table = document.getElementById('transactions-table');
        if (!table) {
          throw new Error("Could not find the data table to export.");
        }

        let content = '';
        const headers: string[] = [];
        table.querySelectorAll('thead th').forEach(th => {
            // Find the button or div that holds the main header text, ignoring filter inputs
            const headerTextElement = th.querySelector('button > div, div:first-child');
            if (headerTextElement) {
                 headers.push(`"${headerTextElement.textContent?.trim() || ''}"`);
            } else {
                 headers.push(`"${th.textContent?.trim() || ''}"`);
            }
        });
        
        const rows: string[] = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
            const rowData: string[] = [];
            tr.querySelectorAll('td').forEach(td => {
                rowData.push(`"${td.innerText || ''}"`);
            });
            rows.push(rowData.join(','));
        });
        
        content = [headers.join(','), ...rows].join('\n');

        if (format === 'csv') {
           downloadFile(content, `transactions-${new Date().toISOString()}.csv`, 'text/csv;charset=utf-8;');
        } else { // DOCS or EXCEL
           const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'/><style>table, th, td { border: 1px solid black; border-collapse: collapse; } th, td { padding: 5px; }</style></head><body>${table.outerHTML}</body></html>`;
           const extension = format === 'docs' ? 'doc' : 'xls';
           const mimeType = format === 'docs' ? 'application/msword' : 'application/vnd.ms-excel';
           downloadFile(htmlContent, `transactions-${new Date().toISOString()}.${extension}`, mimeType);
        }

         toast({
          title: "Export Successful",
          description: `Your file has been downloaded.`,
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


  const transactionColumns = useMemo(() => columns({
    onView: handleViewClick,
    onEdit: handleEditClick,
    onConfirmPayment: handleConfirmPayment,
    onStatusChange: handleStatusUpdate,
    isConfirmingId: isConfirming,
isUpdatingStatusId: isUpdatingStatus,
  }), [isConfirming, isUpdatingStatus]);

  
  const setStagedFilterValue = (id: string, value: any) => {
    setStagedFilters(prev => {
        const newFilters = prev.filter(f => f.id !== id);
        if (value !== undefined && value !== null && value !== '' && !(typeof value === 'object' && !value.from && !value.to)) {
            newFilters.push({ id, value });
        }
        return newFilters;
    });
  };

  
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
        {selectedTransaction && (
            <ViewTransactionDialog
              open={isViewDialogOpen}
              onOpenChange={setIsViewDialogOpen}
              transaction={selectedTransaction}
            />
        )}
        {selectedTransaction && (
            <EditOrderDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                order={selectedTransaction}
                onOrderUpdated={handleTransactionUpdated}
            />
        )}
   
        <Card className="">
            <CardHeader className="w-11/12 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Transactions</CardTitle>
                <CardDescription>
                  A list of all transactions on the platform.
                </CardDescription>
              </div>
               <div className="flex flex-wrap items-center gap-2">
                 <Button size="sm" className="h-8 gap-1" onClick={handleSearch}>
                    <Search className="h-3.5 w-3.5"/>
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
                    <DropdownMenuItem onClick={() => handleExport('csv')}>Export data</DropdownMenuItem>
                    {/* <DropdownMenuItem onClick={() => handleExport('docs')}>Export as DOCS</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('excel')}>Export as Excel</DropdownMenuItem> */}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            </CardHeader>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 px-4 mb-4 w-11/12">
              <div
              className="bg-green-800 rounded-sm px-3 py-1 flex flex-col items-center text-white">
                <p className="text-xs">Completed Amount</p>
                <p className="text-sm font-bold">${summaryStats.completedAmount}</p>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 w-11/12">
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
                           {/* <Label className="text-xs">Status</Label> */}
                            <Select value={stagedFilters.find(f => f.id === 'status')?.value as string ?? ''} onValueChange={value => setStagedFilterValue('status', value === 'all' ? '' : value)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Order Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="On-Hold">On-Hold</SelectItem>
                                    <SelectItem value="Failed">Failed</SelectItem>
                                    <SelectItem value="Requires Confirmation">Requires Confirmation</SelectItem>
                                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                    <SelectItem value="Refunded">Refunded</SelectItem>
                                    <SelectItem value="Over-paid Refunded">Over-paid Refunded</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            {/* <Label className="text-xs">Order ID</Label> */}
                            <Input placeholder="Order ID" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'merchantOrderId')?.value as string ?? ''} onChange={e => setStagedFilterValue('merchantOrderId', e.target.value)} />
                        </div>
                         <div className="grid gap-2">
                            {/* <Label className="text-xs">Order Amount</Label> */}
                            <Input placeholder="Amount" className="h-8 text-xs" type="number" value={stagedFilters.find(f => f.id === 'totalAmount')?.value as string ?? ''} onChange={e => setStagedFilterValue('totalAmount', e.target.value)} />
                        </div>
                         <div className="grid gap-2">
                            {/* <Label className="text-xs">Paid Amount</Label> */}
                            <Input placeholder="Amount" className="h-8 text-xs" type="number" value={stagedFilters.find(f => f.id === 'paidAmount')?.value as string ?? ''} onChange={e => setStagedFilterValue('paidAmount', e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            {/* <Label className="text-xs">Cust. Email</Label> */}
                            <Input placeholder="Email" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'customerEmail')?.value as string ?? ''} onChange={e => setStagedFilterValue('customerEmail', e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            {/* <Label className="text-xs">Cust. First Name</Label> */}
                            <Input placeholder="First Name" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'customerFirstName')?.value as string ?? ''} onChange={e => setStagedFilterValue('customerFirstName', e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                           {/* <Label className="text-xs">Cust. Last Name</Label> */}
                            <Input placeholder="Last Name" className="h-8 text-xs" value={stagedFilters.find(f => f.id === 'customerLastName')?.value as string ?? ''} onChange={e => setStagedFilterValue('customerLastName', e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                             {/* <Label className="text-xs">Merchant</Label> */}
                            <MerchantFilter column={{ setFilterValue: (value: any) => setStagedFilterValue('merchantId', value), getFilterValue: () => stagedFilters.find(f => f.id === 'merchantId')?.value }} />
                        </div>
                        <div className="grid gap-2">
                            {/* <Label className="text-xs">Payment Account</Label> */}
                            <AccountInfoFilter column={{ setFilterValue: (value: any) => setStagedFilterValue('paymentAccountId', value), getFilterValue: () => stagedFilters.find(f => f.id === 'paymentAccountId')?.value }} />
                        </div>
                    </div>
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataTableWithColumnFilters 
                  columns={transactionColumns} 
                  data={transactions} 
                  columnFilters={columnFilters}
                  setColumnFilters={setColumnFilters}
                    columnVisibility={columnVisibility}
                  setColumnVisibility={setColumnVisibility}
                  pagination={pagination}
                  setPagination={setPagination}
                  pageCount={pageCount}
                  customFilterComponents={{ 
                     merchantId: MerchantFilter,
                     paymentAccountId: AccountInfoFilter,
                    status: StatusFilter,
                    orderDate: DateRangeColumnFilter,
                    paymentReceivedDate: DateRangeColumnFilter,
                   }}
                />
              )}
              </div>
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

    