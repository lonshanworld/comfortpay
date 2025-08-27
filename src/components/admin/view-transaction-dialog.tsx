

"use client"

import { useToast } from "@/hooks/use-toast";
import type { Order } from "@/lib/types";
import { Copy, User, Mail, Phone, Home, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import Link from "next/link";
import { Badge } from "../ui/badge";

interface ViewTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Order | null;
}

const DetailRow = ({ label, value, isCopyable = false, onCopy, children }: { label: string, value?: string | null, isCopyable?: boolean, onCopy?: (value: string) => void, children?: React.ReactNode }) => {
    if (!value && !children) return null;
    return (
        <div className="grid grid-cols-3 gap-2 text-sm items-center py-1.5">
            <p className="text-muted-foreground col-span-1">{label}</p>
            <div className="col-span-2 font-medium break-words flex items-center gap-2">
                {children ? children : <span>{value}</span>}
                {isCopyable && value && onCopy && (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCopy(value)}
                        >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="sr-only">Copy {label}</span>
                    </Button>
                )}
            </div>
        </div>
    )
}


export function ViewTransactionDialog({ open, onOpenChange, transaction }: ViewTransactionDialogProps) {
    const { toast } = useToast();

    const handleCopy = (value: string, fieldName: string) => {
        navigator.clipboard.writeText(value);
        toast({
            title: "Copied to clipboard",
            description: `${fieldName} has been copied.`,
        });
    }

    if (!transaction) return null;

    const fullName = `${transaction.billingDetails?.firstName || ''} ${transaction.billingDetails?.lastName || ''}`.trim() || transaction.customerName;
    const fullAddress = [transaction.billingDetails?.address1, transaction.billingDetails?.address2, transaction.billingDetails?.city, transaction.billingDetails?.state, transaction.billingDetails?.postcode, transaction.billingDetails?.country].filter(Boolean).join(', ');
    const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>
            Full details for transaction {transaction.id}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 py-4 pr-6">
                <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">Transaction Information</h4>
                     <div className="space-y-1">
                        <DetailRow label="ComfortPay ID" value={transaction.id} isCopyable onCopy={(v) => handleCopy(v, "ComfortPay ID")} />
                        <DetailRow label="Merchant Transaction ID" value={transaction.merchantOrderId} isCopyable onCopy={(v) => handleCopy(v, "Merchant Transaction ID")} />
                        <DetailRow label="Gateway Txn ID" value={transaction.paymentGatewayTransactionId} isCopyable onCopy={(v) => handleCopy(v, "Gateway Transaction ID")} />
                        <DetailRow label="Status"><Badge>{transaction.status}</Badge></DetailRow>
                        <DetailRow label="Transaction Date" value={new Date(transaction.orderDate).toLocaleString()} />
                        <DetailRow label="Payment Received" value={transaction.paymentReceivedDate ? new Date(transaction.paymentReceivedDate).toLocaleString() : 'N/A'} />
                        <DetailRow label="Transaction Amount" value={formatCurrency(transaction.orderAmount, transaction.currency)} />
                        <DetailRow label="Total Amount" value={formatCurrency(transaction.totalAmount, transaction.currency)} />
                        <DetailRow label="Paid Amount">
                           <div className="flex flex-col items-start">
                             <span>{formatCurrency(transaction.paidAmount, transaction.currency)}</span>
                              {transaction.paidAmount > transaction.totalAmount && (
                                <Badge variant="destructive" className="mt-1">
                                    Refund Due: {formatCurrency(transaction.paidAmount - transaction.totalAmount, transaction.currency)}
                                </Badge>
                               )}
                           </div>
                        </DetailRow>
                        <DetailRow label="Payment Method" value={`${transaction.paymentType} (${transaction.paymentMethod})`} />
                     </div>
                </section>
                <Separator />
                <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">Merchant & Source Details</h4>
                     <div className="space-y-1">
                        <DetailRow label="Merchant Name">
                           <Link href={transaction.merchantWebsiteUrl || '#'} target="_blank" className="flex items-center gap-1.5 hover:underline">
                                {transaction.merchantName} <ExternalLink className="h-3 w-3" />
                            </Link>
                        </DetailRow>
                        <DetailRow label="Merchant ID" value={transaction.merchantId} isCopyable onCopy={(v) => handleCopy(v, "Merchant ID")} />
                        <DetailRow label="Source Website">
                           {transaction.sourceWebsiteUrl ? (
                                <Link href={transaction.sourceWebsiteUrl} target="_blank" className="flex items-center gap-1.5 hover:underline">
                                    {transaction.sourceWebsiteUrl} <ExternalLink className="h-3 w-3" />
                                </Link>
                           ) : (
                                <span className="text-muted-foreground">N/A</span>
                           )}
                        </DetailRow>
                     </div>
                </section>
                <Separator />
                 <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">Customer Billing Information</h4>
                    <div className="space-y-1">
                      <DetailRow label="Name" value={fullName} />
                      <DetailRow 
                          label="Email" 
                          value={transaction.customerEmail}
                          isCopyable
                          onCopy={(v) => handleCopy(v, 'Customer Email')} 
                      />
                       <DetailRow 
                          label="Phone" 
                          value={transaction.billingDetails?.phone}
                          isCopyable
                          onCopy={(v) => handleCopy(v, 'Customer Phone')} 
                      />
                      <DetailRow label="Address" value={fullAddress} />
                    </div>
                </section>
            </div>
        </ScrollArea>
         <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
