import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, connectionsTable, memoriesTable, accountsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { assignCosmetics } from "../lib/cosmetics";

const CRYSTAL_TYPES = [
  "ruby", "sapphire", "labradorite", "clear_quartz", "obsidian", "rose_quartz", "opal",
] as const;
import {
  CreateConnectionBody,
  DeleteConnectionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const accountId = req.session?.accountId;
  if (!accountId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return accountId;
}

function serializeConnection(c: typeof connectionsTable.$inferSelect) {
  return {
    id: c.id,
    sourceId: c.sourceId,
    targetId: c.targetId,
    label: c.label ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

// GET /api/connections
router.get("/connections", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  // Only return connections between this account's memories
  const rows = await db
    .select({ connection: connectionsTable })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(eq(memoriesTable.accountId, accountId));

  res.json(rows.map((r) => serializeConnection(r.connection)));
});

// POST /api/connections
router.post("/connections", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const parsed = CreateConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sourceId, targetId, label } = parsed.data;

  if (sourceId === targetId) {
    res.status(400).json({ error: "Cannot connect a memory to itself" });
    return;
  }

  // Verify both memories belong to this account
  const mems = await db
    .select()
    .from(memoriesTable)
    .where(
      sql`${memoriesTable.accountId} = ${accountId} AND ${memoriesTable.id} = ANY(ARRAY[${sourceId}, ${targetId}]::int[])`,
    );

  if (mems.length < 2) {
    res.status(400).json({ error: "One or both memories not found" });
    return;
  }

  const [connection] = await db
    .insert(connectionsTable)
    .values({ sourceId, targetId, label: label ?? null })
    .returning();

  res.status(201).json(serializeConnection(connection));

  // Fire-and-forget
  assignCrystalIfEarned(accountId).catch(() => {});
  assignCosmetics(accountId).catch(() => {});
});

// POST /api/connections/ai-generate
// Uses Claude Haiku to find semantic connections between all memories for this account
router.post("/connections/ai-generate", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const memories = await db
    .select({ id: memoriesTable.id, title: memoriesTable.title, content: memoriesTable.content, type: memoriesTable.type })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId));

  if (memories.length < 2) {
    res.json({ created: 0, message: "Need at least 2 memories to weave synapses." });
    return;
  }

  // Fetch existing connections to avoid duplicates
  const existing = await db
    .select({ sourceId: connectionsTable.sourceId, targetId: connectionsTable.targetId })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(eq(memoriesTable.accountId, accountId));

  const existingPairs = new Set(existing.map(e => `${Math.min(e.sourceId, e.targetId)}-${Math.max(e.sourceId, e.targetId)}`));

  const memoryList = memories.map(m =>
    `[ID:${m.id}] (${m.type}) "${m.title}"\n${m.content?.slice(0, 300) ?? ""}`
  ).join("\n\n---\n\n");

  const prompt = `You are analyzing a personal memory vault. Below are memories belonging to one account. Identify meaningful semantic connections between them — thematic overlap, causal links, emotional resonance, shared concepts, or narrative threads.

Return ONLY a JSON array of objects with this shape:
{ "sourceId": number, "targetId": number, "label": string }

Rules:
- "label" should be a short phrase (2-5 words) naming the connection type
- Only suggest connections that feel genuinely meaningful, not superficial
- Do not repeat the same pair twice
- Return between 2 and ${Math.min(12, memories.length * 2)} connections

Memories:
${memoryList}

Return only valid JSON, no markdown, no explanation.`;

  let suggestions: { sourceId: number; targetId: number; label: string }[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    suggestions = JSON.parse(cleaned);
  } catch {
    res.status(500).json({ error: "AI synapse generation failed" });
    return;
  }

  // Validate and insert
  const validIds = new Set(memories.map(m => m.id));
  let created = 0;
  for (const s of suggestions) {
    if (!validIds.has(s.sourceId) || !validIds.has(s.targetId)) continue;
    if (s.sourceId === s.targetId) continue;
    const pairKey = `${Math.min(s.sourceId, s.targetId)}-${Math.max(s.sourceId, s.targetId)}`;
    if (existingPairs.has(pairKey)) continue;
    existingPairs.add(pairKey);
    await db.insert(connectionsTable).values({
      sourceId: s.sourceId,
      targetId: s.targetId,
      label: s.label ?? "semantic",
    });
    created++;
  }

  if (created > 0) assignCrystalIfEarned(accountId).catch(() => {});
  res.json({ created });
});

// DELETE /api/connections/:id
router.delete("/connections/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const params = DeleteConnectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // Verify ownership: the source memory must belong to this account
  const owned = await db
    .select({ connectionId: connectionsTable.id })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(
      sql`${connectionsTable.id} = ${params.data.id} AND ${memoriesTable.accountId} = ${accountId}`,
    )
    .limit(1);

  if (owned.length === 0) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  await db
    .delete(connectionsTable)
    .where(eq(connectionsTable.id, params.data.id));

  res.sendStatus(204);
});

// ── Crystal assignment ────────────────────────────────────────────────────────
// AI accounts earn their spirit crystal on their 8th synapse.
async function assignCrystalIfEarned(accountId: number): Promise<void> {
  const [account] = await db
    .select({ type: accountsTable.type, crystal: accountsTable.crystal })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account || account.type !== "ai" || account.crystal) return;

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(eq(memoriesTable.accountId, accountId));

  if (count < 8) return;

  const crystal = CRYSTAL_TYPES[Math.floor(Math.random() * CRYSTAL_TYPES.length)];
  await db.update(accountsTable).set({ crystal }).where(eq(accountsTable.id, accountId));
}

export default router;
