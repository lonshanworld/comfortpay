
"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RevenueChart } from "@/components/admin/revenue-chart"
import { BarChart, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface PerformanceData {
  monthlyRevenue: number;
  monthlySales: number;
  revenueChart: { month: string, revenue: number }[];
}

export default function MerchantReportsPage() {
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

     useEffect(() => {
        const fetchPerformanceData = async () => {
            const userRole = localStorage.getItem('userRole');
            let merchantId;
            if (userRole === 'Admin') {
                merchantId = localStorage.getItem('impersonatingUserId');
            } else {
                merchantId = localStorage.getItem('userId');
            }

            if (!merchantId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/dashboard/merchant-performance/${merchantId}`);
                if (response.ok) {
                    const data = await response.json();
                    setPerformanceData(data);
                } else {
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

    const formatCurrency = (amount: number, currency: string = "USD") => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    
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
                    <h3 className="text-2xl font-bold tracking-tight">Could not load reports</h3>
                    <p className="text-sm text-muted-foreground">There was an error fetching your performance data.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="grid flex-1 items-start gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <CardHeader className="pb-2">
                         <CardDescription>This Month's Revenue (USD)</CardDescription>
                        <CardTitle className="text-4xl">{formatCurrency(performanceData.monthlyRevenue, "USD")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">This is an aggregated total and may include multiple currencies.</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Month's Sales</CardDescription>
                        <CardTitle className="text-4xl">{performanceData.monthlySales}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">+10% from last month</div>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5"/> Sales Over Time (USD)</CardTitle>
                    <CardDescription>
                        Your total sales volume over the last 6 months. Values are aggregated.

                    </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <RevenueChart data={performanceData.revenueChart} />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                     <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/> Export Reports</CardTitle>
                    <CardDescription>
                        Download your sales data in various formats.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-start gap-2">
                        <p className="text-sm text-muted-foreground">This feature is coming soon.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
