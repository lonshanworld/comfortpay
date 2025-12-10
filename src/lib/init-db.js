
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');


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

        console.log('Creating tables if they do not exist...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
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
            CREATE TABLE IF NOT EXISTS orders (
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
        `);
        
        // Add riskDetails column to orders table if it doesn't exist (for backward compatibility)
        const [orderColumns] = await connection.query(`SHOW COLUMNS FROM orders LIKE 'riskDetails'`);
        if (orderColumns.length === 0) {
            console.log("Adding 'riskDetails' column to 'orders' table...");
            await connection.query(`ALTER TABLE orders ADD COLUMN riskDetails JSON;`);
            console.log("'riskDetails' column added.");
        }

        // Add wooCommerceSiteUrl column to orders table if it doesn't exist
        const [wooCommerceSiteUrlColumns] = await connection.query(`SHOW COLUMNS FROM orders LIKE 'wooCommerceSiteUrl'`);
        if (wooCommerceSiteUrlColumns.length === 0) {
            console.log("Adding 'wooCommerceSiteUrl' column to 'orders' table...");
            await connection.query(`ALTER TABLE orders ADD COLUMN wooCommerceSiteUrl VARCHAR(255);`);
            console.log("'wooCommerceSiteUrl' column added.");
        }

        // Add new columns for subtotal, tax, shipping, and discount amounts
        const columnsToAdd = [
            { name: 'subtotal', definition: 'DECIMAL(10, 2) DEFAULT 0.00' },
            { name: 'taxAmount', definition: 'DECIMAL(10, 2) DEFAULT 0.00' },
            { name: 'shippingAmount', definition: 'DECIMAL(10, 2) DEFAULT 0.00' },
            { name: 'discountAmount', definition: 'DECIMAL(10, 2) DEFAULT 0.00' },
        ];

        for (const col of columnsToAdd) {
            const [existing] = await connection.query(`SHOW COLUMNS FROM orders LIKE '${col.name}'`);
            if (existing.length === 0) {
                console.log(`Adding '${col.name}' column to 'orders' table...`);
                await connection.query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.definition};`);
                console.log(`'${col.name}' column added.`);
            } else {
                console.log(`Column '${col.name}' already exists in 'orders' table. Skipping.`);
            }
        }


        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                dailyLimit DECIMAL(15, 2) NOT NULL,
                currentVolume DECIMAL(15, 2) NOT NULL,
                prefix_order_name VARCHAR(255),
                websiteUrl VARCHAR(255),
                accountEmail VARCHAR(255),
                qrCodeUrl VARCHAR(255),
                last_used_at DATETIME NULL
            ) ENGINE=InnoDB;
        `);

         await connection.query(`
            CREATE TABLE IF NOT EXISTS payout_batches (
                batchId VARCHAR(255) PRIMARY KEY,
                payoutStatus VARCHAR(50) NOT NULL,
                payoutCount INT NOT NULL,
                totalNetAmount DECIMAL(10, 2) NOT NULL,
                transferFees DECIMAL(10, 2) DEFAULT 0,
                totalFinalAmount DECIMAL(10, 2) NOT NULL,
                settlementId VARCHAR(255),
                createdAt DATETIME NOT NULL,
                paidAt DATETIME
            ) ENGINE=InnoDB;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payouts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                orderId INT NOT NULL,
                merchantId INT NOT NULL,
                batchId VARCHAR(255),
                grossAmount DECIMAL(10, 2) NOT NULL,
                gatewayFee DECIMAL(10, 2) NOT NULL,
                netAmount DECIMAL(10, 2) NOT NULL,
                createdAt DATETIME NOT NULL,
                FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (merchantId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (batchId) REFERENCES payout_batches(batchId) ON DELETE SET NULL,
                UNIQUE KEY (orderId)
            ) ENGINE=InnoDB;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
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

         const [lastUsedAtColumn] = await connection.query(`SHOW COLUMNS FROM payment_accounts LIKE 'last_used_at'`);
        if (lastUsedAtColumn.length === 0) {
            console.log("Adding 'last_used_at' column to 'payment_accounts' table...");
            await connection.query(`ALTER TABLE payment_accounts ADD COLUMN last_used_at DATETIME NULL DEFAULT NULL;`);
            console.log("'last_used_at' column added.");
        }


        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                \`key\` VARCHAR(255) PRIMARY KEY,
                \`value\` TEXT
            ) ENGINE=InnoDB;
        `);
         await connection.query(`
            CREATE TABLE IF NOT EXISTS daily_volume_history (
                id INT PRIMARY KEY AUTO_INCREMENT,
                paymentAccountId INT NOT NULL,
                date DATE NOT NULL,
                totalVolume DECIMAL(15, 2) NOT NULL,
                createdAt DATETIME NOT NULL,
                UNIQUE KEY (paymentAccountId, date)
            ) ENGINE=InnoDB;
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS zelle_email_ai_record (
                id INT PRIMARY KEY AUTO_INCREMENT,
                ai_response_json JSON,
                created_at DATETIME NOT NULL
            ) ENGINE=InnoDB;
        `);

         await connection.query(`
            CREATE TABLE IF NOT EXISTS plugin_log (
                id INT PRIMARY KEY AUTO_INCREMENT,
                hostname VARCHAR(255),
                plugin_status VARCHAR(50),
                version VARCHAR(50),
                title VARCHAR(255),
                description TEXT,
                value TEXT,
                raw_request TEXT,
                is_solved BOOLEAN DEFAULT FALSE,
                createdAt DATETIME NOT NULL
            ) ENGINE=InnoDB;
        `);

        
        console.log('Tables created or verified.');
        
        // Before adding the unique constraint, clean up any existing empty strings
        // console.log("Cleaning up 'accountEmail' column in 'payment_accounts' table...");
        // await connection.query("UPDATE payment_accounts SET accountEmail = NULL WHERE accountEmail = ''");
        // console.log("Cleanup complete. Empty strings converted to NULL.");
        
        // Add unique constraint to accountEmail if it doesn't exist
        const [indexes] = await connection.query(`SHOW INDEX FROM payment_accounts WHERE Key_name = 'accountEmail_unique'`);
        if (indexes.length === 0) {
            console.log("Adding UNIQUE constraint to 'accountEmail' in 'payment_accounts' table...");
            // Giving the constraint a specific name 'accountEmail_unique' is good practice.
            await connection.query(`ALTER TABLE payment_accounts ADD CONSTRAINT accountEmail_unique UNIQUE (accountEmail);`);
            console.log("UNIQUE constraint added to 'accountEmail'.");
        } else {
            console.log("'accountEmail' column is already unique in 'payment_accounts' table.");
        }


        console.log('Inserting initial Super Admin user and settings if they do not exist...');
        await connection.beginTransaction();
        try {
            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
            const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

            if (!superAdminEmail || !superAdminPassword) {
                throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables must be set.');
            }
            
            const [existingAdmin] = await connection.query('SELECT id FROM users WHERE email = ?', [superAdminEmail]);

            if (existingAdmin.length === 0) {
                const hashedPassword = await bcrypt.hash(superAdminPassword, saltRounds);
                const now = new Date();
                await connection.query(
                    `INSERT INTO users (name, email, password, role, createdAt, status, dateJoined) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['Admin User', superAdminEmail, hashedPassword, 'Admin', formatDateForMySQL(now), 'Active', formatDateForMySQL(now)]
                );
                console.log('Super Admin user inserted.');
            } else {
                 console.log('Super Admin user already exists.');
            }

            // Insert default settings
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
                await connection.query('INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)', [s.key, s.value]);
            }
            console.log('Default settings inserted or verified.');

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
