
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { initialUsers, initialOrders, initialPaymentAccounts } = require('./in-memory-db-for-init');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'comfortpay.db');

async function initialize() {
    console.log(`Initializing database at ${DB_FILE}...`);
    
    const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON;');
    
    console.log('Dropping existing tables...');
    await db.exec(`
        DROP TABLE IF EXISTS settings;
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS payment_accounts;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS users;
    `);
    console.log('Existing tables dropped.');

    console.log('Creating tables...');
    // =================================================================
    // SQLite Schema
    // =================================================================
    await db.exec(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            status TEXT NOT NULL,
            permissions TEXT,
            
            -- Merchant-specific fields
            dateJoined TEXT,
            nationality TEXT,
            dateOfBirth TEXT,
            idType TEXT,
            photoIdUrl TEXT,
            businessDocumentUrl TEXT,
            token TEXT,
            websiteUrl TEXT,
            orderIdPrefix TEXT,
            bankName TEXT,
            bankAccountNumber TEXT,
            bankAccountType TEXT,
            bankEmail TEXT,
            walletAddress TEXT,
            network TEXT,
            salesAgentId INTEGER,
            settlementFees TEXT,
            paymentGatewayFees TEXT,
            commissionRates TEXT
        );
        
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            merchantId INTEGER NOT NULL,
            merchantOrderId TEXT NOT NULL,
            visualOrderId TEXT,
            orderDate TEXT NOT NULL,
            paymentReceivedDate TEXT,
            customerName TEXT NOT NULL,
            customerEmail TEXT NOT NULL,
            status TEXT NOT NULL,
            paymentMethod TEXT NOT NULL,
            orderAmount REAL NOT NULL,
            totalAmount REAL NOT NULL,
            paidAmount REAL NOT NULL,
            currency TEXT NOT NULL,
            paymentType TEXT NOT NULL,
            paymentGatewayTransactionId TEXT,
            billingDetails TEXT,
            FOREIGN KEY (merchantId) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE payment_accounts (
            id INTEGER PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            dailyLimit REAL NOT NULL,
            currentVolume REAL NOT NULL,
            prefix_order_name TEXT,
            websiteUrl TEXT,
            accountEmail TEXT
        );

        CREATE TABLE notifications (
            id INTEGER PRIMARY KEY,
            userId INTEGER,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            isRead INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            link TEXT,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
     // =================================================================
    // MySQL Schema (for reference)
    // =================================================================
    /*
    CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        createdAt DATETIME NOT NULL,
        status VARCHAR(50) NOT NULL,
        permissions TEXT,
        
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
        settlementFees TEXT,
        paymentGatewayFees TEXT,
        commissionRates TEXT
    );
    
    CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        merchantId INT,
        merchantOrderId VARCHAR(255) NOT NULL,
        visualOrderId VARCHAR(255),
        orderDate DATETIME NOT NULL,
        paymentReceivedDate DATETIME,
        customerName VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255) NOT NULL,
        status VARCHAR(255) NOT NULL,
        paymentMethod VARCHAR(255) NOT NULL,
        orderAmount DECIMAL(10, 2) NOT NULL,
        totalAmount DECIMAL(10, 2) NOT NULL,
        paidAmount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        paymentType VARCHAR(255) NOT NULL,
        paymentGatewayTransactionId VARCHAR(255),
        billingDetails TEXT,
        FOREIGN KEY (merchantId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE payment_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(255) NOT NULL,
        dailyLimit DECIMAL(15, 2) NOT NULL,
        currentVolume DECIMAL(15, 2) NOT NULL,
        prefix_order_name VARCHAR(255),
        websiteUrl VARCHAR(255),
        accountEmail VARCHAR(255)
    );

    CREATE TABLE notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        type VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        isRead BOOLEAN DEFAULT FALSE,
        createdAt DATETIME NOT NULL,
        link VARCHAR(255),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE settings (
        `key` VARCHAR(255) PRIMARY KEY,
        `value` TEXT
    );
    */
    console.log('Tables created.');
    
    console.log('Inserting initial data...');

    await db.run('BEGIN TRANSACTION');
    try {
        const userStmt = await db.prepare(`
            INSERT INTO users (
                id, name, email, password, role, createdAt, status, permissions,
                dateJoined, nationality, dateOfBirth, idType, token, websiteUrl,
                orderIdPrefix, bankName, bankAccountNumber, bankAccountType, bankEmail,
                walletAddress, network, settlementFees, paymentGatewayFees, salesAgentId,
                commissionRates
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const user of initialUsers) {
            const userId = parseInt(user.id.split('_')[1]);
            await userStmt.run(
                userId,
                user.name, 
                user.email, 
                user.password, 
                user.role, 
                user.createdAt,
                user.status, 
                user.permissions ? JSON.stringify(user.permissions) : null,
                user.role === 'Merchant' ? user.createdAt : null,
                user.nationality,
                user.dateOfBirth,
                user.idType,
                user.token,
                user.websiteUrl,
                user.orderIdPrefix,
                user.bankName,
                user.bankAccountNumber,
                user.bankAccountType,
                user.bankEmail,
                user.walletAddress,
                user.network,
                user.settlementFees ? JSON.stringify(user.settlementFees) : null,
                user.paymentGatewayFees ? JSON.stringify(user.paymentGatewayFees) : null,
                user.salesAgentId ? parseInt(user.salesAgentId.split('_')[1]) : null,
                user.commissionRates ? JSON.stringify(user.commissionRates) : null
            );
        }
        await userStmt.finalize();
        console.log(`${initialUsers.length} users inserted.`);

        const orderStmt = await db.prepare(`INSERT INTO orders (id, merchantId, merchantOrderId, visualOrderId, orderDate, paymentReceivedDate, customerName, customerEmail, status, paymentMethod, orderAmount, totalAmount, paidAmount, currency, paymentType, paymentGatewayTransactionId, billingDetails) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const o of initialOrders) {
            await orderStmt.run(
                 parseInt(o.id.replace('CP', '')),
                 parseInt(o.merchantId.split('_')[1]),
                 o.merchantOrderId, o.visualOrderId, 
                 o.orderDate,
                 o.paymentReceivedDate || null,
                 o.customerName, o.customerEmail, o.status, o.paymentMethod, o.orderAmount, o.totalAmount, o.paidAmount, o.currency, o.paymentType, o.paymentGatewayTransactionId,
                 o.billingDetails ? JSON.stringify(o.billingDetails) : null
            );
        }
        await orderStmt.finalize();
        console.log(`${initialOrders.length} orders inserted.`);

        const accountStmt = await db.prepare(`INSERT INTO payment_accounts (id, type, name, status, dailyLimit, currentVolume, prefix_order_name, websiteUrl, accountEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const pa of initialPaymentAccounts) {
            await accountStmt.run(
                 parseInt(pa.id.split('_')[1]),
                 pa.type, pa.name, pa.status, pa.dailyLimit, pa.currentVolume, pa.prefix_order_name, pa.websiteUrl, pa.accountEmail
            );
        }
        await accountStmt.finalize();
        console.log(`${initialPaymentAccounts.length} payment accounts inserted.`);

        const settingsStmt = await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
        const settings = [
            { key: 'emailProvider', value: 'cpanel' },
            { key: 'cpanelSmtp', value: '{}' },
            { key: 'titanSmtp', value: '{}' },
            { key: 'sendgrid', value: '{}' },
            { key: 'fromEmail', value: 'noreply@comfortpay.com' },
        ];
        for(const s of settings) {
             await settingsStmt.run(s.key, s.value);
        }
        await settingsStmt.finalize();
        console.log(`${settings.length} settings inserted.`);

        const notificationStmt = await db.prepare(`INSERT INTO notifications (userId, type, title, description, isRead, createdAt, link) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const now = new Date();
        const notifications = [
            { userId: 1, type: 'CHARGEBACK_ALERT', title: 'Chargeback Alert: $129.99', description: 'For order GADGETS-WC-2024-592.', isRead: 0, createdAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), link: '/admin/dashboard/transactions' },
            { userId: 1, type: 'ACCOUNT_REVIEW', title: 'Account Needs Review', description: 'Merchant "Crafty Creations" is Inactive.', isRead: 0, createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), link: '/admin/dashboard/merchants' },
            { userId: 1, type: 'LARGE_TRANSACTION', title: 'Large Transaction: $1,200.00', description: 'From customer Jack Black for order TECH-101.', isRead: 1, createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), link: '/admin/dashboard/transactions' },
            { userId: 1, type: 'GATEWAY_ALERT', title: 'Gateway Limit Reached', description: 'Payment account "Stripe Primary (USD)" is at 74% of its daily limit.', isRead: 1, createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), link: '/admin/dashboard/payments' },
        ];

        for(const n of notifications) {
            await notificationStmt.run(n.userId, n.type, n.title, n.description, n.isRead, n.createdAt, n.link);
        }
        await notificationStmt.finalize();
        console.log(`${notifications.length} notifications inserted.`);

        await db.run('COMMIT');
        console.log('Database initialization process finished.');

    } catch(err) {
        console.error("Error during transaction, rolling back.", err);
        await db.run('ROLLBACK');
    } finally {
        await db.close();
        console.log('Closed the database connection.');
    }
}

initialize().catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
});
