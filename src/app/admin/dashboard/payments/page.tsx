
"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type { PaymentAccount } from "@/lib/types"
import { Loader2, PlusCircle } from "lucide-react"
import { AddAccountDialog } from "@/components/admin/add-account-dialog"
import { EditAccountDialog } from "@/components/admin/edit-account-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DataTable } from "@/components/admin/data-table"
import { columns as paymentAccountColumnsDefinition } from "./columns"

export default function PaymentsPage() {
    const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
    const [activeTab, setActiveTab] = useState("Stripe");
    const { toast } = useToast();

    const fetchAccounts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/payments/accounts');
            const data = await response.json();
            setAccounts(data);
        } catch (error) {
            console.error("Failed to fetch payment accounts", error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleAccountAdded = () => {
        fetchAccounts();
    }

    const handleAccountUpdated = () => {
      fetchAccounts();
    }

    const handleManageClick = (account: PaymentAccount) => {
        setSelectedAccount(account);
        setIsEditDialogOpen(true);
    }
    
    const handleAccountDeleted = async (accountId: string) => {
        try {
            const response = await fetch(`/api/payments/accounts/${accountId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete the account.');
            }
            toast({
                title: "Account Deleted",
                description: `Payment account ${accountId} has been successfully deleted.`
            });
            fetchAccounts();
            setIsEditDialogOpen(false);
        } catch (error) {
             toast({
                variant: 'destructive',
                title: "Deletion Failed",
                description: "There was a problem deleting the payment account."
            });
        }
    };
    
    const paymentAccountColumns = useMemo(() => paymentAccountColumnsDefinition({
      onManage: handleManageClick,
    }), []);
    
    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => acc.type === activeTab);
    }, [accounts, activeTab]);


  return (
    <div className="flex flex-col gap-4 w-svw">
        <div className="w-11/12">
          <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Payment Accounts</h1>
                <p className="text-muted-foreground">
                Manage your processor accounts and their daily limits.
                </p>
            </div>
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Account
              </span>
            </Button>
        </div>
         <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>API Key Management</AlertTitle>
          <AlertDescription>
            For security, API keys (both secret and publishable) are not stored in the database. They must be managed as environment variables. Use the numeric <strong>ID</strong> shown on each account to name your variables.
            <br/>
            Example for an account with ID <strong>123</strong>:
            <ul className="list-disc list-inside pl-2 font-mono text-xs">
                <li>STRIPE_SECRET_KEY_123=sk_test_...</li>
                <li>SQUARE_APP_ID_123=...</li>
            </ul>
          </AlertDescription>
        </Alert>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="Stripe">Stripe</TabsTrigger>
          <TabsTrigger value="Square">Square</TabsTrigger>
          <TabsTrigger value="Zelle">Zelle</TabsTrigger>
          <TabsTrigger value="Interac">Interac</TabsTrigger>
          <TabsTrigger value="Wise">Wise</TabsTrigger>
        </TabsList>
            <TabsContent value={activeTab} className="mt-4">
               <Card>
                <CardHeader>
                    <CardTitle>{activeTab} Accounts</CardTitle>
                    <CardDescription>
                       Manage all of your {activeTab} payment accounts.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DataTable 
                          columns={paymentAccountColumns} 
                          data={filteredAccounts}
                          filterColumnId="name"
                          filterPlaceholder="Filter by name..."
                        />
                    )}
                </CardContent>
               </Card>
            </TabsContent>
      </Tabs>
      <AddAccountDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onAccountAdded={handleAccountAdded} />
      <EditAccountDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        onAccountUpdated={handleAccountUpdated} 
        onAccountDeleted={handleAccountDeleted}
        account={selectedAccount} 
      />
        </div>
    </div>
  )
}
