
"use client"

import { useState, useEffect, useMemo } from "react";
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
  FormDescription,
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
import { Loader2, Trash, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PaymentAccount, PaymentAccountType } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { ScrollArea } from "../ui/scroll-area";

const accountFormSchema = z.object({
  name: z.string().min(3, "Account name must be at least 3 characters."),
  type: z.enum(["Stripe", "Square", "Zelle", "Interac", "Wise"]),
  status: z.enum(["Active", "Inactive"]),
  dailyLimit: z.coerce.number().positive("Daily limit must be a positive number."),
  prefix_order_name: z.string().optional(),
  websiteUrl: z.string().optional().or(z.literal('')),
  accountEmail: z.string().email("Please enter a valid email.").optional().or(z.literal('')),
  tag: z.string().optional().or(z.literal('')),
  qrCode: z.any().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "Zelle" || data.type === "Interac" || data.type === "Wise") {
    if (!data.accountEmail) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "account email is required.",
        path: ["accountEmail"],
      });
    }
  } else { // Stripe, Square
    if (!data.websiteUrl || !z.string().url().safeParse(data.websiteUrl).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid URL.",
        path: ["websiteUrl"],
      });
    }
  }
});


type AccountFormValues = z.infer<typeof accountFormSchema>;

interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountUpdated: () => void;
  onAccountDeleted: (accountId: string) => void;
  account: PaymentAccount | null;
}

// Helper to read file as Base64
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});


export function EditAccountDialog({ open, onOpenChange, onAccountUpdated, onAccountDeleted, account }: EditAccountDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
          tag: (account as any).tag || "",
        qrCode: null, // Reset file input
      });
    }
  }, [account, open, form]);

  const onSubmit = async (values: AccountFormValues) => {
    if (!account) return;
    setIsLoading(true);

    const dataToSubmit: any = { ...values };
    
    if (values.qrCode && values.qrCode instanceof File) {
        dataToSubmit.qrCode = await toBase64(values.qrCode);
    } else {
        delete dataToSubmit.qrCode;
    }

    try {
      const response = await fetch(`/api/payments/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
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

  const handleDelete = () => {
    if (!account) return;
    if (confirm(`Are you sure you want to delete account "${account.name}"? This action cannot be undone.`)) {
        setIsDeleting(true);
        onAccountDeleted(account.id);
        setIsDeleting(false);
    }
  };

   const handleOpenChange = (open: boolean) => {
    if (!isLoading && !isDeleting) {
      onOpenChange(open);
    }
  };

  const qrCodeUrlFromAccount = (account as any)?.qrCodeUrl || null;
  const qrPreviewUrl = useMemo(() => {
    if (!qrCodeUrlFromAccount) return null;
    if (qrCodeUrlFromAccount.startsWith('http') || qrCodeUrlFromAccount.startsWith('//')) return qrCodeUrlFromAccount;
    const uploadsHost = process.env.NEXT_PUBLIC_UPLOADS_HOST;
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
    const host = uploadsHost || origin;
    return `${host}${qrCodeUrlFromAccount}`;
  }, [qrCodeUrlFromAccount]);

  if (!account) return null;
  const selectedType = form.watch('type');
  const accountId = String(account.id).replace('pa_', '');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Payment Account</DialogTitle>
          <DialogDescription>
            Update details for {account.name} (ID: {accountId}).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <ScrollArea className="flex-grow pr-6 -mr-6 overflow-y-scroll">
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
                        <SelectItem value="Interac">Interac</SelectItem>
                        <SelectItem value="Wise">Wise</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(selectedType === 'Zelle' || selectedType === 'Interac' || selectedType === 'Wise') && (
                  <>
                  <FormField
                      control={form.control}
                      name="accountEmail"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Account / Email</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g., billing@company.com" {...field} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="tag"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Tag (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., @companyname" {...field} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="qrCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Upload New QR Code (Optional)</FormLabel>
                          <FormControl>
                            <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files?.[0])} disabled={isLoading} />
                          </FormControl>
                          <FormDescription>
                            Leave blank to keep the existing QR code.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  {qrCodeUrlFromAccount && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Current QR Code</p>
                      {qrPreviewUrl ? (
                        <img src={qrPreviewUrl} alt="QR Code" className="h-40 w-40 object-contain border" />
                      ) : (
                        <p className="text-sm text-muted-foreground">{qrCodeUrlFromAccount}</p>
                      )}
                      <a href={qrPreviewUrl || qrCodeUrlFromAccount} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Open image</a>
                    </div>
                  )}
                  </>
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
              {selectedType !== 'Zelle' && (
                  <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Source Website URL {selectedType !== 'Zelle' && <span className="text-destructive">*</span>}</FormLabel>
                      <FormControl>
                          <Input placeholder="https://your-source-website.com" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
              )}
              <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Environment Variable Configuration</AlertTitle>
                  <AlertDescription>
                      {selectedType === 'Stripe' && (
                          <div>
                          This account requires these .env variables, using the ID: <strong>{accountId}</strong>
                          <ul className="list-disc list-inside pl-2 font-mono text-xs mt-2">
                              <li>STRIPE_SECRET_KEY_{accountId}=sk_...</li>
                              <li>STRIPE_PUBLIC_KEY_{accountId}=pk_...</li>
                              <li>STRIPE_WEBHOOK_SECRET_{accountId}=whsec_...</li>
                          </ul>
                          </div>
                      )}
                      {selectedType === 'Square' && (
                          <div>
                          This account requires these .env variables, using the ID: <strong>{accountId}</strong>
                          <ul className="list-disc list-inside pl-2 font-mono text-xs mt-2">
                              <li>SQUARE_APP_ID_{accountId}=...</li>
                              <li>SQUARE_LOCATION_ID_{accountId}=...</li>
                              <li>SQUARE_ACCESS_TOKEN_{accountId}=...</li>
                              <li>SQUARE_WEBHOOK_SIGNATURE_KEY_{accountId}=...</li>
                          </ul>
                          </div>
                      )}
                      {(selectedType === 'Zelle' || selectedType === 'Wise' || selectedType === 'Interac') && (
                        <p>{selectedType} accounts do not require API keys.</p>
                      )}
                  </AlertDescription>
              </Alert>
            </form>
          </ScrollArea>
          <DialogFooter className="flex-shrink-0 pt-4">
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading || isDeleting} className="mr-auto">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                Delete Account
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
