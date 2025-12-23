
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
import { Loader2, Eye, EyeOff } from "lucide-react";
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
import type { Merchant, User } from "@/lib/types";
import { ScrollArea } from "../ui/scroll-area";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";


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
  password: z.string().min(8, "Password must be at least 8 characters.").optional().or(z.literal('')),
  websiteUrl: z.string().url("Please enter a valid URL.").nullable().optional().or(z.literal('')),
  orderIdPrefix: z.string().nullable().optional(),
  status: z.enum(["Active", "Inactive"]),
  nationality: z.string().min(2, "Please enter a valid nationality.").nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  idType: z.enum(["Passport", "Driver License", "ID Card"]).nullable().optional(),
  
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountType: z.string().nullable().optional(),
  bankEmail: z.string().email().nullable().optional().or(z.literal('')),

  walletAddress: z.string().nullable().optional(),
  network: z.string().nullable().optional(),
  
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
    interac: gatewayFeeSchema.optional(),
    wise: gatewayFeeSchema.optional(),
  }).optional(),
  salesAgentId: z.string().optional(),
  commissionRates: z.object({
      stripe: feeSchema.optional(),
      square: feeSchema.optional(),
      zelle: feeSchema.optional(),
      interac: feeSchema.optional(),
      wise: feeSchema.optional(),
  }).optional(),
  merchantDailyLimits: z.record(z.any()).optional(),
});


type MerchantFormValues = z.infer<typeof merchantFormSchema>;

const sanitizeForForm = (value: any): any => {
  // Keep only plain objects and arrays. This ensures we don't pass class
  // instances (including Zod internals) into react-hook-form defaults.
  console.log('sanitizeForForm input:', value);
  const seen = new WeakSet();
  console.log('sanitizeForForm: initialized seen set');
  const isPlainObject = (o: any) => {
    if (!o || typeof o !== 'object') return false;
    const proto = Object.getPrototypeOf(o);
    return proto === Object.prototype || proto === null;
  };
  console.log('sanitizeForForm: defined isPlainObject helper');
  const _sanitize = (v: any, path: string = '<root>') => {
    console.log(`sanitizeForForm: enter path=${path} valueType=${v === null ? 'null' : typeof v}`);
    if (v === null || v === undefined) {
      console.log(`sanitizeForForm: path=${path} -> null/undefined`);
      return v;
    }
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      console.log(`sanitizeForForm: path=${path} -> primitive (${t}) =`, v);
      return v;
    }
    if (v instanceof Date) {
      const iso = v.toISOString();
      console.log(`sanitizeForForm: path=${path} -> Date ->`, iso);
      return iso;
    }
    if (Array.isArray(v)) {
      console.log(`sanitizeForForm: path=${path} -> array length=${v.length}`);
      return v.map((item, i) => _sanitize(item, `${path}[${i}]`));
    }
    if (isPlainObject(v)) {
      if (seen.has(v)) {
        console.log(`sanitizeForForm: path=${path} -> cycle detected, omitting`);
        return undefined;
      }
      seen.add(v);
      const out: any = {};
      console.log(`sanitizeForForm: path=${path} -> plain object, keys=${Object.keys(v).join(',')}`);
      for (const k of Object.keys(v)) {
        try {
          const sv = _sanitize(v[k], `${path}.${k}`);
          if (typeof sv !== 'undefined') {
            out[k] = sv;
            console.log(`sanitizeForForm: path=${path}.${k} -> kept`);
          } else {
            console.log(`sanitizeForForm: path=${path}.${k} -> omitted`);
          }
        } catch (e) {
          console.warn(`sanitizeForForm: path=${path}.${k} -> sanitize error`, e);
        }
      }

      // Coerce fee value strings to numbers where appropriate to match schema expectations
      if (out && typeof out === 'object') {
        const maybeFeeKeys = ['value'];
        for (const fk of maybeFeeKeys) {
          if (fk in out && typeof out[fk] === 'string' && out[fk] !== '') {
            const n = Number(out[fk]);
            console.log(`sanitizeForForm: path=${path}.${fk} coercing string->number candidate='${out[fk]}' => ${n}`);
            out[fk] = Number.isNaN(n) ? out[fk] : n;
          }
        }
      }

      console.log(`sanitizeForForm: path=${path} -> returning object keys=${Object.keys(out).join(',')}`);
      return out;
    }
    // not a plain object -> omit (filters Zod instances, class instances, functions)
    console.log(`sanitizeForForm: path=${path} -> non-plain object or function, omitting`);
    return undefined;
  };

  try {
    return _sanitize(value);
  } catch (e) {
    console.warn('sanitizeForForm failed', e);
    return undefined;
  }
}

