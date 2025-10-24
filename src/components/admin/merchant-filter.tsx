
"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Merchant } from "@/lib/types"

export function MerchantFilter({ column }: { column: any }) {
  const [merchants, setMerchants] = React.useState<Merchant[]>([])

  React.useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const response = await fetch('/api/merchants?status=all')
        if (response.ok) {
          const data = await response.json()
          setMerchants(data)
        }
      } catch (error) {
        console.error("Failed to fetch merchants for filter", error)
      }
    }
    fetchMerchants()
  }, [])

  return (
    <Select
      value={(column.getFilterValue() ?? '') as string}
      onValueChange={value => column.setFilterValue(value === 'all' ? '' : value)}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Filter by merchant..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Merchants</SelectItem>
        {merchants.map(merchant => (
          <SelectItem key={merchant.id} value={merchant.id}>
            {merchant.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
