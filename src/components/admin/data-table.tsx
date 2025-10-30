
"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnSizingState,
  RowSelectionState,
   ExpandedState,
  getExpandedRowModel,
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
  filterColumnId?: string;
  filterPlaceholder?: string;
   rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
    showPagination?: boolean;
  getRowCanExpand?: (row: any) => boolean;
  renderSubComponent?: (props: { row: any }) => React.ReactElement;

}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumnId,
  filterPlaceholder,
    rowSelection,
  setRowSelection,
  showPagination = true,
    getRowCanExpand,
  renderSubComponent,

}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  
  const isMobile = useIsMobile();

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
     onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: getRowCanExpand,
    columnResizeMode: "onChange",
    enableRowSelection: !!setRowSelection, 
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
      expanded,
    },
    defaultColumn: {
      size: 100, // default column size
      minSize: 100,
      maxSize: 500,
    },
    initialState: {
        pagination: {
             pageSize: showPagination ? 200 : data.length,
        },
    }
  })

  React.useEffect(() => {
    console.log('isMobile changed:', isMobile);
    if (isMobile) {
      const newColumnSizing: ColumnSizingState = {};
      table.getAllLeafColumns().forEach(column => {
        // Only set a default mobile size if one isn't already specified in the column def
        if (column.columnDef.size === undefined) {
          console.log('Setting mobile size for column:', column.columnDef);
           newColumnSizing[column.id] = 10;
        }
      });
      setColumnSizing(newColumnSizing);
    } else {
        // On desktop, reset to default behavior
        setColumnSizing({});
    }
  }, [isMobile, table.getAllLeafColumns]);


  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        {filterColumnId && (
            <Input
              placeholder={filterPlaceholder || `Filter by ${filterColumnId}...`}
              value={(table.getColumn(filterColumnId)?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn(filterColumnId)?.setFilterValue(event.target.value)
              }
              className="max-w-sm h-8"
            />
        )}
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
        <Table style={{ width: table.getTotalSize() }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} style={{ width: header.getSize() }} className="relative">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                       {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none bg-border/50 hover:bg-primary active:bg-primary"
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
                <React.Fragment key={row.id}>
                  <TableRow data-state={setRowSelection && row.getIsSelected() ? "selected" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className="break-words">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && renderSubComponent && (
                    <TableRow>
                      <TableCell colSpan={row.getVisibleCells().length}>
                        {renderSubComponent({ row })}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center break-words"
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
            {setRowSelection ? (
                <>
                {table.getFilteredSelectedRowModel().rows.length} of{" "}
                {table.getFilteredRowModel().rows.length} row(s) selected.
                </>
            ) : (
                <>
                {table.getFilteredRowModel().rows.length} row(s) found.
                </>
            )}
        </div>
        {showPagination && (
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
        )}
      </div>
    </div>
  )
}