// Ensure form default values use stable primitive types so components
// don't switch between uncontrolled and controlled states.
const normalizeFormValues = (v: any) => {
  const out: any = {
    name: v?.name ?? "",
    email: v?.email ?? "",
    password: "",
    websiteUrl: v?.websiteUrl ?? "",
    orderIdPrefix: v?.orderIdPrefix ?? "",
    status: v?.status ?? "Active",
    nationality: v?.nationality ?? "",
    dateOfBirth: v?.dateOfBirth ?? "",
    idType: v?.idType ?? "",
    bankName: v?.bankName ?? "",
    bankAccountNumber: v?.bankAccountNumber ?? "",
    bankAccountType: v?.bankAccountType ?? "",
    bankEmail: v?.bankEmail ?? "",
    walletAddress: v?.walletAddress ?? "",
    network: v?.network ?? "",
    photoId: v?.photoId ?? null,
    businessDocument: v?.businessDocument ?? null,
    salesAgentId: v?.salesAgentId ?? "none",
    commissionRates: {},
    paymentGatewayFees: {},
    merchantDailyLimits: {},
    settlementFees: {},
    ...v,
  };

  // Normalize payment gateways and fee shapes
  const gateways = ['stripe','square','zelle','interac','wise'];
  for (const g of gateways) {
    const pg = (out.paymentGatewayFees && out.paymentGatewayFees[g]) || {};
    out.paymentGatewayFees[g] = {
      enabled: typeof pg.enabled === 'boolean' ? pg.enabled : false,
      transactionFee: {
        value: typeof pg.transactionFee?.value === 'number' ? pg.transactionFee.value : (pg.transactionFee?.value ?? ''),
        type: pg.transactionFee?.type ?? ''
      },
      transactionFeeFixed: {
        value: typeof pg.transactionFeeFixed?.value === 'number' ? pg.transactionFeeFixed.value : (pg.transactionFeeFixed?.value ?? ''),
        type: pg.transactionFeeFixed?.type ?? ''
      },
      refundFee: {
        value: typeof pg.refundFee?.value === 'number' ? pg.refundFee.value : (pg.refundFee?.value ?? ''),
        type: pg.refundFee?.type ?? ''
      },
      chargebackFee: {
        value: typeof pg.chargebackFee?.value === 'number' ? pg.chargebackFee.value : (pg.chargebackFee?.value ?? ''),
        type: pg.chargebackFee?.type ?? ''
      }
    };

    const comm = (out.commissionRates && out.commissionRates[g]) || {};
    out.commissionRates[g] = {
      value: typeof comm.value === 'number' ? comm.value : (comm.value ?? ''),
      type: comm.type ?? ''
    };

    const mdl = (out.merchantDailyLimits && out.merchantDailyLimits[g]) || {};
    out.merchantDailyLimits[g] = {
      dailyLimit: typeof mdl.dailyLimit === 'number' ? mdl.dailyLimit : (mdl.dailyLimit ?? ''),
      dailyUsed: typeof mdl.dailyUsed === 'number' ? mdl.dailyUsed : (mdl.dailyUsed ?? 0),
    };
  }

  // Settlement fees
  out.settlementFees = out.settlementFees || {};
  const sf = out.settlementFees;
  sf.domesticTransferFee = sf.domesticTransferFee || { value: '', type: '' };
  sf.internationalTransferFee = sf.internationalTransferFee || { value: '', type: '' };
  sf.cryptoTransferFee = sf.cryptoTransferFee || { value: '', type: '' };

  return out;
}
interface EditMerchantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerchantUpdated: (merchantId: string) => void;
  merchant: Merchant | null;
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
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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


