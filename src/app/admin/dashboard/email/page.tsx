
"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCustomerEmailContent, getMerchantEmailContent } from "@/lib/email-templates"
import type { SendOrderNotificationInput } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"


const sampleOrder: SendOrderNotificationInput = {
    recipientType: 'customer', // This will be changed for the merchant email
    customerEmail: 'customer@example.com',
    merchantEmail: 'merchant@example.com',
    merchantName: 'The Gadget Store',
    orderDetails: {
        merchantId: 'merch_123',
        totalAmount: 129.98,
        merchantOrderId: 'WC-2024-789',
        visualOrderId: 'CP-54321-WC-2024-789',
        paymentMethod: 'card',
        billingDetails: {
            firstName: 'John',
            lastName: 'Doe',
            address1: '123 Main St',
            address2: 'Apt 4B',
            city: 'Anytown',
            state: 'CA',
            postcode: '12345',
            country: 'USA',
            email: 'john.doe@example.com',
            phone: '555-123-4567',
        },
        items: [
            { name: 'Wireless Mouse', quantity: 1, price: 49.99 },
            { name: 'USB-C Hub', quantity: 1, price: 79.99 },
        ]
    }
}

const EmailPreviewCard = ({ title, description, subject, body }: { title: string, description: string, subject: string, body: string }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-1">
                <h4 className="text-sm font-semibold">Subject</h4>
                <p className="text-sm p-3 bg-muted rounded-md">{subject}</p>
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-semibold">Body Preview</h4>
                <div className="rounded-md border bg-background overflow-hidden">
                    <iframe
                        srcDoc={body}
                        className="w-full h-[600px] border-none"
                        title={title}
                    />
                </div>
            </div>
        </CardContent>
    </Card>
)

function EmailTemplatesTab() {
    const customerEmail = getCustomerEmailContent(sampleOrder);
    const merchantEmail = getMerchantEmailContent({
        ...sampleOrder,
        recipientType: 'merchant'
    });

  return (
        <div className="grid gap-6 xl:grid-cols-2">
           <EmailPreviewCard 
                title="Customer Invoice Email"
                description="This email is sent to the customer after a successful payment."
                subject={customerEmail.subject}
                body={customerEmail.body}
            />
            <EmailPreviewCard 
                title="Merchant Notification Email"
                description="This email is sent to the merchant when a new order is received."
                subject={merchantEmail.subject}
                body={merchantEmail.body}
            />
        </div>
  )
}

const emailSettingsSchema = z.object({
  emailProvider: z.enum(["cpanel", "titan", "sendgrid"]),
  fromEmail: z.string().email("Please enter a valid 'From' email address."),
  cpanelSmtp: z.object({
    host: z.string().optional(),
    port: z.coerce.number().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
  }),
  titanSmtp: z.object({
    host: z.string().optional(),
    port: z.coerce.number().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
  }),
  sendgrid: z.object({
    apiKey: z.string().optional(),
  }),
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsSchema>;

function EmailSettingsTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      emailProvider: "cpanel",
      fromEmail: "",
      cpanelSmtp: { host: "", port: 465, user: "", pass: "" },
      titanSmtp: { host: "", port: 465, user: "", pass: "" },
      sendgrid: { apiKey: "" },
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/settings?group=email");
        if (response.ok) {
          const data = await response.json();
          form.reset({
            emailProvider: data.emailProvider || 'cpanel',
            fromEmail: data.fromEmail || '',
            cpanelSmtp: data.cpanelSmtp || { host: "", port: 465, user: "", pass: "" },
            titanSmtp: data.titanSmtp || { host: "", port: 465, user: "", pass: "" },
            sendgrid: data.sendgrid || { apiKey: "" },
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Failed to load settings",
          description: "Could not fetch email settings from the server.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [form, toast]);

  const onSubmit = async (values: EmailSettingsFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      toast({
        title: "Settings Saved",
        description: "Your email settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "There was a problem saving your settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
     try {
      const response = await fetch("/api/settings/test-email", {
        method: "POST",
      });

       const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send test email');
      }
      
      toast({
        title: "Test Email Sent",
        description: `An email has been sent via the active provider. Check your inbox.`,
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error.message || "There was a problem sending the test email.",
      });
    } finally {
        setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 justify-center items-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Global Email Settings</CardTitle>
                    <CardDescription>
                       Select the active email provider and set the default sender address.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="emailProvider"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-base">Active Email Provider</FormLabel>
                          <FormDescription>
                            Select the service that will be used to send all transactional emails.
                          </FormDescription>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="cpanel" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                 cPanel Mail
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="titan" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Titan Mail
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="sendgrid" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  SendGrid
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                        control={form.control}
                        name="fromEmail"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>From Email Address</FormLabel>
                            <FormControl>
                                <Input placeholder="noreply@yourdomain.com" {...field} />
                            </FormControl>
                             <FormDescription>
                                The default email address that appears in the 'From' field. This must be a verified sender in SendGrid if you are using it.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>cPanel SMTP Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField control={form.control} name="cpanelSmtp.host" render={({ field }) => ( <FormItem><FormLabel>Host</FormLabel><FormControl><Input placeholder="mail.yourdomain.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="cpanelSmtp.port" render={({ field }) => ( <FormItem><FormLabel>Port</FormLabel><FormControl><Input type="number" placeholder="465" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="cpanelSmtp.user" render={({ field }) => ( <FormItem><FormLabel>Username</FormLabel><FormControl><Input placeholder="you@yourdomain.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="cpanelSmtp.pass" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Titan Mail SMTP Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField control={form.control} name="titanSmtp.host" render={({ field }) => ( <FormItem><FormLabel>Host</FormLabel><FormControl><Input placeholder="smtp.titan.email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="titanSmtp.port" render={({ field }) => ( <FormItem><FormLabel>Port</FormLabel><FormControl><Input type="number" placeholder="465" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="titanSmtp.user" render={({ field }) => ( <FormItem><FormLabel>Username</FormLabel><FormControl><Input placeholder="you@yourdomain.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={form.control} name="titanSmtp.pass" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>SendGrid Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField control={form.control} name="sendgrid.apiKey" render={({ field }) => ( <FormItem><FormLabel>API Key</FormLabel><FormControl><Input type="password" placeholder="SG.••••••••" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </CardContent>
            </Card>

             <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                    Storing credentials and API keys directly in the database is not recommended for production environments. For enhanced security, use environment variables or a secret management service.
                </AlertDescription>
            </Alert>
            
            <div className="flex justify-end gap-2">
                 <Button type="button" variant="outline" onClick={handleTestEmail} disabled={isSaving || isTesting}>
                    {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Send Test Email
                </Button>
                <Button type="submit" disabled={isSaving || isTesting}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Settings
                </Button>
            </div>
        </form>
      </Form>
  );
}


export default function EmailPage() {
    return (
        <div className="grid gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Email Management</h1>
                <p className="text-muted-foreground">
                    Configure email services and preview transactional email templates.
                </p>
            </div>
            <Tabs defaultValue="templates">
                <TabsList>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                <TabsContent value="templates" className="mt-4">
                    <EmailTemplatesTab />
                </TabsContent>
                <TabsContent value="settings" className="mt-4">
                    <EmailSettingsTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}

    