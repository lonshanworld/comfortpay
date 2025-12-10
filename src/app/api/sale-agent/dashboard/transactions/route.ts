
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Order } from '@/lib/types';

// Helper to parse database order into the correct Order type
const parseDbOrder = (dbOrder: any): Order => {
    const billingDetails = typeof dbOrder.billingDetails === 'string' 
        ? JSON.parse(dbOrder.billingDetails || '{}') 
        : dbOrder.billingDetails || {};
    return {
        ...dbOrder,
        id: `CP${dbOrder.id}`,
        merchantId: `user_${dbOrder.merchantId}`,
        totalAmount: Number(dbOrder.totalAmount),
        paidAmount: Number(dbOrder.paidAmount),
        billingDetails: billingDetails,
    };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saleAgentIdParam = searchParams.get('saleAgentId');

  if (!saleAgentIdParam) {
    return NextResponse.json({ message: 'Sales Agent ID is required' }, { status: 400 });
  }

  const saleAgentId = saleAgentIdParam.replace('user_', '');

  try {
    // 1. Get all merchants for the given sales agent
    const merchants: any[] = await executeQuery("SELECT id FROM users WHERE salesAgentId = ?", [saleAgentId]);
    if (merchants.length === 0) {
        return NextResponse.json({ data: [], pageCount: 0, totalCount: 0 });
    }
    const merchantIds = merchants.map(m => m.id);
    const merchantIdPlaceholders = merchantIds.map(() => '?').join(',');

    // 2. Build query to fetch orders for those merchants
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '75', 10);
    const offset = (page - 1) * pageSize;

    let whereClauses = `o.merchantId IN (${merchantIdPlaceholders})`;
    const params: (string | number)[] = [...merchantIds];

    searchParams.forEach((value, key) => {
        if (value && !['page', 'pageSize', 'saleAgentId'].includes(key)) {
            switch (key) {
                case 'merchantId':
                    // Ensure the filtered merchantId is one managed by this agent
                    const numericMerchantId = value.replace('user_', '');
                    if (merchantIds.includes(parseInt(numericMerchantId, 10))) {
                        whereClauses += ` AND o.merchantId = ?`;
                        params.push(numericMerchantId);
                    } else {
                        // If a merchant not managed by the agent is requested, return no results.
                        // We add a clause that will always be false.
                        whereClauses += ` AND 1=0`;
                    }
                    break;
                case 'merchantOrderId':
                    whereClauses += ` AND o.merchantOrderId LIKE ?`;
                    params.push(`%${value}%`);
                    break;
                case 'status':
                    whereClauses += ` AND o.status = ?`;
                    params.push(value);
                    break;
                case 'totalAmount':
                     whereClauses += ` AND CAST(o.totalAmount AS CHAR) LIKE ?`;
                    params.push(`%${value}%`);
                    break;
                case 'orderDate_start':
                case 'paymentReceivedDate_start': {
                    const dbKey = key.replace('_start', '');
                    whereClauses += ` AND o.${dbKey} >= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                }
                case 'orderDate_end':
                case 'paymentReceivedDate_end': {
                    const dbKey = key.replace('_end', '');
                    whereClauses += ` AND o.${dbKey} <= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                }
            }
        }
    });
       const selectClause = `
        SELECT 
            o.*, 
            DATE_FORMAT(o.orderDate, '%Y-%m-%dT%H:%i:%s.000Z') as orderDate,
            DATE_FORMAT(o.paymentReceivedDate, '%Y-%m-%dT%H:%i:%s.000Z') as paymentReceivedDate,
            u.websiteUrl as merchantWebsiteUrl
    `;

    const dataQuery = `
      ${selectClause}
      FROM orders o
      JOIN users u ON o.merchantId = u.id
      WHERE ${whereClauses}
      ORDER BY o.orderDate DESC 
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countQuery = `SELECT COUNT(*) as totalCount FROM orders o WHERE ${whereClauses}`;

    const [dataResult, countResult] = await Promise.all([
      executeQuery(dataQuery, params),
      executeQuery(countQuery, params)
    ]);
    
    const totalCount = countResult[0]?.totalCount || 0;

    return NextResponse.json({
        data: dataResult.map(parseDbOrder),
        pageCount: Math.ceil(totalCount / pageSize),
        totalCount: totalCount
    });

  } catch (error) {
    console.error("Failed to fetch sales agent transactions:", error);
    return NextResponse.json({ message: "Failed to fetch sales agent transactions" }, { status: 500 });
  }
}
