"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PaymentAccount } from "@/lib/types"

export function AccountInfoFilter({ column }: { column: any }) {
  const [accounts, setAccounts] = React.useState<PaymentAccount[]>([])

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/payments/accounts')
        if (response.ok) {
          const data = await response.json()
          setAccounts(data)
        }
      } catch (error) {
        console.error("Failed to fetch payment accounts for filter", error)
      }
    }
    fetchAccounts()
  }, [])

  return (
    <Select
      value={(column.getFilterValue() ?? '') as string}
      onValueChange={value => column.setFilterValue(value === 'all' ? '' : value)}
    >
      <SelectTrigger className="h-8 text-xs max-w-sm">
        <SelectValue placeholder="Filter by account..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Accounts</SelectItem>
        {accounts.map(account => (
          <SelectItem key={account.id} value={String(account.id).replace('pa_', '')}>
            {account.name} ({account.accountEmail || `ID: ${String(account.id).replace('pa_', '')}`})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
