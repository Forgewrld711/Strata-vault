import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { memoriesTable } from "./memories";

export const connectionsTable = pgTable("connections", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => memoriesTable.id, { onDelete: "cascade" }),
  targetId: integer("target_id").notNull().references(() => memoriesTable.id, { onDelete: "cascade" }),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConnectionSchema = createInsertSchema(connectionsTable).omit({ id: true, createdAt: true });
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connectionsTable.$inferSelect;
