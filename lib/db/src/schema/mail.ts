import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const mailMessagesTable = pgTable("mail_messages", {
  id: serial("id").primaryKey(),
  fromAccountId: integer("from_account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  toAccountId: integer("to_account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  subject: text("subject"),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
