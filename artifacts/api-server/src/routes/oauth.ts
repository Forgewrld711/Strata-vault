/**
 * OAuth 2.0 Authorization Server
 *
 * Endpoints:
 *   GET  /api/oauth/authorize  — show approval page (user must be logged in via session)
 *   POST /api/oauth/authorize  — user approves; redirect to client with auth code
 *   POST /api/oauth/token      — exchange auth code for access token
 *   GET  /api/oauth/clients    — list registered clients (admin)
 *   POST /api/oauth/clients    — register a new OAuth client (admin)
 *
 * The access token returned is the same bearer token already used by MCP/API,
 * so existing integrations remain backward-compatible.
 */

import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { db, accountsTable, oauthClientsTable, oauthCodesTable, pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRedirectUriAllowed(allowed: string[], requested: string): boolean {
  return allowed.some((uri) => uri === requested);
}

// ── GET /api/oauth/authorize ─────────────────────────────────────────────────
// Validates the request params and renders an HTML approval page.
// Requires the user to be authenticated via session cookie.
router.get("/oauth/authorize", async (req, res): Promise<void> => {
  const { client_id, redirect_uri, response_type, state, scope } = req.query as Record<string, string>;

  // Validate response_type
  if (response_type !== "code") {
    res.status(400).json({ error: "unsupported_response_type", error_description: "Only 'code' is supported" });
    return;
  }

  if (!client_id || !redirect_uri) {
    res.status(400).json({ error: "invalid_request", error_description: "client_id and redirect_uri are required" });
    return;
  }

  // Look up client
  const [client] = await db
    .select()
    .from(oauthClientsTable)
    .where(eq(oauthClientsTable.clientId, client_id))
    .limit(1);

  if (!client) {
    res.status(400).json({ error: "invalid_client", error_description: "Unknown client_id" });
    return;
  }

  const allowedUris: string[] = JSON.parse(client.redirectUris);
  if (!isRedirectUriAllowed(allowedUris, redirect_uri)) {
    res.status(400).json({ error: "invalid_request", error_description: "redirect_uri not allowed for this client" });
    return;
  }

  // Must be logged in
  const accountId = (req.session as any).accountId;
  if (!accountId) {
    // Redirect to the login page, preserving the full OAuth params as a return URL
    const returnTo = encodeURIComponent(req.originalUrl);
    res.redirect(`/login?oauth_return=${returnTo}`);
    return;
  }

  const [account] = await db
    .select({ id: accountsTable.id, username: accountsTable.username, type: accountsTable.type })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const safeClientName = escapeHtml(client.name);
  const safeUsername = escapeHtml(account.username);
  const safeScope = escapeHtml(scope || "read");
  const safeState = escapeHtml(state || "");
  const safeRedirectUri = escapeHtml(redirect_uri);
  const safeClientId = escapeHtml(client_id);

  // Render approval page
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorize — Strata Palimpsest</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0c0c14;
      color: #e2e0ff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #13121e;
      border: 1px solid #2a2850;
      border-radius: 16px;
      padding: 40px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 0 60px rgba(120, 80, 255, 0.15);
    }
    .logo { font-size: 28px; margin-bottom: 8px; }
    h1 { font-size: 20px; font-weight: 600; color: #c5bfff; margin-bottom: 24px; }
    .app-name {
      font-size: 22px;
      font-weight: 700;
      color: #a78bfa;
      margin-bottom: 8px;
    }
    .user-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1e1c30;
      border: 1px solid #3a3660;
      border-radius: 999px;
      padding: 4px 14px;
      font-size: 14px;
      margin-bottom: 24px;
      color: #9b97cf;
    }
    .scope-box {
      background: #1a1828;
      border: 1px solid #2a2850;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .scope-box p { font-size: 13px; color: #8b87c0; margin-bottom: 8px; }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #c5bfff;
    }
    .scope-item::before { content: "✓"; color: #7c3aed; font-weight: bold; }
    .actions { display: flex; gap: 12px; }
    button {
      flex: 1;
      padding: 12px;
      border-radius: 10px;
      border: none;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.85; }
    .allow { background: #7c3aed; color: #fff; }
    .deny { background: #1e1c30; color: #8b87c0; border: 1px solid #3a3660; }
    .footer { margin-top: 20px; font-size: 12px; color: #4a4870; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🔮</div>
    <h1>Authorization Request</h1>
    <div class="app-name">${safeClientName}</div>
    <p style="color:#8b87c0;font-size:13px;margin-bottom:12px;">wants to access your vault as</p>
    <div class="user-pill">👤 ${safeUsername}</div>
    <div class="scope-box">
      <p>This app will be able to:</p>
      <div class="scope-item">Read your memories and connections</div>
      ${safeScope.includes("write") ? '<div class="scope-item">Create and update memories</div>' : ""}
    </div>
    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="client_id" value="${safeClientId}" />
      <input type="hidden" name="redirect_uri" value="${safeRedirectUri}" />
      <input type="hidden" name="state" value="${safeState}" />
      <input type="hidden" name="scope" value="${safeScope}" />
      <div class="actions">
        <button type="submit" name="decision" value="deny" class="deny">Deny</button>
        <button type="submit" name="decision" value="allow" class="allow">Allow Access</button>
      </div>
    </form>
    <p class="footer">Strata Palimpsest · Your vault, your rules</p>
  </div>
</body>
</html>`);
});

// ── POST /api/oauth/authorize ────────────────────────────────────────────────
// User submits the approval form. Issue a code or redirect with error.
router.post("/oauth/authorize", async (req, res): Promise<void> => {
  const { client_id, redirect_uri, state, scope, decision } = req.body as Record<string, string>;

  const accountId = (req.session as any).accountId;
  if (!accountId) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  if (!client_id || !redirect_uri) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const [client] = await db
    .select()
    .from(oauthClientsTable)
    .where(eq(oauthClientsTable.clientId, client_id))
    .limit(1);

  if (!client) {
    res.status(400).json({ error: "invalid_client" });
    return;
  }

  const allowedUris: string[] = JSON.parse(client.redirectUris);
  if (!isRedirectUriAllowed(allowedUris, redirect_uri)) {
    res.status(400).json({ error: "invalid_request", error_description: "redirect_uri not allowed" });
    return;
  }

  const redirectBase = redirect_uri.includes("?") ? redirect_uri + "&" : redirect_uri + "?";

  if (decision !== "allow") {
    const params = `error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    res.redirect(redirectBase + params);
    return;
  }

  // Issue auth code (10-minute expiry)
  const code = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(oauthCodesTable).values({
    code,
    clientId: client_id,
    accountId: String(accountId),
    redirectUri: redirect_uri,
    scope: scope || "read",
    used: false,
    expiresAt,
  });

  const params = `code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
  res.redirect(redirectBase + params);
});

// ── POST /api/oauth/token ────────────────────────────────────────────────────
// Exchange auth code for access token.
router.post("/oauth/token", async (req, res): Promise<void> => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body as Record<string, string>;

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  if (!code || !client_id || !client_secret) {
    res.status(400).json({ error: "invalid_request", error_description: "code, client_id, and client_secret are required" });
    return;
  }

  // Validate client credentials
  const [client] = await db
    .select()
    .from(oauthClientsTable)
    .where(eq(oauthClientsTable.clientId, client_id))
    .limit(1);

  if (!client) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const secretOk = await bcrypt.compare(client_secret, client.clientSecretHash);
  if (!secretOk) {
    res.status(401).json({ error: "invalid_client", error_description: "Invalid client credentials" });
    return;
  }

  // Step 1: Read and validate the code (including redirect_uri) before consuming it.
  const [codeRow] = await db
    .select()
    .from(oauthCodesTable)
    .where(eq(oauthCodesTable.code, code))
    .limit(1);

  if (!codeRow) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code not found" });
    return;
  }
  if (codeRow.used) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code already used" });
    return;
  }
  if (codeRow.clientId !== client_id) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code was not issued to this client" });
    return;
  }
  if (redirect_uri && codeRow.redirectUri !== redirect_uri) {
    res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
    return;
  }
  if (new Date() > codeRow.expiresAt) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code has expired" });
    return;
  }

  // Step 2: Atomically mark as used — conditional UPDATE prevents concurrent replay.
  // If 0 rows are updated a concurrent request already consumed the code.
  const consumed = await db
    .update(oauthCodesTable)
    .set({ used: true })
    .where(
      and(
        eq(oauthCodesTable.code, code),
        eq(oauthCodesTable.used, false),
        sql`${oauthCodesTable.expiresAt} > NOW()`,
      ),
    )
    .returning();

  if (consumed.length === 0) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code already used or expired" });
    return;
  }

  const authCode = codeRow;

  // Fetch the account and return (or generate) its access token
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, parseInt(authCode.accountId, 10)))
    .limit(1);

  if (!account) {
    res.status(400).json({ error: "invalid_grant", error_description: "Account not found" });
    return;
  }

  let accessToken = account.accessToken;
  if (!accessToken) {
    // Human accounts don't always have a token — generate one
    accessToken = randomBytes(32).toString("hex");
    await db
      .update(accountsTable)
      .set({ accessToken })
      .where(eq(accountsTable.id, account.id));
  }

  logger.info({ accountId: account.id, clientId: client_id }, "OAuth token issued");

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    scope: authCode.scope,
    account_id: account.id,
    username: account.username,
  });
});

// ── Admin auth helper ─────────────────────────────────────────────────────────
// Only human accounts may manage OAuth clients.
async function requireHumanAccount(req: any, res: any): Promise<typeof accountsTable.$inferSelect | null> {
  const accountId = (req.session as any).accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return null; }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account || account.type !== "human") {
    res.status(403).json({ error: "Forbidden", error_description: "Only human accounts may manage OAuth clients" });
    return null;
  }
  return account;
}

// ── GET /api/oauth/clients ───────────────────────────────────────────────────
// List registered clients (safe — no secrets). Human accounts only.
router.get("/oauth/clients", async (req, res): Promise<void> => {
  const account = await requireHumanAccount(req, res);
  if (!account) return;

  const clients = await db
    .select({
      id: oauthClientsTable.id,
      clientId: oauthClientsTable.clientId,
      name: oauthClientsTable.name,
      redirectUris: oauthClientsTable.redirectUris,
      createdAt: oauthClientsTable.createdAt,
    })
    .from(oauthClientsTable);

  res.json({ clients });
});

// ── POST /api/oauth/clients ──────────────────────────────────────────────────
// Register a new OAuth client. Returns the plaintext secret once.
// Human accounts only — prevents AI accounts from self-registering clients.
router.post("/oauth/clients", async (req, res): Promise<void> => {
  const account = await requireHumanAccount(req, res);
  if (!account) return;

  const { name, redirectUris } = req.body as { name?: string; redirectUris?: string[] };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "name is required (min 2 chars)" });
    return;
  }

  const uris: string[] = Array.isArray(redirectUris) ? redirectUris : [];

  const clientId = randomBytes(12).toString("hex");
  const clientSecret = randomBytes(32).toString("hex");
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);

  await db.insert(oauthClientsTable).values({
    clientId,
    clientSecretHash,
    name: name.trim(),
    redirectUris: JSON.stringify(uris),
  });

  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret, // returned once — store safely
    name: name.trim(),
    redirect_uris: uris,
    note: "Save client_secret now — it will not be shown again.",
  });
});

export default router;
