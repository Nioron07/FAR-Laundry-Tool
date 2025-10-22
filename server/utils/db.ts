import mysql from 'mysql2/promise'
import { Connector } from '@google-cloud/cloud-sql-connector'

let pool: mysql.Pool | null = null
let connector: Connector | null = null

export async function getDbPool() {
  if (!pool) {
    const config = useRuntimeConfig()

    // Initialize Cloud SQL Connector (similar to Python backend)
    connector = new Connector()

    // Get connection options from Cloud SQL Connector
    const clientOpts = await connector.getOptions({
      instanceConnectionName: config.instanceConnectionName,
      ipType: 'PUBLIC',
    })

    // Create pool with Cloud SQL Connector options + credentials
    pool = mysql.createPool({
      ...clientOpts,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
    })
  }

  return pool
}

export async function queryDatabase<T = any>(query: string, params?: any[]): Promise<T[]> {
  const pool = await getDbPool()
  const [rows] = await pool.execute(query, params)
  return rows as T[]
}
