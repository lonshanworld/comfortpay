
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const path = require('path');

const saltRounds = 10;

const formatDateForMySQL = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    const seconds = d.getUTCSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};


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
        console.log('Connecting to MySQL server for development seeding...');
        connection = await mysql.createConnection({
            host: url.hostname,
            port: url.port,
            user: url.username,
            password: url.password,
            multipleStatements: true
        });
        console.log('Successfully connected to MySQL server.');

        console.log(`Creating database "${dbName}" if it doesn't exist...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await connection.query(`USE \`${dbName}\`;`);
        console.log(`Using database "${dbName}".`);

        console.log('Dropping existing tables...');
        const dropTablesScript = `
            SET FOREIGN_KEY_CHECKS = 0;
            DROP TABLE IF EXISTS zelle_email_ai_record;
            DROP TABLE IF EXISTS daily_volume_history;
            DROP TABLE IF EXISTS settings;
            DROP TABLE IF EXISTS notifications;
            DROP TABLE IF EXISTS payment_accounts;
            DROP TABLE IF EXISTS orders;
            DROP TABLE IF EXISTS users;
            SET FOREIGN_KEY_CHECKS = 1;
        `;
        await connection.query(dropTablesScript);
        console.log('Existing tables dropped.');
        
        console.log('Cleaning up old upload directories...');
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.rm(uploadsDir, { recursive: true, force: true });
        console.log('Old upload directories cleaned.');

        console.log('Creating tables...');
        const createTablesScript = `
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
                items JSON,
                riskDetails JSON,
                FOREIGN KEY (merchantId) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;

            CREATE TABLE payment_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                dailyLimit DECIMAL(15, 2) NOT NULL,
                currentVolume DECIMAL(15, 2) NOT NULL,
                prefix_order_name VARCHAR(255),
                websiteUrl VARCHAR(255),
                accountEmail VARCHAR(255) UNIQUE,
                qrCodeUrl VARCHAR(255)
            ) ENGINE=InnoDB;

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

            CREATE TABLE settings (
                \`key\` VARCHAR(255) PRIMARY KEY,
                \`value\` TEXT
            ) ENGINE=InnoDB;

             CREATE TABLE daily_volume_history (
                id INT PRIMARY KEY AUTO_INCREMENT,
                paymentAccountId INT NOT NULL,
                date DATE NOT NULL,
                totalVolume DECIMAL(15, 2) NOT NULL,
                createdAt DATETIME NOT NULL,
                UNIQUE KEY (paymentAccountId, date)
            ) ENGINE=InnoDB;

            CREATE TABLE zelle_email_ai_record (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ai_response_json JSON,
                created_at DATETIME NOT NULL
            ) ENGINE=InnoDB;
        `;
        await connection.query(createTablesScript);
        console.log('Tables created.');

        console.log('Inserting initial data...');
        await connection.beginTransaction();
        try {
            // Super Admin
            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
            const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
            if (!superAdminEmail || !superAdminPassword) {
                throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables must be set.');
            }
            const adminHashedPassword = await bcrypt.hash(superAdminPassword, saltRounds);
            const now = new Date();
            await connection.query(
                `INSERT INTO users (name, email, password, role, createdAt, status, dateJoined) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['Admin User', superAdminEmail, adminHashedPassword, 'Admin', formatDateForMySQL(now), 'Active', formatDateForMySQL(now)]
            );

            // Other users
            const password = await bcrypt.hash('password', saltRounds);
            const commissionRates = JSON.stringify({"stripe":{"value":0.5,"type":"percentage"},"square":{"value":0.5,"type":"percentage"},"zelle":{"value":0.5,"type":"percentage"}});
            const settlementFees = JSON.stringify({"domesticTransferFee":{"value":2.5,"type":"flat"},"internationalTransferFee":{"value":5,"type":"flat"},"cryptoTransferFee":{"value":1,"type":"percentage"}});
            const paymentGatewayFees = JSON.stringify({
                stripe: { enabled: true, transactionFee: { value: 2.9 }, transactionFeeFixed: {value: 0.30}, refundFee: { value: 0, type: 'flat'}, chargebackFee: { value: 15.00, type: 'flat'} },
                square: { enabled: true, transactionFee: { value: 2.6 }, transactionFeeFixed: {value: 0.10}, refundFee: { value: 0, type: 'flat'}, chargebackFee: { value: 20.00, type: 'flat'} },
                zelle: { enabled: true, transactionFee: { value: 0 }, transactionFeeFixed: {value: 0}, refundFee: { value: 0, type: 'flat'}, chargebackFee: { value: 0, type: 'flat'} },
            });
            const defaultToken = 'cp_tok_xxxxxxxxxxxxxxxxxxxxxxxx';
            
            // Sales Agents
            await connection.query(`INSERT INTO users (name, email, password, role, createdAt, status, dateJoined) VALUES ?`, [[
                ['Agent Smith', 'agent.smith@comfortpay.com', password, 'Sale Agent', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date())],
                ['Agent Jones', 'agent.jones@comfortpay.com', password, 'Sale Agent', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date())]
            ]]);
            
            // Merchants
            await connection.query(`INSERT INTO users (name, email, password, role, createdAt, status, dateJoined, salesAgentId, commissionRates, websiteUrl, settlementFees, paymentGatewayFees, token) VALUES ?`, [[
                ['Gadget Store', 'merchant@comfortpay.com', password, 'Merchant', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), 2, commissionRates, 'https://gadgetstore.com', settlementFees, paymentGatewayFees, defaultToken],
                ['Bookworm Nook', 'books@comfortpay.com', password, 'Merchant', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), 2, commissionRates, 'https://bookwormnook.com', settlementFees, paymentGatewayFees, defaultToken],
                ['The Art Corner', 'art@comfortpay.com', password, 'Merchant', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), 3, commissionRates, 'https://theartcorner.com', settlementFees, paymentGatewayFees, defaultToken],
                ['Coffee Express', 'coffee@comfortpay.com', password, 'Merchant', formatDateForMySQL(new Date()), 'Inactive', formatDateForMySQL(new Date()), 3, commissionRates, 'https://coffeeexpress.com', settlementFees, paymentGatewayFees, defaultToken],
                ['Global Exports', 'exports@comfortpay.com', password, 'Merchant', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), 2, commissionRates, 'https://globalexports.com', settlementFees, paymentGatewayFees, defaultToken]
            ]]);

            // Staff
            await connection.query(`INSERT INTO users (name, email, password, role, createdAt, status, dateJoined, permissions) VALUES ?`, [[
                ['Support Staff', 'support@comfortpay.com', password, 'Staff', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), JSON.stringify({ "view_dashboard": true, "view_transactions": true })],
                ['Finance Staff', 'finance@comfortpay.com', password, 'Staff', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), JSON.stringify({ "view_dashboard": true, "view_transactions": true, "edit_transactions": true, "view_merchants": true })],
                ['Compliance Staff', 'compliance@comfortpay.com', password, 'Staff', formatDateForMySQL(new Date()), 'Active', formatDateForMySQL(new Date()), JSON.stringify({ "view_merchants": true, "edit_merchants": true })]
            ]]);

            // Payment Accounts (3 Stripe, 2 Square, 3 Zelle)
            await connection.query(`INSERT INTO payment_accounts (type, name, status, dailyLimit, currentVolume, websiteUrl, accountEmail, qrCodeUrl) VALUES ?`, [[
                ['Stripe', 'Stripe Primary', 'Active', 10000.00, 1250.50, 'https://comfortpay.com', null, null],
                ['Stripe', 'Stripe High Volume', 'Active', 50000.00, 25000.00, 'https://comfortpay.com', null, null],
                ['Stripe', 'Stripe EU', 'Inactive', 15000.00, 100.00, 'https://comfortpay.com', null, null],
                ['Square', 'Square US', 'Active', 5000.00, 250.00, 'https://comfortpay.com', null, null],
                ['Square', 'Square Events', 'Active', 2000.00, 100.00, 'https://comfortpay.com', null, null],
                ['Zelle', 'Zelle Main', 'Active', 20000.00, 5000.00, null, 'billing@comfortpay.com', null],
                ['Zelle', 'Zelle Secondary', 'Active', 10000.00, 150.00, null, 'payments@comfortpay.com', null],
                ['Zelle', 'Zelle Backup', 'Inactive', 5000.00, 0.00, null, 'backup@comfortpay.com', null]
            ]]);

             // Orders
             const ordersData = [
                [4, 'WC-101', 'GS-101-A', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 1)), 'Alice Johnson', 'alice@example.com', 'Completed', 'Credit Card', 99.99, 105.99, 105.99, 'USD', 'Stripe', 1, JSON.stringify({firstName: 'Alice'}), JSON.stringify([{name: 'Product A', quantity: 1, price: 99.99}]), null],
                [5, 'WC-102', 'BN-102-B', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 2)), 'Bob Williams', 'bob@example.com', 'Requires Confirmation', 'Zelle', 45.00, 45.00, 0, 'USD', 'Zelle', 6, JSON.stringify({firstName: 'Bob'}), JSON.stringify([{name: 'Book', quantity: 2, price: 22.50}]), null],
                [4, 'WC-103', 'GS-103-C', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 3)), 'Charlie Brown', 'charlie@example.com', 'Completed', 'Credit Card', 15.50, 18.00, 18.00, 'USD', 'Square', 4, JSON.stringify({firstName: 'Charlie'}), JSON.stringify([{name: 'Sticker', quantity: 1, price: 15.50}]), null],
                [6, 'WC-104', 'AC-104-D', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 4)), 'Diana Miller', 'diana@example.com', 'Pending', 'Credit Card', 250.00, 265.00, 0, 'USD', 'Stripe', 2, JSON.stringify({firstName: 'Diana'}), JSON.stringify([{name: 'Artwork', quantity: 1, price: 250.00}]), null],
                [7, 'WC-105', 'CE-105-E', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 5)), 'Ethan Davis', 'ethan@example.com', 'Completed', 'Zelle', 12.50, 12.50, 12.50, 'USD', 'Zelle', 7, JSON.stringify({firstName: 'Ethan'}), JSON.stringify([{name: 'Coffee', quantity: 5, price: 2.50}]), null],
                [8, 'WC-106', 'GE-106-F', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 6)), 'Fiona Clark', 'fiona@example.com', 'Completed', 'Credit Card', 1200.00, 1250.00, 1250.00, 'USD', 'Stripe', 2, JSON.stringify({firstName: 'Fiona'}), JSON.stringify([{name: 'Export Item', quantity: 10, price: 120.00}]), null],
                [4, 'WC-107', 'GS-107-G', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 7)), 'George Harris', 'george@example.com', 'Refunded', 'Credit Card', 75.00, 75.00, 0, 'USD', 'Square', 5, JSON.stringify({firstName: 'George'}), JSON.stringify([{name: 'Gadget', quantity: 1, price: 75.00}]), null],
                [5, 'WC-108', 'BN-108-H', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 8)), 'Hannah Lewis', 'hannah@example.com', 'Completed', 'Zelle', 22.95, 25.00, 25.00, 'USD', 'Zelle', 6, JSON.stringify({firstName: 'Hannah'}), JSON.stringify([{name: 'Book', quantity: 1, price: 22.95}]), null],
                [6, 'WC-109', 'AC-109-I', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 9)), 'Ian Walker', 'ian@example.com', 'Failed', 'Credit Card', 300.00, 310.00, 0, 'USD', 'Stripe', 1, JSON.stringify({firstName: 'Ian'}), JSON.stringify([{name: 'Artwork Large', quantity: 1, price: 300.00}]), null],
                [7, 'WC-110', 'CE-110-J', formatDateForMySQL(new Date(new Date().getTime() - 86400000 * 10)), 'Jane Hall', 'jane@example.com', 'Requires Confirmation', 'Zelle', 8.75, 8.75, 0, 'USD', 'Zelle', 7, JSON.stringify({firstName: 'Jane'}), JSON.stringify([{name: 'Pastry', quantity: 2, price: 4.375}]), null]
             ];
             await connection.query(`INSERT INTO orders (merchantId, merchantOrderId, visualOrderId, orderDate, customerName, customerEmail, status, paymentMethod, orderAmount, totalAmount, paidAmount, currency, paymentType, paymentAccountId, billingDetails, items, riskDetails) VALUES ?`, [ordersData]);
            
            // Settings
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

            await connection.commit();
            console.log('Database seeding process finished.');

        } catch (err) {
            console.error("Error during transaction, rolling back.", err);
            await connection.rollback();
            throw err;
        } finally {
            if (connection) {
                await connection.end();
                console.log('Closed the MySQL connection.');
            }
        }
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! FAILED TO SEED DEVELOPMENT DATABASE        !!!');
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
