
"use client"

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PaymentAccount, PaymentAccountType } from "@/lib/types";

const accountFormSchema = z.object({
  name: z.string().min(3, "Account name must be at least 3 characters."),
  type: z.enum(["Stripe", "Square", "Zelle"]),
  status: z.enum(["Active", "Inactive"]),
  dailyLimit: z.coerce.number().positive("Daily limit must be a positive number."),
  prefix_order_name: z.string().optional(),
  websiteUrl: z.string().url("Please enter a valid URL."),
  accountEmail: z.string().email("Please enter a valid email for Zelle.").optional().or(z.literal('')),
}).refine(data => {
    if (data.type === "Zelle") {
        return !!data.accountEmail;
    }
    return true;
}, {
    message: "Zelle account email is required.",
    path: ["accountEmail"],
});


type AccountFormValues = z.infer<typeof accountFormSchema>;

interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountUpdated: () => void;
  account: PaymentAccount | null;
}

export function EditAccountDialog({ open, onOpenChange, onAccountUpdated, account }: EditAccountDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
  });

  useEffect(() => {
    if (account && open) {
      form.reset({
        name: account.name || "",
        type: account.type || "Stripe",
        status: account.status || "Active",
        dailyLimit: account.dailyLimit || 0,
        prefix_order_name: account.prefix_order_name || "",
        websiteUrl: account.websiteUrl || "",
        accountEmail: account.accountEmail || "",
      });
    }
  }, [account, open, form]);

  const onSubmit = async (values: AccountFormValues) => {
    if (!account) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/payments/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to update account');
      }
      
      toast({
        title: "Account Updated",
        description: `The ${values.type} account has been updated successfully.`,
      });

      onOpenChange(false);
      onAccountUpdated();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem updating the account. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
   const handleOpenChange = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Payment Account</DialogTitle>
          <DialogDescription>
            Update details for {account.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Stripe Primary" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Stripe">Stripe</SelectItem>
                      <SelectItem value="Square">Square</SelectItem>
                      <SelectItem value="Zelle">Zelle</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {account.type === 'Zelle' && (
                 <FormField
                    control={form.control}
                    name="accountEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Zelle Account / Email</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., billing@company.com" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
            )}
             <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
              control={form.control}
              name="dailyLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Volume Limit ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 10000" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="prefix_order_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Name Prefix (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Online Gadget Store" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="websiteUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Website URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://your-source-website.com" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
