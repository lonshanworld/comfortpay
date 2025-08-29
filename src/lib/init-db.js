
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const mysql = require('mysql2/promise');
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
            // Define Super Admin details directly in the script
            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
            const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

            if (!superAdminEmail || !superAdminPassword) {
                throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables must be set.');
            }
            
            const hashedPassword = await bcrypt.hash(superAdminPassword, saltRounds);
            const now = formatDateForMySQL(new Date());

            // Insert only the Super Admin
            await connection.query(
                `INSERT INTO users (
                    name, email, password, role, createdAt, status, dateJoined
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    'Admin User',
                    superAdminEmail,
                    hashedPassword,
                    'Admin',
                    now,
                    'Active',
                    now
                ]
            );
            console.log('Super Admin user inserted.');

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
                await connection.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?)', [s.key, s.value]);
            }
            console.log(`${settings.length} default settings inserted.`);

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
