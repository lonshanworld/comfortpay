
"use client"
import { useState, useEffect, useCallback } from "react"
import {
  Loader2,
  Filter,
  Search,
  X,
  File,
  ChevronDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Order } from "@/lib/types"
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"
import { ViewTransactionDialog } from "@/components/admin/view-transaction-dialog"
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
import { DateTimePicker } from "@/components/ui/datetime-picker"
import { useToast } from "@/hooks/use-toast"


const defaultFilters = {
    status: "all",
    q: "",
    currency: undefined,
    startDate: undefined,
    endDate: undefined,
    minAmount: "",
    maxAmount: "",
};

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


export default function MerchantTransactionsPage() {
  const [transactions, setTransactions] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Filter states
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);


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

  const fetchTransactions = useCallback(async (filtersToApply: typeof appliedFilters) => {
    if (!merchantId) return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({ merchantId });
      if (filtersToApply.status && filtersToApply.status !== 'all') params.append('status', filtersToApply.status);
      if (filtersToApply.q) params.append('q', filtersToApply.q);
      if (filtersToApply.currency) params.append('currency', filtersToApply.currency);
      if (filtersToApply.startDate) params.append('startDate', filtersToApply.startDate.toISOString());
      if (filtersToApply.endDate) params.append('endDate', filtersToApply.endDate.toISOString());
      if (filtersToApply.minAmount) params.append('minAmount', filtersToApply.minAmount);
      if (filtersToApply.maxAmount) params.append('maxAmount', filtersToApply.maxAmount);

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
    } finally {
      setIsLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    if (merchantId) {
      fetchTransactions(appliedFilters);
    }
  }, [merchantId, appliedFilters, fetchTransactions]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }
  
  const handleApplyFilters = () => {
    setAppliedFilters(filters);
  }

  const handleClearFilters = () => {
    const newFilters = { ...defaultFilters, status: appliedFilters.status };
    setFilters(newFilters);
    setAppliedFilters(newFilters);
  }


  const handleViewClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
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
      
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <CardTitle>All Transactions</CardTitle>
                    <CardDescription>
                        Search and filter through all of your transactions.
                    </CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
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
              </div>
              <div className="flex flex-wrap items-end gap-4 pt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="q">Search</Label>
                    <Input 
                        id="q"
                        name="q"
                        placeholder="Customer name, email or ID..." 
                        value={filters.q}
                        onChange={handleFilterChange}
                        className="h-8 w-64"
                    />
                  </div>
                 <div className="flex flex-col gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="min-amount" className="text-xs">Min Amount</Label>
                      <Input 
                        id="min-amount"
                        name="minAmount"
                        type="number"
                        placeholder="0.00"
                        value={filters.minAmount}
                        onChange={handleFilterChange}
                        className="h-8 w-28"
                      />
                    </div>
                     <div className="grid gap-1">
                      <Label htmlFor="max-amount" className="text-xs">Max Amount</Label>
                      <Input 
                        id="max-amount"
                        name="maxAmount"
                        type="number"
                        placeholder="1000.00"
                        value={filters.maxAmount}
                        onChange={handleFilterChange}
                        className="h-8 w-28"
                      />
                    </div>
                  </div>
                 <div className="grid gap-1.5 p-2 border rounded-md">
                    <Label className="text-xs">Date Range</Label>
                    <div className="flex flex-col items-start gap-2">
                        <DateTimePicker date={filters.startDate} setDate={(d) => setFilters(p => ({ ...p, startDate: d }))} label="Start Date & Time" />
                        <DateTimePicker date={filters.endDate} setDate={(d) => setFilters(p => ({ ...p, endDate: d }))} label="End Date & Time" />
                    </div>
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                            <Filter className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Currency{filters.currency ? `: ${filters.currency}` : ''}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Filter by Currency</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                            checked={!filters.currency}
                            onCheckedChange={() => setFilters(p => ({ ...p, currency: undefined }))}
                        >
                        All
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={filters.currency === 'USD'}
                            onCheckedChange={() => setFilters(p => ({ ...p, currency: 'USD' }))}
                        >
                        USD
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={filters.currency === 'EUR'}
                            onCheckedChange={() => setFilters(p => ({ ...p, currency: 'EUR' }))}
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
          </Card>
    </div>
  )
}
