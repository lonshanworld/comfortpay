
"use client"

import { useState, Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/icons/logo"
import { CreditCard, Loader2, User, Mail, Phone, Home, ShoppingCart, X } from "lucide-react"
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { CreateCheckoutSessionInput, Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { sendOrderNotification } from '@/app/actions/send-order-notification';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { processPayment } from '@/app/actions/process-payment';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Payment, Card as SquareCard } from '@square/web-payments-sdk-types';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#32325d",
      fontFamily: '"Inter", sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a",
    },
  },
};


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

function SquarePaymentForm({ sessionData, onPaymentSuccess, setParentProcessing }: { sessionData: CreateCheckoutSessionInput, onPaymentSuccess: (transactionId: string) => Promise<void>, setParentProcessing: (isProcessing: boolean) => void }) {
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);
    const cardInstance = useRef<SquareCard | null>(null);
    const [isCardReady, setIsCardReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const initializeSquare = async () => {
            if (!isMounted || !cardRef.current || cardInstance.current) {
                return;
            }

            try {
                const appIdRes = await fetch(`/api/payments/public-key/${sessionData.paymentDetails!.paymentAccountId}`);
                if (!appIdRes.ok) throw new Error(`Could not fetch Square App ID. Status: ${appIdRes.status}`);
                const { applicationId, locationId } = await appIdRes.json();

                if (!applicationId || !locationId) {
                    throw new Error("Square Application ID or Location ID not configured.");
                }

                const payments = window.Square.payments(applicationId, locationId);
                const squareCard = await payments.card();
                
                if (isMounted && cardRef.current) {
                    await squareCard.attach(cardRef.current);
                    cardInstance.current = squareCard;
                    setIsCardReady(true);
                }

            } catch (error: any) {
                 if (isMounted) {
                    console.error("Square initialization error:", error);
                    toast({ variant: "destructive", title: "Square SDK Error", description: error.message });
                 }
            }
        };

        const loadSquareSdk = () => {
            if (window.Square) {
                initializeSquare();
            } else {
                const script = document.createElement('script');
                script.src = "https://sandbox.web.squarecdn.com/v1/square.js";
                script.id = "square-sdk";
                script.async = true;
                script.onload = () => initializeSquare();
                script.onerror = () => {
                    if (isMounted) {
                        toast({ variant: "destructive", title: "SDK Error", description: "Failed to load Square payment script." });
                    }
                };
                document.head.appendChild(script);
            }
        };

        if (sessionData.paymentDetails?.paymentAccountId && cardRef.current) {
            loadSquareSdk();
        }

        return () => {
            isMounted = false;
        };
    }, [sessionData, toast]);


    const handlePayment = async () => {
        if (!cardInstance.current) {
            toast({ variant: "destructive", title: "Payment Error", description: "Square payment form is not ready." });
            return;
        }
        
        setIsProcessing(true);
        setParentProcessing(true);
        try {
            const result = await cardInstance.current.tokenize();
            if (result.status === 'OK' && result.token) {
                await onPaymentSuccess(result.token);
            } else {
                throw new Error(result.errors?.map(e => e.message).join(', ') || "Failed to tokenize card.");
            }
        } catch (error: any) {
            console.error("Square Payment error:", error);
            toast({ variant: "destructive", title: "Payment Failed", description: error.message });
            setIsProcessing(false);
            setParentProcessing(false);
        }
    };

    return (
      <>
        <div ref={cardRef} style={{ minHeight: !isCardReady ? '50px' : 'auto' }}>
          {!isCardReady && <Loader2 className="animate-spin h-5 w-5 mx-auto" />}
        </div>
        <Button onClick={handlePayment} disabled={isProcessing || !isCardReady} className="w-full">
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          Pay ${sessionData.totalAmount?.toFixed(2)}
        </Button>
      </>
    )
}

