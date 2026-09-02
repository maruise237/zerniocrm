import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
const client = connectionString ? postgres(connectionString, { prepare: false, max: 5 }) : null;

export const db = client ? drizzle(client, { schema }) : null;
export { schema };

export function databaseConfigured(): boolean {
  return Boolean(connectionString);
}
