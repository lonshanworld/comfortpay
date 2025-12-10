
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
        customerName: billingDetails?.firstName ? `${billingDetails.firstName} ${billingDetails.lastName}`.trim() : dbOrder.customerName,
        customerEmail: billingDetails?.email || dbOrder.customerEmail,
        customerFirstName: billingDetails?.firstName || '',
        customerLastName: billingDetails?.lastName || '',
        customerPhone: billingDetails?.phone || '',
    };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchantIdParam = searchParams.get('merchantId');

  if (!merchantIdParam) {
    return NextResponse.json({ message: 'Merchant ID is required' }, { status: 400 });
  }

  const merchantId = merchantIdParam.replace('user_', '');

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '75', 10);
// const pageSize = 5;
  const offset = (page - 1) * pageSize;

  let whereClauses = "o.merchantId = ?";
  const params: (string | number)[] = [merchantId];

  searchParams.forEach((value, key) => {
    if (value && !['page', 'pageSize', 'merchantId'].includes(key)) {
        switch (key) {
            case 'merchantOrderId':
                whereClauses += ` AND o.merchantOrderId LIKE ?`;
                params.push(`%${value}%`);
                break;
            case 'status':
                if (value === 'Completed') {
                    whereClauses += " AND o.status IN ('Completed', 'Over-paid Refunded')";
                } else {
                    whereClauses += ` AND o.status = ?`;
                    params.push(value);
                }
                break;
            case 'customerEmail':
                 whereClauses += " AND (o.customerEmail LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.email')) LIKE ?)";
                 params.push(`%${value}%`, `%${value}%`);
                break;
            case 'customerFirstName':
                whereClauses += ` AND JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.firstName')) LIKE ?`;
                params.push(`%${value}%`);
                break;
            case 'customerLastName':
                whereClauses += ` AND JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.lastName')) LIKE ?`;
                params.push(`%${value}%`);
                break;
            case 'totalAmount':
                whereClauses += ` AND o.totalAmount = ?`;
                params.push(Number(value));
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

  const dataQuery = `
      SELECT o.*,
       DATE_FORMAT(o.orderDate, '%Y-%m-%dT%H:%i:%s.000Z') as orderDate,
        DATE_FORMAT(o.paymentReceivedDate, '%Y-%m-%dT%H:%i:%s.000Z') as paymentReceivedDate
        FROM orders o
      WHERE ${whereClauses}
      ORDER BY o.orderDate DESC 
      LIMIT ${pageSize} OFFSET ${offset}
  `;
  const countQuery = `SELECT COUNT(*) as totalCount FROM orders o WHERE ${whereClauses}`;

  try {
    const [dataResult, countResult] = await Promise.all([
      executeQuery(dataQuery, params),
      executeQuery(countQuery, params)
    ]);
    
    const totalCount = countResult[0]?.totalCount || 0;
    console.log("Merchant Transactions fetched:", dataResult.map(parseDbOrder));
    return NextResponse.json({
        data: dataResult.map(parseDbOrder),
        pageCount: Math.ceil(totalCount / pageSize),
        totalCount: totalCount
    });

  } catch (error) {
    console.error("Failed to fetch merchant transactions:", error);
    return NextResponse.json({ message: "Failed to fetch merchant transactions" }, { status: 500 });
  }
}
