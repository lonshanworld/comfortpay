
"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RevenueChart } from "@/components/admin/revenue-chart"
import { BarChart, FileText } from "lucide-react";


const mockChartData = [
    { month: "January", revenue: 4000 },
    { month: "February", revenue: 3000 },
    { month: "March", revenue: 5000 },
    { month: "April", revenue: 4500 },
    { month: "May", revenue: 6000 },
    { month: "June", revenue: 8000 },
];

export default function MerchantReportsPage() {
    return (
        <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Month's Revenue</CardDescription>
                        <CardTitle className="text-4xl">$12,875</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">+25% from last month</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Month's Sales</CardDescription>
                        <CardTitle className="text-4xl">1,250</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">+10% from last month</div>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5"/> Sales Over Time</CardTitle>
                    <CardDescription>
                        Your total sales volume over the last 6 months.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <RevenueChart data={mockChartData} />
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
