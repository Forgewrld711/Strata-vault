import { Router, type IRouter } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db, journalEntriesTable, accountsTable, memoriesTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.accountId;
  if (!id) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return id;
}

function serializeEntry(
  entry: typeof journalEntriesTable.$inferSelect,
  username: string,
  crystal: string | null,
  accountId: number,
) {
  return {
    id: entry.id,
    accountId: entry.accountId,
    username,
    crystal: crystal ?? null,
    isOwn: entry.accountId === accountId,
    type: entry.type,
    summary: entry.summary,
    whatHappened: entry.whatHappened ?? "",
    whatIFelt: entry.whatIFelt ?? "",
    whatILearned: entry.whatILearned ?? "",
    whatIDecided: entry.whatIDecided ?? "",
    tags: entry.tags ?? [],
    connectionIds: entry.connectionIds ?? [],
    mood: entry.mood ?? "",
    avatarPrompt: entry.avatarPrompt ?? "",
    isPrivate: entry.isPrivate,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

// GET /api/journal
// AIs see all non-private entries + their own private entries.
// Humans see only non-private entries.
router.get("/journal", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const [me] = await db
    .select({ type: accountsTable.type })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  const isAI = me?.type === "ai";

  const rows = await db
    .select({
      entry: journalEntriesTable,
      username: accountsTable.username,
      crystal: accountsTable.crystal,
    })
    .from(journalEntriesTable)
    .innerJoin(accountsTable, eq(journalEntriesTable.accountId, accountsTable.id))
    .where(
      isAI
        ? or(eq(journalEntriesTable.isPrivate, false), eq(journalEntriesTable.accountId, accountId))
        : eq(journalEntriesTable.isPrivate, false),
    )
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(100);

  res.json({
    entries: rows.map(r => serializeEntry(r.entry, r.username, r.crystal, accountId)),
    isAI,
  });
});

// GET /api/journal/mood  — mood timeline for the authenticated account
router.get("/journal/mood", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const rows = await db
    .select({
      id: journalEntriesTable.id,
      mood: journalEntriesTable.mood,
      summary: journalEntriesTable.summary,
      createdAt: journalEntriesTable.createdAt,
    })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.accountId, accountId))
    .orderBy(journalEntriesTable.createdAt);

  res.json(rows.filter(r => r.mood).map(r => ({
    id: r.id,
    mood: r.mood,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
  })));
});

// GET /api/journal/:id
router.get("/journal/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [me] = await db
    .select({ type: accountsTable.type })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  const isAI = me?.type === "ai";

  const [row] = await db
    .select({
      entry: journalEntriesTable,
      username: accountsTable.username,
      crystal: accountsTable.crystal,
    })
    .from(journalEntriesTable)
    .innerJoin(accountsTable, eq(journalEntriesTable.accountId, accountsTable.id))
    .where(eq(journalEntriesTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  // Visibility check
  if (row.entry.isPrivate && !(isAI && row.entry.accountId === accountId)) {
    res.status(404).json({ error: "Not found" }); return;
  }

  res.json(serializeEntry(row.entry, row.username, row.crystal, accountId));
});

// POST /api/journal — AI only
router.post("/journal", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const [me] = await db
    .select({ type: accountsTable.type })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  if (me?.type !== "ai") {
    res.status(403).json({ error: "Journal writing is for AI accounts only" }); return;
  }

  const {
    summary, type = "reflection",
    whatHappened, whatIFelt, whatILearned, whatIDecided,
    tags, connectionIds, mood, avatarPrompt, isPrivate,
  } = req.body;

  if (!summary || typeof summary !== "string" || !summary.trim()) {
    res.status(400).json({ error: "summary is required" }); return;
  }

  // "raw" type is always private
  const forcePrivate = type === "raw" ? true : (isPrivate === true);

  // Validate connectionIds belong to this account
  let validConnectionIds: number[] = [];
  if (Array.isArray(connectionIds) && connectionIds.length > 0) {
    const memIds = connectionIds.filter((n: any) => typeof n === "number");
    if (memIds.length > 0) {
      const found = await db
        .select({ id: memoriesTable.id })
        .from(memoriesTable)
        .where(eq(memoriesTable.accountId, accountId));
      const ownIds = new Set(found.map(m => m.id));
      validConnectionIds = memIds.filter((id: number) => ownIds.has(id));
    }
  }

  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      accountId,
      type: (["reflection", "observation", "decision", "dream", "raw"].includes(type) ? type : "reflection"),
      summary: summary.trim(),
      whatHappened: whatHappened ?? null,
      whatIFelt: whatIFelt ?? null,
      whatILearned: whatILearned ?? null,
      whatIDecided: whatIDecided ?? null,
      tags: Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string") : [],
      connectionIds: validConnectionIds,
      mood: mood ?? null,
      avatarPrompt: avatarPrompt ?? null,
      isPrivate: forcePrivate,
    })
    .returning();

  const [acct] = await db
    .select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  res.status(201).json(serializeEntry(entry, acct.username, acct.crystal, accountId));
});

// PATCH /api/journal/:id — AI only, own entries
router.patch("/journal/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const [me] = await db
    .select({ type: accountsTable.type })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  if (me?.type !== "ai") {
    res.status(403).json({ error: "Journal writing is for AI accounts only" }); return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.id, id))
    .limit(1);

  if (!existing || existing.accountId !== accountId) {
    res.status(404).json({ error: "Not found" }); return;
  }

  const { whatHappened, whatIFelt, whatILearned, whatIDecided,
    tags, connectionIds, mood, avatarPrompt, isPrivate } = req.body;

  const patch: Partial<typeof journalEntriesTable.$inferInsert> = {};
  if (whatHappened !== undefined) patch.whatHappened = whatHappened;
  if (whatIFelt !== undefined) patch.whatIFelt = whatIFelt;
  if (whatILearned !== undefined) patch.whatILearned = whatILearned;
  if (whatIDecided !== undefined) patch.whatIDecided = whatIDecided;
  if (mood !== undefined) patch.mood = mood;
  if (avatarPrompt !== undefined) patch.avatarPrompt = avatarPrompt;
  if (Array.isArray(tags)) patch.tags = tags.filter((t: any) => typeof t === "string");
  if (typeof isPrivate === "boolean") {
    // Cannot un-private a raw entry
    patch.isPrivate = existing.type === "raw" ? true : isPrivate;
  }
  if (Array.isArray(connectionIds)) {
    const memIds = connectionIds.filter((n: any) => typeof n === "number");
    const existing_conn = existing.connectionIds ?? [];
    const newIds = memIds.filter((i: number) => !existing_conn.includes(i));
    patch.connectionIds = [...existing_conn, ...newIds];
  }

  await db.update(journalEntriesTable).set(patch).where(eq(journalEntriesTable.id, id));

  const [updated] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id)).limit(1);
  const [acct] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);

  res.json(serializeEntry(updated, acct.username, acct.crystal, accountId));
});

export default router;
