
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Shield, UserCog, LayoutGrid, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User, UserRole } from "@/lib/types"

const getRoleVariant = (role: UserRole) => {
  switch (role) {
    case 'Admin':
      return 'destructive';
    case 'Merchant':
      return 'secondary';
    case 'Sale Agent':
        return 'default'
    case 'Staff':
      return 'outline';
    default:
      return 'outline';
  }
};

type UserColumnsProps = {
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onManagePermissions: (user: User) => void;
  onViewDashboard: (user: User) => void;
  isDeletingId: string | null;
};

export const columns = ({ onView, onEdit, onDelete, onManagePermissions, onViewDashboard, isDeletingId }: UserColumnsProps): ColumnDef<User>[] => [
  {
    accessorKey: "id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
     cell: ({ row }) => <div className="font-mono">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const user = row.original;
        return (
             <div className="font-medium">
                <div>{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
        )
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
       const role = row.getValue("role") as UserRole;
       return <Badge variant={getRoleVariant(role)}>{role}</Badge>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
       const status = row.getValue("status") as string;
       return <Badge variant={status === 'Active' ? "secondary" : "destructive"}>{status}</Badge>
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date Joined (GMT)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return <div>{date.toLocaleString()}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original
      const isDeleting = isDeletingId === user.id;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
              <span className="sr-only">Open menu</span>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
             {user.role !== 'Admin' && (
              <DropdownMenuItem onClick={() => onViewDashboard(user)}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>View Dashboard</span>
              </DropdownMenuItem>
            )}
             <DropdownMenuItem onClick={() => onView(user)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(user)}>
              Edit User
            </DropdownMenuItem>
             {user.role === 'Staff' && (
                <DropdownMenuItem onClick={() => onManagePermissions(user)}>
                    <UserCog className="mr-2 h-4 w-4" />
                    <span>Manage Permissions</span>
                </DropdownMenuItem>
            )}
            {user.role === 'Admin' && (
                 <DropdownMenuItem disabled>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Cannot Modify Admin</span>
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(user)}
                disabled={user.role === 'Admin'}
            >
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
