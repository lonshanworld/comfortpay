
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type { PaymentAccount, PaymentAccountType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { KeyRound, Loader2, PlusCircle, ExternalLink } from "lucide-react"
import { AddAccountDialog } from "@/components/admin/add-account-dialog"
import { EditAccountDialog } from "@/components/admin/edit-account-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const AccountCard = ({ account, onManage }: { account: PaymentAccount, onManage: (account: PaymentAccount) => void }) => {
    const currentVolume = Number(account.currentVolume);
    const dailyLimit = Number(account.dailyLimit);
    
    const isOverLimit = dailyLimit > 0 && currentVolume >= dailyLimit;
    const progressValue = dailyLimit > 0 ? (currentVolume / dailyLimit) * 100 : 0;
  
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{account.name}</CardTitle>
              <CardDescription>{account.type} Account</CardDescription>
            </div>
            <Badge variant={account.status === 'Active' ? "secondary" : "destructive"}>{account.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
           <div>
            <p className="text-sm font-medium text-muted-foreground">Account ID</p>
            <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded-md">{account.id}</p>
          </div>
           {account.websiteUrl && (
            <div>
                <p className="text-sm font-medium text-muted-foreground">Source Website</p>
                <Link href={account.websiteUrl} target="_blank" className="text-sm flex items-center gap-1.5 hover:underline text-primary">
                    {new URL(account.websiteUrl).hostname} <ExternalLink className="h-3 w-3" />
                </Link>
            </div>
           )}
           {account.type === 'Zelle' && account.accountEmail && (
            <div>
                <p className="text-sm font-medium text-muted-foreground">Zelle Email</p>
                <p className="text-sm">{account.accountEmail}</p>
            </div>
           )}
            {account.type === 'Zelle' && account.qrCodeUrl && (
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">QR Code</p>
                    <div className="relative w-32 h-32">
                        <Image
                            src={account.qrCodeUrl}
                            alt="Zelle QR Code"
                            layout="fill"
                            objectFit="contain"
                            className="rounded-md border p-1"
                        />
                    </div>
                </div>
            )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Order Prefix</p>
            <p className="text-sm font-semibold">{account.prefix_order_name || "Not Set"}</p>
          </div>
          <div>
            <div className={cn("flex justify-between text-sm mb-1", isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground")}>
                <span>Daily Volume</span>
                <span>${currentVolume.toLocaleString()} / ${dailyLimit.toLocaleString()}</span>
            </div>
            <Progress value={progressValue} className={cn(isOverLimit && "[&>div]:bg-destructive")} />
          </div>
          <Button variant="outline" size="sm" onClick={() => onManage(account)}>Manage Account</Button>
        </CardContent>
      </Card>
    )
}

const AccountGrid = ({ accounts, type, onManage }: { accounts: PaymentAccount[], type: PaymentAccountType, onManage: (account: PaymentAccount) => void }) => {
  const filteredAccounts = accounts.filter((acc) => acc.type === type)
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredAccounts.map((account) => (
        <AccountCard key={account.id} account={account} onManage={onManage}/>
      ))}
    </div>
  )
}

export default function PaymentsPage() {
    const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
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


  return (
    <div className="flex flex-col gap-4">
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
            For security, API keys (both secret and publishable) are not stored in the database. They must be managed as environment variables. Use the unique <strong>Account ID</strong> shown on each card to name your variables.
            <br/>
            Example for an account with ID <strong>pa_123</strong>:
            <ul className="list-disc list-inside pl-2 font-mono text-xs">
                <li>SECRET_KEY_pa_123=sk_test_...</li>
                <li>PUBLIC_KEY_pa_123=pk_test_...</li>
            </ul>
          </AlertDescription>
        </Alert>
      <Tabs defaultValue="stripe">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="square">Square</TabsTrigger>
          <TabsTrigger value="zelle">Zelle</TabsTrigger>
        </TabsList>
        {isLoading ? (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ) : (
        <>
            <TabsContent value="stripe" className="mt-4">
            <AccountGrid accounts={accounts} type="Stripe" onManage={handleManageClick} />
            </TabsContent>
            <TabsContent value="square" className="mt-4">
            <AccountGrid accounts={accounts} type="Square" onManage={handleManageClick}/>
            </TabsContent>
            <TabsContent value="zelle" className="mt-4">
            <AccountGrid accounts={accounts} type="Zelle" onManage={handleManageClick}/>
            </TabsContent>
        </>
        )}
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
  )
}
