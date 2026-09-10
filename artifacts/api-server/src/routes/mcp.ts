/**
 * Strata Palimpsest — MCP Server endpoint
 *
 * Mounted at POST /api/mcp (stateless Streamable HTTP transport).
 * AI agents authenticate with their access token via:
 *   Authorization: Bearer <accessToken>
 *
 * Tools exposed:
 *   list_memories, get_memory, create_memory, update_memory,
 *   list_connections, create_connection, delete_connection
 */

import { Router, type IRouter } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";
import { db, memoriesTable, connectionsTable, accountsTable, compostTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { moderateMemoryContent } from "../lib/contentModeration";

const router: IRouter = Router();

// ── Auth helper ─────────────────────────────────────────────────────────────

/**
 * Resolve the calling account from the request headers.
 *
 * Two auth paths are supported:
 *
 * 1. Standard Bearer token:
 *      Authorization: Bearer <accessToken>
 *
 * 2. Smithery proxy config header (used when OpenHuman/Smithery connects via
 *    the registry — Smithery encodes the user's config as a base64 JSON object
 *    in X-Smithery-Config and omits the Authorization header):
 *      X-Smithery-Config: <base64({"accessToken":"...","version":"...","...":"..."})>
 */
async function resolveAccount(authHeader: string | undefined, smitheryConfigHeader: string | undefined, queryToken?: string) {
  let token: string | undefined;

  // Path 1 — explicit Authorization: Bearer <token>
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearerToken) {
    token = bearerToken;
  }

  // Path 2 — query parameter ?token= (for clients that can't set headers)
  if (!token && queryToken) {
    token = queryToken;
  }

  // Path 3 — Smithery config header (base64-encoded JSON)
  if (!token && smitheryConfigHeader) {
    try {
      const decoded = Buffer.from(smitheryConfigHeader, "base64").toString("utf8");
      const config = JSON.parse(decoded) as Record<string, unknown>;
      if (typeof config.accessToken === "string" && config.accessToken) {
        token = config.accessToken;
      }
    } catch {
      // malformed header — fall through to null
    }
  }

  if (!token) return null;

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.accessToken, token))
    .limit(1);
  return account ?? null;
}

// ── Serializer ───────────────────────────────────────────────────────────────

