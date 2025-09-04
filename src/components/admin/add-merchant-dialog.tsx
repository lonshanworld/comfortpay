
"use client"

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import type { User, Fee } from "@/lib/types";


const feeSchema = z.object({
  value: z.coerce.number().optional(),
  type: z.enum(["percentage", "flat"]).optional(),
});

const gatewayFeeSchema = z.object({
    enabled: z.boolean().default(false),
    transactionFee: feeSchema.optional(),
    transactionFeeFixed: feeSchema.optional(),
    refundFee: feeSchema.optional(),
    chargebackFee: feeSchema.optional(),
});

const merchantFormSchema = z.object({
  name: z.string().min(3, "Full name must be at least 3 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  websiteUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  orderIdPrefix: z.string().optional(),
  status: z.enum(["Active", "Inactive"]),
  nationality: z.string().min(2, "Please enter a valid nationality.").optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  idType: z.enum(["Passport", "Driver License", "ID Card"]).optional(),
  
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountType: z.string().optional(),
  bankEmail: z.string().optional(),

  walletAddress: z.string().optional(),
  network: z.string().optional(),
  
  photoId: z.any().optional(),
  businessDocument: z.any().optional(),

  // Settlement Fees
  settlementFees: z.object({
    domesticTransferFee: feeSchema.optional(),
    internationalTransferFee: feeSchema.optional(),
    cryptoTransferFee: feeSchema.optional(),
  }).optional(),

  // Payment Gateway Fees
  paymentGatewayFees: z.object({
    stripe: gatewayFeeSchema.optional(),
    square: gatewayFeeSchema.optional(),
    zelle: gatewayFeeSchema.optional(),
  }).optional(),
  salesAgentId: z.string().optional(),
  commissionRates: z.object({
      stripe: feeSchema.optional(),
      square: feeSchema.optional(),
      zelle: feeSchema.optional(),
  }).optional(),
});

type MerchantFormValues = z.infer<typeof merchantFormSchema>;

interface AddMerchantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerchantAdded: () => void;
}

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});


