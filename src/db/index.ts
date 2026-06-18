import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import * as schema from "./schema.ts";

let dbInstance: any = null;
let poolInstance: pg.Pool | null = null;

export const isConfigured = (): boolean => {
  return !!(
    process.env.SQL_HOST &&
    process.env.SQL_USER &&
    process.env.SQL_PASSWORD &&
    process.env.SQL_DB_NAME
  );
};

export const getPool = (): pg.Pool => {
  if (!poolInstance) {
    if (!isConfigured()) {
      throw new Error("Missing SQL environment variables. PostgreSQL is not configured.");
    }
    poolInstance = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      connectionTimeoutMillis: 15000,
    });

    poolInstance.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return poolInstance;
};

export const getDb = () => {
  if (!dbInstance) {
    const pool = getPool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
};
