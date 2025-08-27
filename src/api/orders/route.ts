
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

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

  try {
    let query = `
      SELECT o.*, u.name as merchantName, u.websiteUrl as merchantWebsiteUrl, pa.websiteUrl as sourceWebsiteUrl
      FROM orders o
      LEFT JOIN users u ON o.merchantId = u.id AND u.role = 'Merchant'
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
    query += " GROUP BY o.id ORDER BY o.orderDate DESC";


    const dbOrders = await executeQuery(query, params);
    return NextResponse.json(dbOrders.map(parseDbOrder));
  } catch (error) {
    console.error("Failed to fetch orders from DB:", error);
    return NextResponse.json({ message: "Failed to fetch orders" }, { status: 500 });
  }
}