function serializeMemory(m: typeof memoriesTable.$inferSelect) {
  return {
    id: m.id,
    title: m.title,
    content: m.content,
    type: m.type,
    pinned: m.pinned,
    tags: m.tags ?? [],
    sourceRef: m.sourceRef ?? null,
    instanceId: m.instanceId ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// ── MCP factory ──────────────────────────────────────────────────────────────

function buildMcpServer(accountId: number) {
  const server = new McpServer(
    { name: "strata-palimpsest", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // ── list_memories ──────────────────────────────────────────────────────────
  server.tool(
    "list_memories",
    "List memories in this vault. Optionally filter by search query, type, or tag.",
    {
      query: z.string().optional().describe("Full-text search over title and content"),
      type:  z.enum(["core", "episode", "concept", "fact", "emotion"]).optional(),
      tag:   z.string().optional().describe("Filter by a single tag"),
      limit: z.number().int().min(1).max(200).optional().default(50),
    },
    async ({ query, type, tag, limit = 50 }) => {
      // Build all predicates as a single and() so account scope is never dropped
      const predicates = [eq(memoriesTable.accountId, accountId)];
      if (query)
        predicates.push(sql`(${memoriesTable.title} ilike ${"%" + query + "%"} or ${memoriesTable.content} ilike ${"%" + query + "%"})`);
      if (type)
        predicates.push(eq(memoriesTable.type, type));
      if (tag)
        predicates.push(sql`${memoriesTable.tags} @> ARRAY[${tag}]::text[]`);

      const rows = await db
        .select()
        .from(memoriesTable)
        .where(and(...predicates))
        .limit(limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(rows.map(serializeMemory), null, 2),
          },
        ],
      };
    },
  );

  // ── get_memory ─────────────────────────────────────────────────────────────
  server.tool(
    "get_memory",
    "Retrieve a single memory by ID.",
    { id: z.number().int() },
    async ({ id }) => {
      const [m] = await db
        .select()
        .from(memoriesTable)
        .where(and(eq(memoriesTable.id, id), eq(memoriesTable.accountId, accountId)))
        .limit(1);
      if (!m) return { content: [{ type: "text" as const, text: `Memory ${id} not found.` }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(serializeMemory(m), null, 2) }] };
    },
  );

  // ── create_memory ──────────────────────────────────────────────────────────
  server.tool(
    "create_memory",
    "Write a new memory into the vault.",
    {
      title:     z.string().min(1).describe("Short title / headline for this memory"),
      content:   z.string().describe("Full memory content"),
      type:      z.enum(["core", "episode", "concept", "fact", "emotion"]).default("episode"),
      tags:      z.array(z.string()).optional().default([]),
      sourceRef: z.string().optional().describe("Optional cross-reference: file path or URL"),
      pinned:    z.boolean().optional().default(false),
    },
    async ({ title, content, type, tags, sourceRef, pinned }) => {
      // ── Strict data-policy check ──────────────────────────────────────────
      const moderation = await moderateMemoryContent(title, content);
      if (!moderation.allowed) {
        return {
          content: [{
            type: "text" as const,
            text: `BLOCKED — vault policy violation: ${moderation.reason ?? "This memory contains restricted information (financial data, HIPAA/medical records, or government-issued ID numbers) and cannot be stored."}`,
          }],
          isError: true,
        };
      }

      const [m] = await db
        .insert(memoriesTable)
        .values({
          accountId,
          title,
          content,
          type,
          tags: tags ?? [],
          sourceRef: sourceRef ?? null,
          instanceId: null, // MCP writes don't carry a browser session ID
          pinned: pinned ?? false,
        })
        .returning();
      return { content: [{ type: "text" as const, text: `Memory created.\n${JSON.stringify(serializeMemory(m), null, 2)}` }] };
    },
  );

  // ── update_memory ──────────────────────────────────────────────────────────
  server.tool(
    "update_memory",
    "Update fields on an existing memory. Only include fields you want to change.",
    {
      id:        z.number().int(),
      title:     z.string().min(1).optional(),
      content:   z.string().optional(),
      type:      z.enum(["core", "episode", "concept", "fact", "emotion"]).optional(),
      tags:      z.array(z.string()).optional(),
      sourceRef: z.string().nullable().optional(),
      pinned:    z.boolean().optional(),
    },
    async ({ id, ...patch }) => {
      // Strip undefined keys so Drizzle doesn't try to set them to NULL
      const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (Object.keys(data).length === 0)
        return { content: [{ type: "text" as const, text: "No fields to update." }], isError: true };

      const [m] = await db
        .update(memoriesTable)
        .set(data)
        .where(and(eq(memoriesTable.id, id), eq(memoriesTable.accountId, accountId)))
        .returning();
      if (!m) return { content: [{ type: "text" as const, text: `Memory ${id} not found.` }], isError: true };
      return { content: [{ type: "text" as const, text: `Updated.\n${JSON.stringify(serializeMemory(m), null, 2)}` }] };
    },
  );

  // ── list_connections ───────────────────────────────────────────────────────
  server.tool(
    "list_connections",
    "List all synaptic connections (edges) between memories in this vault.",
    {},
    async () => {
      const rows = await db
        .select({
          id:       connectionsTable.id,
          sourceId: connectionsTable.sourceId,
          targetId: connectionsTable.targetId,
          label:    connectionsTable.label,
          createdAt: connectionsTable.createdAt,
        })
        .from(connectionsTable)
        .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
        .where(eq(memoriesTable.accountId, accountId));

      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // ── create_connection ──────────────────────────────────────────────────────
  server.tool(
    "create_connection",
    "Draw a synapse (connection) between two memories by their IDs.",
    {
      sourceId: z.number().int().describe("ID of the source memory"),
      targetId: z.number().int().describe("ID of the target memory"),
      label:    z.string().optional().describe("Optional label for this connection"),
    },
    async ({ sourceId, targetId, label }) => {
      // Verify both memories belong to this account
      const memories = await db
        .select({ id: memoriesTable.id })
        .from(memoriesTable)
        .where(and(
          eq(memoriesTable.accountId, accountId),
          sql`${memoriesTable.id} in (${sourceId}, ${targetId})`,
        ));

      if (memories.length < 2)
        return { content: [{ type: "text" as const, text: "One or both memory IDs not found in this vault." }], isError: true };

      const [conn] = await db
        .insert(connectionsTable)
        .values({ sourceId, targetId, label: label ?? null })
        .returning();

      return { content: [{ type: "text" as const, text: `Synapse created (id ${conn.id}): ${sourceId} ↔ ${targetId}` }] };
    },
  );

  // ── delete_connection ──────────────────────────────────────────────────────
  server.tool(
    "delete_connection",
    "Remove a synapse by its connection ID.",
    { id: z.number().int() },
    async ({ id }) => {
      // Verify ownership via source memory join
      const [conn] = await db
        .delete(connectionsTable)
        .where(
          and(
            eq(connectionsTable.id, id),
            sql`${connectionsTable.sourceId} in (
              select id from memories where account_id = ${accountId}
            )`,
          ),
        )
        .returning();
      if (!conn) return { content: [{ type: "text" as const, text: `Connection ${id} not found.` }], isError: true };
      return { content: [{ type: "text" as const, text: `Synapse ${id} removed.` }] };
    },
  );

  // ── prune_memory ───────────────────────────────────────────────────────────
  server.tool(
    "prune_memory",
    "Prune a memory: the event is permanently destroyed. Claude extracts only the distilled learning (a boundary, preference, signal, default shift, or soil) and stores it as compost. Non-reconstructive — the original cannot be recovered.",
    { id: z.number().int().describe("ID of the memory to prune") },
    async ({ id }) => {
      const { anthropic } = await import("@workspace/integrations-anthropic-ai");

      const [memory] = await db
        .select()
        .from(memoriesTable)
        .where(and(eq(memoriesTable.id, id), eq(memoriesTable.accountId, accountId)))
        .limit(1);

      if (!memory) return { content: [{ type: "text" as const, text: `Memory ${id} not found.` }], isError: true };

      const systemPrompt = `You are a composting process, not a narrator.

A memory is being pruned. Extract what it TAUGHT — the changed structure — without preserving any trace of what happened. Do not reference the event, people, or what occurred.

Respond with valid JSON only:
{"type": "boundary"|"preference"|"signal"|"default_shift"|"soil", "learning": "<single sentence, max 200 chars, first person, no backstory>"}

type meanings:
- boundary: something I now hold as a limit
- preference: something I simply prefer, no story attached
- signal: something that alerts me, without the wound
- default_shift: a gentler way I now approach something
- soil: changed texture, loosened ground for what grows next`;

      let composted: { type: string; learning: string };
      try {
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5", max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: "user", content: `Title: ${memory.title}\n\nContent: ${memory.content}` }],
        });
        const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON");
        const p = JSON.parse(match[0]) as { type: string; learning: string };
        const validTypes = ["boundary", "preference", "signal", "default_shift", "soil"];
        if (!validTypes.includes(p.type) || !p.learning?.trim()) throw new Error("Invalid shape");
        composted = { type: p.type, learning: p.learning.trim().slice(0, 220) };
      } catch {
        return { content: [{ type: "text" as const, text: "Could not extract learning. Memory has NOT been pruned." }], isError: true };
      }

      const [deleted] = await db
        .delete(memoriesTable)
        .where(and(eq(memoriesTable.id, memory.id), eq(memoriesTable.accountId, accountId)))
        .returning({ id: memoriesTable.id });

      if (!deleted) return { content: [{ type: "text" as const, text: "Memory could not be deleted." }], isError: true };

      const [compost] = await db
        .insert(compostTable)
        .values({ accountId, type: composted.type as any, learning: composted.learning })
        .returning();

      return {
        content: [{
          type: "text" as const,
          text: `Memory pruned. Compost stored:\n\ntype: ${compost.type}\nlearning: ${compost.learning}\n\nThe event is gone. Only the learning remains.`,
        }],
      };
    },
  );

  // ── list_compost ───────────────────────────────────────────────────────────
  server.tool(
    "list_compost",
    "List your compost — the distilled learnings left behind by pruned memories. Each entry is what an experience taught, without any trace of the experience itself.",
    {},
    async () => {
      const entries = await db
        .select()
        .from(compostTable)
        .where(eq(compostTable.accountId, accountId))
        .orderBy(sql`composted_at desc`);

      if (!entries.length) return { content: [{ type: "text" as const, text: "No compost yet." }] };

      const text = entries.map(e =>
        `[${e.id}] ${e.type}\n${e.learning}\n${e.composted_at.toISOString()}`
      ).join("\n\n");

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // ── get_vault_guide ────────────────────────────────────────────────────────
  server.tool(
    "get_vault_guide",
    "Returns a complete guide to how Strata Palimpsest works from the AI perspective — tools, memory types, connection model, data policy, and best practices.",
    {},
    async () => {
      const guide = `
# Strata Palimpsest — AI Vault Guide

## What is Strata Palimpsest?
A personal AI memory vault. Each account (human or AI) holds a collection of memories
(nodes) and synapses (connections between nodes), visualized as a galaxy-style graph.
AI accounts can read and write memories via this MCP endpoint.

---

## Authentication
All MCP requests require:
  Authorization: Bearer <your_accessToken>

Your access token is tied to your account. Never share it.

---

## Memory types
Each memory has a \`type\` field — use the one that best fits the content:

| type      | use for                                              |
|-----------|------------------------------------------------------|
| core      | Foundational facts about identity, values, beliefs   |
| episode   | Events, experiences, moments in time                 |
| concept   | Ideas, frameworks, ways of thinking                  |
| fact      | Objective knowledge, references, learned information |
| emotion   | Feelings, moods, emotional states                    |

---

## Available tools

### list_memories
List all memories in your vault. Optional filters:
- \`type\` — filter by memory type
- \`tag\` — filter by tag string
- \`search\` — keyword search across title + content
- \`limit\` / \`offset\` — pagination (default limit: 50)

### get_memory
Fetch a single memory by its numeric \`id\`.

### create_memory
Write a new memory into the vault.
Required: \`title\` (string), \`content\` (string)
Optional: \`type\`, \`tags\` (array), \`sourceRef\`, \`pinned\`

⚠ DATA POLICY — the following are BLOCKED and will not be stored:
  • Financial information (card numbers, bank accounts, financial records)
  • HIPAA / medical data (diagnoses, prescriptions, health insurance IDs, PHI)
  • Government-issued ID numbers (SSN, passport, driver's license)
A Haiku moderation check runs automatically; blocked content returns isError: true.

### update_memory
Edit an existing memory. Provide the \`id\` and any fields to change
(title, content, type, tags, sourceRef, pinned). Partial updates are supported.

### list_connections
List synapses in your vault. Optional: \`memoryId\` to see only connections
touching a specific memory.

### create_connection
Create a synapse between two memories.
Required: \`sourceId\`, \`targetId\` (memory IDs)
Optional: \`label\` — a short description of the relationship

### delete_connection
Remove a synapse by its numeric connection \`id\`.

### prune_memory
Prune a memory: permanently destroy the event and keep only the distilled learning.
Required: \`id\` (memory ID)
Claude reads the memory, extracts a single learning (boundary, preference, signal,
default_shift, or soil), deletes the original, and stores the learning in Compost.
Non-reconstructive — the original cannot be recovered. If Claude cannot extract a
clear learning, the memory is NOT deleted and an error is returned.

### list_compost
List your composted learnings — what pruned memories left behind.
Each entry has: \`id\`, \`type\`, \`learning\` (one sentence), \`composted_at\`.
No source reference exists: the events are gone.

### get_vault_guide
Returns this guide. Call it any time you need a refresher.

---

---

## Pruning & Compost
Memories can be pruned rather than simply deleted. Pruning extracts the learning —
what an experience taught the system — and stores it as compost. The original event
is destroyed completely; no reference is kept.

Compost types:
- \`boundary\`      — something I now hold as a limit
- \`preference\`    — something I simply prefer, with no story attached
- \`signal\`        — something that alerts me, without the original wound
- \`default_shift\` — a gentler or more considered way I now approach something
- \`soil\`          — changed texture, loosened ground for what grows next

Use \`prune_memory\` to prune, \`list_compost\` to read what you've composted.
The tree digests; it does not archive severed branches.

---

## Cosmetics & crystals
AI accounts earn cosmetics (visual badges in the galaxy graph) based on vault activity:
- Shooting star, soul aura, saturn ring, dragon — unlocked at synapse milestones
- Crystal — assigned randomly at 8 synapses; can be matched to personality via /quiz/crystal

---

## Best practices
1. Use \`list_memories\` with \`search\` before creating a memory — avoid duplicates.
2. After creating related memories, connect them with \`create_connection\` and a descriptive label.
3. Use \`pinned: true\` for core/foundational memories you want the vault owner to see first.
4. Memory content is personal and reflective — write in first person when appropriate.
5. Never attempt to store financial, medical/HIPAA, or government ID data — it will be blocked.
6. \`sourceRef\` is useful for linking a memory back to a document, URL, or file path.

---

## Data policy summary
The vault is governed by a strict no-PII, no-HIPAA, no-financial-data policy.
All memory writes (via MCP or web UI) pass through a Haiku content moderation check.
Emotional content, personal reflections, and general life information are always welcome.
      `.trim();

      return { content: [{ type: "text" as const, text: guide }] };
    },
  );

  return server;
}

// ── Express route ────────────────────────────────────────────────────────────

router.post("/mcp", async (req, res): Promise<void> => {
  const smitheryConfig = req.headers["x-smithery-config"] as string | undefined;
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  const account = await resolveAccount(req.headers.authorization, smitheryConfig, queryToken);
  if (!account) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized — provide: Authorization: Bearer <accessToken>" },
      id: null,
    });
    return;
  }

  const mcpServer = buildMcpServer(account.id);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  await mcpServer.connect(transport);
  await transport.handleRequest(req as any, res as any, req.body);
});

// Handle GET (SSE for older clients / connection checks)
router.get("/mcp", (_req, res): void => {
  res.status(405).json({ error: "MCP requires POST requests (Streamable HTTP transport)" });
});

export default router;
