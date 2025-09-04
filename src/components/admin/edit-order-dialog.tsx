
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import type { Order, OrderStatus, PaymentMethod, PaymentType } from "@/lib/types";
import { ScrollArea } from "../ui/scroll-area";


const transactionFormSchema = z.object({
  merchantOrderId: z.string().min(1, "Merchant Transaction ID is required."),
  customerName: z.string().min(2, "Customer name is required."),
  customerEmail: z.string().email("Please enter a valid email."),
  status: z.enum(["Pending", "Completed", "Failed", "Requires Confirmation", "Refunded", "Reconciled", "Partially Paid"]),
  orderAmount: z.coerce.number().positive("Amount must be a positive number."),
  totalAmount: z.coerce.number().positive("Amount must be a positive number."),
  paidAmount: z.coerce.number().min(0, "Amount must be zero or positive."),
  paymentMethod: z.enum(["Credit Card", "Zelle"]),
  paymentType: z.enum(["Stripe", "Square", "Zelle"]),
  orderDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  paymentReceivedDate: z.string().optional().or(z.literal('')).refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date format" }),
});


type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
  order: Order | null;
}

const toDateTimeLocal = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
        const date = new Date(isoString);
        // Directly format to YYYY-MM-DDTHH:mm which <input type="datetime-local"> requires.
        // This keeps the time in the user's local timezone for the input, which is expected behavior for this control.
        // The display will be local, but the submission will be converted back to ISO string (UTC).
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        return "";
    }
};


export function EditOrderDialog({ open, onOpenChange, onOrderUpdated, order: transaction }: EditTransactionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
  });

  useEffect(() => {
    if (transaction && open) {
        form.reset({
          merchantOrderId: transaction.merchantOrderId,
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          status: transaction.status,
          orderAmount: transaction.orderAmount,
          totalAmount: transaction.totalAmount,
          paidAmount: transaction.paidAmount,
          paymentMethod: transaction.paymentMethod,
          paymentType: transaction.paymentType,
          orderDate: toDateTimeLocal(transaction.orderDate),
          paymentReceivedDate: toDateTimeLocal(transaction.paymentReceivedDate)
        });
    }
  }, [transaction, open, form]);

  const onSubmit = async (values: TransactionFormValues) => {
    if (!transaction) return;
    setIsLoading(true);

    const dataToSubmit = {
        ...values,
        // Convert local input time back to UTC ISO string for the server
        orderDate: values.orderDate ? new Date(values.orderDate).toISOString() : undefined,
        paymentReceivedDate: values.paymentReceivedDate ? new Date(values.paymentReceivedDate).toISOString() : undefined,
    }


    try {
      const response = await fetch(`/api/orders/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }
      
      toast({
        title: "Transaction Updated",
        description: `Transaction ${transaction.id} has been updated successfully.`,
      });

      onOpenChange(false);
      onOrderUpdated();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem updating the transaction. Please try again.",
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

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Transaction {transaction.id}</DialogTitle>
          <DialogDescription>
            Update the details for this transaction. All times are in GMT.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <ScrollArea className="max-h-[70vh]">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 pr-4">
               <FormField
                control={form.control}
                name="merchantOrderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant Transaction ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., WC-12345" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Failed">Failed</SelectItem>
                          <SelectItem value="Requires Confirmation">Requires Confirmation</SelectItem>
                          <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                          <SelectItem value="Refunded">Refunded</SelectItem>
                          <SelectItem value="Reconciled">Reconciled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="orderAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transaction Amount</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.01" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="totalAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Amount</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.01" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="paidAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Paid Amount</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.01" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
               <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Zelle">Zelle</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Processor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a processor" />
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
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="orderDate"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transaction Date (GMT)</FormLabel>
                            <FormControl>
                            <Input type="datetime-local" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="paymentReceivedDate"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Received Date (GMT)</FormLabel>
                            <FormControl>
                            <Input type="datetime-local" {...field} disabled={isLoading} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              <Separator className="my-4" />
              <h4 className="text-sm font-semibold text-primary">Customer Information</h4>
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sticky bottom-0 bg-background/95 pt-4">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    