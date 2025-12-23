
"use client"

import { useToast } from "@/hooks/use-toast";
import type { GatewayFee, Merchant, User, Fee } from "@/lib/types";
import { Copy, FileText, Image as ImageIcon, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
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
import { useEffect, useState } from "react";
import { Progress } from "../ui/progress";
import { cn } from "@/lib/utils";

interface ViewMerchantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchant: Merchant | null;
}

const DetailRow = ({ label, value, isCopyable = false, onCopy, children }: { label: string, value?: string | number | null, isCopyable?: boolean, onCopy?: (value: string) => void, children?: React.ReactNode }) => {
    if ((value === null || value === undefined || value === '') && !children) return null;
    const displayValue = typeof value === 'number' ? value.toString() : value;
    return (
        <div className="grid grid-cols-3 gap-2 text-sm items-center py-1.5">
            <p className="text-muted-foreground col-span-1">{label}</p>
            <div className="col-span-2 font-medium break-words flex items-center gap-2">
                {children ? children : <span>{displayValue}</span>}
                {isCopyable && onCopy && displayValue && (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCopy(displayValue)}
                        >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="sr-only">Copy {label}</span>
                    </Button>
                )}
            </div>
        </div>
    )
}

const DocumentRow = ({ label, url, type }: { label: string, url?: string, type: 'image' | 'document' }) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const fullUrl = url ? `${appUrl}${url}` : null;
  
  if (!fullUrl) {
    return (
       <div className="grid grid-cols-3 gap-2 text-sm items-center py-1.5">
          <p className="text-muted-foreground col-span-1">{label}</p>
          <div className="col-span-2 text-muted-foreground italic">Not provided</div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2 text-sm items-center py-1.5">
        <p className="text-muted-foreground col-span-1">{label}</p>
        <div className="col-span-2 font-medium break-words flex items-center gap-2">
            <Link href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-2">
               {type === 'image' ? <ImageIcon className="h-4 w-4"/> : <FileText className="h-4 w-4" />}
               View Document <ExternalLink className="h-3.5 w-3.5" />
            </Link>
        </div>
    </div>
  )
}

const FeeDetailRow = ({ label, fee, isPercentage = false, isFixed = false }: { label: string, fee?: Fee, isPercentage?: boolean, isFixed?: boolean }) => {
    // A fee is considered not set if the fee object itself is missing, or if its value is undefined or null.
    if (!fee || typeof fee.value !== 'number') {
        return <DetailRow label={label} value="N/A" />;
    }

    const value = fee.value || 0;
    let displayValue;

    if (isPercentage) {
        displayValue = `${value}%`;
    } else { // Flat fee or fixed amount
        displayValue = `$${Number(value).toFixed(2)}`;
    }
    
    return <DetailRow label={label} value={displayValue} />;
}


