import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

/** Registered OAuth 2.0 clients (e.g. OpenHuman) */
export const oauthClientsTable = pgTable("oauth_clients", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  /** bcrypt hash of the client secret */
  clientSecretHash: text("client_secret_hash").notNull(),
  name: text("name").notNull(),
  /** JSON array of allowed redirect URIs */
  redirectUris: text("redirect_uris").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Short-lived authorization codes issued during the authorize step */
export const oauthCodesTable = pgTable("oauth_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  clientId: text("client_id").notNull(),
  accountId: text("account_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  scope: text("scope").notNull().default("read"),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
