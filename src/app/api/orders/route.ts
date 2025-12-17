
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';



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
  
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '75', 10);
    const offset = (page - 1) * pageSize;

    const isFromDashboard = searchParams.has('page') || searchParams.has('pageSize');
    const isFromPlugin = !isFromDashboard;
    console.log('isFromPlugin:', isFromPlugin);

    console.log(`Fetching orders - Page: ${page}, Page Size: ${pageSize}, Offset: ${offset}`);
    let selectClause = `
        SELECT 
            o.*, 
            DATE_FORMAT(o.orderDate, '%Y-%m-%dT%H:%i:%s.000Z') as orderDate,
            DATE_FORMAT(o.paymentReceivedDate, '%Y-%m-%dT%H:%i:%s.000Z') as paymentReceivedDate,
            u.name as merchantName, 
            u.websiteUrl as merchantWebsiteUrl,
            pa.accountEmail as paymentAccountEmail,
                pa.name as paymentAccountName,
                pa.tag as paymentAccountTag
    `;
    let countClause = isFromPlugin ? '' : `SELECT COUNT(*) as totalCount`;

    let fromAndWhereClause = `
        FROM orders o
        LEFT JOIN users u ON o.merchantId = u.id AND u.role = 'Merchant'
        LEFT JOIN payment_accounts pa ON o.paymentAccountId = pa.id
        WHERE 1=1
    `;
    const params: (string | number)[] = [];

    searchParams.forEach((value, key) => {
        if (value && !['page', 'pageSize'].includes(key)) {
            switch (key) {
                case 'id':
                    fromAndWhereClause += " AND o.id LIKE ?";
                    params.push(`%${value.replace('CP', '')}%`);
                    break;
                case 'merchantId':
                    fromAndWhereClause += " AND o.merchantId = ?";
                    params.push(value.replace('user_', ''));
                    break;
                case 'merchantName':
                    fromAndWhereClause += " AND u.name LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'merchantWebsiteUrl':
                    fromAndWhereClause += " AND u.websiteUrl LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'merchantOrderId':
                    fromAndWhereClause += " AND o.merchantOrderId LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'customerFirstName':
                     fromAndWhereClause += " AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.firstName'))) LIKE ?";
                    params.push(`%${value.toLowerCase()}%`);
                    break;
                case 'customerLastName':
                    fromAndWhereClause += " AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.lastName'))) LIKE ?";
                    params.push(`%${value.toLowerCase()}%`);
                    break;
                case 'customerEmail':
                    fromAndWhereClause += " AND (o.customerEmail LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.email')) LIKE ?)";
                    params.push(`%${value}%`, `%${value}%`);
                    break;
                case 'customerPhone':
                    fromAndWhereClause += " AND JSON_UNQUOTE(JSON_EXTRACT(o.billingDetails, '$.phone')) LIKE ?";
                    params.push(`%${value}%`);
                    break;
                case 'status':
                    if (value === 'NOT_PENDING') {
                        fromAndWhereClause += " AND o.status != 'Pending'";
                    } else {
                        fromAndWhereClause += " AND o.status LIKE ?";
                        params.push(`%${value}%`);
                    }
                    break;
                case 'orderAmount':
                case 'totalAmount':
                case 'paidAmount':
                    fromAndWhereClause += ` AND CAST(o.${key} AS CHAR) LIKE ?`;
                    params.push(`%${value}%`);
                    break;
                case 'currency':
                case 'paymentMethod':
                case 'paymentType':
                case 'paymentGatewayTransactionId':
                    fromAndWhereClause += ` AND o.${key} LIKE ?`;
                    params.push(`%${value}%`);
                    break;
                case 'wooCommerceSiteUrl':
                    // Decode the URL before using it in the query
                    fromAndWhereClause += " AND o.wooCommerceSiteUrl LIKE ?";
                    params.push(`%${decodeURIComponent(value)}%`);
                    break;
                case 'paymentAccountId':
                    fromAndWhereClause += ` AND o.paymentAccountId = ?`;
                     params.push(value);
                    break;
                // case 'orderDate_start':
                //     query += ` AND o.orderDate >= ?`;
                //     params.push(value);
                //     break;
                // case 'orderDate_end':
                //     query += ` AND o.orderDate <= ?`;
                //     params.push(value);
                //     break;
                // case 'paymentReceivedDate_start':
                //     query += ` AND o.paymentReceivedDate >= ?`;
                //     params.push(value);
                //     break;
                // case 'paymentReceivedDate_end':
                //     query += ` AND o.paymentReceivedDate <= ?`;
                //     params.push(value);
                //     break;
                case 'orderDate':
                case 'paymentReceivedDate':
                    try {
                        const dateRange = JSON.parse(value);
                        if (dateRange.from) {
                            fromAndWhereClause += ` AND o.${key} >= ?`;
                            params.push(new Date(dateRange.from).toISOString().slice(0, 19).replace('T', ' '));
                        }
                        if (dateRange.to) {
                            fromAndWhereClause += ` AND o.${key} <= ?`;
                            params.push(new Date(dateRange.to).toISOString().slice(0, 19).replace('T', ' '));
                        
                        }
                    } catch (e) {
                        console.error(`Invalid date range format for ${key}:`, value);
                    }
                    break;
                case 'orderDate_start':
                case 'paymentReceivedDate_start': {
                    const dbKey = key.replace('_start', '');
                    fromAndWhereClause += ` AND o.${dbKey} >= ?`;
                    params.push(new Date(value).toISOString());
                    break;
                }
                case 'orderDate_end':
                case 'paymentReceivedDate_end': {
                    const dbKey = key.replace('_end', '');
                    fromAndWhereClause += ` AND o.${dbKey} <= ?`;
                   params.push(new Date(value).toISOString());
                    break;
                }
                case 'startDate':
                    fromAndWhereClause += ` AND DATE(o.orderDate) >= ?`;
                    params.push(value.split('T')[0]); // Use just the date part
                    break;
                case 'endDate':
                    fromAndWhereClause += ` AND DATE(o.orderDate) <= ?`;
                    params.push(value.split('T')[0]); // Use just the date part
                    break;    
                
            }
        }
    })

    const dataQuery = `
  ${selectClause} 
  ${fromAndWhereClause} 
  ORDER BY o.orderDate DESC 
  LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
`;

    const pluginQuery = `
  ${selectClause} 
  ${fromAndWhereClause} 
  ORDER BY o.orderDate DESC LIMIT 200
`;
    const countQuery = `${countClause} ${fromAndWhereClause}`;

    try {
        if(isFromPlugin) {
            console.log('it is from plugin');
          const dbOrders = await executeQuery(pluginQuery, params);  
          console.log(`Fetched ${dbOrders.length} orders for plugin`);
            return NextResponse.json(dbOrders.map(parseDbOrder));
        } else{
            console.log('normal request');
             const [dataResult, countResult] = await Promise.all([
                executeQuery(dataQuery, params),
                executeQuery(countQuery, params)
            ]);
            
            
            const totalCount = countResult[0]?.totalCount || 0;
            console.log("Orders fetched:",dataResult.map(parseDbOrder));
            return NextResponse.json({
                data: dataResult.map(parseDbOrder),
                pageCount: Math.ceil(totalCount / pageSize),
                totalCount: totalCount
            });
        }

       
    } catch (error) {
        console.error("Failed to fetch orders from DB:", error);
        return NextResponse.json({ message: "Failed to fetch orders from DB", error: error instanceof Error ? error.message : "Unknown error"}, { status: 500 });
    }
}
