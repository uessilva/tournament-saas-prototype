import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  summerCupDb?: ReturnType<typeof createDatabase>;
};

function createDatabase() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgres://summercup:summercup@localhost:5433/summercup";

  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

const database = globalForDb.summerCupDb ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.summerCupDb = database;
}

export const db = database.db;
export const sqlClient = database.client;
export { schema };
export type Database = typeof db;
