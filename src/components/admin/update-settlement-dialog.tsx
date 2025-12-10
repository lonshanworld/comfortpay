
"use client"

import { useState, useEffect } from "react"
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
import { updatePayoutBatch } from "@/app/actions/create-payout"

const formSchema = z.object({
  settlementId: z.string().min(1, "Settlement ID is required."),
  transferFees: z.coerce.number().min(0, "Transfer fees cannot be negative.").optional(),

});

type FormValues = z.infer<typeof formSchema>;

interface UpdateSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  currentTransferFees?: number;
  onSuccess: () => void;
}

export function UpdateSettlementDialog({ open, onOpenChange, batchId, currentTransferFees, onSuccess }: UpdateSettlementDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      settlementId: "",
      transferFees: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        settlementId: "",
        transferFees: currentTransferFees || 0,
      });
    }
  }, [open, currentTransferFees, form]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const result = await updatePayoutBatch({
        batchId: batchId,
        settlementId: values.settlementId,
        transferFees: values.transferFees ?? 0,
      });

      if (result.success) {
        toast({
          title: "Batch Updated",
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
        title: "Failed to Update Batch",
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
          <DialogTitle>Update Settlement ID</DialogTitle>
          <DialogDescription>
            Enter the bank reference or settlement ID for batch <span className="font-mono">{batchId}</span>. This will mark all payouts in the batch as "Paid".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="settlementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Settlement / Reference ID</FormLabel>
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
                  <FormLabel>Total Transfer Fees</FormLabel>

                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g., 5.00" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormDescription>
                    This amount will be applied to the batch. If fees were added previously, they will be overwritten.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark as Paid
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
