
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
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { changePassword } from "@/app/actions/user"
import { useRouter } from "next/navigation"

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;


export default function MerchantSettingsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [merchant, setMerchant] = useState<Merchant | null>(null);

     const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

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

    const handleChangePassword = async (data: PasswordFormValues) => {
        if (!merchant) return;
        setIsPasswordSaving(true);
        try {
            const result = await changePassword({
                userId: merchant.id,
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });

            if (result.success) {
                toast({
                    title: "Password Updated",
                    description: result.message,
                });
                setTimeout(() => {
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('userId');
                    router.push('/login/merchant');
                }, 2000);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: error.message || "An unknown error occurred.",
            });
        } finally {
            setIsPasswordSaving(false);
        }
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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleChangePassword)}>
                <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                    For security, you will be logged out after changing your password.
                </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                 <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                            <Input type="password" {...field} disabled={isPasswordSaving} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} disabled={isPasswordSaving}/>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} disabled={isPasswordSaving} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isPasswordSaving}>
                    {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                </Button>
                </CardFooter>
            </form>
         </Form>
      </Card>
    </div>
  )
}
