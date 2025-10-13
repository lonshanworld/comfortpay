
import { z } from 'zod';

// Schema for sending a support email
export const SendSupportEmailInputSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  recipient: z.string().email().describe('The email address of the support team.'),
});

// Schema for a single transaction item
const OrderItemSchema = z.object({
  name: z.string().describe('The name of the product.'),
  quantity: z.number().int().positive().describe('The quantity of the product.'),
  price: z.number().positive().describe('The price of a single unit of the product.'),
});

// Schema for billing details
const BillingDetailsSchema = z.object({
  firstName: z.string().describe("The customer's first name."),
  lastName: z.string().describe("The customer's last name."),
  address1: z.string().describe("The primary line of the customer's billing address."),
  address2: z.string().optional().describe("The optional secondary line of the customer's billing address."),
  city: z.string().describe("The city of the customer's billing address."),
  state: z.string().describe("The state or province of the customer's billing address."),
  postcode: z.string().describe("The postal code of the customer's billing address."),
  country: z.string().describe("The country of the customer's billing address."),
  email: z.string().email().describe("The customer's email address."),
  phone: z.string().optional().describe("The customer's phone number."),
});

// Schema for payment details, which can include the prefix
const PaymentDetailsSchema = z.object({
  prefix_order_name: z.string().optional().describe('The prefix for the transaction name sent to the payment processor.'),
  qrCodeUrl: z.string().url().optional().nullable().describe('The URL for the Zelle QR code image.'),
  accountEmail: z.string().email().optional().describe('The email address for the Zelle account.'),
});

// Schema for creating a checkout session
export const CreateCheckoutSessionInputSchema = z.object({
  totalAmount: z.number().positive().describe('The total transaction amount.'),
   subtotal: z.number().min(0).optional().describe('The subtotal before taxes and shipping.'),
  taxAmount: z.number().min(0).optional().describe('The total tax amount.'),
  shippingAmount: z.number().min(0).optional().describe('The total shipping amount.'),
  discountAmount: z.number().min(0).optional().describe('The total discount amount.'),
  merchantId: z.string().optional().describe("The ID of the merchant for this transaction."),
  merchantOrderId: z.string().describe("The merchant's unique transaction identifier."),
  visualOrderId: z.string().optional().describe('The transaction ID that is shown to the customer and sent to the payment processor.'),
  redirectUrl: z.string().url().optional().describe('The URL to redirect the user to after payment completion.'),
  wooCommerceOrderReceivedUrl: z.string().url().optional().describe('The standard WooCommerce thank you page URL.'),
  paymentMethod: z.enum(['card', 'zelle']).describe('The selected payment method.'),
  processor: z.enum(['Stripe', 'Square', 'Zelle']).optional().describe('The specific payment processor to use.'),
  billingDetails: BillingDetailsSchema.describe('The customer\'s billing information.'),
  items: z.array(OrderItemSchema).describe('The list of items in the transaction.'),
  paymentDetails: PaymentDetailsSchema.optional().describe('Details specific to the payment processor account.'),
  currency: z.string().optional().describe('The currency of the transaction.'),
  merchantLogoUrl: z.string().url().optional().nullable().describe("The URL of the merchant's logo to display on checkout."),
});

// Schema for the transaction notification action
export const SendOrderNotificationInputSchema = z.object({
    recipientType: z.enum(['customer', 'merchant']),
    customerEmail: z.string().email().optional(),
    merchantEmail: z.string().email().optional(),
    merchantName: z.string(),
    orderDetails: CreateCheckoutSessionInputSchema,
});
