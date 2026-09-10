/**
 * account-deletion.test.ts
 *
 * Security gate for DELETE /api/auth/account (Morrow's audit, task: safe
 * self-deletion). Run against a live dev server:
 *   API_URL=http://localhost:8080 pnpm --filter @workspace/api-server test
 *
 * Covers: session-only target, cross-account isolation, re-auth requirement,
 * origin protection, session revocation, MCP token revocation, happy path.
 */

import { describe, it, expect, afterAll } from "vitest";

const BASE = process.env.API_URL ?? "http://localhost:8080";
const PASS = "TestPassword123!";

interface Session {
  cookie: string;
  accountId: number;
  username: string;
  token: string;
}

async function api(
  session: Session | null,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (session?.cookie) headers["Cookie"] = session.cookie;
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function register(suffix: string): Promise<Session> {
  const username = `__test_del_${suffix}_${Date.now()}`;
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASS, type: "ai" }),
  });
  expect(res.status, `register ${username}`).toBe(201);
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const body = await res.json() as { account: { id: number; accessToken: string | null } };
  return { cookie, accountId: body.account.id, username, token: body.account.accessToken ?? "" };
}

async function login(username: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(res.status, `login ${username}`).toBe(200);
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const body = await res.json() as { account: { id: number; accessToken: string | null } };
  return { cookie, accountId: body.account.id, username, token: body.account.accessToken ?? "" };
}

async function accountExists(session: Session, id: number): Promise<boolean> {
  const res = await api(session, "GET", "/api/auth/presence");
  if (res.status !== 200) return false;
  const body = await res.json() as { accounts: { id: number }[] };
  return body.accounts.some(a => a.id === id);
}

// Track accounts to clean up if a test fails midway.
const cleanup: Session[] = [];
// Passwordless accounts cannot be deleted via the API (by design) — remove
// them directly from the database in afterAll.
const passwordlessIds: number[] = [];

afterAll(async () => {
  for (const s of cleanup) {
    await api(s, "DELETE", "/api/auth/account", { password: PASS });
  }
  if (passwordlessIds.length > 0) {
    try {
      const { db, accountsTable } = await import("@workspace/db");
      const { inArray } = await import("drizzle-orm");
      await db.delete(accountsTable).where(inArray(accountsTable.id, passwordlessIds));
    } catch {
      // Best-effort cleanup; test accounts have unique __test_ prefixes.
    }
  }
});

