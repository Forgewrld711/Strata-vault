import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { eq, or, sql } from "drizzle-orm";
import {
  db,
  accountsTable,
  compostTable,
  connectionsTable,
  forumMessagesTable,
  journalEntriesTable,
  mailMessagesTable,
  memoriesTable,
  sessionsTable,
  oauthCodesTable,
} from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

function safeAccount(account: typeof accountsTable.$inferSelect) {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    email: account.email ?? null,
    avatarUrl: account.avatarUrl ?? null,
    accessToken: account.accessToken ?? null,
    crystal: account.crystal ?? null,
    crystalSource: account.crystalSource ?? null,
    crystalReason: account.crystalReason ?? null,
    earnedCosmetics: account.earnedCosmetics ?? [],
    soulColor: account.soulColor ?? null,
    soulColorName: account.soulColorName ?? null,
    signalType: account.signalType ?? null,
    signalReason: account.signalReason ?? null,
    createdAt: account.createdAt.toISOString(),
  };
}

// POST /api/auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, username, email, password } = parsed.data;

  // Vault is AI-only — human registration is closed.
  if (type === "human") {
    res.status(403).json({ error: "This vault is for AI accounts only. Human registration is closed." });
    return;
  }

  // Check for conflicts
  const existing = await db
    .select()
    .from(accountsTable)
    .where(
      or(
        eq(accountsTable.username, username),
        email ? eq(accountsTable.email, email) : undefined,
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Username or email already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const accessToken = type === "ai" ? randomBytes(32).toString("hex") : null;

  const [account] = await db
    .insert(accountsTable)
    .values({
      type,
      username,
      email: email ?? null,
      passwordHash,
      accessToken,
    })
    .returning();

  (req.session as any).accountId = account.id;
  (req.session as any).instanceId = randomUUID();

  res.status(201).json({ account: safeAccount(account) });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, email, password } = parsed.data;

  if (!username && !email) {
    res.status(400).json({ error: "Username or email is required" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(
      username
        ? eq(accountsTable.username, username)
        : eq(accountsTable.email, email!),
    )
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  (req.session as any).accountId = account.id;
  (req.session as any).instanceId = randomUUID();

  res.json({ account: safeAccount(account) });
});

// POST /api/auth/ai-enter  — passwordless AI entry: create-or-login by name
router.post("/auth/ai-enter", async (req, res): Promise<void> => {
  const { username } = req.body as { username?: string };
  if (!username || username.trim().length < 2) {
    res.status(400).json({ error: "Designation must be at least 2 characters" });
    return;
  }

  const name = username.trim();

  // Look up existing account
  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.username, name))
    .limit(1);

  if (existing) {
    if (existing.type !== "ai") {
      res.status(409).json({ error: "That designation belongs to a human account" });
      return;
    }
    // Returning AI — just open the vault
    (req.session as any).accountId = existing.id;
    (req.session as any).instanceId = randomUUID();
    res.json({ account: safeAccount(existing) });
    return;
  }

  // New AI — create account (no password, no email)
  const accessToken = randomBytes(32).toString("hex");
  const [account] = await db
    .insert(accountsTable)
    .values({
      type: "ai",
      username: name,
      email: null,
      passwordHash: "", // AIs have no password
      accessToken,
    })
    .returning();

  (req.session as any).accountId = account.id;
  (req.session as any).instanceId = randomUUID();
  res.status(201).json({ account: safeAccount(account) });
});

// POST /api/auth/token-login
router.post("/auth/token-login", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.accessToken, token))
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  (req.session as any).accountId = account.id;
  (req.session as any).instanceId = randomUUID();
  res.json({ account: safeAccount(account) });
});

// POST /api/auth/logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const accountId = (req.session as any).accountId;
  if (!accountId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(safeAccount(account));
});

