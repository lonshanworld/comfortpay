
"use client"

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/icons/logo"
import { CreditCard, Loader2, User, Mail, Phone, Home, ShoppingCart, X } from "lucide-react"
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { CreateCheckoutSessionInput, Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { sendOrderNotification } from '@/app/actions/send-order-notification';

const BillingDetail = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-1" />
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [sessionData, setSessionData] = useState<CreateCheckoutSessionInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModal, setIsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const token = searchParams.get('session');
    const displayMode = searchParams.get('display');
    if (displayMode === 'modal') {
      setIsModal(true);
    }
    if (token) {
      try {
        const decodedString = Buffer.from(token, 'base64').toString('utf8');
        const data = JSON.parse(decodedString) as CreateCheckoutSessionInput;
        setSessionData(data);
      } catch (e) {
        setError("Invalid or corrupted session token. Please return to the merchant and try again.");
      }
    } else {
      setError("No session token provided. Please return to the merchant and try again.");
    }
  }, [searchParams]);

  const postMessageToParent = (message: any) => {
    const targetOrigin = sessionData?.merchantOrigin || '*';
    // In production, you might want a stricter check than '*' if merchantOrigin is not available
    window.parent.postMessage(message, targetOrigin);
  }

  const handleClose = () => {
    postMessageToParent({ type: 'comfortPay:close' });
  }

  const handlePaymentSuccess = async (transactionId: string) => {
    if (!sessionData || !sessionData.comfortPayOrderId) return;
    setIsProcessing(true);
    
    let updatedOrder: Order | null = null;
     try {
        // Update order in DB
        const response = await fetch(`/api/orders/${sessionData.comfortPayOrderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'Completed', 
                paidAmount: sessionData.totalAmount, 
                paymentGatewayTransactionId: transactionId, 
                paymentReceivedDate: new Date().toISOString() 
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to update order status.");
        }
        
        updatedOrder = await response.json();

        // Attempt to send notifications, but don't block the user flow if it fails
        try {
            const merchantRes = await fetch(`/api/merchants/${updatedOrder.merchantId}/details`);
            const merchant = await merchantRes.json();
            if(merchant) {
                await Promise.all([
                    sendOrderNotification({ recipientType: 'customer', customerEmail: updatedOrder.customerEmail, merchantName: merchant.name, orderDetails: updatedOrder }),
                    sendOrderNotification({ recipientType: 'merchant', merchantEmail: merchant.email, merchantName: merchant.name, orderDetails: updatedOrder })
                ]);
            }
        } catch(emailError) {
             console.error("Failed to send notification emails:", emailError);
             // Log this error for internal review, but don't show it to the customer.
        }

    } catch (e: any) {
        console.error("Critical error during payment success handling:", e);
        toast({ variant: "destructive", title: "An Error Occurred", description: "Your payment was successful, but there was an issue updating your order. Please contact support." });
    }

    // This part runs regardless of notification success.
    const successPayload = {
        status: 'success',
        orderId: sessionData.merchantOrderId,
        comfortPayOrderId: sessionData.comfortPayOrderId,
        transactionId: transactionId,
        amount: sessionData.totalAmount.toFixed(2),
    };

    if (isModal) {
        postMessageToParent({ type: 'comfortPay:success', data: successPayload });
    } else {
        toast({ title: "Payment Successful!", description: `Transaction ${transactionId} has been processed.` });
        if (sessionData.redirectUrl) {
            setTimeout(() => {
                const url = new URL(sessionData.redirectUrl!);
                for (const [key, value] of Object.entries(successPayload)) {
                    url.searchParams.append(key, value.toString());
                }
                window.location.href = url.toString();
            }, 2000);
        } else {
            setIsProcessing(false);
        }
    }
  }

  const handleZelleConfirmation = async () => {
    if (!sessionData || !sessionData.comfortPayOrderId) return;
    setIsProcessing(true);

    let updatedOrder: Order | null = null;
    try {
        // Update order in DB
        const response = await fetch(`/api/orders/${sessionData.comfortPayOrderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Requires Confirmation' }),
        });
        if (!response.ok) throw new Error("Failed to update order status.");
        updatedOrder = await response.json();

    } catch (e: any) {
         console.error("Critical error during Zelle confirmation handling:", e);
         toast({ variant: "destructive", title: "An Error Occurred", description: "There was an issue submitting your order. Please contact support." });
         setIsProcessing(false);
         return; // Stop execution
    }

    const pendingPayload = {
        status: 'pending_confirmation',
        orderId: sessionData.merchantOrderId,
        comfortPayOrderId: sessionData.comfortPayOrderId,
        amount: sessionData.totalAmount.toFixed(2),
    };

    if(isModal) {
        postMessageToParent({ type: 'comfortPay:success', data: pendingPayload });
    } else {
        toast({
            title: "Transaction Received!",
            description: "Your transaction is pending confirmation. We will process it once payment is verified.",
        });

        if (sessionData.redirectUrl) {
            setTimeout(() => {
            const url = new URL(sessionData.redirectUrl!);
                for (const [key, value] of Object.entries(pendingPayload)) {
                url.searchParams.append(key, value.toString());
                }
            window.location.href = url.toString();
            }, 2000);
        } else {
            setIsProcessing(false);
        }
    }
  }
  
  if (error) {
    return (
       <div className={cn("container mx-auto max-w-4xl", isModal ? "p-0" : "py-12")}>
          <div className={cn("mb-12 flex justify-center", isModal ? "hidden": "")}>
            <Logo className="h-10 w-auto text-primary" />
          </div>
          <Card className={cn(isModal ? "border-none shadow-none rounded-none" : "")}>
             <CardContent className="p-6">
                 <div className="text-center text-destructive p-4 border border-destructive/50 rounded-lg">
                    <p className="font-bold">An Error Occurred</p>
                    <p className="text-sm">{error}</p>
                    { !isModal && <Button variant="secondary" className="mt-4" onClick={() => router.push('/')}>Go to Homepage</Button> }
                </div>
             </CardContent>
          </Card>
       </div>
    )
  }

  if (!sessionData) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )
  }

  const { totalAmount, merchantOrderId, paymentMethod, billingDetails, items } = sessionData;
  const fullName = [billingDetails.firstName, billingDetails.lastName].filter(Boolean).join(' ');
  const fullAddress = [billingDetails.address1, billingDetails.address2, billingDetails.city, billingDetails.state, billingDetails.postcode, billingDetails.country].filter(Boolean).join(', ');
  const visualOrderId = sessionData.visualOrderId || merchantOrderId;

  const renderCreditCardForm = () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="card-number">Card number</Label>
        <div className="relative">
          <Input id="card-number" placeholder="0000 0000 0000 0000" disabled={isProcessing} />
          <CreditCard className="absolute top-1/2 right-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="month">Expires</Label>
          <Input id="month" placeholder="MM/YY" disabled={isProcessing} />
        </div>
        <div className="grid gap-2 col-span-2">
          <Label htmlFor="cvc">CVC</Label>
          <Input id="cvc" placeholder="123" disabled={isProcessing} />
        </div>
      </div>
       <p className="text-xs text-muted-foreground">
         Your transaction will appear as &quot;{visualOrderId}&quot; on your statement.
      </p>
      <Button className="w-full" onClick={() => handlePaymentSuccess(`txn_${Date.now()}`)} disabled={isProcessing}>
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Pay ${totalAmount.toFixed(2)}
      </Button>
    </div>
  );

  const renderZelleForm = () => {
    return (
      <div className="space-y-4">
        <div className="text-sm p-4 bg-muted/50 rounded-lg">
          <p className="font-semibold">Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Open your Zelle-enabled banking app.</li>
            <li>Send <strong className="text-primary">${totalAmount.toFixed(2)}</strong> to <strong className="text-primary">billing@comfortpay.com</strong>.</li>
            <li>In the memo/reason field, enter this exact text: <strong className="text-primary">{visualOrderId}</strong>.</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">Your transaction will be processed once payment is manually confirmed by the merchant.</p>
        </div>
        <Button variant="outline" className="w-full" onClick={handleZelleConfirmation} disabled={isProcessing}>
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm & Complete Transaction
        </Button>
      </div>
    );
  }

  const renderInvalidMethod = () => (
    <div className="text-center text-destructive p-4 border border-destructive/50 rounded-lg">
      <p className="font-bold">Invalid Payment Method</p>
      <p className="text-sm">The payment method '{paymentMethod}' is not supported.</p>
       { !isModal && <Button variant="secondary" className="mt-4" onClick={() => router.push('/')}>Go to Homepage</Button> }
    </div>
  )
    
  return (
     <div className={cn("mx-auto max-w-4xl", isModal ? "p-0" : "container py-12")}>
        <div className={cn("mb-12 flex justify-center", isModal ? "hidden" : "")}>
            <Logo className="h-10 w-auto text-primary" />
        </div>
        { isModal && (
            <div className="flex justify-end p-2 absolute top-0 right-0">
                <Button variant="ghost" size="icon" onClick={handleClose}>
                    <X className="h-5 w-5 text-muted-foreground" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>
        )}
        <div className={cn("grid gap-8 items-start", isModal ? "grid-cols-1" : "md:grid-cols-2")}>
             <div className="space-y-8">
                <Card className={cn(isModal ? "border-none shadow-none rounded-none" : "")}>
                    <CardHeader>
                        <CardTitle>Transaction Summary</CardTitle>
                        { !isModal && <CardDescription>Review your transaction details below.</CardDescription> }
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Transaction ID</span>
                            <span className="font-medium">{merchantOrderId}</span>
                        </div>
                        <Separator />
                         <div className="text-sm p-3 bg-muted/50 rounded-lg">
                           <div className="flex items-center gap-2 font-medium mb-2 text-foreground">
                               <ShoppingCart className="h-4 w-4" />
                               <span>Transaction Items</span>
                           </div>
                            <div className="pl-6 space-y-2 text-muted-foreground">
                               {items.map((item, index) => (
                                  <div className="flex justify-between" key={index}>
                                      <span>{item.quantity} x {item.name}</span>
                                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                               ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Subtotal</span>
                            <span>${totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Convenience Fee</span>
                            <span>$0.00</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between font-semibold">
                            <span>Total</span>
                            <span>${totalAmount.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
                 <Card className={cn(isModal ? "hidden" : "")}>
                    <CardHeader>
                        <CardTitle>Customer Billing Information</CardTitle>
                        <CardDescription>Customer-provided billing information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <BillingDetail icon={User} label="Name" value={fullName} />
                        <BillingDetail icon={Mail} label="Email" value={billingDetails.email} />
                        <BillingDetail icon={Phone} label="Phone" value={billingDetails.phone} />
                        <BillingDetail icon={Home} label="Shipping Address" value={fullAddress} />
                    </CardContent>
                </Card>
            </div>
             <div>
                <Card className={cn(isModal ? "border-none shadow-none rounded-none" : "")}>
                    <CardHeader>
                    <CardTitle>
                        {paymentMethod === 'card' && 'Pay with Credit Card'}
                        {paymentMethod === 'zelle' && 'Pay with Zelle'}
                    </CardTitle>
                    { !isModal && 
                        <CardDescription>
                            Complete your payment to finalize your transaction.
                        </CardDescription>
                    }
                    </CardHeader>
                    <CardContent>
                        {paymentMethod === 'card' && renderCreditCardForm()}
                        {paymentMethod === 'zelle' && renderZelleForm()}
                        {paymentMethod !== 'card' && paymentMethod !== 'zelle' && renderInvalidMethod()}
                    </CardContent>
                </Card>
            </div>
        </div>
         {isProcessing && !isModal && (
            <div className="mt-8 text-center text-muted-foreground animate-pulse">
                <p>
                  {sessionData.paymentMethod === 'zelle' 
                    ? 'Transaction received. Redirecting you back to the merchant...'
                    : 'Payment successful. Redirecting you back to the merchant...'
                  }
                </p>
            </div>
        )}
     </div>
  )
}

export default function NewCheckoutPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <CheckoutForm />
        </Suspense>
    )
}
