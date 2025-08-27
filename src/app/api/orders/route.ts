
import { NextResponse } from 'next/server';
import { initialOrders } from '@/lib/in-memory-db';
import { executeQuery } from '@/lib/db';

// In-memory data - this will be used as a fallback if the database is not connected.
let orders = initialOrders;

const parseDbOrder = (dbOrder: any) => {
    if (!dbOrder) return null;
    return {
        ...dbOrder,
        id: `CP${dbOrder.id}`,
        merchantId: `user_${dbOrder.merchantId}`
    };
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');
  const numericMerchantId = merchantId ? merchantId.split('_')[1] : null;
  const status = searchParams.get('status');
  const searchQuery = searchParams.get('q');
  const currency = searchParams.get('currency');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const minAmount = searchParams.get('minAmount');
  const maxAmount = searchParams.get('maxAmount');

  // =================================================================
  // REAL DATABASE LOGIC
  // =================================================================
  try {
    let query = `
      SELECT o.*, m.name as merchantName, m.websiteUrl as merchantWebsiteUrl, pa.websiteUrl as sourceWebsiteUrl
      FROM orders o
      LEFT JOIN merchants m ON o.merchantId = m.id
      LEFT JOIN payment_accounts pa ON o.paymentType = pa.type -- This is a simplification
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (numericMerchantId) {
      query += " AND o.merchantId = ?";
      params.push(numericMerchantId);
    }
    if (status) {
      query += " AND o.status = ?";
      params.push(status.replace('-', ' ')); // e.g. requires-confirmation -> requires confirmation
    }
    if (searchQuery) {
      query += " AND (o.id LIKE ? OR o.customerEmail LIKE ? OR o.customerName LIKE ?)";
      const likeQuery = `%${searchQuery}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    }
    if (currency) {
      query += " AND o.currency = ?";
      params.push(currency);
    }
    if (startDate) {
      query += " AND o.orderDate >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND o.orderDate <= ?";
      params.push(endDate);
    }
     if (minAmount) {
      query += " AND o.totalAmount >= ?";
      params.push(Number(minAmount));
    }
    if (maxAmount) {
      query += " AND o.totalAmount <= ?";
      params.push(Number(maxAmount));
    }
    // Simplistic grouping to get one source URL per payment type. A real implementation might need a more direct link.
    query += " GROUP BY o.id ORDER BY o.orderDate DESC";


    const dbOrders = await executeQuery(query, params);
    return NextResponse.json(dbOrders.map(parseDbOrder));
  } catch (error) {
    console.error("Failed to fetch orders from DB:", error);
    // Fallback to in-memory data for demonstration
    let filteredOrders = orders;

    if (merchantId) {
      filteredOrders = filteredOrders.filter(o => o.merchantId === merchantId);
    }

    if (status) {
      filteredOrders = filteredOrders.filter(o => o.status.toLowerCase().replace(' ', '-') === status);
    }

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filteredOrders = filteredOrders.filter(
        o =>
          o.id.toLowerCase().includes(lowercasedQuery) ||
          o.customerEmail.toLowerCase().includes(lowercasedQuery) ||
          o.customerName.toLowerCase().includes(lowercasedQuery)
      );
    }

    if (currency) {
      filteredOrders = filteredOrders.filter(o => o.currency === currency);
    }

    if (startDate) {
      filteredOrders = filteredOrders.filter(o => new Date(o.orderDate) >= new Date(startDate));
    }

    if (endDate) {
      filteredOrders = filteredOrders.filter(o => new Date(o.orderDate) <= new Date(endDate));
    }

    if (minAmount) {
      filteredOrders = filteredOrders.filter(o => o.totalAmount >= Number(minAmount));
    }

    if (maxAmount) {
      filteredOrders = filteredOrders.filter(o => o.totalAmount <= Number(maxAmount));
    }
    
    return NextResponse.json(filteredOrders);
  }
}
