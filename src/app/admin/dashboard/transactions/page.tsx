
"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  File,
  Loader2,
  Search,
  X,
  ChevronDown,
} from "lucide-react"
import type { ColumnFiltersState } from "@tanstack/react-table"

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

// Helper to convert array of objects to CSV
const convertToCSV = (data: Order[]): string => {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(fieldName =>
                JSON.stringify(row[fieldName as keyof Order], (key, value) =>
                    value === null || value === undefined ? '' : value
                )
            ).join(',')
        )
    ];
    return csvRows.join('\n');
};

// Helper to convert array of objects to an HTML table string
const convertToHtmlTable = (data: Order[]): string => {
    if (data.length === 0) return "<p>No data to export.</p>";
    const headers = Object.keys(data[0]);
    const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    const bodyRows = data.map(row =>
        `<tr>${headers.map(fieldName => `<td>${row[fieldName as keyof Order] ?? ''}</td>`).join('')}</tr>`
    ).join('');
    return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'/><style>table, th, td { border: 1px solid black; border-collapse: collapse; } th, td { padding: 5px; }</style></head><body><table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
};

const StatusFilter = ({ column }: { column: any }) => {
  const statuses: OrderStatus[] = ["Pending", "Completed", "Failed", "Requires Confirmation", "Refunded", "Reconciled", "Partially Paid"];
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


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const { toast } = useToast();
  
  // State for temporary filters in inputs
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  // State for applied filters which triggers the fetch
  const [appliedFilters, setAppliedFilters] = React.useState<ColumnFiltersState>([])

  const fetchTransactions = useCallback(async (filters: ColumnFiltersState, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
        setIsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      // Add column filters to params
      filters.forEach(filter => {
         if (filter.value) {
            params.append(String(filter.id), String(filter.value));
          }
      })

      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast({ variant: "destructive", title: "Fetch Error", description: "Could not fetch transactions."})
    } finally {
       if (!isBackgroundRefresh) {
            setIsLoading(false);
        }
    }
  }, [toast]);

  useEffect(() => {
    fetchTransactions(appliedFilters);
    const intervalId = setInterval(() => {
        fetchTransactions(appliedFilters, true);
    }, 3 * 60 * 1000); // 3 minutes

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [appliedFilters, fetchTransactions]);
  
  const handleViewClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };
  
  const handleEditClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleTransactionUpdated = () => {
    fetchTransactions(appliedFilters);
  }

  const handleConfirmPayment = async (transaction: Order, amount: number) => {
    console.log("--- Starting Manual Payment Confirmation ---");
    console.log(`Transaction to confirm: ${transaction.id}, Amount: ${amount}`);
    setIsConfirming(transaction.id);

    try {
      // Determine the new status and the total paid amount
      const newPaidAmount = (Number(transaction.paidAmount) || 0) + amount;
      const isFullyPaid = newPaidAmount >= transaction.totalAmount;
      const newStatus: OrderStatus = isFullyPaid ? 'Completed' : 'Partially Paid';

      console.log(`Step 1: Updating order. New Status: ${newStatus}, New Paid Amount: ${newPaidAmount}`);

      const response = await fetch(`/api/orders/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus, 
          paidAmount: newPaidAmount,
          paymentReceivedDate: new Date().toISOString() // Update payment date on each confirmation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error on Step 1:", errorData);
        throw new Error('Failed to update order status');
      }
        
      const updatedTransaction = await response.json();
      console.log("Step 1 successful. API returned updated transaction:", updatedTransaction);

      // Only update payment account volume if the payment makes the order completed
      if (isFullyPaid && updatedTransaction.paymentAccountId && typeof updatedTransaction.totalAmount !== 'undefined') {
        console.log(`Step 2: Updating volume for Payment Account ID: ${updatedTransaction.paymentAccountId}`);
        const numericAccountId = String(updatedTransaction.paymentAccountId).replace('pa_','');
        const payload = { amount: Number(updatedTransaction.totalAmount) };
        console.log("Payload for volume update:", payload);

        const volumeResponse = await fetch(`/api/payments/accounts/${numericAccountId}/update-volume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
            
        if (!volumeResponse.ok) {
          const errorData = await volumeResponse.json();
          console.error("Error on Step 2:", errorData);
          // Don't throw error here, let the main flow complete
          toast({ variant: "destructive", title: "Volume Update Failed", description: errorData.message || 'Failed to update payment account volume.'});
        } else {
          console.log("Step 2 successful: Volume updated.");
        }
      } else {
        console.warn("Skipping volume update: Order is not fully paid or is missing data.");
      }
        
      toast({
        title: "Payment Confirmed",
        description: `Transaction ${transaction.id} has been marked as ${newStatus}.`
      });

      console.log("Step 3: Refreshing transaction list.");
      await fetchTransactions(appliedFilters);
      console.log("--- Manual Payment Confirmation Finished Successfully ---");

    } catch (error: any) {
        console.error("--- Manual Payment Confirmation FAILED ---");
        console.error("Full error object:", error);
        toast({
            variant: 'destructive',
            title: "Confirmation Failed",
            description: error.message || `There was a problem confirming payment for transaction ${transaction.id}.`
        });
    } finally {
        setIsConfirming(null);
    }
  }


  const handleSearch = () => {
    setAppliedFilters(columnFilters);
  }

  const handleClearFilters = () => {
    setColumnFilters([]);
    setAppliedFilters([]);
  }

  const handleExport = (format: 'csv' | 'docs' | 'excel') => {
    setIsExporting(true);
    toast({
      title: "Exporting Data",
      description: `Your transaction data is being prepared as a ${format.toUpperCase()} file.`,
    });

    setTimeout(() => {
      try {
        if (format === 'csv') {
          const csvData = convertToCSV(transactions);
          downloadFile(csvData, `transactions-${new Date().toISOString()}.csv`, 'text/csv;charset=utf-8;');
        } else if (format === 'docs') {
          const htmlData = convertToHtmlTable(transactions);
          downloadFile(htmlData, `transactions-${new Date().toISOString()}.doc`, 'application/msword');
        } else if (format === 'excel') {
           const htmlData = convertToHtmlTable(transactions);
           downloadFile(htmlData, `transactions-${new Date().toISOString()}.xls`, 'application/vnd.ms-excel');
        }
         toast({
          title: "Export Successful",
          description: "Your file has been downloaded.",
        });
      } catch (error) {
         toast({
            variant: "destructive",
            title: "Export Failed",
            description: "There was an issue exporting your data.",
        });
      } finally {
        setIsExporting(false);
      }
    }, 1000); // Simulate processing time
  };

  const transactionColumns = useMemo(() => columns({
    onView: handleViewClick,
    onEdit: handleEditClick,
    onConfirmPayment: handleConfirmPayment,
    isConfirmingId: isConfirming,
  }), [isConfirming]);


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
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                    <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('docs')}>Export as DOCS</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('excel')}>Export as Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            </CardHeader>
            <CardContent>
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
                  customFilterComponents={{ status: StatusFilter }}
                />
              )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{transactions.length}</strong> transactions
              </div>
            </CardFooter>
          </Card>
    </div>
  )
}

    