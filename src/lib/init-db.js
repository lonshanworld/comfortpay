

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const mysql = require('mysql2/promise');
const { initialUsers, initialOrders, initialPaymentAccounts } = require('./in-memory-db-for-init');
const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const path = require('path');

const saltRounds = 10;

const formatDateForMySQL = (isoDate) => {
    if (!isoDate) return null;
    return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
}

async function initialize() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('DATABASE_URL environment variable is not set.');
        process.exit(1);
    }
    
    const url = new URL(dbUrl);
    const dbName = url.pathname.slice(1);
    
    let connection;

    try {
        console.log('Connecting to MySQL server...');
        connection = await mysql.createConnection({
            host: url.hostname,
            port: url.port,
            user: url.username,
            password: url.password,
        });
        console.log('Successfully connected to MySQL server.');

        console.log(`Creating database "${dbName}" if it doesn't exist...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await connection.query(`USE \`${dbName}\`;`);
        console.log(`Using database "${dbName}".`);

        console.log('Dropping existing tables...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
        await connection.query('DROP TABLE IF EXISTS settings;');
        await connection.query('DROP TABLE IF EXISTS notifications;');
        await connection.query('DROP TABLE IF EXISTS payment_accounts;');
        await connection.query('DROP TABLE IF EXISTS orders;');
        await connection.query('DROP TABLE IF EXISTS users;');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('Existing tables dropped.');
        
        console.log('Cleaning up old upload directories...');
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.rm(uploadsDir, { recursive: true, force: true });
        console.log('Old upload directories cleaned.');

        console.log('Creating tables...');
        await connection.query(`
            CREATE TABLE users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                createdAt DATETIME NOT NULL,
                status VARCHAR(50) NOT NULL,
                permissions JSON,
                dateJoined DATETIME,
                nationality VARCHAR(255),
                dateOfBirth DATE,
                idType VARCHAR(255),
                photoIdUrl VARCHAR(255),
                businessDocumentUrl VARCHAR(255),
                token VARCHAR(255),
                websiteUrl VARCHAR(255),
                orderIdPrefix VARCHAR(255),
                bankName VARCHAR(255),
                bankAccountNumber VARCHAR(255),
                bankAccountType VARCHAR(255),
                bankEmail VARCHAR(255),
                walletAddress VARCHAR(255),
                network VARCHAR(255),
                salesAgentId INT,
                settlementFees JSON,
                paymentGatewayFees JSON,
                commissionRates JSON
            ) ENGINE=InnoDB;
        `);
        await connection.query(`
            CREATE TABLE orders (
                id INT PRIMARY KEY AUTO_INCREMENT,
                merchantId INT,
                merchantOrderId VARCHAR(255) NOT NULL,
                visualOrderId VARCHAR(255),
                orderDate DATETIME NOT NULL,
                paymentReceivedDate DATETIME,
                customerName VARCHAR(255) NOT NULL,
                customerEmail VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                paymentMethod VARCHAR(50) NOT NULL,
                orderAmount DECIMAL(10, 2) NOT NULL,
                totalAmount DECIMAL(10, 2) NOT NULL,
                paidAmount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(10) NOT NULL,
                paymentType VARCHAR(50) NOT NULL,
                paymentAccountId INT,
                paymentGatewayTransactionId VARCHAR(255),
                billingDetails JSON,
                FOREIGN KEY (merchantId) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);
        await connection.query(`
            CREATE TABLE payment_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                dailyLimit DECIMAL(15, 2) NOT NULL,
                currentVolume DECIMAL(15, 2) NOT NULL,
                prefix_order_name VARCHAR(255),
                websiteUrl VARCHAR(255),
                accountEmail VARCHAR(255),
                qrCodeUrl VARCHAR(255)
            ) ENGINE=InnoDB;
        `);
        await connection.query(`
            CREATE TABLE notifications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                userId INT,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                isRead BOOLEAN DEFAULT false,
                createdAt DATETIME NOT NULL,
                link VARCHAR(255),
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        await connection.query(`
            CREATE TABLE settings (
                \`key\` VARCHAR(255) PRIMARY KEY,
                \`value\` TEXT
            ) ENGINE=InnoDB;
        `);
        console.log('Tables created.');

        console.log('Inserting initial data...');
        await connection.beginTransaction();
        try {
            for (const user of initialUsers) {
                const userId = parseInt(user.id.split('_')[1]);
                const plainPassword = user.email === process.env.SUPER_ADMIN_EMAIL 
                    ? process.env.SUPER_ADMIN_PASSWORD 
                    : user.password;
                
                const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
                await connection.query(
                    `INSERT INTO users (
                        id, name, email, password, role, createdAt, status, permissions,
                        dateJoined, nationality, dateOfBirth, idType, token, websiteUrl,
                        orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail,
                        walletAddress, network, settlementFees, paymentGatewayFees, salesAgentId,
                        commissionRates, photoIdUrl, businessDocumentUrl
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId, user.name, user.email, hashedPassword, user.role, formatDateForMySQL(user.createdAt),
                        user.status, user.permissions ? JSON.stringify(user.permissions) : null,
                        user.dateJoined ? formatDateForMySQL(user.dateJoined) : null,
                        user.nationality, user.dateOfBirth, user.idType, user.token,
                        user.websiteUrl, user.orderIdPrefix, user.bankName, user.bankAccountNumber,
                        user.bankAccountType, user.bankEmail, user.walletAddress, user.network,
                        user.settlementFees ? JSON.stringify(user.settlementFees) : null,
                        user.paymentGatewayFees ? JSON.stringify(user.paymentGatewayFees) : null,
                        user.salesAgentId ? parseInt(user.salesAgentId.split('_')[1]) : null,
                        user.commissionRates ? JSON.stringify(user.commissionRates) : null,
                        user.photoIdUrl || null,
                        user.businessDocumentUrl || null
                    ]
                );
            }
            console.log(`${initialUsers.length} users inserted.`);

            for (const o of initialOrders) {
                await connection.query(
                    `INSERT INTO orders (id, merchantId, merchantOrderId, visualOrderId, orderDate, paymentReceivedDate, customerName, customerEmail, status, paymentMethod, orderAmount, totalAmount, paidAmount, currency, paymentType, paymentGatewayTransactionId, billingDetails) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        parseInt(o.id.replace('CP', '')), parseInt(o.merchantId.split('_')[1]),
                        o.merchantOrderId, o.visualOrderId, formatDateForMySQL(o.orderDate), formatDateForMySQL(o.paymentReceivedDate),
                        o.customerName, o.customerEmail, o.status, o.paymentMethod, o.orderAmount,
                        o.totalAmount, o.paidAmount, o.currency, o.paymentType,
                        o.paymentGatewayTransactionId, o.billingDetails ? JSON.stringify(o.billingDetails) : null
                    ]
                );
            }
            console.log(`${initialOrders.length} orders inserted.`);

            for (const pa of initialPaymentAccounts) {
                await connection.query(
                    `INSERT INTO payment_accounts (id, type, name, status, dailyLimit, currentVolume, prefix_order_name, websiteUrl, accountEmail, qrCodeUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        pa.id, pa.type, pa.name, pa.status, pa.dailyLimit,
                        pa.currentVolume, pa.prefix_order_name, pa.websiteUrl, pa.accountEmail, pa.qrCodeUrl
                    ]
                );
            }
            console.log(`${initialPaymentAccounts.length} payment accounts inserted.`);
            
            const settings = [
                { key: 'emailEnabled', value: 'true'},
                { key: 'emailProvider', value: 'cpanel' },
                { key: 'cpanelSmtp', value: '{}' },
                { key: 'titanSmtp', value: '{}' },
                { key: 'sendgrid', value: '{}' },
                { key: 'fromEmail', value: 'noreply@comfortpay.com' },
                { key: 'sendToCustomer', value: 'true' },
                { key: 'sendToMerchant', value: 'true' },
            ];
            for (const s of settings) {
                await connection.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?)', [s.key, s.value]);
            }
            console.log(`${settings.length} settings inserted.`);

            const notifications = [
                { userId: 1, type: 'CHARGEBACK_ALERT', title: 'Chargeback Alert: $129.99', description: 'For order GADGETS-WC-2024-592.', isRead: 0, createdAt: new Date(new Date().getTime() - 2 * 60 * 1000).toISOString(), link: '/admin/dashboard/transactions' },
                { userId: 1, type: 'ACCOUNT_REVIEW', title: 'Account Needs Review', description: 'Merchant "Crafty Creations" is Inactive.', isRead: 0, createdAt: new Date(new Date().getTime() - 5 * 60 * 1000).toISOString(), link: '/admin/dashboard/merchants' },
                { userId: 1, type: 'LARGE_TRANSACTION', title: 'Large Transaction: $1,200.00', description: 'From customer Jack Black for order TECH-101.', isRead: 1, createdAt: new Date(new Date().getTime() - 1 * 60 * 60 * 1000).toISOString(), link: '/admin/dashboard/transactions' },
                { userId: 1, type: 'GATEWAY_ALERT', title: 'Gateway Limit Reached', description: 'Payment account "Stripe Primary (USD)" is at 74% of its daily limit.', isRead: 1, createdAt: new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString(), link: '/admin/dashboard/payments' },
            ];
            for (const n of notifications) {
                await connection.query(`INSERT INTO notifications (userId, type, title, description, isRead, createdAt, link) VALUES (?, ?, ?, ?, ?, ?, ?)`, [n.userId, n.type, n.title, n.description, n.isRead, formatDateForMySQL(n.createdAt), n.link]);
            }
            console.log(`${notifications.length} notifications inserted.`);

            await connection.commit();
            console.log('Database initialization process finished.');

        } catch (err) {
            console.error("Error during transaction, rolling back.", err);
            await connection.rollback();
            throw err; // re-throw error after rollback
        } finally {
            if (connection) {
                await connection.end();
                console.log('Closed the MySQL connection.');
            }
        }
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! FAILED TO INITIALIZE MYSQL DATABASE        !!!');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error(error.message);
        if (connection) await connection.end();
        process.exit(1);
    }
}

initialize().catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
});
