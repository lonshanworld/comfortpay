
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

export default function StaffMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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
  }, [])

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
