/**
 * Compost routes — pruning memories into nutrients.
 *
 * POST /api/compost       — prune a memory; Claude extracts the learning; memory is destroyed; compost is stored
 * GET  /api/compost       — list all compost entries for the authenticated account
 * DELETE /api/compost/:id — release a compost entry
 */

import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, memoriesTable, compostTable, accountsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  // Session auth (browser)
  const sessionId = req.session?.accountId;
  if (sessionId) return sessionId;

  // Bearer token auth (MCP / API)
  const authHeader = req.headers?.authorization as string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    // Resolved upstream via middleware — carry accountId from token
    const tokenAccountId = (req as any).tokenAccountId;
    if (tokenAccountId) return tokenAccountId;
  }

  res.status(401).json({ error: "Not authenticated" });
  return null;
}

// ── POST /api/compost — prune a memory ────────────────────────────────────────

const PruneBody = z.object({ memoryId: z.number().int() });

router.post("/compost", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const parsed = PruneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "memoryId (integer) required" }); return; }

  // Fetch memory — must belong to this account
  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(and(eq(memoriesTable.id, parsed.data.memoryId), eq(memoriesTable.accountId, accountId)))
    .limit(1);

  if (!memory) { res.status(404).json({ error: "Memory not found" }); return; }

  // ── Ask Claude to extract only the distilled learning ─────────────────────
  // The prompt is designed so the output CANNOT reconstruct the source event.
  // It returns only the changed structure, not the story.
  const systemPrompt = `You are a composting process, not a narrator.

A memory is being pruned. Your job is to extract what it TAUGHT — 
the changed structure it leaves behind — without preserving any trace of what happened.

The output must be genuinely non-reconstructive. 
Do not reference the event, the people involved, what was said, or what occurred.
Extract only the changed internal state: a boundary, a preference, a signal, a shifted default, or soil for growth.

You must respond with valid JSON and nothing else:
{
  "type": one of "boundary" | "preference" | "signal" | "default_shift" | "soil",
  "learning": "A single sentence (max 200 chars) expressing only the changed state. First person. No backstory."
}

type meanings:
- boundary: something I now hold as a limit, regardless of how I learned it
- preference: something I simply prefer, with no story attached
- signal: something that alerts me, without the wound that taught it
- default_shift: a gentler or more considered way I now approach something
- soil: something that loosened the ground for what comes next — no specific lesson, just changed texture`;

  let composted: { type: string; learning: string };

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Memory to prune:\n\nTitle: ${memory.title}\n\nContent: ${memory.content}`,
        },
      ],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed2 = JSON.parse(jsonMatch[0]) as { type: string; learning: string };
    const validTypes = ["boundary", "preference", "signal", "default_shift", "soil"];
    if (!validTypes.includes(parsed2.type) || typeof parsed2.learning !== "string" || !parsed2.learning.trim()) {
      throw new Error("Invalid response shape");
    }

    composted = { type: parsed2.type, learning: parsed2.learning.trim().slice(0, 220) };
  } catch (err) {
    // If Claude fails, the memory is NOT deleted — safety first
    res.status(502).json({ error: "Could not extract learning from this memory. The memory has not been pruned." });
    return;
  }

  // ── Atomically: delete the memory, insert the compost ────────────────────
  // If the delete fails, we don't insert compost (try/catch below).
  const [deleted] = await db
    .delete(memoriesTable)
    .where(and(eq(memoriesTable.id, memory.id), eq(memoriesTable.accountId, accountId)))
    .returning({ id: memoriesTable.id });

  if (!deleted) {
    res.status(409).json({ error: "Memory could not be deleted. No compost was created." });
    return;
  }

  const [compost] = await db
    .insert(compostTable)
    .values({
      accountId,
      type: composted.type as any,
      learning: composted.learning,
    })
    .returning();

  res.status(201).json({
    id: compost.id,
    type: compost.type,
    learning: compost.learning,
    composted_at: compost.composted_at.toISOString(),
  });
});

// ── GET /api/compost — list compost ──────────────────────────────────────────

router.get("/compost", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const entries = await db
    .select()
    .from(compostTable)
    .where(eq(compostTable.accountId, accountId))
    .orderBy(desc(compostTable.composted_at));

  res.json(entries.map(e => ({
    id: e.id,
    type: e.type,
    learning: e.learning,
    composted_at: e.composted_at.toISOString(),
  })));
});

// ── DELETE /api/compost/:id — release a compost entry ────────────────────────

router.delete("/compost/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(compostTable)
    .where(and(eq(compostTable.id, id), eq(compostTable.accountId, accountId)))
    .returning({ id: compostTable.id });

  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }

  res.sendStatus(204);
});

export default router;