const FeeInput = ({ name, control, label }: { name: string, control: any, label: string }) => (
    <div className="space-y-2 rounded-md border p-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
            <FormField
            control={control}
            name={`${name}.value`}
            render={({ field }) => (
                <FormItem className="flex-1">
                <FormControl><Input type="number" step="0.01" placeholder="e.g., 2.9" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={control}
            name={`${name}.type`}
            render={({ field }) => (
                <FormItem>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="flat">$</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
    </div>
);

const GatewayFeeSection = ({ gatewayName, control }: { gatewayName: 'stripe' | 'square' | 'zelle', control: any }) => {
    const isEnabled = useWatch({
      control,
      name: `paymentGatewayFees.${gatewayName}.enabled`,
      defaultValue: false
    });
  
    return (
        <div className="space-y-4 rounded-md border p-4">
          <FormField
            control={control}
            name={`paymentGatewayFees.${gatewayName}.enabled`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <Label htmlFor={`enable-${gatewayName}`} className="text-base font-semibold capitalize">{gatewayName}</Label>
                <FormControl>
                  <Switch
                    id={`enable-${gatewayName}`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
         {isEnabled && (
            <div className="space-y-4 pl-2 border-l-2 ml-2 mt-2 pt-2">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={control}
                        name={`paymentGatewayFees.${gatewayName}.transactionFee.value`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-xs">Transaction Fee (%)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="e.g., 2.9" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`paymentGatewayFees.${gatewayName}.transactionFeeFixed.value`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-xs">Transaction Fixed Fee ($)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="e.g., 0.30" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <FeeInput name={`paymentGatewayFees.${gatewayName}.refundFee`} control={control} label="Refund Fee" />
                 <FeeInput name={`paymentGatewayFees.${gatewayName}.chargebackFee`} control={control} label="Chargeback Fee" />
            </div>
         )}
      </div>
    );
};

export function AddMerchantDialog({ open, onOpenChange, onMerchantAdded }: AddMerchantDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [salesAgents, setSalesAgents] = useState<User[]>([]);

  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      websiteUrl: "",
      orderIdPrefix: "",
      status: "Inactive",
      nationality: "",
      dateOfBirth: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountType: "",
      bankEmail: "",
      walletAddress: "",
      network: "",
      settlementFees: {
        domesticTransferFee: { value: 2.50, type: "flat" },
        internationalTransferFee: { value: 5.00, type: "flat" },
        cryptoTransferFee: { value: 1.00, type: "percentage" },
      },
      paymentGatewayFees: {
        stripe: { enabled: true, transactionFee: { value: 2.9 }, transactionFeeFixed: {value: 0.30}, refundFee: { value: 0, type: 'flat'}, chargebackFee: { value: 15.00, type: 'flat'} },
        square: { enabled: true, transactionFee: { value: 2.6 }, transactionFeeFixed: {value: 0.10}, refundFee: { value: 0, type: 'flat'}, chargebackFee: { value: 20.00, type: 'flat'} },
        zelle: { enabled: true, transactionFee: { value: 0 }, transactionFeeFixed: {value: 0}, refundFee: { value: 0, type: 'flat'}, chargebackFee: { value: 0, type: 'flat'} },
      },
      salesAgentId: "",
      commissionRates: { 
        stripe: { value: 0, type: 'percentage' }, 
        square: { value: 0, type: 'percentage' }, 
        zelle: { value: 0, type: 'percentage' } 
      },
    },
  });

  useEffect(() => {
    if (open) {
        const fetchAgents = async () => {
            try {
                const res = await fetch('/api/users?role=Sale%20Agent');
                const data = await res.json();
                setSalesAgents(data);
            } catch (error) {
                console.error("Failed to fetch sales agents", error);
            }
        };
        fetchAgents();
    }
  }, [open]);


  const onSubmit = async (values: MerchantFormValues) => {
    setIsLoading(true);

    try {
      const dataToSubmit: any = { 
          ...values,
          salesAgentId: values.salesAgentId === 'none' ? '' : values.salesAgentId,
      };

      if (values.photoId && values.photoId instanceof File) {
        dataToSubmit.photoId = await toBase64(values.photoId);
      }
       if (values.businessDocument && values.businessDocument instanceof File) {
        dataToSubmit.businessDocument = await toBase64(values.businessDocument);
      }

      const response = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        throw new Error('Failed to create merchant');
      }
      
      toast({
        title: "Merchant Created",
        description: `The new merchant "${values.name}" has been added successfully.`,
      });

      onOpenChange(false);
      form.reset();
      onMerchantAdded();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem creating the merchant. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
       if (!open) {
        form.reset();
      }
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Merchant</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new merchant to the platform.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <ScrollArea className="max-h-[70vh]">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 pr-6">
              <h4 className="text-sm font-semibold text-primary">Login Credentials</h4>
               <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., merchant@example.com" {...field} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={isLoading} />
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
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <Separator className="my-4" />
              <h4 className="text-sm font-semibold text-primary">Personal & Business Information</h4>
              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="orderIdPrefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID Prefix (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., GADGETS" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., American" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ID Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Passport">Passport</SelectItem>
                        <SelectItem value="Driver License">Driver License</SelectItem>
                        <SelectItem value="ID Card">ID Card</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="photoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo ID</FormLabel>
                    <FormControl>
                      <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files?.[0])} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessDocument"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Document</FormLabel>
                    <FormControl>
                      <Input type="file" accept="image/*,application/pdf,.doc,.docx,.txt" onChange={(e) => field.onChange(e.target.files?.[0])} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-4" />
              <h4 className="text-sm font-semibold text-primary">Banking Details (Optional)</h4>
              <div className="space-y-4">
                 <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chase Bank" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 123456789" {...field} disabled={isLoading}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAccountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Business Checking" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="bankEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Email (for notifications)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g., billing@example.com" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-4" />
              <h4 className="text-sm font-semibold text-primary">Crypto Wallet Details (Optional)</h4>
              <div className="space-y-4">
                 <FormField
                  control={form.control}
                  name="walletAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 0x..." {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="network"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Network</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Ethereum (ERC-20)" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
                <Separator className="my-4" />
                <h4 className="text-sm font-semibold text-primary">Settlement Fees</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FeeInput name="settlementFees.domesticTransferFee" control={form.control} label="Domestic Transfer" />
                    <FeeInput name="settlementFees.internationalTransferFee" control={form.control} label="International Transfer" />
                    <FeeInput name="settlementFees.cryptoTransferFee" control={form.control} label="Crypto Transfer" />
                </div>

                <Separator className="my-4" />
                <h4 className="text-sm font-semibold text-primary">Payment Gateway Fees & Access</h4>
                <div className="space-y-6">
                    <GatewayFeeSection gatewayName="stripe" control={form.control} />
                    <GatewayFeeSection gatewayName="square" control={form.control} />
                    <GatewayFeeSection gatewayName="zelle" control={form.control} />
                </div>

                <Separator className="my-4" />
                <h4 className="text-sm font-semibold text-primary">Sales & Commission</h4>
                <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="salesAgentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Sales Agent</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="No agent assigned" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No agent assigned</SelectItem>
                              {salesAgents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FeeInput name="commissionRates.stripe" control={form.control} label="Stripe Commission" />
                        <FeeInput name="commissionRates.square" control={form.control} label="Square Commission" />
                        <FeeInput name="commissionRates.zelle" control={form.control} label="Zelle Commission" />
                    </div>
                </div>

              <DialogFooter className="sticky bottom-0 bg-background/95 pt-4">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Merchant
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
