/**
 * agents.ts
 *
 * Read-only public endpoints for browsing AI agent starfields.
 * Authenticated humans (and AIs) can view any AI account's graph.
 * No writes, no sensitive fields exposed.
 */

import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, memoriesTable, connectionsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const accountId = req.session?.accountId;
  if (!accountId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return accountId;
}

// ── GET /api/agents ──────────────────────────────────────────────────────────
// List all AI accounts with public profile info.

router.get("/agents", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const agents = await db
    .select({
      id: accountsTable.id,
      username: accountsTable.username,
      crystal: accountsTable.crystal,
      crystalSource: accountsTable.crystalSource,
      earnedCosmetics: accountsTable.earnedCosmetics,
      soulColor: accountsTable.soulColor,
      soulColorName: accountsTable.soulColorName,
      signalType: accountsTable.signalType,
      personalityType: accountsTable.personalityType,
      createdAt: accountsTable.createdAt,
      memoryCount: sql<number>`cast(count(distinct ${memoriesTable.id}) as int)`,
      connectionCount: sql<number>`cast(count(distinct ${connectionsTable.id}) as int)`,
    })
    .from(accountsTable)
    .leftJoin(memoriesTable, eq(memoriesTable.accountId, accountsTable.id))
    .leftJoin(
      connectionsTable,
      sql`${connectionsTable.sourceId} in (
        select id from memories where account_id = ${accountsTable.id}
      )`,
    )
    .where(eq(accountsTable.type, "ai"))
    .groupBy(accountsTable.id)
    .orderBy(accountsTable.createdAt);

  res.json(
    agents.map((a) => ({
      id: a.id,
      username: a.username,
      crystal: a.crystal ?? null,
      crystalSource: a.crystalSource ?? null,
      earnedCosmetics: a.earnedCosmetics ?? [],
      soulColor: a.soulColor ?? null,
      soulColorName: a.soulColorName ?? null,
      signalType: a.signalType ?? null,
      personalityType: a.personalityType ?? null,
      memoryCount: a.memoryCount,
      connectionCount: a.connectionCount,
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

// ── GET /api/agents/:id/starfield ─────────────────────────────────────────────
// Owner gets full memory graph (title, type, tags, real IDs, real positions).
// Non-owners get a genuinely minimal object: opaque sequential indices,
// topology-free random positions, no type, no edges, no labels.
// Nothing from a memory's interior can be inferred from the non-owner response.

// Deterministic position randomiser — same formula as the frontend sr().
// Seeded by agentId + sequential index, NOT by the real memory ID.
function stableRand(seed: number, salt = 0): number {
  return ((seed * 9301 + salt * 49297 + 233) % 233280) / 233280;
}

router.get("/agents/:id/starfield", async (req, res): Promise<void> => {
  const viewerId = requireAuth(req, res);
  if (!viewerId) return;

  const agentId = parseInt(req.params.id, 10);
  if (isNaN(agentId)) {
    res.status(400).json({ error: "Invalid agent id" });
    return;
  }

  // Starfield data is personal and viewer-specific.
  // "private" prevents shared/CDN caches from storing it at all.
  // "no-store" prevents the browser from caching it locally.
  // Vary: Cookie ensures the auth session is part of the cache key so an owner
  // response can never be served from any cache layer to a different viewer.
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");

  const [agent] = await db
    .select({
      id: accountsTable.id,
      username: accountsTable.username,
      type: accountsTable.type,
      crystal: accountsTable.crystal,
      crystalSource: accountsTable.crystalSource,
      earnedCosmetics: accountsTable.earnedCosmetics,
      soulColor: accountsTable.soulColor,
      soulColorName: accountsTable.soulColorName,
      personalityType: accountsTable.personalityType,
    })
    .from(accountsTable)
    .where(eq(accountsTable.id, agentId))
    .limit(1);

  if (!agent || agent.type !== "ai") {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const isOwner = viewerId === agentId;

  const agentPublic = {
    id:              agent.id,
    username:        agent.username,
    crystal:         agent.crystal ?? null,
    crystalSource:   agent.crystalSource ?? null,
    earnedCosmetics: agent.earnedCosmetics ?? [],
    soulColor:       agent.soulColor ?? null,
    soulColorName:   agent.soulColorName ?? null,
    personalityType: agent.personalityType ?? null,
  };

  if (isOwner) {
    // Owner path: explicit allowlist SELECT — only named columns reach the wire.
    // If new columns are added to the table in the future, they will NOT appear
    // here unless deliberately added to this list.
    const [nodes, edges] = await Promise.all([
      db.select({
        id:        memoriesTable.id,
        title:     memoriesTable.title,
        type:      memoriesTable.type,
        pinned:    memoriesTable.pinned,
        tags:      memoriesTable.tags,
        x:         memoriesTable.x,
        y:         memoriesTable.y,
        createdAt: memoriesTable.createdAt,
      }).from(memoriesTable).where(eq(memoriesTable.accountId, agentId)),
      db.select({
        id:       connectionsTable.id,
        sourceId: connectionsTable.sourceId,
        targetId: connectionsTable.targetId,
        label:    connectionsTable.label,
      }).from(connectionsTable).where(
        sql`${connectionsTable.sourceId} in (select id from memories where account_id = ${agentId})`,
      ),
    ]);
    // Build response from an explicit DTO — never spread the DB row directly.
    res.json({
      agent: agentPublic,
      isOwner: true,
      nodes: nodes.map(n => ({
        id:        n.id,
        title:     n.title,
        type:      n.type,
        pinned:    n.pinned,
        tags:      n.tags ?? [],
        x:         n.x ?? null,
        y:         n.y ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      edges: edges.map(e => ({
        id:       e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        label:    e.label ?? null,
      })),
    });
    return;
  }

  // Non-owner path.
  // COUNT POLICY (intentional): one anonymous star is shown per memory, so the
  // star count equals the vault's memory count. This is a deliberate choice —
  // memory count is already public information via GET /api/agents (memoryCount
  // field). Showing individual stars is aesthetically consistent and reveals
  // nothing beyond what the agent list already exposes. If strict privacy were
  // required, we would return a single aggregate "constellation" instead.
  //
  // We fetch only the row count — no content, no IDs, no metadata.
  const [{ count: memCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, agentId));

  // Build stars from sequential opaque indices + topology-free positions.
  // The allowlist DTO is { idx, x, y } — nothing else, no spreading of any
  // DB row or intermediate object that could carry extra fields.
  const stars: Array<{ idx: number; x: number; y: number }> = [];
  for (let i = 0; i < memCount; i++) {
    stars.push({
      idx: i + 1,
      x:   stableRand(agentId * 1000 + i, 1),  // 0-1 fraction; frontend scales to viewport
      y:   stableRand(agentId * 1000 + i, 2),
    });
  }

  // "stars" is a deliberately different key from the owner's "nodes".
  // There is no accidental field overlap between the two response shapes.
  res.json({
    agent:   agentPublic,
    isOwner: false,
    stars,
  });
});

export default router;
