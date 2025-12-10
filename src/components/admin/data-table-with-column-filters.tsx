
"use client"

import * as React from "react"
import {
  Column,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnFiltersState,
  ColumnSizingState,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-mobile"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  columnFilters: ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
 
  customFilterComponents?: Record<string, React.ElementType<{ column: any }>>;
    pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  pageCount: number;
  tableId: string;
}


export function DataTableWithColumnFilters<TData, TValue>({
  columns,
  data,
  columnFilters,
  setColumnFilters,
  
  customFilterComponents = {},
  pagination,
  setPagination,
  pageCount,
  tableId
}: DataTableProps<TData, TValue>) {
  
  const [sorting, setSorting] = React.useState<any[]>([])

  const [rowSelection, setRowSelection] = React.useState({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})


  const isMobile = useIsMobile();

  
  React.useEffect(() => {
    const savedSizing = localStorage.getItem(`tableSizing_${tableId}`);
    const savedVisibility = localStorage.getItem(`tableVisibility_${tableId}`);
    if (savedSizing) {
      setColumnSizing(JSON.parse(savedSizing));
    }
    if (savedVisibility) {
      setColumnVisibility(JSON.parse(savedVisibility));
    }
  }, [tableId]);

  const handleColumnSizingChange = (updater: any) => {
    const newSizing = typeof updater === 'function' ? updater(columnSizing) : updater;
    setColumnSizing(newSizing);
    localStorage.setItem(`tableSizing_${tableId}`, JSON.stringify(newSizing));
  };
  
  const handleColumnVisibilityChange = (updater: any) => {
      const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      localStorage.setItem(`tableVisibility_${tableId}`, JSON.stringify(newVisibility));
  };


  const table = useReactTable({
    data,
    columns,
    pageCount,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: handleColumnSizingChange,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualFiltering: true,
    columnResizeMode: "onChange",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    initialState: {
       
        columnVisibility : {
          id : false,
          paymentMethod : false,
        }
    },
  
  })

   React.useEffect(() => {
    if (isMobile) {
      const newColumnSizing: ColumnSizingState = {};
      table.getAllLeafColumns().forEach(column => {
        // Only set a default mobile size if one isn't already specified in the column def
        // if (column.columnDef.size === undefined) {
        //    newColumnSizing[column.id] = 100;
        // }
        newColumnSizing[column.id] = 100;
      });
      setColumnSizing(newColumnSizing);
    }
  }, [isMobile, table.getAllLeafColumns]);

  return (
    <div>
      <div className="flex items-center py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto h-8 gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                View
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table id="transactions-table" style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const CustomFilter = customFilterComponents[header.id];
                  return (
                    <TableHead key={header.id} style={{ width: header.getSize() }} className="relative align-top h-24 text-xs">
                      <div className="flex flex-col gap-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                         {header.column.getCanFilter() ? (
                            CustomFilter ? (
                              <CustomFilter column={header.column} />
                            ) : (
                              <Input
                                placeholder={`Filter...`}
                                value={(header.column.getFilterValue() ?? '') as string}
                                onChange={e => header.column.setFilterValue(e.target.value)}
                                className="h-8 text-xs max-w-sm"
                              />
                            )
                          ) : null}
                      </div>
                       {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none bg-border/50 hover:bg-primary"
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className="text-xs break-words">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
