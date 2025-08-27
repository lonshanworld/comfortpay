
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
import { useState } from "react"

export default function SaleAgentSettingsPage() {
    const { toast } = useToast()
    const [isPasswordSaving, setIsPasswordSaving] = useState(false)

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
                <Input id="name" defaultValue="Agent Smith" disabled />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="agent.smith@comfortpay.com" disabled />
                 <p className="text-xs text-muted-foreground">
                    Your name and email address cannot be changed.
                </p>
            </div>
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
