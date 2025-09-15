
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
import type { PaymentAccountType } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

const accountFormSchema = z.object({
  name: z.string().min(3, "Account name must be at least 3 characters."),
  type: z.enum(["Stripe", "Square", "Zelle"]),
  dailyLimit: z.coerce.number().positive("Daily limit must be a positive number."),
  prefix_order_name: z.string().optional(),
  websiteUrl: z.string().optional().or(z.literal('')),
  accountEmail: z.string().email("Please enter a valid email for Zelle.").optional().or(z.literal('')),
  qrCode: z.any().optional(),
}).superRefine((data, ctx) => {
    if (data.type === "Zelle") {
        if (!data.accountEmail) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Zelle account email is required.",
                path: ["accountEmail"],
            });
        }
        if (data.qrCode && data.qrCode instanceof File) {
            if (!data.qrCode.type.startsWith("image/")) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Please upload a valid image file.",
                    path: ["qrCode"],
                });
            }
        }
    } else { // Stripe or Square
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

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded: () => void;
}

// Helper to read file as Base64
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});


export function AddAccountDialog({ open, onOpenChange, onAccountAdded }: AddAccountDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<PaymentAccountType>("Stripe");

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      type: "Stripe",
      dailyLimit: 10000,
      prefix_order_name: "",
      websiteUrl: "",
      accountEmail: "",
      qrCode: null,
    },
  });

   useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        const newType = value.type as PaymentAccountType;
        setSelectedType(newType);
        // Clear conditional errors when type changes
        if (newType !== 'Zelle') {
            form.clearErrors('accountEmail');
        }
        if (newType === 'Zelle') {
            form.clearErrors('websiteUrl');
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (values: AccountFormValues) => {
    setIsLoading(true);
    try {
      const dataToSubmit: any = { ...values };

      if (values.qrCode && values.qrCode instanceof File) {
        dataToSubmit.qrCode = await toBase64(values.qrCode);
      } else {
        delete dataToSubmit.qrCode;
      }

      const response = await fetch('/api/payments/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create account');
      }
      
      const newAccount = await response.json();

      toast({
        title: "Account Created",
        description: `The new ${values.type} account has been added successfully. Please add its API keys to your environment variables.`,
        duration: 9000,
      });

      onOpenChange(false);
      form.reset({ ...form.formState.defaultValues, type: values.type });
      onAccountAdded();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error.message || "There was a problem creating the account. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
   const handleOpenChange = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
       if (!open) {
        form.reset();
      }
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Payment Account</DialogTitle>
          <DialogDescription>
            Configure a new payment processor account for your platform.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <ScrollArea className="flex-grow pr-6 -mr-6">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
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
              {selectedType === 'Zelle' && (
                  <>
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
                  <FormField
                      control={form.control}
                      name="qrCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zelle QR Code (Optional)</FormLabel>
                          <FormControl>
                            <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files?.[0])} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
              )}
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
                      <Input placeholder="e.g., Online Purchase (leave blank for none)" {...field} disabled={isLoading} />
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
                    <FormLabel>Source Website URL {selectedType !== 'Zelle' && <span className="text-destructive">*</span>}</FormLabel>
                    <FormControl>
                      <Input placeholder="https://your-source-website.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Configuration Required</AlertTitle>
                  <AlertDescription>
                      {selectedType === 'Stripe' && (
                          <div>
                          After creating, add these to your .env file. Replace `[ID]` with the generated Account ID (e.g., 1, 2).
                          <ul className="list-disc list-inside pl-2 font-mono text-xs mt-2">
                              <li>STRIPE_SECRET_KEY_[ID]=sk_...</li>
                              <li>STRIPE_PUBLIC_KEY_[ID]=pk_...</li>
                              <li>STRIPE_WEBHOOK_SECRET_[ID]=whsec_...</li>
                          </ul>
                          </div>
                      )}
                      {selectedType === 'Square' && (
                          <div>
                          After creating, add these to your .env file. Replace `[ID]` with the generated Account ID.
                          <ul className="list-disc list-inside pl-2 font-mono text-xs mt-2">
                              <li>SQUARE_APP_ID_[ID]=...</li>
                              <li>SQUARE_LOCATION_ID_[ID]=...</li>
                              <li>SQUARE_ACCESS_TOKEN_[ID]=...</li>
                              <li>SQUARE_WEBHOOK_SIGNATURE_KEY_[ID]=...</li>
                          </ul>
                          </div>
                      )}
                      {selectedType === 'Zelle' && (
                        <p>Zelle accounts do not require API keys.</p>
                      )}
                  </AlertDescription>
              </Alert>
            </form>
          </ScrollArea>
          <DialogFooter className="flex-shrink-0 pt-4">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
