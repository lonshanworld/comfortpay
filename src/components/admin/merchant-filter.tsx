
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
      try {
        let apiUrl = '/api/merchants?status=all';
        if (salesAgentId) {
            apiUrl += `&salesAgentId=${salesAgentId}`;
        }
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json()
          setMerchants(data)
        }
      } catch (error) {
        console.error("Failed to fetch merchants for filter", error)
      }
    }
    
    // Check if the salesAgentId prop is present. If it is, we are in the sales agent context.
    const isSalesAgentContext = salesAgentId !== undefined;

    if (isSalesAgentContext) {
      // In sales agent context, only fetch if the ID is available.
      if (salesAgentId) {
        fetchMerchants();
      }
    } else {
      // In admin context (salesAgentId prop is not passed), fetch immediately.
      fetchMerchants();
    }
  }, [salesAgentId])


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
