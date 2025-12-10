
"use client"

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, Permissions } from "@/lib/types";
import { ScrollArea } from "../ui/scroll-area";

const permissionsList: { id: keyof Permissions; label: string, description: string }[] = [
  { id: "view_dashboard", label: "View Dashboard", description: "Can view the main dashboard and analytics." },
  { id: "view_transactions", label: "View Transactions", description: "Can view all transaction records." },
  { id: "edit_transactions", label: "Edit Transactions", description: "Can modify transaction details and status." },
  { id: "view_merchants", label: "View Merchants", description: "Can view the list of merchants." },
  { id: "edit_merchants", label: "Edit Merchants", description: "Can add, edit, and remove merchants." },
  { id: "view_users", label: "View Users", description: "Can view all users (excluding admins)." },
  { id: "edit_users", label: "Edit Users", description: "Can add, edit, and remove non-admin users." },
  { id: "manage_settings", label: "Manage Settings", description: "Can change platform-wide settings." },
];

const permissionsSchema = z.object({
  view_dashboard: z.boolean().default(false),
  view_transactions: z.boolean().default(false),
  edit_transactions: z.boolean().default(false),
  view_merchants: z.boolean().default(false),
  edit_merchants: z.boolean().default(false),
  view_users: z.boolean().default(false),
  edit_users: z.boolean().default(false),
  manage_settings: z.boolean().default(false),
});


type PermissionsFormValues = z.infer<typeof permissionsSchema>;

interface ManagePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionsUpdated: () => void;
  user: User | null;
}

export function ManagePermissionsDialog({ open, onOpenChange, onPermissionsUpdated, user }: ManagePermissionsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {},
  });
  
  useEffect(() => {
    if (user && open) {
        const getInitialPermissions = () => {
            if (!user.permissions) return {};
            // This is now robust and can handle both string and object types
            if (typeof user.permissions === 'string') {
                try {
                    return JSON.parse(user.permissions);
                } catch (e) {
                    console.error("Failed to parse user permissions:", e);
                    return {};
                }
            }
            return user.permissions;
        };

      const initialPermissions = permissionsList.reduce((acc, perm) => {
        acc[perm.id as keyof Permissions] = !!getInitialPermissions()[perm.id as keyof Permissions];
        return acc;
      }, {} as Record<keyof Permissions, boolean>);
      
      form.reset(initialPermissions);
    }
  }, [user, open, form]);

  const onSubmit = async (data: PermissionsFormValues) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const payload = { permissions: data };

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update permissions");
      }

      toast({
        title: "Permissions Updated",
        description: `Permissions for ${user.name} have been saved.`,
      });
      onPermissionsUpdated();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "There was a problem saving the permissions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Permissions</DialogTitle>
          <DialogDescription>
            Set access controls for staff user: <strong>{user.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-grow min-h-0">
                <ScrollArea className="flex-grow pr-4 -mr-4">
                    <div className="space-y-4 pb-4">
                        {permissionsList.map((permission) => (
                        <FormField
                            key={permission.id}
                            control={form.control}
                            name={permission.id}
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isLoading}
                                />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                <FormLabel>{permission.label}</FormLabel>
                                <FormDescription>
                                {permission.description}
                                </FormDescription>
                                </div>
                            </FormItem>
                            )}
                        />
                        ))}
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 flex-shrink-0">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Permissions
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
