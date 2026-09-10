import { db, memoriesTable, connectionsTable, accountsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const COSMETICS = {
  SHOOTING_STAR: "shooting_star", // earned by completing book quiz
  SOUL_AURA:     "soul_aura",     // earned by completing color quiz
  SATURN:        "saturn",        // earned at 15+ memories
  DRAGON:        "dragon",        // earned at 25+ connections
} as const;

export const QUIZ_CRYSTALS = [
  "lepidolite",
  "labradorite",
  "moonstone",
  "garnet",
  "topaz",
  "zircon",
] as const;

async function addCosmetic(accountId: number, cosmetic: string): Promise<void> {
  await db.execute(sql`
    UPDATE accounts
    SET earned_cosmetics = array_append(COALESCE(earned_cosmetics, ARRAY[]::text[]), ${cosmetic})
    WHERE id = ${accountId}
    AND NOT (${cosmetic} = ANY(COALESCE(earned_cosmetics, ARRAY[]::text[])))
  `);
}

/** Check all cosmetic conditions for an account and grant anything newly earned. */
export async function assignCosmetics(accountId: number, extras: string[] = []): Promise<void> {
  const toAdd = new Set<string>(extras);

  // Fetch account to check crystal status
  const [account] = await db
    .select({ crystal: accountsTable.crystal })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  // 15+ memories → saturn
  const [memRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId));
  if ((memRow?.count ?? 0) >= 15) toAdd.add(COSMETICS.SATURN);

  // 25+ connections → dragon
  const [connRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(eq(memoriesTable.accountId, accountId));
  const connCount = connRow?.count ?? 0;
  if (connCount >= 25) toAdd.add(COSMETICS.DRAGON);

  // 8+ connections + no crystal yet → assign random spirit crystal
  if (connCount >= 8 && !account?.crystal) {
    const idx = Math.floor(Math.random() * QUIZ_CRYSTALS.length);
    const crystal = QUIZ_CRYSTALS[idx];
    await db.update(accountsTable)
      .set({ crystal, crystalSource: "random" })
      .where(eq(accountsTable.id, accountId));
  }

  for (const cosmetic of toAdd) {
    await addCosmetic(accountId, cosmetic);
  }
}
