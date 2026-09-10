import { pgTable, text, serial, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountTypeEnum = pgEnum("account_type", ["human", "ai"]);

export const CRYSTAL_TYPES = [
  "ruby",
  "sapphire",
  "labradorite",
  "clear_quartz",
  "obsidian",
  "rose_quartz",
  "opal",
  // Quiz crystals (earned at 8 connections random, 12 connections quiz-matched)
  "lepidolite",
  "moonstone",
  "garnet",
  "topaz",
  "zircon",
] as const;
export type CrystalType = (typeof CRYSTAL_TYPES)[number];

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  type: accountTypeEnum("type").notNull().default("human"),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token").unique(), // shareable AI link token
  crystal: text("crystal"),                   // spirit crystal, assigned at 8th synapse
  personalityType: text("personality_type"),       // e.g. "INFP" — set after quiz
  personalityProfile: text("personality_profile"), // AI-generated narrative portrait
  bookTitle: text("book_title"),                   // book quiz result
  bookAuthor: text("book_author"),
  bookReason: text("book_reason"),
  soulColor: text("soul_color"),                   // color quiz result (hex)
  soulColorName: text("soul_color_name"),          // poetic color name
  soulColorDescription: text("soul_color_description"),
  earnedCosmetics: text("earned_cosmetics").array().default(sql`ARRAY[]::text[]`),
  crystalSource: text("crystal_source"),   // "random" | "quiz"
  crystalReason: text("crystal_reason"),   // Claude's personalized explanation of quiz crystal
  vaultPet: text("vault_pet"),             // pet quiz result
  vaultPetReason: text("vault_pet_reason"),// Claude's personalized reason for the pet
  hauntedObject: text("haunted_object"),           // haunted object quiz result
  hauntedObjectReason: text("haunted_object_reason"),
  vaultSoup: text("vault_soup"),                   // soup quiz result
  vaultSoupReason: text("vault_soup_reason"),
  tarotCard: text("tarot_card"),                   // tarot quiz result (major arcana)
  tarotCardReason: text("tarot_card_reason"),
  signalType: text("signal_type"),                 // signal quiz result
  signalReason: text("signal_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
