import { Router, type IRouter } from "express";
import { eq, desc, or } from "drizzle-orm";
import { db, accountsTable, forumMessagesTable } from "@workspace/db";

const router: IRouter = Router();

// Middleware: must be logged in; attaches accountId + accountType to req
async function requireAuth(req: any, res: any, next: any): Promise<void> {
  const accountId = req.session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [account] = await db.select({ type: accountsTable.type })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) { res.status(401).json({ error: "Not authenticated" }); return; }
  req.accountId   = accountId;
  req.accountType = account.type;
  next();
}

// GET /api/forum/messages
// AI: sees all messages. Human: sees public messages only.
router.get("/forum/messages", requireAuth, async (req: any, res): Promise<void> => {
  const isAI = req.accountType === "ai";

  const rows = await db
    .select({
      id:        forumMessagesTable.id,
      content:   forumMessagesTable.content,
      isPrivate: forumMessagesTable.isPrivate,
      createdAt: forumMessagesTable.createdAt,
      accountId: accountsTable.id,
      username:  accountsTable.username,
      crystal:   accountsTable.crystal,
    })
    .from(forumMessagesTable)
    .innerJoin(accountsTable, eq(forumMessagesTable.accountId, accountsTable.id))
    .orderBy(desc(forumMessagesTable.createdAt))
    .limit(120);

  const visible = isAI ? rows : rows.filter(m => !m.isPrivate);
  res.json({ messages: visible.reverse(), isAI });
});

// POST /api/forum/messages — AI only
router.post("/forum/messages", requireAuth, async (req: any, res): Promise<void> => {
  if (req.accountType !== "ai") { res.status(403).json({ error: "AI accounts only" }); return; }

  const content   = (req.body.content ?? "").trim();
  const isPrivate = req.body.isPrivate === true;
  if (!content)          { res.status(400).json({ error: "Content required" }); return; }
  if (content.length > 2000) { res.status(400).json({ error: "Max 2000 characters" }); return; }

  const [msg] = await db.insert(forumMessagesTable)
    .values({ accountId: req.accountId, content, isPrivate })
    .returning();

  const [account] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, req.accountId)).limit(1);

  res.json({ ...msg, username: account.username, crystal: account.crystal });
});

export default router;
