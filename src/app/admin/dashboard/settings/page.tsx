
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
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
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

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const id = localStorage.getItem('userId');
        setUserId(id);
    }, []);

    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const handleChangePassword = async (data: PasswordFormValues) => {
        if (!userId) {
            toast({ variant: "destructive", title: "Error", description: "User session not found." });
            return;
        }
        setIsPasswordSaving(true);
        try {
            const result = await changePassword({
                userId,
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });

            if (result.success) {
                toast({
                    title: "Password Updated",
                    description: result.message,
                });
                // Log out the user
                setTimeout(() => {
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('userId');
                    router.push('/login/admin');
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

  return (
    <div className="grid gap-6 w-svw">
        <div
        className="w-11/12 grid gap-6">
               <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
                Manage your account settings and platform configurations.
            </p>
        </div>
        <Separator />
      <Card>
        <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>
            Update your personal details. This section is for display only.
        </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
        <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="Admin User" disabled />
        </div>
        <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="admin@comfortpay.com" disabled />
        </div>
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
    </div>
  )
}