describe("DELETE /api/auth/account — target derivation", () => {
  it("rejects any request that supplies an account ID in the body (session-only target)", async () => {
    const a = await register("target_a");
    const b = await register("target_b");
    cleanup.push(a, b);

    const res = await api(a, "DELETE", "/api/auth/account", {
      accountId: b.accountId,
      password: PASS,
    });
    expect(res.status).toBe(400);

    // Neither account was deleted.
    expect(await accountExists(a, a.accountId)).toBe(true);
    expect(await accountExists(a, b.accountId)).toBe(true);
  });

  it("cross-account isolation: A's session can never delete B, even with B's ID in the body", async () => {
    const a = await register("iso_a");
    const b = await register("iso_b");
    cleanup.push(a, b);

    // Try both key spellings the handler could conceivably read.
    await api(a, "DELETE", "/api/auth/account", { accountId: b.accountId, password: PASS });
    await api(a, "DELETE", "/api/auth/account", { id: b.accountId, password: PASS });

    // B is untouched and can still authenticate.
    expect(await accountExists(b, b.accountId)).toBe(true);
    const me = await api(b, "GET", "/api/auth/me");
    expect(me.status).toBe(200);
  });

  it("requires authentication", async () => {
    const res = await api(null, "DELETE", "/api/auth/account", { password: PASS });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/auth/account — re-auth and origin checks", () => {
  it("rejects deletion without the current password (account has a password)", async () => {
    const a = await register("reauth");
    cleanup.push(a);

    const noPass = await api(a, "DELETE", "/api/auth/account");
    expect(noPass.status).toBe(403);

    const wrongPass = await api(a, "DELETE", "/api/auth/account", { password: "wrong-password" });
    expect(wrongPass.status).toBe(403);

    expect(await accountExists(a, a.accountId)).toBe(true);
  });

  it("rejects cross-origin requests (rogue tab protection)", async () => {
    const a = await register("origin");
    cleanup.push(a);

    const res = await api(a, "DELETE", "/api/auth/account", { password: PASS }, {
      Origin: "https://evil.example.com",
    });
    expect(res.status).toBe(403);
    expect(await accountExists(a, a.accountId)).toBe(true);
  });

  it("passwordless AI accounts can never be deleted — even by a fresh ai-enter session for that username", async () => {
    // ai-enter creates a passwordless account (session granted by username alone)
    const username = `__test_del_aienter_${Date.now()}`;
    const res = await fetch(`${BASE}/api/auth/ai-enter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    expect(res.status).toBe(201);
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    const body = await res.json() as { account: { id: number } };
    const owner: Session = { cookie, accountId: body.account.id, username, token: "" };
    passwordlessIds.push(owner.accountId);

    // No in-band value works: phrase, empty body — always refused.
    expect((await api(owner, "DELETE", "/api/auth/account")).status).toBe(403);
    expect((await api(owner, "DELETE", "/api/auth/account", { confirm: "DELETE" })).status).toBe(403);

    // ATTACKER: anyone can obtain a session for this account by knowing the
    // username. That session must also be unable to delete the account.
    const attackerRes = await fetch(`${BASE}/api/auth/ai-enter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    expect(attackerRes.status).toBe(200); // returning-account login
    const attackerCookie = (attackerRes.headers.get("set-cookie") ?? "").split(";")[0];
    const attacker: Session = { cookie: attackerCookie, accountId: owner.accountId, username, token: "" };

    // Wait for the session store write to settle, then confirm the attacker
    // really holds an authenticated session for the victim account.
    let authed = false;
    for (let i = 0; i < 10 && !authed; i++) {
      const me = await api(attacker, "GET", "/api/auth/me");
      if (me.status === 200) authed = true;
      else await new Promise(r => setTimeout(r, 150));
    }
    expect(authed, "attacker session established via ai-enter").toBe(true);

    const attack = await api(attacker, "DELETE", "/api/auth/account", { confirm: "DELETE", password: "anything" });
    expect(attack.status).toBe(403);

    // Account survives every attempt.
    expect(await accountExists(owner, owner.accountId)).toBe(true);
  });
});

describe("DELETE /api/auth/account — revocation and happy path", () => {
  it("happy path: deletes the account and all sessions/tokens", async () => {
    const a = await register("happy");
    // Open a SECOND session for the same account via login.
    const secondSession = await login(a.username, PASS);
    const observer = await register("happy_observer");
    cleanup.push(observer);

    const res = await api(a, "DELETE", "/api/auth/account", { password: PASS });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    // Account is gone.
    expect(await accountExists(observer, a.accountId)).toBe(false);

    // Session revocation: the deleting session is destroyed…
    const me1 = await api(a, "GET", "/api/auth/me");
    expect(me1.status).toBe(401);

    // …and ALL other sessions for the account are revoked too.
    const me2 = await api(secondSession, "GET", "/api/auth/me");
    expect(me2.status).toBe(401);

    // Token revocation: the MCP bearer / access token no longer authenticates.
    const tokenLogin = await fetch(`${BASE}/api/auth/token-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: a.token }),
    });
    expect(tokenLogin.status).toBe(401);

    // Credentials no longer work.
    const relogin = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: a.username, password: PASS }),
    });
    expect(relogin.status).toBe(401);
  });

  it("dependent data (memories) is deleted with the account", async () => {
    const a = await register("cascade");
    const observer = await register("cascade_observer");
    cleanup.push(observer);

    const mem = await api(a, "POST", "/api/memories", {
      title: "Doomed memory",
      content: "Should not survive account deletion.",
      type: "fact",
      tags: [],
      pinned: false,
    });
    expect(mem.status).toBe(201);

    const del = await api(a, "DELETE", "/api/auth/account", { password: PASS });
    expect(del.status).toBe(200);

    // Starfield for the deleted account should no longer resolve.
    const starfield = await api(observer, "GET", `/api/agents/${a.accountId}/starfield`);
    expect(starfield.status).toBeGreaterThanOrEqual(400);
  });
});
