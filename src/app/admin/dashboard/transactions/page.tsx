
"use client"
import { useState, useEffect, useCallback } from "react"
import {
  File,
  Loader2,
  Filter,
  Search,
  X,
  ChevronDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Order, Merchant, PaymentAccount } from "@/lib/types"
import { DataTable } from "@/components/admin/data-tabel"
import { columns } from "./columns"
import { ViewTransactionDialog } from "@/components/admin/view-transaction-dialog"
import { EditOrderDialog } from "@/components/admin/edit-order-dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DateTimePicker } from "@/components/ui/datetime-picker"
import { sendOrderNotification } from "@/app/actions/send-order-notification"

const defaultFilters = {
    currency: undefined,
    startDate: undefined,
    endDate: undefined,
    minAmount: "",
    maxAmount: "",
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


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const { toast } = useToast();

  // Filter states
  const [currencyFilter, setCurrencyFilter] = useState<string | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [amountRange, setAmountRange] = useState<{ min?: string; max?: string }>({});
  
  // State for applied filters which triggers the fetch
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  const fetchTransactions = useCallback(async (filters: typeof appliedFilters) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.currency) params.append('currency', filters.currency);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.minAmount) params.append('minAmount', filters.minAmount);
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount);

      const [ordersRes, merchantsRes, accountsRes] = await Promise.all([
        fetch(`/api/orders?${params.toString()}`),
        fetch('/api/merchants'),
        fetch('/api/payments/accounts')
      ]);
      const ordersData = await ordersRes.json();
      const merchantsData = await merchantsRes.json();
      const accountsData = await accountsRes.json();
      
      const transactionsWithDetails = ordersData.map((transaction: Order) => {
          const merchant = merchantsData.find((m: Merchant) => m.id === transaction.merchantId);
          const account = accountsData.find((acc: PaymentAccount) => acc.id === `pa_${transaction.paymentAccountId}`);
          return {
              ...transaction,
              merchantName: merchant?.name || 'N/A',
              merchantWebsiteUrl: merchant?.websiteUrl,
              sourceWebsiteUrl: account?.websiteUrl,
          }
      });
      
      setTransactions(transactionsWithDetails);
      setMerchants(merchantsData);
      setPaymentAccounts(accountsData);

    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions(appliedFilters);
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

  const handleConfirmPayment = async (transaction: Order) => {
    console.log("DEBUG: [1] handleConfirmPayment called with transaction:", transaction);
    setIsConfirming(transaction.id);
    try {
        const response = await fetch(`/api/orders/${transaction.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'Completed', 
                paidAmount: transaction.totalAmount,
                paymentReceivedDate: new Date().toISOString()
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to confirm payment');
        }
        
        const updatedTransaction = await response.json();
        console.log("DEBUG: [2] Order status updated in DB:", updatedTransaction);

        // Update payment account volume
        if (updatedTransaction.paymentAccountId) {
            console.log("DEBUG: [3] Payment Account ID found:", updatedTransaction.paymentAccountId);
            const paymentAccount = paymentAccounts.find(pa => pa.id === `pa_${updatedTransaction.paymentAccountId}`);
            console.log("DEBUG: [4] Searching for account in this list:", paymentAccounts);
            console.log("DEBUG: [5] Found payment account:", paymentAccount);
            
            if (paymentAccount) {
                 const payload = { amount: Number(updatedTransaction.totalAmount) };
                 console.log("DEBUG: [6] Sending this payload to update-volume:", payload);
                 const volumeResponse = await fetch(`/api/payments/accounts/${paymentAccount.id}/update-volume`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                 if (!volumeResponse.ok) {
                    console.error("DEBUG: [7] Failed to update volume, server responded with:", await volumeResponse.text());
                    throw new Error('Failed to update payment account volume.');
                 }
                 console.log("DEBUG: [7] Successfully updated volume.");
            } else {
                 console.warn(`DEBUG: [6] Could not find payment account with ID pa_${updatedTransaction.paymentAccountId} to update volume.`);
            }
        }
        
        toast({
            title: "Payment Confirmed",
            description: `Transaction ${transaction.id} has been marked as Completed.`
        });
        
        await fetchTransactions(appliedFilters);

    } catch (error) {
        console.error("Confirmation failed:", error);
        toast({
            variant: 'destructive',
            title: "Confirmation Failed",
            description: `There was a problem confirming payment for transaction ${transaction.id}.`
        });
    } finally {
        setIsConfirming(null);
    }
  }


  const handleApplyFilters = () => {
    setAppliedFilters({
        currency: currencyFilter,
        startDate,
        endDate,
        minAmount: amountRange.min,
        maxAmount: amountRange.max
    })
  }

  const handleClearFilters = () => {
    setCurrencyFilter(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    setAmountRange({});
    setAppliedFilters(defaultFilters);
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

  const transactionColumns = columns({
    onView: handleViewClick,
    onEdit: handleEditClick,
    onConfirmPayment: handleConfirmPayment,
    isConfirmingId: isConfirming,
  });


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
               <div className="flex flex-wrap items-end gap-2 w-full md:w-auto">
                 <div className="flex flex-col gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="min-amount" className="text-xs">Min Amount</Label>
                      <Input 
                        id="min-amount"
                        type="number"
                        placeholder="0.00"
                        value={amountRange.min || ''}
                        onChange={(e) => setAmountRange(prev => ({...prev, min: e.target.value}))}
                        className="h-8 w-28"
                      />
                    </div>
                     <div className="grid gap-1">
                      <Label htmlFor="max-amount" className="text-xs">Max Amount</Label>
                      <Input 
                        id="max-amount"
                        type="number"
                        placeholder="1000.00"
                        value={amountRange.max || ''}
                        onChange={(e) => setAmountRange(prev => ({...prev, max: e.target.value}))}
                        className="h-8 w-28"
                      />
                    </div>
                  </div>
                 <div className="grid gap-1.5 p-2 border rounded-md">
                    <Label className="text-xs">Date Range</Label>
                    <div className="flex flex-col items-start gap-2">
                        <DateTimePicker date={startDate} setDate={setStartDate} label="Start Date & Time" />
                        <DateTimePicker date={endDate} setDate={setEndDate} label="End Date & Time" />
                    </div>
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                            <Filter className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Currency{currencyFilter ? `: ${currencyFilter}` : ''}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Filter by Currency</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                        checked={currencyFilter === undefined}
                        onCheckedChange={() => setCurrencyFilter(undefined)}
                        >
                        All
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                        checked={currencyFilter === 'USD'}
                        onCheckedChange={() => setCurrencyFilter('USD')}
                        >
                        USD
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                        checked={currencyFilter === 'EUR'}
                        onCheckedChange={() => setCurrencyFilter('EUR')}
                        >
                        EUR
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-col gap-2">
                    <Button size="sm" className="h-8 gap-1" onClick={handleApplyFilters}>
                        <Search className="h-3.5 w-3.5"/>
                        <span className="sr-only sm:not-sr-only">Search</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={handleClearFilters}>
                        <X className="h-3.5 w-3.5"/>
                         <span className="sr-only sm:not-sr-only">Clear</span>
                    </Button>
                </div>
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
                <DataTable columns={transactionColumns} data={transactions} />
              )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{transactions.length}</strong> of <strong>{transactions.length}</strong> transactions
              </div>
            </CardFooter>
          </Card>
    </div>
  )
}
