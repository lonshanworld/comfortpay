
"use client"

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RevenueChart } from "@/components/admin/revenue-chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react";

interface CommissionData {
    merchant: string;
    volume: number;
    rate: string;
    commission: number;
}

interface ChartData {
    month: string;
    revenue: number;
}

interface PerformanceData {
    commissionStatement: CommissionData[];
    historicalVolume: ChartData[];
}


export default function SaleAgentPerformancePage() {
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPerformanceData = async () => {
            const agentId = localStorage.getItem('impersonatingUserId') || localStorage.getItem('userId');
            if (!agentId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/dashboard/sale-agent-performance/${agentId}`);
                if (response.ok) {
                    const data = await response.json();
                    setPerformanceData(data);
                } else {
                    console.error("Failed to fetch performance data");
                    setPerformanceData(null);
                }
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
                setPerformanceData(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPerformanceData();
    }, []);

    const totals = performanceData?.commissionStatement.reduce((acc, item) => {
        acc.volume += item.volume;
        acc.commission += item.commission;
        return acc;
    }, { volume: 0, commission: 0 });

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    if (isLoading) {
        return (
            <div className="flex flex-1 justify-center items-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!performanceData) {
         return (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold tracking-tight">Could not load performance data</h3>
                    <p className="text-sm text-muted-foreground">There was an error fetching your stats.</p>
                </div>
            </div>
      )
    }

  return (
    <div className="flex flex-col gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Performance</h1>
            <p className="text-muted-foreground">
                Review your sales metrics and commission history.
            </p>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Commission Statement (Current Month)</CardTitle>
                    <CardDescription>
                        Your commission breakdown for the current month.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Merchant</TableHead>
                                <TableHead className="text-right">Volume</TableHead>
                                <TableHead className="text-right">Commission</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {performanceData.commissionStatement.map((item) => (
                                <TableRow key={item.merchant}>
                                    <TableCell className="font-medium">{item.merchant}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.volume)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.commission)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right">{formatCurrency(totals?.volume || 0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totals?.commission || 0)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                <CardTitle>Sales Volume Over Time</CardTitle>
                <CardDescription>
                    Your total merchant sales volume over the last 6 months.
                </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <RevenueChart data={performanceData.historicalVolume} />
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
