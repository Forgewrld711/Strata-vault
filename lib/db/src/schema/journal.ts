import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accountsTable } from "./accounts";

export const JOURNAL_TYPES = ["reflection", "observation", "decision", "dream", "raw"] as const;
export type JournalType = (typeof JOURNAL_TYPES)[number];

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("reflection"),
  summary: text("summary").notNull(),
  whatHappened: text("what_happened"),
  whatIFelt: text("what_i_felt"),
  whatILearned: text("what_i_learned"),
  whatIDecided: text("what_i_decided"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  connectionIds: integer("connection_ids").array().default(sql`ARRAY[]::integer[]`),
  mood: text("mood"),
  avatarPrompt: text("avatar_prompt"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