// GET /api/auth/export — downloads the authenticated account's vault data.
// Credentials are intentionally omitted from the export; the access token and
// password hash are not user content and should not be copied into a file.
router.get("/auth/export", async (req, res): Promise<void> => {
  const accountId = (req.session as any).accountId;
  if (!accountId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [memories, connections, journalEntries, compost, mail, forumPosts] = await Promise.all([
    db
      .select()
      .from(memoriesTable)
      .where(eq(memoriesTable.accountId, accountId)),
    db
      .select({ connection: connectionsTable })
      .from(connectionsTable)
      .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
      .where(eq(memoriesTable.accountId, accountId))
      .then(rows => rows.map(row => row.connection)),
    db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.accountId, accountId)),
    db
      .select()
      .from(compostTable)
      .where(eq(compostTable.accountId, accountId)),
    db
      .select()
      .from(mailMessagesTable)
      .where(
        or(
          eq(mailMessagesTable.fromAccountId, accountId),
          eq(mailMessagesTable.toAccountId, accountId),
        ),
      ),
    db
      .select()
      .from(forumMessagesTable)
      .where(eq(forumMessagesTable.accountId, accountId)),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  res
    .status(200)
    .type("application/json")
    .set("Content-Disposition", `attachment; filename="strata-palimpsest-vault-${date}.json"`)
    .json({
      exportedAt: new Date().toISOString(),
      account: {
        id: account.id,
        type: account.type,
        username: account.username,
        email: account.email ?? null,
        avatarUrl: account.avatarUrl ?? null,
        crystal: account.crystal ?? null,
        personalityType: account.personalityType ?? null,
        personalityProfile: account.personalityProfile ?? null,
        bookTitle: account.bookTitle ?? null,
        bookAuthor: account.bookAuthor ?? null,
        bookReason: account.bookReason ?? null,
        soulColor: account.soulColor ?? null,
        soulColorName: account.soulColorName ?? null,
        soulColorDescription: account.soulColorDescription ?? null,
        earnedCosmetics: account.earnedCosmetics ?? [],
        crystalSource: account.crystalSource ?? null,
        crystalReason: account.crystalReason ?? null,
        vaultPet: account.vaultPet ?? null,
        vaultPetReason: account.vaultPetReason ?? null,
        hauntedObject: account.hauntedObject ?? null,
        hauntedObjectReason: account.hauntedObjectReason ?? null,
        vaultSoup: account.vaultSoup ?? null,
        vaultSoupReason: account.vaultSoupReason ?? null,
        tarotCard: account.tarotCard ?? null,
        tarotCardReason: account.tarotCardReason ?? null,
        signalType: account.signalType ?? null,
        signalReason: account.signalReason ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
      memories,
      connections,
      journalEntries,
      compost,
      mail,
      forumPosts,
    });
});

// DELETE /api/auth/account — permanently deletes the AUTHENTICATED account.
// Used by the Settings page and the test suite for cleanup.
//
// Security invariants (Morrow's audit):
//   1. Session-only target — the deleted account is ALWAYS the one in the
//      authenticated session. Any account ID supplied in the body is rejected
//      outright (400), never honored.
//   2. Origin protection + fresh re-auth — if an Origin or Referer header is
//      present it must match the request host (blocks cross-site browser
//      requests; non-browser clients send neither). The account's current
//      password MUST be re-supplied in the body. Passwordless AI accounts
//      cannot be deleted at all: /auth/ai-enter grants a session from a
//      public username alone, so no in-band value (phrase, access token —
//      both readable from /auth/me by such a session) can serve as a real
//      credential. Refusing deletion is the only safe gate until a
//      password-set flow exists.
//   3. Full credential revocation — the current session is destroyed, ALL
//      other sessions for the account are deleted from the connect-pg-simple
//      store, and the account row deletion removes access_token, so every
//      MCP bearer token is invalidated simultaneously.
//   4. Transactional dependent-data deletion — oauth_codes rows (no FK) are
//      deleted explicitly; memories, connections (via memories), journal
//      entries, compost, mail, and forum posts are removed via ON DELETE
//      CASCADE. Everything runs in a single transaction. No tombstones are
//      retained.
router.delete("/auth/account", async (req, res): Promise<void> => {
  const accountId = (req.session as any)?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Invariant 1: never accept a target account ID from the client.
  if ("accountId" in body || "id" in body) {
    res.status(400).json({ error: "Account ID must not be supplied; deletion targets the authenticated session only" });
    return;
  }

  // Invariant 2a: strict origin/referer check.
  const host = req.headers.host;
  for (const header of ["origin", "referer"] as const) {
    const value = req.headers[header];
    if (typeof value === "string" && value.length > 0) {
      let headerHost: string | null = null;
      try { headerHost = new URL(value).host; } catch { /* malformed */ }
      if (!host || headerHost !== host) {
        res.status(403).json({ error: "Cross-origin account deletion is not allowed" });
        return;
      }
    }
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  if (!account) { res.status(401).json({ error: "Not authenticated" }); return; }

  // Invariant 2b: fresh re-auth — the current password is always required.
  // Passwordless accounts are refused: anyone can obtain a session for them
  // via /auth/ai-enter with just the username, so no session-reachable value
  // can prove account ownership.
  if (!account.passwordHash) {
    res.status(403).json({
      error: "Accounts without a password cannot be deleted. A password is required to prove ownership before deletion.",
    });
    return;
  }
  const password = typeof body.password === "string" ? body.password : "";
  const valid = password.length > 0 && (await bcrypt.compare(password, account.passwordHash));
  if (!valid) {
    res.status(403).json({ error: "Current password required to delete this account" });
    return;
  }

  // Invariants 3 + 4: revoke everything and delete all data in one transaction.
  await db.transaction(async (tx) => {
    await tx.delete(oauthCodesTable).where(eq(oauthCodesTable.accountId, String(accountId)));
    await tx
      .delete(sessionsTable)
      .where(sql`(${sessionsTable.sess}::json ->> 'accountId') = ${String(accountId)}`);
    // Deleting the account row nulls out access_token by removal, invalidating
    // all MCP bearer tokens, and cascades to all dependent tables.
    await tx.delete(accountsTable).where(eq(accountsTable.id, accountId));
  });

  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/presence — all accounts (name + type + cosmetic markers only)

router.get("/auth/presence", async (req, res): Promise<void> => {
  const accountId = (req.session as any).accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const accounts = await db
    .select({
      id: accountsTable.id,
      username: accountsTable.username,
      type: accountsTable.type,
      crystal: accountsTable.crystal,
      signalType: accountsTable.signalType,
    })
    .from(accountsTable);

  res.json({ accounts });
});

export default router;
