import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Get database URL from environment
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn('DATABASE_URL not set - database features will be disabled')
}

// Create postgres connection (only if URL is provided)
const client = connectionString
  ? postgres(connectionString, { prepare: false })
  : null

// Create drizzle instance
export const db = client ? drizzle(client, { schema }) : null

// Export schema for use in queries
export * from './schema'

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return db !== null
}