const GatewayFeeSection = ({ gatewayName, control }: { gatewayName: 'stripe' | 'square' | 'zelle' | 'interac' | 'wise', control: any }) => {
    const isEnabled = useWatch({
      control,
      name: `paymentGatewayFees.${gatewayName}.enabled`,
    });
    // Watch merchant daily limits so we can show when a gateway is disabled by usage
    const merchantDailyLimits = useWatch({ control, name: 'merchantDailyLimits' }) as Record<string, any> | undefined;
    const limitEntry = merchantDailyLimits ? merchantDailyLimits[gatewayName] : undefined;
    let limitReached = false;
    let limitDisplay = '';
    if (limitEntry && typeof limitEntry !== 'string') {
      const dailyLimit = limitEntry.dailyLimit === '' || limitEntry.dailyLimit === null || typeof limitEntry.dailyLimit === 'undefined' ? null : Number(limitEntry.dailyLimit);
      const dailyUsed = typeof limitEntry.dailyUsed === 'undefined' || limitEntry.dailyUsed === null || limitEntry.dailyUsed === '' ? 0 : Number(limitEntry.dailyUsed);
      if (dailyLimit !== null && !Number.isNaN(dailyLimit)) {
        limitReached = dailyUsed >= dailyLimit;
        limitDisplay = `${dailyUsed.toFixed(2)} / ${dailyLimit.toFixed(2)}`;
      }
    }
  
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
                {limitReached && (
                  <div className="ml-2">
                    <Badge variant="destructive" title={`Daily limit reached (${limitDisplay})`}>
                      Limit reached
                    </Badge>
                  </div>
                )}
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
                 <FormField
                   control={control}
                   name={`merchantDailyLimits.${gatewayName}.dailyLimit`}
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel className="text-xs">Daily Limit (leave empty for unlimited)</FormLabel>
                       <FormControl>
                         <Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} value={field.value ?? ''} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
            </div>
         )}
      </div>
    );
};

