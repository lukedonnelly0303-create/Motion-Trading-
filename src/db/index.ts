import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "crypto";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { dbClient?: ReturnType<typeof createClient> };

const client =
  globalForDb.dbClient ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN, // only needed for a remote libSQL/Turso database
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbClient = client;
}

export const db = drizzle(client, { schema });

/** IDs are generated in application code (not by the DB) so a fresh row's id
 * is known immediately after insert without relying on RETURNING support. */
export function newId(): string {
  return randomUUID();
}
