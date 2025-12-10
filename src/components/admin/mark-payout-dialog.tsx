
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { PayoutData } from "@/lib/types"
import { createPayouts } from "@/app/actions/create-payout"

const formSchema = z.object({
  settlementId: z.string().optional(),
  transferFees: z.coerce.number().min(0, "Transfer fees cannot be negative.").optional(),

});

type FormValues = z.infer<typeof formSchema>;

interface MarkPayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPayouts: PayoutData[];
  onSuccess: () => void;
}

export function MarkPayoutDialog({ open, onOpenChange, selectedPayouts, onSuccess }: MarkPayoutDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      settlementId: "",
      transferFees: 0,
    },
  });

  const totalNetAmount = selectedPayouts.reduce((sum, p) => sum + p.netAmount, 0);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const result = await createPayouts({
        settlementId: values.settlementId,
        transferFees: values.transferFees || 0,
        payouts: selectedPayouts.map(p => ({
          orderId: p.orderId,
          merchantId: p.merchantId, // Use the correct merchantId from the selected data
          grossAmount: p.grossAmount,
          gatewayFee: p.gatewayFee,
          netAmount: p.netAmount,
        }))
      });

      if (result.success) {
        toast({
          title: "Payouts Processed",
          description: result.message,
        });
        form.reset();
        onOpenChange(false);
        onSuccess();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Process Payouts",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Payout Batch</DialogTitle>
          <DialogDescription>
            You are creating a payout batch for <strong>{selectedPayouts.length}</strong> transactions totaling <strong>${totalNetAmount.toFixed(2)}</strong>.
             Enter a reference ID to mark as "Paid", or leave it blank to mark as "In-Settlement".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="settlementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Settlement / Reference ID (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Bank Transfer ID, Check #" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="transferFees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Transfer Fees (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g., 5.00" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormDescription>
                    This fee will be applied to the entire batch.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm and Process
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
