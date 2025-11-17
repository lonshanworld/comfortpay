"use client"
import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Loader2,
} from "lucide-react"
import type { PaginationState } from "@tanstack/react-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { columns as logColumnsDefinition } from "./columns"
import { DataTableWithPagination } from "@/components/ui/data-table-with-pagination"

interface PluginLog {
    id: number;
    hostname: string;
    plugin_status: 'error' | 'success' | 'info';
    title: string;
    description: string;
    value: string;
    is_solved: boolean;
    createdAt: string;
}

export default function PluginLogsPage() {
  const [logs, setLogs] = useState<PluginLog[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const fetchLogs = useCallback(async (page: number, size: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      params.append('page', String(page + 1));
      params.append('pageSize', String(size));      
      const response = await fetch(`/api/plugins/logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch plugin logs");

      const { data, pageCount, totalCount } = await response.json();
      setLogs(data);
      setPageCount(pageCount);
      setTotalCount(totalCount);

    } catch (error: any) {
      console.error("Failed to fetch logs", error);
      toast({ variant: "destructive", title: "Fetch Error", description: "Could not fetch plugin logs." })
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLogs(pageIndex, pageSize);
  }, [pageIndex, pageSize, fetchLogs]);

  const handleStatusChange = async (logId: number, is_solved: boolean) => {
    try {
      const response = await fetch(`/api/plugins/logs/${logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_solved: !is_solved }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      
      toast({
        title: "Status Updated",
        description: "The log status has been changed."
      });
      fetchLogs(pageIndex, pageSize);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message
      })
    }
  };

  const columns = useMemo(() => logColumnsDefinition({
    onStatusChange: handleStatusChange,
  }), [fetchLogs, pageIndex, pageSize]);

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
        <Card>
            <CardHeader>
              <CardTitle>Plugin Logs</CardTitle>
              <CardDescription>
                Review errors and logs submitted by the PHP plugins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && logs.length === 0 ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataTableWithPagination 
                  tableId="plugin-logs"
                  columns={columns} 
                  data={logs}
                  pageCount={pageCount}
                  pagination={{ pageIndex, pageSize }}
                  setPagination={setPagination}
                  isLoading={isLoading}
                />
              )}
            </CardContent>
             <CardFooter>
              <div className="text-xs text-muted-foreground">
                Page <strong>{pageIndex + 1}</strong> of <strong>{pageCount}</strong>. Total logs: <strong>{totalCount}</strong>.
              </div>
            </CardFooter>
          </Card>
    </div>
  )
}
