"use client"
import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  MoreHorizontal,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface PluginLog {
    id: number;
    hostname: string;
    plugin_status: 'error' | 'success' | 'info';
    version: string;
    title: string;
    description: string;
    value: string;
    raw_request?: any;
    is_solved: boolean;
    createdAt: string;
}

type LogColumnsProps = {
  onStatusChange: (logId: number, currentStatus: boolean) => void;
};

const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'GMT',
        hour12: true,
    };
    return date.toLocaleString('en-US', options);
}

const getStatusVariant = (status: 'error' | 'success' | 'info' | undefined) => {
  switch (status) {
    case 'error': return 'destructive';
    case 'success': return 'success';
    case 'info': return 'info';
    default: return 'outline';
  }
}

export const columns = ({ onStatusChange }: LogColumnsProps): ColumnDef<PluginLog>[] => [
  {
    accessorKey: "id",
    header: "ID",
    size: 40,
  },
  {
    accessorKey: "hostname",
    header: "Source",
    size: 60,
  },
  {
    accessorKey: "plugin_status",
    header: "Type",
    cell: ({ row }) => {
      const status = row.original.plugin_status;
      return <Badge variant={getStatusVariant(status)} className="capitalize">{status || 'info'}</Badge>
    },
    size: 50
  },
   {
    accessorKey: "version",
    header: "Version",
    size: 50,
  },
  {
    accessorKey: "title",
    header: "Title",
    size: 100,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <div className="text-xs bg-muted p-2 rounded-md overflow-auto whitespace-pre-wrap break-all">{row.original.description}</div>,
    size: 400,
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => <pre className="text-xs bg-muted p-2 rounded-md overflow-auto whitespace-pre-wrap break-all">{row.original.value}</pre>,
    size: 400,
  },
  {
    accessorKey: "raw_request",
    header: "Raw Request",
    cell: ({ row }) => {
      const rawRequest = row.original.raw_request;
      if (!rawRequest) return <span className="text-muted-foreground">N/A</span>;
      
      const content = typeof rawRequest === 'object' ? JSON.stringify(rawRequest, null, 2) : rawRequest;
      
      return (
        <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-48 whitespace-pre-wrap break-all">
          {content}
        </pre>
      )
    },
    size: 400,
  },
  {
    accessorKey: "createdAt",
    header: "Timestamp (GMT)",
    cell: ({ row }) => formatDate(row.original.createdAt),
    size: 50,
  },
  {
    accessorKey: "is_solved",
    header: "Status",
    cell: ({ row }) => {
      const isSolved = row.original.is_solved;
      return (
        <Badge variant={isSolved ? "success" : "destructive"}>
          {isSolved ? "Solved" : "Unsolved"}
        </Badge>
      )
    },
    size: 30,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const log = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onStatusChange(log.id, log.is_solved)}>
              {log.is_solved ? <XCircle className="mr-2 h-4 w-4"/> : <CheckCircle className="mr-2 h-4 w-4" />}
              Mark as {log.is_solved ? "Unsolved" : "Solved"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    size: 30,
  },
];
