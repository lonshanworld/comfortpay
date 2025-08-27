

// This file is a plain JS copy of in-memory-db.ts to be used by the node script for DB initialization,
// as the script runs outside the Next.js/TypeScript compilation context.

const sampleBillingDetails = {
    firstName: 'Alice',
    lastName: 'Johnson',
    address1: '456 Oak Avenue',
    address2: 'Suite 200',
    city: 'Metropolis',
    state: 'NY',
    postcode: '10001',
    country: 'US',
    email: 'alice@example.com',
    phone: '555-555-5555'
};

const defaultSettlementFees = {
    domesticTransferFee: 2.50,
    internationalTransferFee: 5.00,
    cryptoTransferFee: 1.00,
};

const defaultGatewayFees = {
    stripe: {
        enabled: true,
        transactionFeePercentage: 2.9,
        transactionFeeFlat: 0.30,
        refundFee: 0,
        chargebackFee: 15,
    },
    square: {
        enabled: true,
        transactionFeePercentage: 2.6,
        transactionFeeFlat: 0.10,
        refundFee: 0,
        chargebackFee: 20,
    },
    zelle: {
        enabled: true,
        transactionFeePercentage: 0,
        transactionFeeFlat: 0,
        refundFee: 0,
        chargebackFee: 0,
    },
};


