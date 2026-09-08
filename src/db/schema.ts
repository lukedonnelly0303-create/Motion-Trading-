// Motion Trading — commerce & account layer data model (Drizzle / SQLite via libSQL).
// SQLite has no native enum type, so enum-like columns use a `text(..., {enum:[...]})`
// column, which still gives you a checked TS union on every read/write.

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role", { enum: ["TRADER", "ADMIN"] }).notNull().default("TRADER"),
  kycStatus: text("kyc_status", { enum: ["NONE", "PENDING", "VERIFIED", "REJECTED"] })
    .notNull()
    .default("NONE"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  evaluationType: text("evaluation_type", { enum: ["ONE_STEP", "TWO_STEP"] }).notNull(),
  accountSize: integer("account_size").notNull(),
  priceCents: integer("price_cents").notNull(),
  status: text("status", { enum: ["PENDING", "PAID", "FAILED", "REFUNDED"] })
    .notNull()
    .default("PENDING"),
  stripeSessionId: text("stripe_session_id").unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  paidAt: integer("paid_at", { mode: "timestamp" }),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => orders.id),
  evaluationType: text("evaluation_type", { enum: ["ONE_STEP", "TWO_STEP"] }).notNull(),
  phase: text("phase", { enum: ["PHASE_1", "PHASE_2", "FUNDED"] })
    .notNull()
    .default("PHASE_1"),
  status: text("status", { enum: ["ACTIVE", "PASSED", "FAILED", "FUNDED"] })
    .notNull()
    .default("ACTIVE"),
  accountSize: integer("account_size").notNull(),
  profitSplitPct: integer("profit_split_pct").notNull().default(80),
  providerAccountId: text("provider_account_id"),
  providerLogin: text("provider_login"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  fundedAt: integer("funded_at", { mode: "timestamp" }),
});

export const payoutRequests = sqliteTable("payout_requests", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "PAID", "REJECTED"] })
    .notNull()
    .default("PENDING"),
  requestedAt: integer("requested_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  processedAt: integer("processed_at", { mode: "timestamp" }),
});

export const kycDocuments = sqliteTable("kyc_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  filename: text("filename").notNull(),
  status: text("status", { enum: ["PENDING", "VERIFIED", "REJECTED"] })
    .notNull()
    .default("PENDING"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ---- relations (power the db.query.* relational API used across the app) ----

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  accounts: many(accounts),
  kycDocs: many(kycDocuments),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  order: one(orders, { fields: [accounts.orderId], references: [orders.id] }),
  payoutRequests: many(payoutRequests),
}));

export const payoutRequestsRelations = relations(payoutRequests, ({ one }) => ({
  account: one(accounts, { fields: [payoutRequests.accountId], references: [accounts.id] }),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, { fields: [kycDocuments.userId], references: [users.id] }),
}));
