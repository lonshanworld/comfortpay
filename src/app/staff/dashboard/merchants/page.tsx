
"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Merchant, Permissions, User } from "@/lib/types"
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"

export default function StaffMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const fetchUser = async () => {
      setIsLoading(true);
        if (userId) {
             try {
                const response = await fetch(`/api/users/${userId}`);
                const data = await response.json();
                setUser(data);
            } catch (error) {
                console.error("Failed to fetch user data", error);
            }
        }
        setIsLoading(false);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (user?.permissions?.view_merchants) {
      const fetchMerchants = async () => {
          setIsLoading(true)
          try {
            const response = await fetch('/api/merchants')
            const data = await response.json()
            setMerchants(data)
          } catch (error) {
            console.error("Failed to fetch merchants", error)
          } finally {
            setIsLoading(false)
          }
        }
      fetchMerchants()
    }
  }, [user])

   const permissions: Permissions = useMemo(() => {
    if (!user?.permissions) return {};
    try {
        return typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch {
        return {};
    }
  }, [user]);

  if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
  }

  if (!permissions.view_merchants) {
    return (
       <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You do not have permission to view this page.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle>All Merchants</CardTitle>
          <CardDescription>
            A read-only view of all merchants on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <DataTable columns={columns} data={merchants} filterColumnId="email" filterPlaceholder="Filter by email..." />
        </CardContent>
      </Card>
    </div>
  )
}
