
"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Merchant, User } from "@/lib/types"

function getMerchantShortKey(merchant : User) : String {
    if(merchant.websiteUrl){
       const numericId = merchant.id.split('_')[1];
      const hostname = new URL(merchant.websiteUrl).hostname;
      const prefix = hostname.replace('www.', '').substring(0, 3).toUpperCase();
      return `${prefix}_${numericId}`;
    }else{
      return merchant.name;
    }
  }
interface MerchantFilterProps {
    column: any;
    salesAgentId?: string | null;
}


export function MerchantFilter({ column, salesAgentId }: MerchantFilterProps) {
  const [merchants, setMerchants] = React.useState<Merchant[]>([])



  React.useEffect(() => {
    const fetchMerchants = async () => {
      console.log("Fetching merchants for salesAgentId:", salesAgentId);
      try {
        let apiUrl = '/api/merchants?status=all';
        // Only add the salesAgentId to the query if it's actually set.
        // This ensures the admin dashboard view continues to show all merchants.
        if (salesAgentId) {
            apiUrl += `&salesAgentId=${salesAgentId}`;
        }
        console.log("Merchant filter - Fetching from URL:", apiUrl);
        const response = await fetch(apiUrl);
        if (response.ok) {
          console.log("Merchant filter - Response OK");
          const data = await response.json()
          console.log("Merchant filter - Fetched merchants:", data);
          setMerchants(data)
        }
      } catch (error) {
        console.error("Failed to fetch merchants for filter", error)
      }
    }
    // Re-fetch merchants whenever the determined salesAgentId changes.
    fetchMerchants()
  }, [salesAgentId])

  React.useEffect(() => {
    console.log("Merchant filter - salesAgentId:", salesAgentId);
  }, []);

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
            {getMerchantShortKey(merchant)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