export function EditMerchantDialog({ open, onOpenChange, onMerchantUpdated, merchant }: EditMerchantDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [salesAgents, setSalesAgents] = useState<User[]>([]);
    const [showPassword, setShowPassword] = useState(false);

  
  // Do not use a resolver to avoid react-hook-form invoking Zod internals.
  // We'll perform manual sanitation and validation at submit time.
  const form = useForm<MerchantFormValues>({
    mode: 'onSubmit',
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

  

  useEffect(() => {
    console.log('EditMerchantDialog: merchant prop changed', merchant);
    if (!merchant || !open) return;

    let active = true;
    const fetchAndReset = async () => {
      // Prepare defaults
      const defaultGatewayFees = {
        stripe: { enabled: false, transactionFee: {}, transactionFeeFixed: {}, refundFee: {}, chargebackFee: {} },
        square: { enabled: false, transactionFee: {}, transactionFeeFixed: {}, refundFee: {}, chargebackFee: {} },
        zelle: { enabled: false, transactionFee: {}, transactionFeeFixed: {}, refundFee: {}, chargebackFee: {} },
        interac: { enabled: false, transactionFee: {}, transactionFeeFixed: {}, refundFee: {}, chargebackFee: {} },
        wise: { enabled: false, transactionFee: {}, transactionFeeFixed: {}, refundFee: {}, chargebackFee: {} },
      };

      // Start with the prop merchant, but attempt to fetch the freshest server copy
      let source: Merchant = merchant;
      try {
        const res = await fetch(`/api/merchants-v2/${merchant.id}`);
        if (active && res.ok) {
          const data = await res.json();
          source = data as Merchant;
          console.debug('EditMerchantDialog: fetched fresh merchant data', source);
        } else if (!res.ok) {
          console.warn('EditMerchantDialog: failed to fetch fresh merchant, using provided prop', { status: res.status });
        }
      } catch (e) {
        console.warn('EditMerchantDialog: error fetching fresh merchant, using provided prop', e);
      }

      if (!active) return;

      const paymentGatewayFees = {
        stripe: { ...defaultGatewayFees.stripe, ...(source.paymentGatewayFees?.stripe || {}) },
        square: { ...defaultGatewayFees.square, ...(source.paymentGatewayFees?.square || {}) },
        zelle: { ...defaultGatewayFees.zelle, ...(source.paymentGatewayFees?.zelle || {}) },
        interac: { ...defaultGatewayFees.interac, ...(source.paymentGatewayFees?.interac || {}) },
        wise: { ...defaultGatewayFees.wise, ...(source.paymentGatewayFees?.wise || {}) },
      };

      const formValues = {
        ...source,
        password: "",
        dateOfBirth: source.dateOfBirth ? new Date(source.dateOfBirth).toISOString().split('T')[0] : "",
        salesAgentId: source.salesAgentId || "none",
        paymentGatewayFees: paymentGatewayFees,
        merchantDailyLimits: (source as any).merchantDailyLimits || {},
      };

      // Sanitize and normalize to stable primitives to avoid uncontrolled->controlled
      console.log("EditMerchantDialog: resetting form with merchant data", { formValues });
      try {
        const sanitized = sanitizeForForm(formValues);
        const normalized = normalizeFormValues(sanitized || formValues || {});
        console.log('EditMerchantDialog: resetting form with sanitized+normalized formValues', normalized);
        form.reset(normalized as any);
      } catch (e) {
        console.warn('EditMerchantDialog: JSON sanitize/normalize failed, resetting with raw formValues', e, formValues);
        const normalized = normalizeFormValues(formValues || {});
        form.reset(normalized as any);
      }
    };

    fetchAndReset();
    return () => { active = false; };
  }, [merchant, open, form]);

  const onSubmit = async (values: MerchantFormValues) => {
    console.log('on submit start');
    console.log('EditMerchantDialog: onSubmit called with values', values); 
    if (!merchant) return;
    setIsLoading(true);

    const dataToSubmit: any = { 
        ...values,
        salesAgentId: values.salesAgentId === 'none' ? '' : values.salesAgentId,
     };
    if (!dataToSubmit.password) {
      delete dataToSubmit.password;
    }
    
    if (values.photoId && values.photoId instanceof File) {
        dataToSubmit.photoId = await toBase64(values.photoId);
    } else {
        delete dataToSubmit.photoId;
    }

    if (values.businessDocument && values.businessDocument instanceof File) {
        dataToSubmit.businessDocument = await toBase64(values.businessDocument);
    } else {
        delete dataToSubmit.businessDocument;
    }

    try {
      const response = await fetch(`/api/merchants-v2/${merchant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });
      console.log('EditMerchantDialog: PUT payload', dataToSubmit);

      if (!response.ok) {
        throw new Error('Failed to update merchant');
      }
      
      const updatedMerchant = await response.json();
      console.log('EditMerchantDialog: PUT response', updatedMerchant);
      
      toast({
        title: "Merchant Updated",
        description: `Merchant "${values.name}" has been updated successfully.`,
      });

      onMerchantUpdated(updatedMerchant.id);
      onOpenChange(false);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem updating the merchant. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Robust stripper to remove any runtime/schema-like objects before validation
  const stripZodLikeSafe = (v: any, path = '<root>', seen = new WeakSet()): any => {
    try {
      if (v === null || v === undefined) return v;
    } catch (e) {
      console.warn('stripZodLikeSafe: early access error', { path, error: e });
      return undefined;
    }
    if (typeof v !== 'object') return v;
    if (seen.has(v)) return undefined;
    // Guarded detection
    try {
      if ((v as any)._def || (v as any)._zod) {
        console.warn('stripZodLikeSafe: stripping Zod-like object at', path);
        return undefined;
      }
    } catch (e) {
      console.warn('stripZodLikeSafe: reading _def/_zod threw, stripping', { path, error: e });
      return undefined;
    }
    seen.add(v);
    if (Array.isArray(v)) return v.map((it, i) => stripZodLikeSafe(it, `${path}[${i}]`, seen)).filter((x) => typeof x !== 'undefined');
    const out: any = {};
    let keys: string[] = [];
    try { keys = Object.keys(v); } catch (e) { console.warn('stripZodLikeSafe: Object.keys threw', { path, error: e }); return undefined; }
    for (const k of keys) {
      let child;
      try { child = (v as any)[k]; } catch (e) { console.warn('stripZodLikeSafe: reading prop threw', { path: `${path}.${k}`, error: e }); continue; }
      const cleaned = stripZodLikeSafe(child, path ? `${path}.${k}` : k, seen);
      if (typeof cleaned !== 'undefined') out[k] = cleaned;
    }
    return out;
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
    }
  };

  if (!merchant) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Merchant</DialogTitle>
          <DialogDescription>
            Update the details for {merchant.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <ScrollArea className="max-h-[70vh]">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // Get raw values from the form and perform manual sanitization
                  const rawValues = form.getValues();
                  console.debug('EditMerchantDialog: rawValues before sanitize', rawValues);
                  const cleaned = sanitizeForForm(rawValues) || {};

                  // coerce merchantDailyLimits strings -> numbers
                  if (cleaned && typeof cleaned === 'object' && cleaned.merchantDailyLimits && typeof cleaned.merchantDailyLimits === 'object') {
                    for (const [k, v] of Object.entries(cleaned.merchantDailyLimits)) {
                      if (typeof v === 'string' && v !== '') {
                        const n = Number(v);
                        cleaned.merchantDailyLimits[k] = Number.isNaN(n) ? v : n;
                      }
                    }
                  }

                  // Further strip any runtime/schema objects that survived sanitizeForForm
                  const finalClean = stripZodLikeSafe(cleaned) || {};
                  console.debug('EditMerchantDialog: finalClean before validation', finalClean);

                  // Run Zod validation manually and show errors if any
                  let result;
                  try {
                    result = merchantFormSchema.safeParse(finalClean);
                  } catch (parseErr) {
                    // Zod threw unexpectedly (likely due to a runtime/schema-like value lurking).
                    console.error('EditMerchantDialog: safeParse threw, falling back to raw submission', parseErr, { finalClean, rawValues });
                    // As a safe fallback, send a JSON-roundtripped version of the raw values to the API
                    try {
                      const fallback = JSON.parse(JSON.stringify(rawValues || {}));
                      await onSubmit(fallback as any);
                    } catch (sendErr) {
                      console.error('EditMerchantDialog: fallback submit failed', sendErr);
                      toast({ variant: 'destructive', title: 'Submission failed', description: 'Could not submit data.' });
                    }
                    return;
                  }

                  if (!result.success) {
                    const errors: any = {};
                    for (const issue of result.error.errors) {
                      const path = issue.path.join('.') || '_root';
                      errors[path] = { type: 'validation', message: issue.message };
                    }
                    console.warn('EditMerchantDialog: validation failed', result.error, { cleaned });
                    // Set form errors for UI
                    for (const [path, err] of Object.entries(errors)) {
                      // react-hook-form expects nested paths with dot notation
                      try { form.setError(path as any, { type: (err as any).type, message: (err as any).message } as any); } catch (_e) {}
                    }
                    return;
                  }

                  // If validation passed, call existing onSubmit with parsed data
                  const validated = result.data as MerchantFormValues;
                  // Call the same submit handler that sends the PUT
                  await onSubmit(validated);
                } catch (err) {
                  console.error('EditMerchantDialog: manual submit threw', err);
                  toast({ variant: 'destructive', title: 'Submission failed', description: 'Unexpected error during submit.' });
                }
              }}
              className="space-y-4 py-4 pr-6"
            >
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
                      <Input type="email" placeholder="e.g., merchant@example.com" {...field} disabled={isLoading} />
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
                    <FormLabel>New Password (Optional)</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input type={showPassword ? "text" : "password"} placeholder="Leave blank to keep current password" {...field} disabled={isLoading} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
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
                      <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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
                      <Input placeholder="https://example.com" {...field} value={field.value ?? ""} disabled={isLoading} />
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
                      <Input placeholder="e.g., GADGETS" {...field} value={field.value ?? ""} disabled={isLoading} />
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
                      <Input placeholder="e.g., American" {...field} value={field.value ?? ""} disabled={isLoading} />
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
                      <Input type="date" {...field} value={field.value ?? ""} disabled={isLoading} />
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={isLoading}>
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
                    <FormLabel>Upload New Photo ID</FormLabel>
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
                    <FormLabel>Upload New Business Document</FormLabel>
                    <FormControl>
                      <Input type="file" accept="image/*,application/pdf,.doc,.docx,.txt" onChange={(e) => field.onChange(e.target.files?.[0])} disabled={isLoading}/>
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
                        <Input placeholder="e.g., Chase Bank" {...field} value={field.value ?? ""} disabled={isLoading} />
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
                        <Input placeholder="e.g., 123456789" {...field} value={field.value ?? ""} disabled={isLoading}/>
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
                        <Input placeholder="e.g., Business Checking" {...field} value={field.value ?? ""} disabled={isLoading}/>
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
                        <Input type="email" placeholder="e.g., billing@example.com" {...field} value={field.value ?? ""} disabled={isLoading}/>
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
                        <Input placeholder="e.g., 0x..." {...field} value={field.value ?? ""} disabled={isLoading} />
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
                        <Input placeholder="e.g., Ethereum (ERC-20)" {...field} value={field.value ?? ""} disabled={isLoading} />
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
                    <GatewayFeeSection gatewayName="interac" control={form.control} />
                    <GatewayFeeSection gatewayName="wise" control={form.control} />
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
                          <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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
                        <FeeInput name="commissionRates.interac" control={form.control} label="Interac Commission" />
                        <FeeInput name="commissionRates.wise" control={form.control} label="Wise Commission" />
                    </div>
                </div>

                

              <DialogFooter className="sticky bottom-0 bg-background/95 pt-4">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