const initialUsers = [
  // Admins
  { id: 'user_1', name: 'Admin User', email: 'admin@comfortpay.com', password: 'password', role: 'Admin', createdAt: '2023-01-01T12:00:00Z', status: 'Active' },
  
  // Merchants
  { 
    id: 'user_2', 
    name: 'Gadget Store', 
    email: 'merchant@comfortpay.com',
    password: 'password', 
    role: 'Merchant',
    createdAt: '2023-01-15T12:00:00Z',
    status: 'Active', 
    nationality: 'American',
    dateOfBirth: '1985-05-20',
    idType: 'Driver License',
    token: 'tok_123abc', 
    websiteUrl: 'https://gadgetstore.example.com',
    orderIdPrefix: 'GADGETS', 
    bankName: 'Chase', 
    bankAccountNumber: '123456789', 
    bankAccountType: 'Checking', 
    bankEmail: 'billing@gadgetstore.com', 
    walletAddress: '0x123...abc', 
    network: 'Ethereum (ERC-20)',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
    salesAgentId: 'user_3',
    commissionRates: { stripe: 1.5, square: 1.5, zelle: 0.5 },
  },
  { 
    id: 'user_5', 
    name: 'Bookworm Nook', 
    email: 'jane.smith@bookworm.com', 
    password: 'password',
    role: 'Merchant',
    createdAt: '2023-03-22T12:00:00Z',
    status: 'Active', 
    nationality: 'British',
    dateOfBirth: '1990-11-12',
    idType: 'Passport',
    token: 'tok_456def', 
    websiteUrl: 'https://bookwormnook.example.com',
    orderIdPrefix: '', // No prefix
    bankName: 'Bank of America', 
    bankAccountNumber: '987654321', 
    bankAccountType: 'Business Checking', 
    bankEmail: 'finance@bookworm.com',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
    salesAgentId: 'user_7',
    commissionRates: { stripe: 1.2, square: 1.2, zelle: 0.2 },
  },
  { 
    id: 'user_8',
    name: 'Crafty Creations', 
    email: 'sam.wilson@crafty.com', 
    password: 'password',
    role: 'Merchant',
    createdAt: '2023-05-10T12:00:00Z',
    status: 'Inactive',
    token: 'tok_789ghi', 
    websiteUrl: 'https://craftycreations.example.com',
    orderIdPrefix: 'CRAFTY',
    bankName: 'Wells Fargo', 
    bankAccountNumber: '1122334455', 
    bankAccountType: 'Savings', 
    bankEmail: 'accounts@crafty.com', 
    walletAddress: 'bc1q...', 
    network: 'Bitcoin',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
  },
   { 
    id: 'user_9',
    name: 'Tech Innovators', 
    email: 'maria.garcia@tech.com', 
    password: 'password',
    role: 'Merchant',
    createdAt: '2023-08-01T12:00:00Z',
    status: 'Active',
    nationality: 'Spanish',
    dateOfBirth: '1992-07-14',
    idType: 'ID Card',
    token: 'tok_jklmno', 
    websiteUrl: 'https://techinnovators.example.com',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
    salesAgentId: 'user_3',
    commissionRates: { stripe: 2.0, square: 2.0, zelle: 1.0 },
  },
  { 
    id: 'user_10',
    name: 'Fashion Forward',
    email: 'style@fashionforward.com',
    password: 'password',
    role: 'Merchant',
    createdAt: '2023-09-05T10:00:00Z',
    status: 'Active',
    websiteUrl: 'https://fashionforward.example.com',
    orderIdPrefix: 'FF',
    salesAgentId: 'user_7',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
    commissionRates: { stripe: 1.8, square: 1.8, zelle: 0.8 },
  },
  { 
    id: 'user_12',
    name: 'Healthy Bites',
    email: 'contact@healthybites.com',
    password: 'password',
    role: 'Merchant',
    createdAt: '2023-11-15T10:00:00Z',
    status: 'Active',
    websiteUrl: 'https://healthybites.example.com',
    orderIdPrefix: 'HB',
    salesAgentId: 'user_13',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
    commissionRates: { stripe: 2.2, square: 2.2, zelle: 1.2 },
  },
  { 
    id: 'user_14',
    name: 'Pet Palace',
    email: 'info@petpalace.com',
    password: 'password',
    role: 'Merchant',
    createdAt: '2024-01-20T10:00:00Z',
    status: 'Active',
    websiteUrl: 'https://petpalace.example.com',
    orderIdPrefix: 'PET',
    settlementFees: defaultSettlementFees,
    paymentGatewayFees: defaultGatewayFees,
  },

  // Sale Agents
  { id: 'user_3', name: 'Agent Smith', email: 'agent.smith@comfortpay.com', password: 'password', role: 'Sale Agent', createdAt: '2023-02-01T12:00:00Z', status: 'Active' },
  { id: 'user_7', name: 'Trinity', email: 'trinity@comfortpay.com', password: 'password', role: 'Sale Agent', createdAt: '2023-05-15T12:00:00Z', status: 'Active' },
  { id: 'user_13', name: 'Morpheus Prime', email: 'morpheus.prime@comfortpay.com', password: 'password', role: 'Sale Agent', createdAt: '2023-10-20T12:00:00Z', status: 'Active' },
  
  // Staff
  { id: 'user_4', name: 'Support Staff', email: 'support@comfortpay.com', password: 'password', role: 'Staff', createdAt: '2023-02-10T12:00:00Z', status: 'Active', permissions: '{"view_transactions":true,"view_merchants":true}' },
  { id: 'user_6', name: 'Finance Staff', email: 'finance@comfortpay.com', password: 'password', role: 'Staff', createdAt: '2023-04-01T12:00:00Z', status: 'Active', permissions: '{"view_dashboard":true,"view_transactions":true,"edit_transactions":true}' },
  { id: 'user_11', name: 'Compliance Officer', email: 'compliance@comfortpay.com', password: 'password', role: 'Staff', createdAt: '2023-10-01T09:00:00Z', status: 'Active', permissions: '{"view_dashboard":true, "view_transactions":true, "view_merchants":true, "view_users":true}' },
  { id: 'user_15', name: 'Junior Admin', email: 'junior.admin@comfortpay.com', password: 'password', role: 'Staff', createdAt: '2024-02-01T09:00:00Z', status: 'Active', permissions: '{"view_dashboard":true, "view_merchants":true, "edit_merchants":true, "view_users":true, "edit_users":true}' },

];

const initialMerchants = initialUsers.filter(u => u.role === 'Merchant');

