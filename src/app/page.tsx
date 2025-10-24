
"use client"

import { useState, useEffect } from "react";
import Link from "next/link"
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Logo } from "@/components/icons/logo"
import { ArrowRight, Loader2, ChevronsRight, Shield, User, Briefcase, UserCheck } from "lucide-react"
import { createCheckoutSession, type CreateCheckoutSessionInput } from "@/app/actions/create-checkout-session";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import type { PaymentAccountType } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/api/sdk';
    script.async = true;
    document.body.appendChild(script);

    const handleMessage = (event: MessageEvent) => {
        // In production, you MUST validate the origin against a list of allowed merchant domains
        // if (event.origin !== 'https://your-merchant-site.com') return;

        const { type, data } = event.data;

        if (type === 'comfortPay:success') {
            console.log('Payment Success:', data);
            toast({
                title: "Payment Successful (via Modal)",
                description: `Order ${data.orderId} completed with status ${data.status}.`,
            });
        } else if (type === 'comfortPay:close') {
            console.log('Checkout modal closed.');
             toast({
                variant: "default",
                title: "Checkout Closed",
                description: "The payment dialog was closed before completion.",
            });
        }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      document.body.removeChild(script);
      window.removeEventListener('message', handleMessage);
    };
  }, [toast]);


  const handleCreateSession = async (processor: PaymentAccountType, modal = false) => {
    const loadingKey = `${processor}-${modal ? 'modal' : 'redirect'}`;
    setIsLoading(loadingKey);

    const commonBilling = {
        firstName: 'John',
        lastName: 'Doe',
        address1: '123 Main St',
        address2: 'Apt 4B',
        city: 'Anytown',
        state: 'CA',
        postcode: '12345',
        country: 'US',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
    };

    let sessionInput: CreateCheckoutSessionInput;

    if (processor === 'Stripe') {
      sessionInput = {
        merchantId: 'user_2', // Simulating checkout for 'Gadget Store'
        totalAmount: 99.99,
        merchantOrderId: 'WC-12345',
        paymentMethod: 'card',
        processor: 'Stripe',
        billingDetails: commonBilling,
        items: [
          { name: 'Wireless Headphones', quantity: 1, price: 99.99 }
        ],
        paymentDetails: {
          prefix_order_name: "Online Gadget Purchase"
        }
      }
    } else if (processor === 'Square') {
         sessionInput = {
            merchantId: 'user_2', // Simulating for 'Gadget Store'
            totalAmount: 15.75,
            merchantOrderId: 'WC-2024-590',
            paymentMethod: 'card',
            processor: 'Square',
            billingDetails: commonBilling,
            items: [
                { name: 'Laptop Sticker', quantity: 3, price: 5.25 }
            ],
            paymentDetails: {
                prefix_order_name: "Online Gadget Purchase"
            }
        }
    } else { // Zelle
      sessionInput = {
        merchantId: 'user_5', // Simulating checkout for 'Bookworm Nook'
        totalAmount: 45.50,
        merchantOrderId: 'WC-12346',
        paymentMethod: 'zelle',
        processor: 'Zelle',
        billingDetails: commonBilling,
        items: [
           { name: 'USB-C Cable', quantity: 2, price: 20.00 },
           { name: 'Stickers Pack', quantity: 1, price: 5.50 },
        ],
        paymentDetails: {
          prefix_order_name: "Digital Book"
        }
      }
    }

    try {
      console.log("🚀 [HomePage] Calling createCheckoutSession action...");
      const result = await createCheckoutSession(sessionInput);
      console.log("[HomePage] createCheckoutSession action result:", result);


      if (result.error) {
        throw new Error(result.error);
      }

      if (modal) {
        if (window.ComfortPay && result.sessionToken) {
          window.ComfortPay.open({ sessionToken: result.sessionToken });
        } else {
           throw new Error("ComfortPay SDK not loaded yet.");
        }
      } else {
        router.push(`/checkout/new?session=${result.sessionToken}`);
      }
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Failed to create session",
        description: error.message || "There was a problem contacting the server. Please try again.",
      });
    } finally {
        setIsLoading(null);
    }
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mb-8 flex flex-col items-center text-center">
            <Logo className="h-12 w-auto text-primary" />
            {/* <h1 className="mt-4 text-3xl font-bold">ComfortPay Gateway</h1> */}
            {/* <p className="mt-2 text-muted-foreground">This page demonstrates both a redirect and a modal checkout flow.</p> */}
        </div>
        <div className="gap-8 w-full max-w-4xl">
             <Card className="w-full">
                <CardHeader>
                <CardTitle>Role-Based Access</CardTitle>
                <CardDescription>
                    Access the internal dashboards for each user role.
                </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/login/admin" passHref>
                        <Button className="w-full" variant="outline">
                            <Shield className="mr-2 h-4 w-4"/> Admin Login
                        </Button>
                    </Link>
                    <Link href="/login/merchant" passHref>
                        <Button className="w-full" variant="outline">
                           <User className="mr-2 h-4 w-4"/> Merchant Login
                        </Button>
                    </Link>
                    {/* <Link href="/login/staff" passHref>
                        <Button className="w-full" variant="outline">
                           <UserCheck className="mr-2 h-4 w-4"/> Staff Login
                        </Button>
                    </Link> */}
                    {/* <Link href="/login/sale-agent" passHref>
                        <Button className="w-full" variant="outline">
                            <Briefcase className="mr-2 h-4 w-4"/> Sales Login
                        </Button>
                    </Link> */}
                </CardContent>
            </Card>
             {/* <Card className="w-full">
                <CardHeader>
                <CardTitle>Test Customer Checkout</CardTitle>
                <CardDescription>
                   Simulate a customer being redirected from a merchant's website, or opening the checkout in a dialog.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center">
                        <p className="text-sm font-semibold text-muted-foreground">Redirect Flow</p>
                         <p className="text-xs text-muted-foreground">Navigates to a separate checkout page.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <Button className="w-full" variant="outline" onClick={() => handleCreateSession('Stripe')} disabled={!!isLoading}>
                            {isLoading === 'Stripe-redirect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Stripe ($99.99)'}
                        </Button>
                         <Button className="w-full" variant="outline" onClick={() => handleCreateSession('Square')} disabled={!!isLoading}>
                            {isLoading === 'Square-redirect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Square ($15.75)'}
                        </Button>
                        <Button className="w-full" variant="outline" onClick={() => handleCreateSession('Zelle')} disabled={!!isLoading}>
                           {isLoading === 'Zelle-redirect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Zelle ($45.50)'}
                        </Button>
                    </div>
                    <Separator />
                     <div className="text-center">
                        <p className="text-sm font-semibold text-muted-foreground">Modal / Dialog Flow</p>
                        <p className="text-xs text-muted-foreground">Opens a dialog on this page.</p>
                    </div>
                    <div className="space-y-2">
                        <Button className="w-full" variant="default" onClick={() => handleCreateSession('Stripe', true)} disabled={!!isLoading}>
                           {isLoading === 'Stripe-modal' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Open Stripe Dialog'}
                           <ChevronsRight className="ml-2"/>
                        </Button>
                         <Button className="w-full" variant="default" onClick={() => handleCreateSession('Square', true)} disabled={!!isLoading}>
                           {isLoading === 'Square-modal' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Open Square Dialog'}
                           <ChevronsRight className="ml-2"/>
                        </Button>
                         <Button className="w-full" variant="default" onClick={() => handleCreateSession('Zelle', true)} disabled={!!isLoading}>
                           {isLoading === 'Zelle-modal' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Open Zelle Dialog'}
                           <ChevronsRight className="ml-2"/>
                        </Button>
                    </div>
                     <p className="text-xs text-muted-foreground pt-2">
                        Clicking a button calls a backend flow to create a secure session. The SDK then either redirects or opens the modal.
                    </p>
                </CardContent>
            </Card> */}
        </div>
        <footer className="mt-12 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} ComfortPay. All Right Reserved</p>
        </footer>
    </div>
  );
}

// Augment the Window interface
declare global {
  interface Window {
    ComfortPay?: {
      open: (options: { sessionToken: string }) => void;
    };
  }
}
