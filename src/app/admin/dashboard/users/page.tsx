

"use client"

import {
  File,
  PlusCircle,
  Loader2,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { DataTable } from "@/components/admin/data-table"
import { columns as userColumnsDefinition } from "./columns"
import { columns as merchantColumnsDefinition } from "../merchants/columns"
import type { User, Merchant, UserRole } from "@/lib/types"
import { AddUserDialog } from "@/components/admin/add-user-dialog"
import { EditUserDialog } from "@/components/admin/edit-user-dialog"
import { ManagePermissionsDialog } from "@/components/admin/manage-permissions-dialog"
import { useToast } from "@/hooks/use-toast"
import { ViewMerchantDialog } from "@/components/admin/view-merchant-dialog"
import { ViewUserDialog } from "@/components/admin/view-user-dialog"
import { AddMerchantDialog } from "@/components/admin/add-merchant-dialog"
import { EditMerchantDialog } from "@/components/admin/edit-merchant-dialog"
import { ManageTokenDialog } from "@/components/admin/manage-token-dialog"

const roleDashboardPaths: Record<UserRole, string> = {
    'Merchant': '/merchant/dashboard',
    'Sale Agent': '/sale-agent/dashboard',
    'Staff': '/staff/dashboard',
    'Admin': '/admin/dashboard',
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all")
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)
  const [isAddMerchantDialogOpen, setIsAddMerchantDialogOpen] = useState(false)
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false)
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false)
  const [isViewUserDialogOpen, setIsViewUserDialogOpen] = useState(false)
  const [isViewMerchantDialogOpen, setIsViewMerchantDialogOpen] = useState(false)
  const [isEditMerchantDialogOpen, setIsEditMerchantDialogOpen] = useState(false)
  const [isManageTokenDialogOpen, setIsManageTokenDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null)
  const { toast } = useToast()

  const fetchUsers = async (role?: string) => {
    setIsLoading(true)
    try {
      let url;
      if (role === 'Merchant') {
          url = '/api/merchants'
      } else if (role && role !== "all") {
        url = `/api/users?role=${role}`
      } else {
         url = "/api/users?role=all"
      }
      
      const response = await fetch(url)
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error("Failed to fetch users", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let roleToFetch = activeTab;
    if (activeTab === "sale-agents") roleToFetch = "Sale Agent";
    fetchUsers(roleToFetch)
  }, [activeTab])
  
  const handleUserAdded = () => {
    fetchUsers(activeTab);
  }

  const handleUserUpdated = () => {
    fetchUsers(activeTab);
    setSelectedUser(null);
  }

  const handleMerchantAdded = () => {
    fetchUsers(activeTab);
  }

  const handleMerchantUpdated = () => {
    fetchUsers(activeTab)
    setSelectedMerchant(null)
  }

  const handleViewUserClick = (user: User) => {
    if (user.role === 'Merchant') {
        handleViewMerchantClick(user as Merchant);
    } else {
        setSelectedUser(user);
        setIsViewUserDialogOpen(true);
    }
  }
  
  const handleEditUserClick = (user: User) => {
    setSelectedUser(user);
    setIsEditUserDialogOpen(true);
  }

  const handlePermissionsClick = (user: User) => {
    setSelectedUser(user);
    setIsPermissionsDialogOpen(true);
  }

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Are you sure you want to delete user ${user.name}? This cannot be undone.`)) {
        setIsDeleting(user.id);
        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                 throw new Error('Failed to delete user');
            }
            toast({
                title: "User Deleted",
                description: `${user.name} has been successfully deleted.`,
            });
            fetchUsers(activeTab);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: "There was a problem deleting the user.",
            });
        } finally {
            setIsDeleting(null);
        }
    }
  }

  const handleViewMerchantClick = (merchant: Merchant) => {
    setSelectedMerchant(merchant)
    setIsViewMerchantDialogOpen(true)
  }

  const handleEditMerchantClick = (merchant: Merchant) => {
    setSelectedMerchant(merchant)
    setIsEditMerchantDialogOpen(true)
  }
  
  const handleManageTokenClick = (merchant: Merchant) => {
    setSelectedMerchant(merchant);
    setIsManageTokenDialogOpen(true);
  }

  const handleDeleteMerchant = async (merchant: Merchant) => {
     if (confirm(`Are you sure you want to delete merchant ${merchant.name}? This will also delete their user account.`)) {
        setIsDeleting(merchant.id);
        try {
             const response = await fetch(`/api/merchants/${merchant.id}`, {
                method: 'DELETE',
            });
             if (!response.ok) {
                throw new Error('Failed to delete merchant');
            }
             toast({
                title: "Merchant Deleted",
                description: `${merchant.name} has been successfully deleted.`,
            });
            fetchUsers(activeTab);
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: "There was a problem deleting the merchant.",
            });
        } finally {
            setIsDeleting(null);
        }
     }
  }
  
  const handleViewDashboard = (user: User) => {
    if (user.role && user.role !== 'Admin') {
      const path = roleDashboardPaths[user.role];
      if (path) {
        toast({
            title: `Viewing ${user.name}'s Dashboard`,
            description: `You are now viewing the dashboard as ${user.role}.`,
        });
        localStorage.setItem('impersonatingRole', user.role);
        localStorage.setItem('impersonatingUserId', user.id);
        router.push(path);
      } else {
         toast({
            variant: "destructive",
            title: "Navigation Error",
            description: `No dashboard path defined for role: ${user.role}`,
        });
      }
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      toast({
        title: "Export Started",
        description: "Your data is being exported and will be downloaded shortly.",
      });
      setIsExporting(false);
    }, 1500);
  };


  const userColumns = userColumnsDefinition({
    onView: handleViewUserClick,
    onEdit: handleEditUserClick,
    onDelete: handleDeleteUser,
    onManagePermissions: handlePermissionsClick,
    onViewDashboard: handleViewDashboard,
    isDeletingId: isDeleting,
  });

  const merchantColumns = merchantColumnsDefinition({
      onView: handleViewMerchantClick,
      onEdit: handleEditMerchantClick,
      onDelete: handleDeleteMerchant,
      onViewDashboard: handleViewDashboard,
      onManageToken: handleManageTokenClick,
      isDeletingId: isDeleting,
  });

  const isMerchantTab = activeTab === 'Merchant';
  const currentColumns = isMerchantTab ? merchantColumns : userColumns;
  // Cast is safe because fetchUsers gets the right data type for the tab
  const currentData = isMerchantTab ? (users as unknown as Merchant[]) : users;

  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
      <AddUserDialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} onUserAdded={handleUserAdded} />
      <AddMerchantDialog open={isAddMerchantDialogOpen} onOpenChange={setIsAddMerchantDialogOpen} onMerchantAdded={handleMerchantAdded} />
      {selectedUser && (
        <EditUserDialog 
            open={isEditUserDialogOpen} 
            onOpenChange={setIsEditUserDialogOpen} 
            user={selectedUser} 
            onUserUpdated={handleUserUpdated}
        />
      )}
      {selectedUser && (
        <ViewUserDialog
            open={isViewUserDialogOpen}
            onOpenChange={setIsViewUserDialogOpen}
            user={selectedUser}
        />
       )}
      {selectedUser && (
        <ManagePermissionsDialog
          open={isPermissionsDialogOpen}
          onOpenChange={setIsPermissionsDialogOpen}
          user={selectedUser}
          onPermissionsUpdated={handleUserUpdated}
        />
      )}
      {selectedMerchant && (
        <ViewMerchantDialog
            open={isViewMerchantDialogOpen}
            onOpenChange={setIsViewMerchantDialogOpen}
            merchant={selectedMerchant}
        />
      )}
       {selectedMerchant && (
        <EditMerchantDialog
            open={isEditMerchantDialogOpen}
            onOpenChange={setIsEditMerchantDialogOpen}
            merchant={selectedMerchant}
            onMerchantUpdated={handleMerchantUpdated}
        />
       )}
       {selectedMerchant && (
        <ManageTokenDialog
            open={isManageTokenDialogOpen}
            onOpenChange={setIsManageTokenDialogOpen}
            merchant={selectedMerchant}
            onTokenUpdated={handleMerchantUpdated}
        />
      )}
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="Admin">Admins</TabsTrigger>
            <TabsTrigger value="Merchant">Merchants</TabsTrigger>
            <TabsTrigger value="sale-agents">Sale Agents</TabsTrigger>
            <TabsTrigger value="Staff">Staff</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <File className="h-3.5 w-3.5" />}
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                {isExporting ? "Exporting..." : "Export"}
              </span>
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={() => activeTab === 'Merchant' ? setIsAddMerchantDialogOpen(true) : setIsAddUserDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                {activeTab === 'Merchant' ? 'Add Merchant' : 'Add User'}
              </span>
            </Button>
          </div>
        </div>
        <TabsContent value={activeTab}>
            <Card>
                <CardHeader>
                <CardTitle>{activeTab === 'Merchant' ? 'Merchants' : 'User Management'}</CardTitle>
                <CardDescription>
                    Manage all {activeTab === 'Merchant' ? 'merchants' : 'users'} on the platform.
                </CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <DataTable columns={currentColumns} data={currentData} />
                      )}
                </CardContent>
                 <CardFooter>
                    <div className="text-xs text-muted-foreground">
                        Showing <strong>{users.length}</strong> of <strong>{users.length}</strong>{" "}
                        {activeTab === 'Merchant' ? 'merchants' : 'users'}
                    </div>
                </CardFooter>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
