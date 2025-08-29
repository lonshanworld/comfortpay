
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Order } from '@/lib/types';


const parseDbOrder = (dbOrder: any) => {
    if (!dbOrder) return null;
    try {
      // The mysql2 driver might already parse the JSON string.
      // We check if it's a string before attempting to parse.
      const billingDetails = typeof dbOrder.billingDetails === 'string' 
        ? JSON.parse(dbOrder.billingDetails) 
        : dbOrder.billingDetails;

      return {
          ...dbOrder,
          id: `CP${dbOrder.id}`,
          merchantId: `user_${dbOrder.merchantId}`,
          billingDetails: billingDetails || null
      };
    } catch(e) {
      console.error(`Failed to parse billing details for order ${dbOrder.id}`, e);
      return {
          ...dbOrder,
          id: `CP${dbOrder.id}`,
          merchantId: `user_${dbOrder.merchantId}`,
          billingDetails: null // Gracefully handle parsing error
      };
    }
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
      SELECT o.*, u.name as merchantName, u.websiteUrl as merchantWebsiteUrl
      FROM orders o
      LEFT JOIN users u ON o.merchantId = u.id AND u.role = 'Merchant'
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
    query += " ORDER BY o.orderDate DESC";


    const dbOrders = await executeQuery(query, params);
    return NextResponse.json(dbOrders.map(parseDbOrder));
  } catch (error) {
    console.error("Failed to fetch orders from DB:", error);
    return NextResponse.json({ message: "Failed to fetch orders from DB", error: error instanceof Error ? error.message : "Unknown error"}, { status: 500 });
  }
}
