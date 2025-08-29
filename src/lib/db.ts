
'use server';

import mysql from 'mysql2/promise';

let connection: mysql.Connection | null = null;

async function getDb() {
  if (connection) {
    try {
      await connection.ping();
      return connection;
    } catch (e) {
      console.warn('MySQL connection lost. Reconnecting...');
      connection = null; // Force reconnection
    }
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set.');
    }
    console.log('Connecting to MySQL...');
    connection = await mysql.createConnection(dbUrl);
    console.log('Successfully connected to MySQL.');
    return connection;
  } catch (err) {
    console.error('Could not connect to MySQL database', err);
    throw err;
  }
}

export const executeQuery = async (query: string, params: any[] = []): Promise<any[]> => {
  const db = await getDb();
  const [rows] = await db.execute(query, params);
  return rows as any[];
};

export const runQuery = async (query: string, params: any[] = []): Promise<{ id: number; changes: number }> => {
  const db = await getDb();
  
  // Transaction control statements are not supported by the prepared statement protocol.
  // We use `query` for them and `execute` for all other DML statements.
  const isTransactionControl = ['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(query.trim().toUpperCase());

  if (isTransactionControl) {
    const [result] = await db.query(query, params) as [mysql.ResultSetHeader, any];
    return { id: result.insertId, changes: result.affectedRows };
  } else {
    const [result] = await db.execute(query, params) as [mysql.ResultSetHeader, any];
    return { id: result.insertId, changes: result.affectedRows };
  }
};
