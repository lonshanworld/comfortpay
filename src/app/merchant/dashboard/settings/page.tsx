
"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Copy, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import type { Merchant } from "@/lib/types"

export default function MerchantSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [merchant, setMerchant] = useState<Merchant | null>(null);

    useEffect(() => {
        const fetchMerchant = async () => {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/merchants/${userId}`);
                if (response.ok) {
                    const data = await response.json();
                    setMerchant(data);
                } else {
                    throw new Error("Failed to fetch merchant details");
                }
            } catch (error) {
                 toast({
                    variant: "destructive",
                    title: "Failed to load data",
                    description: "Could not retrieve your merchant details.",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchMerchant();
    }, [toast]);

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault()
        setIsPasswordSaving(true)
        // Simulate API call
        setTimeout(() => {
            setIsPasswordSaving(false)
            toast({
                title: "Password Updated",
                description: "Your password has been changed successfully.",
            })
        }, 1500)
    }
    
    const handleCopyToken = () => {
        if (!merchant?.token) return;
        navigator.clipboard.writeText(merchant.token);
        toast({
            title: "Copied to clipboard!",
            description: "Your API token has been copied.",
        });
    }

    if (isLoading) {
        return (
            <div className="flex flex-1 justify-center items-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    if (!merchant) {
         return (
            <div className="flex flex-1 justify-center items-center">
                <p className="text-muted-foreground">Could not load merchant information.</p>
            </div>
        )
    }

  return (
    <div className="grid gap-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
                Manage your account settings and preferences.
            </p>
        </div>
        <Separator />
        <Card>
            <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
                Your personal details.
            </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue={merchant.name} disabled />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={merchant.email} disabled />
                 <p className="text-xs text-muted-foreground">
                    Your name and email address cannot be changed.
                </p>
            </div>
            </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>API Token</CardTitle>
          <CardDescription>
            Use this token to integrate with the ComfortPay WooCommerce plugin.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-2">
                <Input id="token" value={merchant.token || "No token generated"} readOnly />
                <Button type="button" size="sm" className="px-3" onClick={handleCopyToken} disabled={!merchant.token}>
                    <span className="sr-only">Copy</span>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-2">
                This token is a secret. Do not share it. Only admins can regenerate this token.
            </p>
        </CardContent>
      </Card>
       <Card>
         <form onSubmit={handleChangePassword}>
            <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
                For security, you will be logged out after changing your password.
            </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" disabled={isPasswordSaving} />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" disabled={isPasswordSaving}/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" disabled={isPasswordSaving} />
                </div>
            </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isPasswordSaving}>
                {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
            </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  )
}
