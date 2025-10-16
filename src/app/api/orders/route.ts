
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Order } from '@/lib/types';


const parseDbOrder = (dbOrder: any) => {
    if (!dbOrder) return null;
        try {
              const billingDetails = typeof dbOrder.billingDetails === 'string' 
                      ? JSON.parse(dbOrder.billingDetails) 
                              : dbOrder.billingDetails;

            // The date strings from the database are now correctly formatted as ISO strings (UTC)
            // by the SQL query itself, so we can use them directly.
            return {
                ...dbOrder,
                id: `CP${dbOrder.id}`,
                merchantId: `user_${dbOrder.merchantId}`,
                paymentAccountId: dbOrder.paymentAccountId ? `pa_${dbOrder.paymentAccountId}` : null,
                billingDetails: billingDetails || null,
                customerFirstName: billingDetails?.firstName || '',
                customerLastName: billingDetails?.lastName || '',
                customerEmail: billingDetails?.email || dbOrder.customerEmail,
                customerPhone: billingDetails?.phone || '',
            };
        } catch(e) {
            console.error(`Failed to parse billing details for order ${dbOrder.id}`, e);
            return {
                ...dbOrder,
                id: `CP${dbOrder.id}`,
                merchantId: `user_${dbOrder.merchantId}`,
                paymentAccountId: dbOrder.paymentAccountId ? `pa_${dbOrder.paymentAccountId}` : null,
                billingDetails: null,
                customerFirstName: '',
                customerLastName: '',
                customerEmail: dbOrder.customerEmail,
                customerPhone: '',
            };
        }
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
    // Force dates to be formatted as ISO 8601 UTC strings directly in the query
    let query = `
        SELECT 
            o.*, 
            DATE_FORMAT(o.orderDate, '%Y-%m-%dT%H:%i:%s.000Z') as orderDate,
            DATE_FORMAT(o.paymentReceivedDate, '%Y-%m-%dT%H:%i:%s.000Z') as paymentReceivedDate,
            u.name as merchantName, 
            u.websiteUrl as merchantWebsiteUrl,
            pa.accountEmail as paymentAccountEmail
        FROM orders o
        LEFT JOIN users u ON o.merchantId = u.id AND u.role = 'Merchant'
        LEFT JOIN payment_accounts pa ON o.paymentAccountId = pa.id
        WHERE 1=1
    `;
    const params: (string | number)[] = [];

    searchParams.forEach((value, key) => {
        if (value) {
            switch (key) {
                case 'id':
                    query += " AND o.id LIKE ?";
                    params.push(`%${value.replace('CP', '')}%`);
                    break;
                case 'merchantId':
                    query += " AND o.merchantId = ?";
                    params.push(value.replace('user_', ''));
                    break;
                case 'merchantName':
                    query += " AND u.name LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'merchantWebsiteUrl':
                    query += " AND u.websiteUrl LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'merchantOrderId':
                    query += " AND o.merchantOrderId LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'customerFirstName':
                    query += " AND JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.firstName')) LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'customerLastName':
                    query += " AND JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.lastName')) LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'customerEmail':
                    query += " AND (o.customerEmail LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.email')) LIKE ?)";
                    params.push(`%${value}%`, `%${value}%`);
                    break;
                case 'status':
                    if (value === 'NOT_PENDING') {
                        query += " AND o.status != 'Pending'";
                    } else {
                        query += " AND o.status LIKE ?";
                        params.push(`%${value}%`);
                    }
                    break;
                case 'orderAmount':
                case 'totalAmount':
                case 'paidAmount':
                    query += ` AND o.${key} = ?`;
                    params.push(Number(value));
                    break;
                case 'currency':
                case 'paymentMethod':
                case 'paymentType':
                case 'paymentGatewayTransactionId':
                case 'wooCommerceSiteUrl':
                    query += " AND o.wooCommerceSiteUrl LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'paymentAccountId':
                    query += ` AND o.paymentAccountId = ?`;
                    params.push(value.replace('pa_', ''));
                    break;
                  case 'orderDate_start':
                    query += ` AND o.orderDate >= ?`;
                    params.push(value);
                    break;
                case 'orderDate_end':
                    query += ` AND o.orderDate <= ?`;
                    params.push(value);
                    break;
                case 'paymentReceivedDate_start':
                    query += ` AND o.paymentReceivedDate >= ?`;
                    params.push(value);
                    break;
                case 'paymentReceivedDate_end':
                    query += ` AND o.paymentReceivedDate <= ?`;
                    params.push(value);
                    break;
                case 'startDate':
                    query += ` AND DATE(o.orderDate) >= ?`;
                    params.push(value.split('T')[0]); // Use just the date part
                    break;
                case 'endDate':
                    query += ` AND DATE(o.orderDate) <= ?`;
                    params.push(value.split('T')[0]); // Use just the date part
                    break;
            }
        }
    })

    query += " ORDER BY o.orderDate DESC";

    try {
        const dbOrders = await executeQuery(query, params);
        return NextResponse.json(dbOrders.map(parseDbOrder));
    } catch (error) {
        console.error("Failed to fetch orders from DB:", error);
        return NextResponse.json({ message: "Failed to fetch orders from DB", error: error instanceof Error ? error.message : "Unknown error"}, { status: 500 });
    }
}
