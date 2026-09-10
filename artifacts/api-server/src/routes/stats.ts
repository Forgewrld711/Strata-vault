import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, memoriesTable, connectionsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const accountId = req.session?.accountId;
  if (!accountId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return accountId;
}

function serializeMemory(m: typeof memoriesTable.$inferSelect) {
  return {
    id: m.id,
    accountId: m.accountId,
    title: m.title,
    content: m.content,
    type: m.type,
    pinned: m.pinned,
    tags: m.tags ?? [],
    x: m.x ?? null,
    y: m.y ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// GET /api/stats
router.get("/stats", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const [totalMemoriesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId));

  const totalMemories = totalMemoriesResult?.count ?? 0;

  // Total connections (for memories belonging to this account)
  const totalConnectionsResult = await db.execute(
    sql`
      SELECT COUNT(c.id)::int AS count
      FROM connections c
      INNER JOIN memories m ON c.source_id = m.id
      WHERE m.account_id = ${accountId}
    `,
  );

  const totalConnections = (totalConnectionsResult.rows[0] as any)?.count ?? 0;

  // By type
  const byTypeRows = await db.execute(
    sql`
      SELECT type, COUNT(*)::int AS count
      FROM memories
      WHERE account_id = ${accountId}
      GROUP BY type
    `,
  );

  const byType = (byTypeRows.rows as any[]).map((r) => ({
    type: r.type,
    count: r.count,
  }));

  // Recent memories (last 5)
  const recentMemories = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(desc(memoriesTable.createdAt))
    .limit(5);

  // Pinned memories
  const pinnedMemories = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(desc(memoriesTable.createdAt))
    .limit(10);

  const pinned = pinnedMemories.filter((m) => m.pinned);

  res.json({
    totalMemories,
    totalConnections,
    byType,
    recentMemories: recentMemories.map(serializeMemory),
    pinnedMemories: pinned.map(serializeMemory),
  });
});

export default router;