function StripePaymentForm({ sessionData, onPaymentSuccess, setParentProcessing }: { sessionData: CreateCheckoutSessionInput, onPaymentSuccess: (transactionId: string) => Promise<void>, setParentProcessing: (isProcessing: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setIsProcessing(true);
    setParentProcessing(true);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      toast({ variant: "destructive", title: "Payment Error", description: error.message });
      setIsProcessing(false);
      setParentProcessing(false);
      return;
    }

    try {
      await onPaymentSuccess(paymentMethod.id);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Payment Error", description: e.message || 'An unknown error occurred' });
      setIsProcessing(false);
      setParentProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CardElement options={CARD_ELEMENT_OPTIONS} />
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
        Pay ${sessionData.totalAmount?.toFixed(2)}
      </Button>
    </form>
  )
}


function CheckoutForm({ sessionData }: { sessionData: CreateCheckoutSessionInput }) {
  const router = useRouter();
  const { toast } = useToast();
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isModal, setIsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const qrCodeUrl = sessionData.paymentDetails?.qrCodeUrl ? `${appUrl}${sessionData.paymentDetails.qrCodeUrl}` : null;

  useEffect(() => {
    // Check if running in an iframe (modal)
    if (window.self !== window.top) {
      setIsModal(true);
    }
    
    if (sessionData.processor === 'Stripe' && sessionData.paymentDetails?.paymentAccountId) {
      fetch(`/api/payments/public-key/${sessionData.paymentDetails.paymentAccountId}`)
        .then(res => res.json())
        .then(data => {
          if(data.publicKey) {
            setStripePromise(loadStripe(data.publicKey));
          } else {
            toast({ variant: "destructive", title: "Configuration Error", description: data.message || "Stripe public key is not configured for this account." });
          }
        })
        .catch(err => toast({ variant: "destructive", title: "Stripe Error", description: "Could not load Stripe. Please contact support." }))
    }
  }, [sessionData, toast]);


  const handleClose = () => {
    if (isModal) {
      window.parent.postMessage({ type: 'comfortPay:close' }, '*');
    } else {
      router.push('/');
    }
  };

  const handlePaymentSuccess = async (paymentMethodId: string) => {
    if (!sessionData.comfortPayOrderId || typeof sessionData.totalAmount === 'undefined') {
      toast({ variant: "destructive", title: "Payment Error", description: "Internal order ID or final amount is missing." });
      return;
    }
    console.log("🚀 [CheckoutForm] Calling processPayment action...");
    const paymentResult = await processPayment({
      processor: sessionData.processor as 'Stripe' | 'Square',
      paymentMethodId: paymentMethodId,
      comfortPayOrderId: sessionData.comfortPayOrderId,
      amount: sessionData.totalAmount,
      currency: sessionData.currency || 'USD',
    });
    console.log("[CheckoutForm] processPayment action result:", paymentResult);

    if (paymentResult.success && paymentResult.transactionId) {
      await updateOrderStatus('Completed', paymentResult.transactionId);
      
      if (isModal) {
        window.parent.postMessage({ type: 'comfortPay:success', data: { orderId: sessionData.comfortPayOrderId, status: 'Completed' }}, '*');
      } else if(sessionData.wooCommerceOrderReceivedUrl) {
        window.location.href = sessionData.wooCommerceOrderReceivedUrl;
      }

    } else {
      throw new Error(paymentResult.error || "Payment processing failed.");
    }
  };
  
  const updateOrderStatus = async (status: 'Completed' | 'Requires Confirmation', transactionId?: string) => {
    if (!sessionData.comfortPayOrderId) return;
    try {
      const payload: Partial<Order> = { status };
      if (transactionId) payload.paymentGatewayTransactionId = transactionId;
      if (status === 'Completed' && typeof sessionData.totalAmount !== 'undefined') {
        payload.paidAmount = sessionData.totalAmount;
        payload.paymentReceivedDate = new Date().toISOString();
      }
      
      console.log(`[CheckoutForm] Updating order status to '${status}'...`);
      const response = await fetch(`/api/orders/${sessionData.comfortPayOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status.");
      }
      
      const updatedOrder = await response.json();
      console.log("[CheckoutForm] Order status update result:", updatedOrder);
      
      // Update payment account volume
      if (updatedOrder.paymentAccountId && typeof sessionData.totalAmount !== 'undefined') {
        console.log("[CheckoutForm] Updating payment account volume...");
        const volumeResponse = await fetch(`/api/payments/accounts/${updatedOrder.paymentAccountId}/update-volume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Number(sessionData.totalAmount) }),
        });
        console.log("[CheckoutForm] Volume update response status:", volumeResponse.status);
      }
      
      // Only send email notifications if the payment is fully completed.
      if (status === 'Completed') {
        const merchantDetailsRes = await fetch(`/api/merchants/${sessionData.merchantId}/details`);
        const merchantDetails = await merchantDetailsRes.json();
        const merchantName = merchantDetails?.name || 'Your Merchant';

        // Send emails but don't wait for them
        sendOrderNotification({ recipientType: 'customer', customerEmail: sessionData.billingDetails.email, merchantName, orderDetails: sessionData, items: sessionData.items });
        sendOrderNotification({ recipientType: 'merchant', merchantEmail: merchantDetails.email, merchantName, orderDetails: sessionData, items: sessionData.items });
      }

    } catch (error: any) {
      console.error("Status update/notification error:", error);
      toast({ variant: "destructive", title: "Post-Payment Error", description: error.message });
    }
  }
  
  const handleZelleConfirmation = async () => {
    setIsProcessing(true);
    await updateOrderStatus('Requires Confirmation');
    console.log("✅ [CheckoutForm] Zelle payment confirmed by user.");


    if (isModal) {
      window.parent.postMessage({ type: 'comfortPay:success', data: { orderId: sessionData.comfortPayOrderId, status: 'Requires Confirmation' }}, '*');
    } else if (sessionData.wooCommerceOrderReceivedUrl) {
      window.location.href = sessionData.wooCommerceOrderReceivedUrl;
    }
  }

  const { visualOrderId, totalAmount, billingDetails, items } = sessionData;
  const orderAmount = (items || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payment Details</span>
            <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
          <CardDescription>
            Complete your secure payment for transaction <span className="font-semibold text-foreground">{visualOrderId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionData.processor === 'Stripe' && stripePromise && (
            <Elements stripe={stripePromise}>
              <StripePaymentForm sessionData={sessionData} onPaymentSuccess={handlePaymentSuccess} setParentProcessing={setIsProcessing} />
            </Elements>
          )}
          {sessionData.processor === 'Square' && (
            <SquarePaymentForm sessionData={sessionData} onPaymentSuccess={handlePaymentSuccess} setParentProcessing={setIsProcessing} />
          )}
          {sessionData.processor === 'Zelle' && (
            <div className="space-y-6 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Send payment to:</p>
                <p className="text-2xl lg:text-4xl font-semibold text-primary">{sessionData.paymentDetails?.accountEmail}</p>
              </div>
              {/* {qrCodeUrl && (
                <div className="flex justify-center">
                  <Image src={qrCodeUrl} alt="Zelle QR Code" width={200} height={200} className="rounded-lg border shadow-sm" />
                </div>
              )} */}
              <div>
                <p className="text-lg text-muted-foreground">Memo = <span className="text-2xl lg:text-4xl font-bold text-primary">{visualOrderId}</span></p>
              </div>
              <Alert>
                <AlertTitle>Important!</AlertTitle>
                <AlertDescription>
                  You must include the exact memo shown above with your Zelle payment. After sending, click the button below to confirm.
                </AlertDescription>
              </Alert>
              <Button onClick={handleZelleConfirmation} className="w-full" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                I Have Sent The Zelle Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5"/>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Items</h3>
            {(items || []).map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <p>{item.name} x {item.quantity}</p>
                <p>${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <p>Subtotal</p>
              <p>${orderAmount.toFixed(2)}</p>
            </div>
            <div className="flex justify-between">
              <p>Shipping & Taxes</p>
              <p>${(totalAmount - orderAmount).toFixed(2)}</p>
            </div>
            <div className="flex justify-between font-bold text-base">
              <p>Total</p>
              <p>${totalAmount.toFixed(2)}</p>
            </div>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Billing Details</h3>
            <div className="space-y-3">
              <BillingDetail icon={User} label="Name" value={`${billingDetails.firstName} ${billingDetails.lastName}`} />
              <BillingDetail icon={Mail} label="Email" value={billingDetails.email} />
              <BillingDetail icon={Phone} label="Phone" value={billingDetails.phone} />
              <BillingDetail icon={Home} label="Address" value={`${billingDetails.address1}, ${billingDetails.city}, ${billingDetails.state} ${billingDetails.postcode}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CheckoutPage() {
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get('session');
  const [sessionData, setSessionData] = useState<CreateCheckoutSessionInput | null>(null);

  useEffect(() => {
    if (sessionToken) {
      try {
        console.log("🚀 [CheckoutPage] Decoding session token...");
        const decodedData = JSON.parse(atob(sessionToken));
        setSessionData(decodedData);
        console.log("[CheckoutPage] Decoded session data result:", decodedData);
      } catch (error) {
        console.error("Invalid session token:", error);
      }
    }
  }, [sessionToken]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <Logo className="h-10 w-auto mx-auto text-primary" />
        </div>
        {sessionData ? <CheckoutForm sessionData={sessionData} /> : (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Loading Checkout...</CardTitle>
              <CardDescription>Please wait while we load your secure payment session.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function CheckoutPageSuspenseWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen justify-center items-center"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <CheckoutPage />
    </Suspense>
  )
}

// Augment the Window interface
declare global {
  interface Window {
    Square?: any;
  }
}
