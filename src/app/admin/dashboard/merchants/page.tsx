
"use client"

import { useState, useEffect, useCallback } from "react"
import {
  File,
  PlusCircle,
  Loader2,
} from "lucide-react"
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
import { AddMerchantDialog } from "@/components/admin/add-merchant-dialog"
import type { Merchant, UserRole } from "@/lib/types"
import { EditMerchantDialog } from "@/components/admin/edit-merchant-dialog"
import { ViewMerchantDialog } from "@/components/admin/view-merchant-dialog"
import { DataTable } from "@/components/admin/data-table"
import { columns } from "./columns"
import { useToast } from "@/hooks/use-toast"
import { ManageTokenDialog } from "@/components/admin/manage-token-dialog"

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isManageTokenDialogOpen, setIsManageTokenDialogOpen] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const router = useRouter();
  const { toast } = useToast()

  const fetchMerchants = useCallback(async (status: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/merchants?status=${status}`)
      const data = await response.json()
      setMerchants(data)
    } catch (error) {
      console.error("Failed to fetch merchants", error)
    } finally {
      setIsLoading(false)
    }
  }, []);

  useEffect(() => {
    fetchMerchants(activeTab)
  }, [activeTab, fetchMerchants])

  const handleMerchantAdded = () => {
    fetchMerchants(activeTab)
  }

  const handleMerchantUpdated = async (updatedMerchantId: string) => {
    await fetchMerchants(activeTab); // Refresh the list in the background
    // Fetch the single updated merchant to refresh the dialog instantly
    try {
        const response = await fetch(`/api/merchants/${updatedMerchantId}`);
        if (response.ok) {
            const freshMerchantData = await response.json();
            setSelectedMerchant(freshMerchantData); // Update the state that is passed to the dialog
        } else {
            setSelectedMerchant(null);
            setIsEditDialogOpen(false);
        }
    } catch (error) {
         setSelectedMerchant(null);
         setIsEditDialogOpen(false);
    }
  }

 const handleViewClick = (merchant: Merchant) => {
    setSelectedMerchant(merchant)
    setIsViewDialogOpen(true)
  }

  const handleEditClick = (merchant: Merchant) => {
    setSelectedMerchant(merchant)
    setIsEditDialogOpen(true)
  }

  const handleDeleteClick = async (merchant: Merchant) => {
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
            fetchMerchants(activeTab);
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

  const handleManageTokenClick = (merchant: Merchant) => {
    setSelectedMerchant(merchant);
    setIsManageTokenDialogOpen(true);
  }
  
   const handleViewDashboard = (merchant: Merchant) => {
    const roleDashboardPaths: Record<UserRole, string> = {
        'Merchant': '/merchant/dashboard',
        'Sale Agent': '/sale-agent/dashboard',
        'Staff': '/staff/dashboard',
        'Admin': '/admin/dashboard',
    }
    
    const role = merchant.role || 'Merchant'; // Fallback for safety
    const path = roleDashboardPaths[role];
    
    if (path) {
        toast({
            title: `Viewing ${merchant.name}'s Dashboard`,
            description: `You are now viewing the dashboard as ${role}.`,
        });
        localStorage.setItem('impersonatingRole', role);
        localStorage.setItem('impersonatingUserId', merchant.id);
        router.push(path);
    } else {
        toast({
            variant: "destructive",
            title: "Navigation Error",
            description: `No dashboard path defined for role: ${role}`,
        });
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    // Simulate export process
    setTimeout(() => {
      toast({
        title: "Export Started",
        description: "Your data is being exported and will be downloaded shortly.",
      });
      setIsExporting(false);
    }, 1500);
  };

  const merchantColumns = columns({
    onView: handleViewClick,
    onEdit: handleEditClick,
    onDelete: handleDeleteClick,
    onViewDashboard: handleViewDashboard,
    onManageToken: handleManageTokenClick,
    isDeletingId: isDeleting,
  });


  return (
    <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
      <AddMerchantDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onMerchantAdded={handleMerchantAdded} />
      {selectedMerchant && (
        <EditMerchantDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            merchant={selectedMerchant}
            onMerchantUpdated={handleMerchantUpdated}
          />
      )}
       {selectedMerchant && (
            <ViewMerchantDialog 
                open={isViewDialogOpen} 
                onOpenChange={setIsViewDialogOpen} 
                merchant={selectedMerchant} 
            />
       )}
        {selectedMerchant && (
            <ManageTokenDialog
                open={isManageTokenDialogOpen}
                onOpenChange={setIsManageTokenDialogOpen}
                merchant={selectedMerchant}
                onTokenUpdated={() => handleMerchantUpdated(selectedMerchant.id)}
            />
        )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="Active">Active</TabsTrigger>
            <TabsTrigger value="Inactive">Inactive</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <File className="h-3.5 w-3.5" />}
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                {isExporting ? "Exporting..." : "Export"}
              </span>
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Merchant
              </span>
            </Button>
          </div>
        </div>
        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Merchants</CardTitle>
              <CardDescription>
                Manage your merchants and view their sales performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataTable 
                  columns={merchantColumns} 
                  data={merchants}
                  filterColumnId="email"
                  filterPlaceholder="Filter by name or email..."
                />
              )}
            </CardContent>
             <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{merchants.length}</strong> merchants
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
