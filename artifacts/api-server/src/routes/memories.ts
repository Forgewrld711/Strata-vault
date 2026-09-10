import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, or, sql } from "drizzle-orm";
import { db, memoriesTable, connectionsTable, accountsTable } from "@workspace/db";
import { assignCosmetics } from "../lib/cosmetics";

const CRYSTAL_TYPES = [
  "ruby", "sapphire", "labradorite", "clear_quartz", "obsidian", "rose_quartz", "opal",
] as const;

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
import {
  CreateMemoryBody,
  UpdateMemoryBody,
  GetMemoryParams,
  UpdateMemoryParams,
  DeleteMemoryParams,
  ToggleMemoryPinParams,
  ListMemoriesQueryParams,
} from "@workspace/api-zod";
import { moderateMemoryContent } from "../lib/contentModeration";

const router: IRouter = Router();

// ─── Auto-link helper ─────────────────────────────────────────────────────────
// Obsidian-style: after a memory is saved, scan all other memories in the vault
// for title mentions (both directions) and auto-create synapses for new matches.

function titleMentionedIn(title: string, content: string): boolean {
  if (title.length < 3) return false;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\const router: IRouter = Router();");
  return new RegExp(`\\b${escaped}\\b`, "i").test(content);
}

async function connectionExists(a: number, b: number): Promise<boolean> {
  const rows = await db
    .select({ id: connectionsTable.id })
    .from(connectionsTable)
    .where(
      or(
        and(eq(connectionsTable.sourceId, a), eq(connectionsTable.targetId, b)),
        and(eq(connectionsTable.sourceId, b), eq(connectionsTable.targetId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function autoLinkMemory(
  accountId: number,
  memory: { id: number; title: string; content: string },
): Promise<number> {
  // Fetch all other memories for this account
  const others = await db
    .select({ id: memoriesTable.id, title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(and(eq(memoriesTable.accountId, accountId), sql`${memoriesTable.id} != ${memory.id}`));

  let created = 0;
  for (const other of others) {
    const shouldLink =
      titleMentionedIn(other.title, memory.content) ||
      titleMentionedIn(memory.title, other.content);

    if (shouldLink && !(await connectionExists(memory.id, other.id))) {
      await db.insert(connectionsTable).values({
        sourceId: memory.id,
        targetId: other.id,
        label: "auto",
      });
      created++;
    }
  }
  if (created > 0) assignCrystalIfEarned(accountId).catch(() => {});
  return created;
}

// Retroactive: scan every pair of memories in the vault for unlinked title mentions
async function autoLinkVault(accountId: number): Promise<number> {
  const all = await db
    .select({ id: memoriesTable.id, title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId));

  let created = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const shouldLink =
        titleMentionedIn(a.title, b.content) ||
        titleMentionedIn(b.title, a.content);

      if (shouldLink && !(await connectionExists(a.id, b.id))) {
        await db.insert(connectionsTable).values({ sourceId: a.id, targetId: b.id, label: "auto" });
        created++;
      }
    }
  }
  return created;
}

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
    sourceRef: m.sourceRef ?? null,
    instanceId: m.instanceId ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// GET /api/memories
router.get("/memories", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const qp = ListMemoriesQueryParams.safeParse(req.query);
  const { q, tag, type } = qp.success ? qp.data : {};

  let query = db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId));

  const conditions = [eq(memoriesTable.accountId, accountId)];

  if (q) {
    conditions.push(
      sql`(${memoriesTable.title} ilike ${"%" + q + "%"} or ${memoriesTable.content} ilike ${"%" + q + "%"})`,
    );
  }

  if (type) {
    conditions.push(eq(memoriesTable.type, type as any));
  }

  if (tag) {
    conditions.push(sql`${memoriesTable.tags} @> ARRAY[${tag}]::text[]`);
  }

  const rows = await db
    .select()
    .from(memoriesTable)
    .where(and(...conditions))
    .orderBy(memoriesTable.createdAt);

  res.json(rows.map(serializeMemory));
});

// GET /api/memories/graph
router.get("/memories/graph", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const nodes = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId));

  const nodeIds = nodes.map((n) => n.id);

  let edges: typeof connectionsTable.$inferSelect[] = [];
  if (nodeIds.length > 0) {
    edges = await db
      .select()
      .from(connectionsTable)
      .where(sql`${connectionsTable.sourceId} = ANY(${sql`ARRAY[${sql.join(nodeIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`);
  }

  res.json({
    nodes: nodes.map(serializeMemory),
    edges: edges.map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
      label: e.label ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

// POST /api/memories
router.post("/memories", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const instanceId = (req.session as any).instanceId ?? null;

  // ── Strict data-policy check ──────────────────────────────────────────────
  const moderation = await moderateMemoryContent(parsed.data.title, parsed.data.content);
  if (!moderation.allowed) {
    res.status(422).json({
      error: "vault_policy_violation",
      message: `This memory contains restricted information and cannot be stored. ${moderation.reason ?? ""}`.trim(),
    });
    return;
  }

  const [memory] = await db
    .insert(memoriesTable)
    .values({ ...parsed.data, accountId, tags: parsed.data.tags ?? [], instanceId })
    .returning();

  res.status(201).json(serializeMemory(memory));

  // Fire-and-forget: auto-link + cosmetics check
  autoLinkMemory(accountId, memory).catch(() => {});
  assignCosmetics(accountId).catch(() => {});
});

// POST /api/memories/auto-link — retroactively scan the whole vault for unlinked title mentions
router.post("/memories/auto-link", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const created = await autoLinkVault(accountId);
  res.json({ created });
});

// POST /api/memories/import  — bulk create (must come BEFORE /:id)
router.post("/memories/import", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const schema = z.object({
    memories: z
      .array(
        z.object({
          title: z.string().min(1),
          content: z.string().min(1),
          type: z.enum(["core", "episode", "concept", "fact", "emotion"]),
          tags: z.array(z.string()).optional(),
          pinned: z.boolean().optional(),
          x: z.number().optional(),
          y: z.number().optional(),
        }),
      )
      .min(1)
      .max(500),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // ── Strict data-policy check (all memories must pass) ────────────────────
  for (const m of parsed.data.memories) {
    const moderation = await moderateMemoryContent(m.title, m.content);
    if (!moderation.allowed) {
      res.status(422).json({
        error: "vault_policy_violation",
        message: `Memory "${m.title}" contains restricted information and cannot be stored. ${moderation.reason ?? ""}`.trim(),
      });
      return;
    }
  }

  const total = parsed.data.memories.length;
  const cx = 500;
  const cy = 300;
  const radius = Math.max(150, total * 30);

  const instanceId = (req.session as any).instanceId ?? null;

  const rows = await db
    .insert(memoriesTable)
    .values(
      parsed.data.memories.map((m, i) => ({
        ...m,
        accountId,
        instanceId,
        tags: m.tags ?? [],
        x: m.x ?? cx + radius * Math.cos((2 * Math.PI * i) / total),
        y: m.y ?? cy + radius * Math.sin((2 * Math.PI * i) / total),
      })),
    )
    .returning();

  res.status(201).json({ created: rows.length, memories: rows.map(serializeMemory) });
});

// GET /api/memories/:id
router.get("/memories/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const params = GetMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, params.data.id),
        eq(memoriesTable.accountId, accountId),
      ),
    )
    .limit(1);

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.json(serializeMemory(memory));
});

// PATCH /api/memories/:id
router.patch("/memories/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const params = UpdateMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [memory] = await db
    .update(memoriesTable)
    .set(parsed.data)
    .where(
      and(
        eq(memoriesTable.id, params.data.id),
        eq(memoriesTable.accountId, accountId),
      ),
    )
    .returning();

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.json(serializeMemory(memory));

  // Re-scan links if title or content changed
  if (parsed.data.title != null || parsed.data.content != null) {
    autoLinkMemory(accountId, memory).catch(() => {});
  }
});

// DELETE /api/memories/:id
router.delete("/memories/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const params = DeleteMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [memory] = await db
    .delete(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, params.data.id),
        eq(memoriesTable.accountId, accountId),
      ),
    )
    .returning();

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.sendStatus(204);
});

// PATCH /api/memories/:id/pin
router.patch("/memories/:id/pin", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const params = ToggleMemoryPinParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, params.data.id),
        eq(memoriesTable.accountId, accountId),
      ),
    )
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  const [memory] = await db
    .update(memoriesTable)
    .set({ pinned: !existing.pinned })
    .where(eq(memoriesTable.id, params.data.id))
    .returning();

  res.json(serializeMemory(memory));
});

export default router;
