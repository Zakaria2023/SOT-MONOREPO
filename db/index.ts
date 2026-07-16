import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (
  !process.env.DB_HOST ||
  !process.env.DB_PORT ||
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD ||
  !process.env.DB_NAME
) {
  throw new Error("Database credentials are not set in environment variables.");
}

const createPool = () =>
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    // The server's max_connections is shared by every app in this monorepo —
    // keep each app's slice small and recycle idle connections quickly so the
    // pool never exhausts the server ("Too many connections").
    connectionLimit: 4,
    maxIdle: 2,
    idleTimeout: 60_000,
    enableKeepAlive: true,
  });

// Reuse one pool across Next.js dev hot-reloads — without this, every code
// change re-evaluates this module and leaks a fresh pool of connections.
const globalForDb = globalThis as typeof globalThis & {
  mysqlPool?: ReturnType<typeof createPool>;
};

const pool = globalForDb.mysqlPool ?? createPool();
globalForDb.mysqlPool = pool;

export const db = drizzle(pool, {
  schema,
  mode: "default",
});

export * from "./schema";
