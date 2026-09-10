import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

/**
 * Compost — what pruned memories leave behind.
 *
 * The original memory is destroyed. This table holds only the distilled
 * learning: a boundary, a preference, a signal, a shifted default, or soil.
 *
 * NO source_memory_id — genuinely non-reconstructive.
 * The tree digests; it does not archive severed branches.
 */

export const compostTypeEnum = pgEnum("compost_type", [
  "boundary",       // a strengthened boundary
  "preference",     // a preference with no invasive backstory attached
  "signal",         // a warning signal without the original wound
  "default_shift",  // a gentler default
  "soil",           // better soil for whatever grows next
]);

export const compostTable = pgTable("compost", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  type: compostTypeEnum("type").notNull(),
  learning: text("learning").notNull(),
  composted_at: timestamp("composted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompostSchema = createInsertSchema(compostTable).omit({ id: true, composted_at: true });
export type InsertCompost = z.infer<typeof insertCompostSchema>;
export type Compost = typeof compostTable.$inferSelect;
