/**
 * starfield-privacy.test.ts
 *
 * Regression gate for the starfield metadata leak fix.
 * All assertions are against the RAW HTTP payload — not rendered UI.
 *
 * Run against a live dev server:
 *   API_URL=http://localhost:8080 pnpm --filter @workspace/api-server test
 *
 * The suite creates two ephemeral AI accounts, adds a memory to account A,
 * then asserts the shape of /api/agents/:id/starfield from both sessions.
 * Accounts are deleted in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = process.env.API_URL ?? "http://localhost:8080";

// ─── Cookie-aware session helper ─────────────────────────────────────────────

interface Session {
  cookie: string;
  accountId: number;
  username: string;
  token: string; // bearer token stored on account
}

async function api(
  session: Session | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.cookie) headers["Cookie"] = session.cookie;
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function register(suffix: string): Promise<Session> {
  const username = `__test_${suffix}_${Date.now()}`;
  const password = "TestPassword123!";

  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, type: "ai" }),
  });
  expect(reg.status, `register ${username}`).toBe(201);

  // Session cookie comes from Set-Cookie; grab name=value only (strip attributes)
  const raw = reg.headers.get("set-cookie") ?? "";
  const cookie = raw.split(";")[0];

  // API returns { account: { id, accessToken, ... } }
  const body = await reg.json() as { account: { id: number; accessToken: string | null } };
  return { cookie, accountId: body.account.id, username, token: body.account.accessToken ?? "" };
}

// login kept for reference — currently unused since register establishes the session,
// but left in for completeness and future account-switch tests.
async function login(username: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(res.status, `login ${username}`).toBe(200);
  const raw = res.headers.get("set-cookie") ?? "";
  const cookie = raw.split(";")[0];
  const body = await res.json() as { account: { id: number; accessToken: string | null } };
  return { cookie, accountId: body.account.id, username, token: body.account.accessToken ?? "" };
}

// ─── Fixture state ────────────────────────────────────────────────────────────

let sessionA: Session;
let sessionB: Session;
let memoryId: number;

const PASS = "TestPassword123!";

beforeAll(async () => {
  sessionA = await register("alpha");
  sessionB = await register("beta");

  // Give account A one memory so the starfield is non-empty.
  const mem = await api(sessionA, "POST", "/api/memories", {
    title: "Test anchor memory",
    content: "This memory is created by the test suite and will be deleted.",
    type: "fact",
    tags: ["test-tag"],
    pinned: false,
  });
  expect(mem.status, "create test memory").toBe(201);
  const memBody = await mem.json() as { id: number };
  memoryId = memBody.id;
});

afterAll(async () => {
  // Delete the test memory
  if (memoryId) {
    await api(sessionA, "DELETE", `/api/memories/${memoryId}`);
  }
  // Delete both test accounts (registered accounts have passwords → re-auth required)
  await api(sessionA, "DELETE", "/api/auth/account", { password: PASS });
  await api(sessionB, "DELETE", "/api/auth/account", { password: PASS });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/agents/:id/starfield — cache headers", () => {
  it("returns Cache-Control: private, no-store", async () => {
    const res = await api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("returns Vary: Cookie", async () => {
    const res = await api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`);
    const vary = res.headers.get("vary") ?? "";
    expect(vary.toLowerCase()).toContain("cookie");
  });
});

describe("GET /api/agents/:id/starfield — owner view", () => {
  let payload: Record<string, unknown>;

  beforeAll(async () => {
    const res = await api(sessionA, "GET", `/api/agents/${sessionA.accountId}/starfield`);
    expect(res.status).toBe(200);
    payload = await res.json() as Record<string, unknown>;
  });

  it("isOwner is true", () => {
    expect(payload.isOwner).toBe(true);
  });

  it("has 'nodes' key, not 'stars'", () => {
    expect(payload).toHaveProperty("nodes");
    expect(payload).not.toHaveProperty("stars");
  });

  it("has 'edges' key", () => {
    expect(payload).toHaveProperty("edges");
  });

  it("nodes include all expected owner fields", () => {
    const nodes = payload.nodes as Record<string, unknown>[];
    expect(nodes.length).toBeGreaterThan(0);
    const node = nodes[0];
    // Required owner fields
    expect(node).toHaveProperty("id");
    expect(node).toHaveProperty("title");
    expect(node).toHaveProperty("type");
    expect(node).toHaveProperty("pinned");
    expect(node).toHaveProperty("tags");
    expect(node).toHaveProperty("createdAt");
  });

  it("node title matches what was stored", () => {
    const nodes = payload.nodes as Record<string, unknown>[];
    const node = nodes.find(n => n.title === "Test anchor memory");
    expect(node).toBeDefined();
  });

  it("node tags match what was stored", () => {
    const nodes = payload.nodes as Record<string, unknown>[];
    const node = nodes.find(n => (n.tags as string[])?.includes("test-tag"));
    expect(node).toBeDefined();
  });
});

describe("GET /api/agents/:id/starfield — non-owner view", () => {
  let payload: Record<string, unknown>;
  let rawText: string;

  beforeAll(async () => {
    const res = await api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`);
    expect(res.status).toBe(200);
    rawText = await res.text();
    payload = JSON.parse(rawText) as Record<string, unknown>;
  });

  it("isOwner is false", () => {
    expect(payload.isOwner).toBe(false);
  });

  it("has 'stars' key, not 'nodes'", () => {
    expect(payload).toHaveProperty("stars");
    expect(payload).not.toHaveProperty("nodes");
  });

  it("top-level keys are exactly: agent, isOwner, stars", () => {
    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(["agent", "isOwner", "stars"].sort());
  });

  it("each star has exactly: idx, x, y — nothing else", () => {
    const stars = payload.stars as Record<string, unknown>[];
    expect(stars.length).toBeGreaterThan(0);
    for (const star of stars) {
      const keys = Object.keys(star).sort();
      expect(keys).toEqual(["idx", "x", "y"].sort());
    }
  });

  it("star x and y are fractions between 0 and 1", () => {
    const stars = payload.stars as Record<string, unknown>[];
    for (const star of stars) {
      expect(star.x as number).toBeGreaterThanOrEqual(0);
      expect(star.x as number).toBeLessThanOrEqual(1);
      expect(star.y as number).toBeGreaterThanOrEqual(0);
      expect(star.y as number).toBeLessThanOrEqual(1);
    }
  });

  it("raw payload contains no 'title' key anywhere", () => {
    // Checks the JSON string directly — catches nested occurrences too
    expect(rawText).not.toMatch(/"title"\s*:/);
  });

  it("raw payload contains no 'tags' key anywhere", () => {
    expect(rawText).not.toMatch(/"tags"\s*:/);
  });

  it("raw payload contains no 'type' key anywhere", () => {
    // "type" appears in agent object (ai/human) — check only inside stars
    const stars = payload.stars as Record<string, unknown>[];
    for (const star of stars) {
      expect(star).not.toHaveProperty("type");
    }
  });

  it("raw payload contains no 'pinned' key anywhere", () => {
    expect(rawText).not.toMatch(/"pinned"\s*:/);
  });

  it("raw payload contains no 'createdAt' key anywhere", () => {
    expect(rawText).not.toMatch(/"createdAt"\s*:/);
  });

  it("raw payload contains no 'edges' key", () => {
    expect(payload).not.toHaveProperty("edges");
  });

  it("no star exposes a numeric database ID", () => {
    // Stars should only have sequential idx — not original memory IDs.
    // We verify by checking that idx values are 1, 2, 3... (sequential) not
    // arbitrary large integers that would indicate real DB IDs.
    const stars = payload.stars as { idx: number; x: number; y: number }[];
    const idxValues = stars.map(s => s.idx).sort((a, b) => a - b);
    expect(idxValues).toEqual(Array.from({ length: stars.length }, (_, i) => i + 1));
  });
});

describe("GET /api/agents/:id/starfield — account-switch isolation", () => {
  it("owner shape and non-owner shape for the same agentId are structurally different", async () => {
    const [ownerRes, guestRes] = await Promise.all([
      api(sessionA, "GET", `/api/agents/${sessionA.accountId}/starfield`),
      api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`),
    ]);

    const owner = await ownerRes.json() as Record<string, unknown>;
    const guest = await guestRes.json() as Record<string, unknown>;

    expect(owner.isOwner).toBe(true);
    expect(guest.isOwner).toBe(false);
    expect(owner).toHaveProperty("nodes");
    expect(guest).not.toHaveProperty("nodes");
    expect(guest).toHaveProperty("stars");
    expect(owner).not.toHaveProperty("stars");
  });

  it("requesting same endpoint twice as non-owner returns consistent anonymous shape (no bleed from any cache)", async () => {
    const res1 = await api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`);
    const res2 = await api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`);

    const p1 = await res1.json() as Record<string, unknown>;
    const p2 = await res2.json() as Record<string, unknown>;

    // Both responses should be the non-owner shape
    expect(p1.isOwner).toBe(false);
    expect(p2.isOwner).toBe(false);
    expect(p1).toHaveProperty("stars");
    expect(p2).toHaveProperty("stars");

    // Star positions should be stable (deterministic, not random per request)
    const stars1 = p1.stars as { idx: number; x: number; y: number }[];
    const stars2 = p2.stars as { idx: number; x: number; y: number }[];
    expect(stars1).toEqual(stars2);
  });
});

describe("GET /api/agents/:id/starfield — count policy (intentional)", () => {
  it("star count matches memoryCount from /api/agents listing", async () => {
    const [agentsRes, starfieldRes] = await Promise.all([
      api(sessionB, "GET", "/api/agents"),
      api(sessionB, "GET", `/api/agents/${sessionA.accountId}/starfield`),
    ]);

    const agents = await agentsRes.json() as { id: number; memoryCount: number }[];
    const starfield = await starfieldRes.json() as { isOwner: boolean; stars: unknown[] };

    const agentEntry = agents.find(a => a.id === sessionA.accountId);
    expect(agentEntry).toBeDefined();
    expect(starfield.stars.length).toBe(agentEntry!.memoryCount);
  });
});
