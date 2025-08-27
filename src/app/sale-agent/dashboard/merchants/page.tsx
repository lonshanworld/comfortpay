
"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Merchant } from "@/lib/types"
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"

export default function SaleAgentMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [salesAgentId, setSalesAgentId] = useState<string | null>(null);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    let id;
    if (userRole === 'Admin') {
      id = localStorage.getItem('impersonatingUserId');
    } else {
      id = localStorage.getItem('userId');
    }
    setSalesAgentId(id);
  }, []);

  useEffect(() => {
    const fetchMerchants = async () => {
        if (!salesAgentId) return;
        setIsLoading(true)
        try {
          const response = await fetch(`/api/merchants?salesAgentId=${salesAgentId}`)
          const data = await response.json()
          setMerchants(data)
        } catch (error) {
          console.error("Failed to fetch merchants", error)
        } finally {
          setIsLoading(false)
        }
      }
    fetchMerchants()
  }, [salesAgentId])

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle>My Merchants</CardTitle>
          <CardDescription>
            A list of merchants you manage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable columns={columns} data={merchants} filterColumnId="email" filterPlaceholder="Filter by email..." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
