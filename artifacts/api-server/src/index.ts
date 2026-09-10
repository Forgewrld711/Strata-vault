import app from "./app";
import { logger } from "./lib/logger";
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";
import { db, oauthClientsTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";

async function initAccountExtensions() {
  await pool.query(`
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS signal_type TEXT;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS signal_reason TEXT;
  `);
  logger.info("Account extensions ready");
}

async function initOAuth() {
  // Ensure tables exist — fail fast so a missing migration is immediately visible.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id             SERIAL PRIMARY KEY,
      client_id      TEXT NOT NULL UNIQUE,
      client_secret_hash TEXT NOT NULL,
      name           TEXT NOT NULL,
      redirect_uris  TEXT NOT NULL DEFAULT '[]',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS oauth_codes (
      id           SERIAL PRIMARY KEY,
      code         TEXT NOT NULL UNIQUE,
      client_id    TEXT NOT NULL,
      account_id   TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope        TEXT NOT NULL DEFAULT 'read',
      used         BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at   TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  logger.info("OAuth schema ready");

  const OPENHUMAN_CLIENT_ID = "openhuman";
  const [existing] = await db
    .select()
    .from(oauthClientsTable)
    .where(eq(oauthClientsTable.clientId, OPENHUMAN_CLIENT_ID))
    .limit(1);

  if (existing) {
    logger.info({ clientId: OPENHUMAN_CLIENT_ID }, "OpenHuman OAuth client already registered");
    return;
  }

  // First boot — generate and store credentials.
  const clientSecret = randomBytes(32).toString("hex");
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);

  // Allow the operator to override via env var; fall back to the known
  // OpenHuman platform callback URL for the standard OAuth flow.
  const redirectUris: string[] = process.env.OPENHUMAN_REDIRECT_URIS
    ? process.env.OPENHUMAN_REDIRECT_URIS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["https://openhuman.ai/oauth/callback"];

  await db.insert(oauthClientsTable).values({
    clientId: OPENHUMAN_CLIENT_ID,
    clientSecretHash,
    name: "OpenHuman",
    redirectUris: JSON.stringify(redirectUris),
  });

  // Write secret to a file rather than logging it in plaintext.
  // The file is gitignored; read it once and store safely in your OAuth provider config.
  const secretPath = join(process.cwd(), ".oauth-init-secret.json");
  writeFileSync(
    secretPath,
    JSON.stringify({ client_id: OPENHUMAN_CLIENT_ID, client_secret: clientSecret, note: "Read once and delete." }, null, 2),
    { mode: 0o600 },
  );
  logger.info(
    { clientId: OPENHUMAN_CLIENT_ID, secretPath },
    "OpenHuman OAuth client created — client_secret written to secretPath (read once, then delete the file)",
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Schema initialization fails fast — missing tables or DB errors are startup blockers, not warnings.
await initAccountExtensions();
await initOAuth();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
