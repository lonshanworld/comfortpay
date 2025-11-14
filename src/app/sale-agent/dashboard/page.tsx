
import { redirect } from "next/navigation"

export default function MerchantDashboardRedirect() {
  redirect('/sale-agent/dashboard/transactions')
}
// "use client"

// import { useState, useEffect, useCallback } from "react"
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card"
// import { DollarSign, Users, TrendingUp, UserPlus, Loader2 } from "lucide-react"

// interface AgentStats {
//     totalCommission: { value: number; change: string };
//     merchantsOnboarded: { value: number; change: string };
//     totalActiveMerchants: { value: number; change: string };
//     monthlyVolume: { value: number; change: string };
// }

// export default function SaleAgentDashboard() {
//   const [stats, setStats] = useState<AgentStats | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [agentId, setAgentId] = useState<string | null>(null);

//   useEffect(() => {
//     const userRole = localStorage.getItem('userRole');
//     let id;
//     if (userRole === 'Admin') {
//         id = localStorage.getItem('impersonatingUserId');
//     } else {
//         id = localStorage.getItem('userId');
//     }
//     setAgentId(id);
//   }, []);

//   const fetchStats = useCallback(async (isInitialLoad = false) => {
//     if (!agentId) return;

//     if (isInitialLoad) {
//         setIsLoading(true);
//     }
    
//     try {
//         const response = await fetch(`/api/dashboard/sale-agent-stats/${agentId}`);
//         if(response.ok) {
//             const data = await response.json();
//             setStats(data);
//         } else {
//             setStats(null);
//         }
//     } catch (error) {
//         console.error("Failed to fetch agent stats:", error);
//         setStats(null);
//     } finally {
//         if (isInitialLoad) {
//             setIsLoading(false);
//         }
//     }
//   }, [agentId]);

//   useEffect(() => {
//     if (agentId) {
//         fetchStats(true); // Initial fetch
//         const intervalId = setInterval(() => fetchStats(false), 30000); // Refresh every 30 seconds
//         return () => clearInterval(intervalId); // Cleanup on unmount
//     }
//   }, [agentId, fetchStats]);

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-US", {
//         style: "currency",
//         currency: "USD",
//     }).format(amount);
//   }

//   if (isLoading) {
//     return (
//         <div className="flex flex-1 justify-center items-center">
//             <Loader2 className="h-10 w-10 animate-spin text-primary" />
//         </div>
//     )
//   }

//   if (!stats) {
//       return (
//         <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
//             <div className="flex flex-col items-center gap-1 text-center">
//                 <h3 className="text-2xl font-bold tracking-tight">Could not load dashboard</h3>
//                 <p className="text-sm text-muted-foreground">There was an error fetching your stats.</p>
//             </div>
//         </div>
//       )
//   }

//   return (
//      <div className="flex flex-col sm:gap-4">
//         <div>
//             <h1 className="text-2xl font-bold tracking-tight">Welcome, Agent</h1>
//             <p className="text-muted-foreground">
//                 Here's a summary of your sales activity.
//             </p>
//         </div>
//         <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 Total Commission (Month)
//               </CardTitle>
//               <DollarSign className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{formatCurrency(stats.totalCommission.value)}</div>
//               <p className="text-xs text-muted-foreground">
//                 {stats.totalCommission.change}
//               </p>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 Merchants Onboarded
//               </CardTitle>
//               <UserPlus className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">+{stats.merchantsOnboarded.value}</div>
//               <p className="text-xs text-muted-foreground">
//                 {stats.merchantsOnboarded.change}
//               </p>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Total Active Merchants</CardTitle>
//               <Users className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{stats.totalActiveMerchants.value}</div>
//               <p className="text-xs text-muted-foreground">
//                 {stats.totalActiveMerchants.change}
//               </p>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Monthly Volume</CardTitle>
//               <TrendingUp className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{formatCurrency(stats.monthlyVolume.value)}</div>
//               <p className="text-xs text-muted-foreground">
//                 {stats.monthlyVolume.change}
//               </p>
//             </CardContent>
//           </Card>
//         </div>
//          <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
//             <div className="flex flex-col items-center gap-1 text-center">
//                 <h3 className="text-2xl font-bold tracking-tight">
//                 Activity Feed
//                 </h3>
//                 <p className="text-sm text-muted-foreground">
//                 Recent merchant sign-ups and performance alerts will appear here.
//                 </p>
//             </div>
//             </div>
//       </div>
//   )
// }
