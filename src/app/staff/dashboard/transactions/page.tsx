

"use client"

import React, { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Order, Merchant, User, Permissions } from "@/lib/types"
import { DataTable } from "@/components/admin/data-table"
import { columns as transactionColumnsDefinition } from "./columns"
import { EditOrderDialog } from "@/components/admin/edit-order-dialog"
import { ViewTransactionDialog } from "@/components/admin/view-transaction-dialog"

export default function StaffTransactionsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Order | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const fetchUser = async () => {
        if (userId) {
             try {
                const response = await fetch(`/api/users/${userId}`);
                const data = await response.json();
                setUser(data);
            } catch (error) {
                console.error("Failed to fetch user data", error);
            }
        }
    };
    fetchUser();
  }, []);

  const fetchTransactions = async () => {
      setIsLoading(true)
      try {
        const [ordersRes, merchantsRes] = await Promise.all([
          fetch(`/api/orders`),
          fetch('/api/merchants'),
        ]);
        const ordersData = await ordersRes.json();
        const merchantsData = await merchantsRes.json();
        
        const ordersWithDetails = ordersData.map((order: Order) => {
            const merchant = merchantsData.find((m: Merchant) => m.id === order.merchantId);
            return {
                ...order,
                merchantName: merchant?.name || 'N/A',
                merchantWebsiteUrl: merchant?.websiteUrl,
            }
        });
        
        setOrders(ordersWithDetails);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchTransactions()
  }, [])
  
  const handleOrderUpdated = () => {
    fetchTransactions();
    setIsEditDialogOpen(false);
  }

  const handleViewClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  }

  const handleEditClick = (transaction: Order) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  }
  
  const userPermissions: Permissions = React.useMemo(() => {
    if (!user?.permissions) return {};
    try {
        // The permissions from DB are already an object because of the API parsing logic.
        return typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch {
        return {};
    }
  }, [user]);

  const columns = transactionColumnsDefinition({
      permissions: userPermissions,
      onView: handleViewClick,
      onEdit: handleEditClick
  });

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
        <EditOrderDialog 
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            order={selectedTransaction}
            onOrderUpdated={handleOrderUpdated}
        />
         <ViewTransactionDialog
            open={isViewDialogOpen}
            onOpenChange={setIsViewDialogOpen}
            transaction={selectedTransaction}
        />
        <Card>
            <CardHeader>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                  A view of all transactions on the platform based on your permissions.
                </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataTable columns={columns} data={orders} />
              )}
            </CardContent>
          </Card>
    </div>
  )
}
