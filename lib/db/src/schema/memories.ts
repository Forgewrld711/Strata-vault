import { pgTable, text, serial, timestamp, integer, boolean, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const memoryTypeEnum = pgEnum("memory_type", ["core", "episode", "concept", "fact", "emotion"]);

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  type: memoryTypeEnum("type").notNull().default("fact"),
  pinned: boolean("pinned").notNull().default(false),
  tags: text("tags").array().notNull().default([]),
  x: real("x"),
  y: real("y"),
  sourceRef: text("source_ref"),
  instanceId: text("instance_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemorySchema = createInsertSchema(memoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memoriesTable.$inferSelect;
