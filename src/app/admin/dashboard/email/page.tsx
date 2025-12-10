
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
import { useForm, useWatch } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch"


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
        <div className="grid gap-6 xl:grid-cols-2 ">
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
  emailEnabled: z.boolean().default(true),
  emailProvider: z.enum(["cpanel", "titan", "sendgrid"]),
  fromEmail: z.string().email("Please enter a valid 'From' email address."),
  sendToCustomer: z.boolean().default(true),
  sendToMerchant: z.boolean().default(true),
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
  const [testEmailRecipient, setTestEmailRecipient] = useState("");

  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      emailEnabled: true,
      emailProvider: "cpanel",
      fromEmail: "",
      sendToCustomer: true,
      sendToMerchant: true,
      cpanelSmtp: { host: "", port: 465, user: "", pass: "" },
      titanSmtp: { host: "", port: 465, user: "", pass: "" },
      sendgrid: { apiKey: "" },
    },
  });

  const emailEnabled = useWatch({
    control: form.control,
    name: "emailEnabled",
    defaultValue: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/settings?group=email");
        if (response.ok) {
          const data = await response.json();
          form.reset({
            emailEnabled: typeof data.emailEnabled === 'boolean' ? data.emailEnabled : true,
            emailProvider: data.emailProvider || 'cpanel',
            fromEmail: data.fromEmail || '',
            sendToCustomer: typeof data.sendToCustomer === 'boolean' ? data.sendToCustomer : true,
            sendToMerchant: typeof data.sendToMerchant === 'boolean' ? data.sendToMerchant : true,
            cpanelSmtp: data.cpanelSmtp || { host: "", port: 465, user: "", pass: "" },
            titanSmtp: data.titanSmtp || { host: "", port: 465, user: "", pass: "" },
            sendgrid: data.sendgrid || { apiKey: "" },
          });
          setTestEmailRecipient(data.fromEmail || '');
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
    if (!testEmailRecipient) {
        toast({
            variant: "destructive",
            title: "Recipient Required",
            description: "Please enter an email address to send the test email to.",
        });
        return;
    }
    setIsTesting(true);
     try {
      const response = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testEmailRecipient })
      });

       const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send test email');
      }
      
      toast({
        title: "Test Email Sent",
        description: `An email has been sent to ${testEmailRecipient} via the active provider.`,
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
                       Select the active email provider, set sender details, and control notifications.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField
                        control={form.control}
                        name="emailEnabled"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Enable All Email Notifications</FormLabel>
                                <FormDescription>
                                This is the master switch for all emails sent by the platform.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            </FormItem>
                        )}
                    />
                    <fieldset disabled={!emailEnabled} className="space-y-6">
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
                                value={field.value}
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
                        <Separator />
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
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="sendToCustomer"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Send to Customer</FormLabel>
                                        <FormDescription>
                                        Enable or disable invoice emails to customers.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sendToMerchant"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Send to Merchant</FormLabel>
                                        <FormDescription>
                                        Enable or disable new order notifications to merchants.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </fieldset>
                </CardContent>
            </Card>

            <fieldset disabled={!emailEnabled}>
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
            </fieldset>

             <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                    Storing credentials and API keys directly in the database is not recommended for production environments. For enhanced security, use environment variables or a secret management service.
                </AlertDescription>
            </Alert>
            
            <div className="flex justify-end gap-2 items-end">
                <div className="flex-1 grid gap-2">
                    <Label htmlFor="test-email">Test Recipient Email</Label>
                    <Input
                        id="test-email"
                        type="email"
                        placeholder="recipient@example.com"
                        value={testEmailRecipient}
                        onChange={(e) => setTestEmailRecipient(e.target.value)}
                        disabled={isSaving || isTesting || !emailEnabled}
                    />
                </div>
                 <Button type="button" variant="outline" onClick={handleTestEmail} disabled={isSaving || isTesting || !emailEnabled}>
                    {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Send Test
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
        <div className="grid gap-6 w-svw">
            <div
            className="w-11/12 grid gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Email Management</h1>
                    <p className="text-muted-foreground">
                        Configure email services and preview transactional email templates.
                    </p>
                </div>
                <Tabs defaultValue="settings">
                    <TabsList>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                        <TabsTrigger value="templates">Templates</TabsTrigger>
                    </TabsList>
                    <TabsContent value="templates" className="mt-4">
                        <EmailTemplatesTab />
                    </TabsContent>
                    <TabsContent value="settings" className="mt-4">
                        <EmailSettingsTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