const initialOrders = [
  // Orders for Gadget Store (user_2)
  { id: 'CP1001', merchantId: 'user_2', merchantOrderId: 'WC-2024-589', visualOrderId: 'GADGETS-WC-2024-589', orderDate: '2024-07-20T10:30:00Z', paymentReceivedDate: '2024-07-20T10:30:15Z', customerName: 'Alice Johnson', customerEmail: 'alice@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 299.99, totalAmount: 299.99, paidAmount: 299.99, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PbQ4v...', billingDetails: sampleBillingDetails },
  { id: 'CP1003', merchantId: 'user_2', merchantOrderId: 'WC-2024-590', visualOrderId: 'GADGETS-WC-2024-590', orderDate: '2024-07-19T15:00:00Z', paymentReceivedDate: '2024-07-19T15:00:10Z', customerName: 'Charlie Brown', customerEmail: 'charlie@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 999.00, totalAmount: 999.00, paidAmount: 999.00, currency: 'EUR', paymentType: 'Square', paymentGatewayTransactionId: 'sq_order_...', billingDetails: {...sampleBillingDetails, firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com'} },
  { id: 'CP1006', merchantId: 'user_2', merchantOrderId: 'WC-2024-591', visualOrderId: 'GADGETS-WC-2024-591', orderDate: '2024-07-18T18:45:00Z', customerName: 'Frank White', customerEmail: 'frank@example.com', status: 'Requires Confirmation', paymentMethod: 'Zelle', orderAmount: 75.00, totalAmount: 75.00, paidAmount: 0, currency: 'EUR', paymentType: 'Zelle', paymentGatewayTransactionId: 'ZELLE-CONF-67890', billingDetails: {...sampleBillingDetails, firstName: 'Frank', lastName: 'White', email: 'frank@example.com'} },
  { id: 'CP1010', merchantId: 'user_2', merchantOrderId: 'WC-2024-592', visualOrderId: 'GADGETS-WC-2024-592', orderDate: '2024-06-15T11:00:00Z', paymentReceivedDate: '2024-06-15T11:00:25Z', customerName: 'Heidi Klum', customerEmail: 'heidi@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 129.99, totalAmount: 129.99, paidAmount: 129.99, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PbQ5x...', billingDetails: {...sampleBillingDetails, firstName: 'Heidi', lastName: 'Klum'} },
  { id: 'CP1014', merchantId: 'user_2', merchantOrderId: 'WC-2024-600', visualOrderId: 'GADGETS-WC-2024-600', orderDate: '2024-07-22T14:00:00Z', paymentReceivedDate: '2024-07-22T14:00:15Z', customerName: 'Leo Fitz', customerEmail: 'leo.fitz@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 49.99, totalAmount: 49.99, paidAmount: 49.99, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PcQ8a...', billingDetails: {...sampleBillingDetails, firstName: 'Leo', lastName: 'Fitz'} },

  // Orders for Bookworm Nook (user_5)
  { id: 'CP1002', merchantId: 'user_5', merchantOrderId: 'BN-8123', visualOrderId: 'Digital Book #BN-8123', orderDate: '2024-07-20T11:00:00Z', customerName: 'Bob Williams', customerEmail: 'bob@example.com', status: 'Requires Confirmation', paymentMethod: 'Zelle', orderAmount: 45.50, totalAmount: 45.50, paidAmount: 0, currency: 'USD', paymentType: 'Zelle', paymentGatewayTransactionId: 'ZELLE-CONF-98765', billingDetails: {...sampleBillingDetails, firstName: 'Bob', lastName: 'Williams', email: 'bob@example.com'} },
  { id: 'CP1005', merchantId: 'user_5', merchantOrderId: 'BN-8124', visualOrderId: 'Digital Book #BN-8124', orderDate: '2024-07-18T09:05:00Z', paymentReceivedDate: '2024-07-18T14:00:00Z', customerName: 'Eve Adams', customerEmail: 'eve@example.com', status: 'Completed', paymentMethod: 'Zelle', orderAmount: 22.00, totalAmount: 22.00, paidAmount: 22.00, currency: 'USD', paymentType: 'Zelle', paymentGatewayTransactionId: 'ZELLE-CONF-12345', billingDetails: {...sampleBillingDetails, firstName: 'Eve', lastName: 'Adams', email: 'eve@example.com'} },
  { id: 'CP1011', merchantId: 'user_5', merchantOrderId: 'BN-8125', visualOrderId: 'Digital Book #BN-8125', orderDate: '2024-06-25T14:30:00Z', paymentReceivedDate: '2024-06-25T14:30:15Z', customerName: 'Ivy Green', customerEmail: 'ivy@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 55.00, totalAmount: 55.00, paidAmount: 55.00, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PbQ6y...', billingDetails: {...sampleBillingDetails, firstName: 'Ivy', lastName: 'Green'} },
  { id: 'CP1015', merchantId: 'user_5', merchantOrderId: 'BN-8126', visualOrderId: 'Digital Book #BN-8126', orderDate: '2024-07-21T18:00:00Z', customerName: 'Jemma Simmons', customerEmail: 'jemma.simmons@example.com', status: 'Pending', paymentMethod: 'Credit Card', orderAmount: 12.99, totalAmount: 12.99, paidAmount: 0, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PcQ9b...', billingDetails: {...sampleBillingDetails, firstName: 'Jemma', lastName: 'Simmons'} },

  // Orders for Crafty Creations (user_8)
  { id: 'CP1004', merchantId: 'user_8', merchantOrderId: 'CC-951', visualOrderId: 'CRAFTY-CC-951', orderDate: '2024-07-19T14:20:00Z', customerName: 'Diana Prince', customerEmail: 'diana@example.com', status: 'Failed', paymentMethod: 'Credit Card', orderAmount: 15.75, totalAmount: 15.75, paidAmount: 0, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PbQ4w...', billingDetails: {...sampleBillingDetails, firstName: 'Diana', lastName: 'Prince', email: 'diana@example.com'} },
  { id: 'CP1007', merchantId: 'user_8', merchantOrderId: 'CC-952', visualOrderId: 'CRAFTY-CC-952', orderDate: '2024-06-17T12:00:00Z', paymentReceivedDate: '2024-06-17T12:00:20Z', customerName: 'Grace Hopper', customerEmail: 'grace@example.com', status: 'Refunded', paymentMethod: 'Credit Card', orderAmount: 35.00, totalAmount: 35.00, paidAmount: 35.00, currency: 'USD', paymentType: 'Square', paymentGatewayTransactionId: 'sq_order_...', billingDetails: {...sampleBillingDetails, firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com'} },
  
  // Orders for Tech Innovators (user_9)
  { id: 'CP1012', merchantId: 'user_9', merchantOrderId: 'TECH-101', visualOrderId: 'TECH-101', orderDate: '2024-07-21T09:00:00Z', paymentReceivedDate: '2024-07-21T09:00:15Z', customerName: 'Jack Black', customerEmail: 'jack@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 1200.00, totalAmount: 1200.00, paidAmount: 1200.00, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PbQ7z...', billingDetails: {...sampleBillingDetails, firstName: 'Jack', lastName: 'Black'} },
  
  // Orders for Fashion Forward (user_10)
  { id: 'CP1013', merchantId: 'user_10', merchantOrderId: 'FF-201', visualOrderId: 'FF-201', orderDate: '2024-07-15T16:00:00Z', paymentReceivedDate: '2024-07-15T16:00:10Z', customerName: 'Kara Danvers', customerEmail: 'kara@example.com', status: 'Reconciled', paymentMethod: 'Credit Card', orderAmount: 250.00, totalAmount: 250.00, paidAmount: 250.00, currency: 'USD', paymentType: 'Square', paymentGatewayTransactionId: 'sq_order_...', billingDetails: {...sampleBillingDetails, firstName: 'Kara', lastName: 'Danvers'} },
  
  // Orders for Healthy Bites (user_12)
  { id: 'CP1016', merchantId: 'user_12', merchantOrderId: 'HB-301', visualOrderId: 'HB-301', orderDate: '2024-07-22T10:00:00Z', paymentReceivedDate: '2024-07-22T10:00:10Z', customerName: 'Melinda May', customerEmail: 'melinda.may@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 45.00, totalAmount: 45.00, paidAmount: 45.00, currency: 'USD', paymentType: 'Square', paymentGatewayTransactionId: 'sq_order_3PbQAc...', billingDetails: {...sampleBillingDetails, firstName: 'Melinda', lastName: 'May'} },

  // Orders for Pet Palace (user_14)
  { id: 'CP1017', merchantId: 'user_14', merchantOrderId: 'PET-401', visualOrderId: 'PET-401', orderDate: '2024-07-21T11:30:00Z', paymentReceivedDate: '2024-07-21T11:30:15Z', customerName: 'Grant Ward', customerEmail: 'grant.ward@example.com', status: 'Completed', paymentMethod: 'Credit Card', orderAmount: 85.50, totalAmount: 85.50, paidAmount: 85.50, currency: 'USD', paymentType: 'Stripe', paymentGatewayTransactionId: 'ch_3PcQBd...', billingDetails: {...sampleBillingDetails, firstName: 'Grant', lastName: 'Ward'} },
  { id: 'CP1018', merchantId: 'user_14', merchantOrderId: 'PET-402', visualOrderId: 'PET-402', orderDate: '2024-07-22T12:00:00Z', customerName: 'Daisy Johnson', customerEmail: 'daisy.johnson@example.com', status: 'Requires Confirmation', paymentMethod: 'Zelle', orderAmount: 60.00, totalAmount: 60.00, paidAmount: 0, currency: 'USD', paymentType: 'Zelle', paymentGatewayTransactionId: 'ZELLE-CONF-123456', billingDetails: {...sampleBillingDetails, firstName: 'Daisy', lastName: 'Johnson'} },
];

const initialPaymentAccounts = [
  { id: 'pa_1', type: 'Stripe', name: 'Stripe Primary (USD)', status: 'Active', dailyLimit: 25000, currentVolume: 18500, prefix_order_name: 'Online Purchase', websiteUrl: 'https://comfortcommerce.cc/stripe1', accountEmail: '' },
  { id: 'pa_2', type: 'Stripe', name: 'Stripe Secondary (EUR)', status: 'Active', dailyLimit: 10000, currentVolume: 1200, prefix_order_name: 'EU-SALE', websiteUrl: 'https://comfortcommerce.cc/stripe2', accountEmail: '' },
  { id: 'pa_3', type: 'Square', name: 'Square Main (USD)', status: 'Active', dailyLimit: 15000, currentVolume: 9800, prefix_order_name: '', websiteUrl: 'https://comfortcommerce.cc/square1', accountEmail: '' },
  { id: 'pa_4', type: 'Square', name: 'Square Backup', status: 'Inactive', dailyLimit: 5000, currentVolume: 0, prefix_order_name: 'Backup Sale', websiteUrl: 'https://comfortcommerce.cc/square2', accountEmail: '' },
  { id: 'pa_5', type: 'Zelle', name: 'Zelle Primary', status: 'Active', dailyLimit: 2500, currentVolume: 1500, prefix_order_name: '', accountEmail: 'billing@comfortpay.com', websiteUrl: 'https://comfortcommerce.cc/zelle1' },
  { id: 'pa_6', type: 'Zelle', name: 'Zelle Business', status: 'Active', dailyLimit: 5000, currentVolume: 450, prefix_order_name: 'USE_COMFORTPAY_ID', accountEmail: 'sales@comfortpay.com', websiteUrl: 'https://comfortcommerce.cc/zelle2' },
  { id: 'pa_7', type: 'Stripe', name: 'Stripe HighVolume (USD)', status: 'Active', dailyLimit: 100000, currentVolume: 75000, prefix_order_name: 'HV-TXN', websiteUrl: 'https://comfortcommerce.cc/stripe-hv', accountEmail: '' },
  { id: 'pa_8', type: 'Square', name: 'Square Events (USD)', status: 'Active', dailyLimit: 5000, currentVolume: 4500, prefix_order_name: 'EVENT', websiteUrl: 'https://comfortcommerce.cc/square-events', accountEmail: '' },
];

module.exports = {
    initialUsers,
    initialMerchants,
    initialOrders,
    initialPaymentAccounts
};
