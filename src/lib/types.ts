
import type { CreateCheckoutSessionInputSchema, SendOrderNotificationInputSchema } from "./schemas";
import type { z } from "zod";

export type OrderStatus = "Pending" | "Completed" | "Failed" | "Requires Confirmation" | "Refunded" | "Reconciled";
export type PaymentMethod = "Credit Card" | "Zelle";
export type PaymentType = "Stripe" | "Square" | "Zelle";

export interface BillingDetails {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone?: string;
}

export interface OrderItem {
    name: string;
    quantity: number;
    price: number;
}

export interface Order {
  id: string; // ComfortPay Transaction ID
  merchantId: string;
  merchantOrderId: string; // ID from the merchant's system (e.g., WooCommerce)
  visualOrderId?: string; // The ID sent to the payment processor
  merchantName: string;
  orderDate: string; // The date the transaction was created
  paymentReceivedDate?: string; // The date the payment was confirmed
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  orderAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string; // e.g., "USD", "EUR"
  paymentType: PaymentType;
  processor?: PaymentAccountType;
  paymentGatewayTransactionId?: string; // e.g., Stripe's ch_... or a Zelle confirmation code
  merchantWebsiteUrl?: string;
  sourceWebsiteUrl?: string;
  billingDetails?: BillingDetails;
  items?: OrderItem[];
}

export type IdType = "Passport" | "Driver License" | "ID Card";

export interface Fee {
  value?: number;
  type?: 'percentage' | 'flat';
}

export interface GatewayFee {
  enabled?: boolean;
  transactionFee?: Fee;
  refundFee?: Fee;
  chargebackFee?: Fee;
}

export type UserRole = "Admin" | "Merchant" | "Sale Agent" | "Staff";

export interface Permissions {
    view_dashboard?: boolean;
    view_transactions?: boolean;
    edit_transactions?: boolean;
    view_merchants?: boolean;
    edit_merchants?: boolean;
    view_users?: boolean;
    edit_users?: boolean;
    manage_settings?: boolean;
}

// A single unified User type for all roles
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: string;
  status: "Active" | "Inactive";
  permissions?: string; // JSON string for staff permissions
  
  // Merchant-specific fields
  dateJoined?: string;
  nationality?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  idType?: IdType;
  photoIdUrl?: string; // URL to uploaded photo
  businessDocumentUrl?: string; // URL to uploaded document
  token?: string;
  websiteUrl?: string;
  orderIdPrefix?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  bankEmail?: string;
  walletAddress?: string;
  network?: string;
  salesAgentId?: string;
  settlementFees?: {
    domesticTransferFee?: Fee;
    internationalTransferFee?: Fee;
    cryptoTransferFee?: Fee;
  };
  paymentGatewayFees?: {
    stripe?: GatewayFee;
    square?: GatewayFee;
    zelle?: GatewayFee;
  };
  commissionRates?: {
    stripe?: Fee;
    square?: Fee;
    zelle?: Fee;
  };
}

// Redefine Merchant as a User for type compatibility where needed, but User is the primary type now.
export type Merchant = User;


export type PaymentAccountType = "Stripe" | "Square" | "Zelle";

export interface PaymentAccount {
  id: string;
  type: PaymentAccountType;
  name: string;
  status: "Active" | "Inactive";
  dailyLimit: number;
  currentVolume: number;
  prefix_order_name?: string;
  websiteUrl: string;
  accountEmail?: string; // For Zelle
}

export interface DashboardStats {
  totalRevenue: {
    value: number;
    change: string;
  };
  merchants: {
    value: string;
    change: string;
  };
  sales: {
    value: string;
    change: string;
  };
  pendingConfirmation: {
    value: string;
    change: string;
  };
  recentTransactions: {
    customerName: string;
    customerEmail: string;
    type: string;
    status: string;
    date: string;
    amount: number;
  }[];
  revenueChart: {
    month: string;
    revenue: number;
  }[];
}

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInputSchema> & {
    comfortPayOrderId?: string;
    merchantOrigin?: string;
};

export type SendOrderNotificationInput = z.infer<typeof SendOrderNotificationInputSchema>;

export type SendOrderNotificationOutput = {
    success: boolean;
    message: string;
};