const GatewayFeeDetails = ({ name, fees }: { name: string, fees?: GatewayFee }) => {
    // Check if the gateway object exists and has an 'enabled' property
    if (!fees || typeof fees.enabled === 'undefined') {
        return (
             <div className="p-3 rounded-lg border bg-muted/50">
                 <h5 className="font-semibold capitalize flex items-center gap-2 mb-2"><XCircle className="h-4 w-4 text-destructive"/>{name}</h5>
                <p className="text-sm text-muted-foreground">Not configured</p>
            </div>
        )
    }
    return (
        <div className="p-3 rounded-lg border">
            <h5 className="font-semibold capitalize flex items-center gap-2 mb-2">
                 { fees.enabled ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                 {name}
            </h5>
            {fees.enabled ? (
                 <div className="space-y-1 pl-6">
                    <FeeDetailRow label="Transaction Fee (%)" fee={fees.transactionFee} isPercentage />
                    <FeeDetailRow label="Transaction Fixed Fee" fee={fees.transactionFeeFixed} isFixed />
                    <FeeDetailRow label="Refund Fee" fee={fees.refundFee} isFixed />
                    <FeeDetailRow label="Chargeback Fee" fee={fees.chargebackFee} isFixed />
                </div>
            ) : (
                <p className="text-sm text-muted-foreground pl-6">This gateway is disabled for the merchant.</p>
            )}
        </div>
    )
}


export function ViewMerchantDialog({ open, onOpenChange, merchant }: ViewMerchantDialogProps) {
    const { toast } = useToast();
    const [salesAgent, setSalesAgent] = useState<User | null>(null);

    useEffect(() => {
        if (open && merchant?.salesAgentId) {
            const fetchAgent = async () => {
                try {
                    const res = await fetch(`/api/users/${merchant.salesAgentId}`);
                    if(res.ok) {
                        const data = await res.json();
                        console.log("Fetched sales agent data:", data);
                        setSalesAgent(data);
                    } else {
                        setSalesAgent(null);
                    }
                } catch (error) {
                    console.error("Failed to fetch sales agent", error);
                    setSalesAgent(null);
                }
            };
            fetchAgent();
        } else if (!open) {
            setSalesAgent(null);
        }
    }, [open, merchant]);

    const handleCopy = (value: string, fieldName: string) => {
        navigator.clipboard.writeText(value);
        toast({
            title: "Copied to clipboard",
            description: `${fieldName} has been copied.`,
        });
    }

    if (!merchant) return null;

     const dateString = merchant.dateJoined as string;
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const dateJoined = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'GMT',
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merchant Details</DialogTitle>
          <DialogDescription>
            Full details for {merchant.name}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 py-4 pr-6">
                <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">General Information</h4>
                     <div className="space-y-1">
                        <DetailRow label="Merchant ID" value={merchant.id} />
                        <DetailRow label="Full Name" value={merchant.name} />
                        <DetailRow label="Login Email" value={merchant.email} />
                        <DetailRow label="API Token" value={merchant.token} isCopyable onCopy={(v) => handleCopy(v, 'API Token')} />
                        <DetailRow label="Order ID Prefix" value={merchant.orderIdPrefix || "Not Set"} />
                        <DetailRow label="Daily Processing Limit" value={typeof (merchant as any).dailyLimit === 'number' ? `$${Number((merchant as any).dailyLimit).toFixed(2)}` : 'Not Set'} />
                        <DetailRow label="Status"><Badge variant={merchant.status === 'Active' ? "secondary" : "destructive"}>{merchant.status}</Badge></DetailRow>
                        <DetailRow label="Date Joined" value={dateJoined} />
                        {merchant.websiteUrl && <DetailRow label="Website" value={merchant.websiteUrl} />}
                     </div>
                </section>
                <Separator />
                <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">Personal & ID</h4>
                     <div className="space-y-1">
                        <DetailRow label="Nationality" value={merchant.nationality} />
                        <DetailRow label="Date of Birth" value={merchant.dateOfBirth ? new Date(merchant.dateOfBirth).toLocaleDateString('en-US', { timeZone: 'GMT' }) : undefined} />
                        <DetailRow label="ID Type" value={merchant.idType} />
                        <DocumentRow label="Photo ID" url={merchant.photoIdUrl} type="image"/>
                        <DocumentRow label="Business Document" url={merchant.businessDocumentUrl} type="document" />
                     </div>
                </section>
                <Separator />
                 <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">Banking Details</h4>
                    <div className="space-y-1">
                      <DetailRow label="Bank Name" value={merchant.bankName} />
                      <DetailRow 
                          label="Account Number" 
                          value={merchant.bankAccountNumber}
                          isCopyable={!!merchant.bankAccountNumber}
                          onCopy={(value) => handleCopy(value, 'Bank Account Number')} 
                      />
                      <DetailRow label="Account Type" value={merchant.bankAccountType} />
                      <DetailRow 
                          label="Bank Email" 
                          value={merchant.bankEmail}
                          isCopyable={!!merchant.bankEmail}
                          onCopy={(value) => handleCopy(value, 'Bank Email')} 
                      />
                    </div>
                </section>
                <Separator />
                <section>
                    <h4 className="text-sm font-semibold text-primary mb-2">Crypto Wallet</h4>
                    <div className="space-y-1">
                      <DetailRow 
                          label="Wallet Address" 
                          value={merchant.walletAddress}
                          isCopyable={!!merchant.walletAddress}
                          onCopy={(value) => handleCopy(value, 'Wallet Address')}
                      />
                      <DetailRow label="Network" value={merchant.network} />
                    </div>
                </section>
                 <Separator />
                <section>
                    <h4 className="text-sm font-semibold text-primary mb-2">Settlement Fees</h4>
                    <div className="space-y-1">
                      <FeeDetailRow label="Domestic Transfer" fee={merchant.settlementFees?.domesticTransferFee} isFixed />
                      <FeeDetailRow label="International Transfer" fee={merchant.settlementFees?.internationalTransferFee} isFixed />
                      <FeeDetailRow label="Crypto Transfer" fee={merchant.settlementFees?.cryptoTransferFee} isPercentage />
                    </div>
                </section>
                 <Separator />
                <section>
                    <h4 className="text-sm font-semibold text-primary mb-2">Payment Gateway Fees & Status</h4>
                    <div className="space-y-2">
                                                        <GatewayFeeDetails name="Stripe" fees={merchant.paymentGatewayFees?.stripe} />
                                                        <GatewayFeeDetails name="Square" fees={merchant.paymentGatewayFees?.square} />
                                                        <GatewayFeeDetails name="Zelle" fees={merchant.paymentGatewayFees?.zelle} />
                                                        <GatewayFeeDetails name="Interac" fees={merchant.paymentGatewayFees?.interac} />
                                                        <GatewayFeeDetails name="Wise" fees={merchant.paymentGatewayFees?.wise} />
                    </div>
                </section>
                 <Separator />
                                        <section>
                                                <h4 className="text-sm font-semibold text-primary mb-2">Merchant Daily Limits</h4>
                                                <div className="space-y-1">
                                                    {(() => {
                                                        console.log("Rendering Merchant Daily Limits...", merchant);
                                                        const limits = (merchant as any).merchantDailyLimits || {};
                                                        console.log("Merchant Daily Limits:", limits);
                                                        const getDisplay = (pType: string) => {
                                                            const row = limits[pType];
                                                              const dailyLimit = row && row.dailyLimit != null ? `$${Number(row.dailyLimit).toFixed(2)}` : 'Unlimited';
                                                              // `dailyUsed` is a numeric usage counter (not a currency label) — display as a plain number with two decimals.
                                                              const dailyUsed = row && row.dailyUsed != null ? Number(row.dailyUsed).toFixed(2) : '0.00';
                                                            return { dailyLimit, dailyUsed };
                                                        };
                                                        const rows = [
                                                            { key: 'stripe', label: 'Stripe' },
                                                            { key: 'square', label: 'Square' },
                                                            { key: 'zelle', label: 'Zelle' },
                                                            { key: 'interac', label: 'Interac' },
                                                            { key: 'wise', label: 'Wise' },
                                                        ];
                                                        return rows.map(r => {
                                                            const d = getDisplay(r.key);
                                                            const currentUsed = d.dailyUsed;
                                                            const limit = d.dailyLimit ?? 0;
                                                            const isOverLimit = limit !== 'Unlimited' && Number(limit.replace('$','')) > 0 && Number(currentUsed) >= Number(limit.replace('$',''));
                                                            const progressValue = limit !== 'Unlimited' && Number(limit.replace('$','')) > 0 ? (Number(currentUsed) / Number(limit.replace('$',''))) * 100 : 0;
                                                            return (
                                                                <div className="flex flex-row justify-center items-center gap-4">
                                                                    <span className="font-medium mb-1">{r.label}</span>
                                                                    <div className="w-48">
                                                                    <div className={cn("flex justify-between text-xs mb-1", isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground")}>
                                                                        <span>{currentUsed}</span>
                                                                        <span>{limit}</span>
                                                                    </div>
                                                                    <Progress value={progressValue} className={cn("h-2", isOverLimit && "[&>div]:bg-destructive")} />
                                                                </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                        </section>
                <section>
                    <h4 className="text-sm font-semibold text-primary mb-2">Sales & Commission</h4>
                    <div className="space-y-1">
                      <DetailRow label="Assigned Agent" value={salesAgent?.name || 'N/A'} />
                      <FeeDetailRow label="Stripe Commission" fee={merchant.commissionRates?.stripe} isPercentage />
                      <FeeDetailRow label="Square Commission" fee={merchant.commissionRates?.square} isPercentage />
                      <FeeDetailRow label="Zelle Commission" fee={merchant.commissionRates?.zelle} isPercentage />
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
