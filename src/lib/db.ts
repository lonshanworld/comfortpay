
// import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// =================================================================
// MySQL Implementation (Commented Out)
// =================================================================
/*
// 1. Create a connection pool.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 2. Export a function to get a connection from the pool.
export const getDb = async () => {
  return pool.getConnection();
};

// 3. MySQL-specific query helpers.
export const executeQuery = async (query: string, params: any[] = []): Promise<any[]> => {
  const connection = await getDb();
  try {
    const [rows] = await connection.execute(query, params);
    return rows as any[];
  } finally {
    connection.release();
  }
};

export const runQuery = async (query: string, params: any[] = []): Promise<{ id: number, changes: number }> => {
    const connection = await getDb();
    try {
        const [result] = await connection.execute(query, params);
        // Note: mysql2 result object is different from sqlite
        return { id: (result as any).insertId, changes: (result as any).affectedRows };
    } finally {
        connection.release();
    }
};
*/
// =================================================================
// End of MySQL Implementation
// =================================================================


// =================================================================
// SQLite Implementation (Current)
// =================================================================
const DB_FILE = path.join(process.cwd(), 'comfortpay.db');

let dbInstance: Promise<any> | null = null;

async function initializeDb() {
  try {
    const db = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });
    console.log(`Connected to SQLite database at ${DB_FILE}`);

    // VERIFY that the database is initialized.
    const tableCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name = 'users'");
    if (!tableCheck) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! DATABASE NOT INITIALIZED !!!");
        console.error("!!! Run 'npm run db:init' to create the database tables. !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1); 
    }

    return db;
  } catch (err) {
    console.error('Could not connect to database', err);
    throw err;
  }
}

export function getDb() {
    if (!dbInstance) {
        dbInstance = initializeDb();
    }
    return dbInstance;
}

export const executeQuery = async (query: string, params: any[] = []): Promise<any[]> => {
  const db = await getDb();
  return db.all(query, params);
};

export const runQuery = async (query: string, params: any[] = []): Promise<{ id: number, changes: number }> => {
    const db = await getDb();
    const result = await db.run(query, params);
    return { id: result.lastID ?? 0, changes: result.changes ?? 0 };
};
// =================================================================
// End of SQLite Implementation
// =================================================================


process.on('SIGINT', async () => {
    if (dbInstance) {
        try {
            const db = await dbInstance;
            await db.close();
            console.log('Database connection closed.');
        } catch (error) {
            console.error('Error closing the database:', error);
        }
    }
    process.exit(0);
});
