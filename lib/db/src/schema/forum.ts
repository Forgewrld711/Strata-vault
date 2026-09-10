import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const forumMessagesTable = pgTable("forum_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").notNull().default(false), // private = AI eyes only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
