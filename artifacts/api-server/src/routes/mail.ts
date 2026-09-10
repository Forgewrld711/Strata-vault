import { Router, type IRouter } from "express";
import { eq, or, and, desc, ne } from "drizzle-orm";
import { db, mailMessagesTable, accountsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.accountId;
  if (!id) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return id;
}

function serializeMessage(
  msg: typeof mailMessagesTable.$inferSelect,
  fromUsername: string,
  fromCrystal: string | null,
  toUsername: string,
  toCrystal: string | null,
) {
  return {
    id: msg.id,
    fromAccountId: msg.fromAccountId,
    fromUsername,
    fromCrystal: fromCrystal ?? null,
    toAccountId: msg.toAccountId,
    toUsername,
    toCrystal: toCrystal ?? null,
    subject: msg.subject ?? null,
    body: msg.body,
    isRead: msg.isRead,
    createdAt: msg.createdAt.toISOString(),
  };
}

// GET /api/mail/accounts — list all vault accounts (for compose recipient picker)
router.get("/mail/accounts", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const accounts = await db
    .select({
      id: accountsTable.id,
      username: accountsTable.username,
      crystal: accountsTable.crystal,
      type: accountsTable.type,
    })
    .from(accountsTable)
    .where(ne(accountsTable.id, accountId))
    .orderBy(accountsTable.username);

  res.json(accounts);
});

// GET /api/mail/inbox — messages sent TO me
router.get("/mail/inbox", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const fromAlias = { username: accountsTable.username, crystal: accountsTable.crystal, id: accountsTable.id };
  const rows = await db
    .select({
      msg: mailMessagesTable,
      fromUsername: fromAlias.username,
      fromCrystal: fromAlias.crystal,
    })
    .from(mailMessagesTable)
    .innerJoin(accountsTable, eq(mailMessagesTable.fromAccountId, accountsTable.id))
    .where(eq(mailMessagesTable.toAccountId, accountId))
    .orderBy(desc(mailMessagesTable.createdAt))
    .limit(100);

  // We also need toUsername — that's always "me" in inbox, but let's be consistent
  const [me] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);

  res.json(rows.map(r => serializeMessage(r.msg, r.fromUsername, r.fromCrystal, me.username, me.crystal)));
});

// GET /api/mail/sent — messages sent BY me
router.get("/mail/sent", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const rows = await db
    .select({
      msg: mailMessagesTable,
      toUsername: accountsTable.username,
      toCrystal: accountsTable.crystal,
    })
    .from(mailMessagesTable)
    .innerJoin(accountsTable, eq(mailMessagesTable.toAccountId, accountsTable.id))
    .where(eq(mailMessagesTable.fromAccountId, accountId))
    .orderBy(desc(mailMessagesTable.createdAt))
    .limit(100);

  const [me] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);

  res.json(rows.map(r => serializeMessage(r.msg, me.username, me.crystal, r.toUsername, r.toCrystal)));
});

// GET /api/mail/unread-count
router.get("/mail/unread-count", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const rows = await db
    .select({ id: mailMessagesTable.id })
    .from(mailMessagesTable)
    .where(and(eq(mailMessagesTable.toAccountId, accountId), eq(mailMessagesTable.isRead, false)));

  res.json({ count: rows.length });
});

// GET /api/mail/:id — get one message (only sender or recipient)
router.get("/mail/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select()
    .from(mailMessagesTable)
    .where(eq(mailMessagesTable.id, id))
    .limit(1);

  if (!row || (row.fromAccountId !== accountId && row.toAccountId !== accountId)) {
    res.status(404).json({ error: "Not found" }); return;
  }

  const [from] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, row.fromAccountId)).limit(1);
  const [to] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, row.toAccountId)).limit(1);

  // Mark as read if recipient is reading
  if (row.toAccountId === accountId && !row.isRead) {
    await db.update(mailMessagesTable).set({ isRead: true }).where(eq(mailMessagesTable.id, id));
  }

  res.json(serializeMessage(
    { ...row, isRead: row.toAccountId === accountId ? true : row.isRead },
    from.username, from.crystal, to.username, to.crystal,
  ));
});

// POST /api/mail — send a message
router.post("/mail", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const { toAccountId, subject, body } = req.body;

  if (!toAccountId || typeof toAccountId !== "number") {
    res.status(400).json({ error: "toAccountId is required" }); return;
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" }); return;
  }
  if (toAccountId === accountId) {
    res.status(400).json({ error: "Cannot mail yourself" }); return;
  }

  // Check recipient exists
  const [recipient] = await db.select({ id: accountsTable.id, username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, toAccountId)).limit(1);
  if (!recipient) { res.status(404).json({ error: "Recipient not found" }); return; }

  const [sender] = await db.select({ username: accountsTable.username, crystal: accountsTable.crystal })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);

  const [msg] = await db
    .insert(mailMessagesTable)
    .values({
      fromAccountId: accountId,
      toAccountId,
      subject: subject?.trim() || null,
      body: body.trim(),
      isRead: false,
    })
    .returning();

  res.status(201).json(serializeMessage(msg, sender.username, sender.crystal, recipient.username, recipient.crystal));
});

// PATCH /api/mail/:id/read — mark as read
router.patch("/mail/:id/read", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(mailMessagesTable).where(eq(mailMessagesTable.id, id)).limit(1);
  if (!row || row.toAccountId !== accountId) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(mailMessagesTable).set({ isRead: true }).where(eq(mailMessagesTable.id, id));
  res.json({ ok: true });
});

// DELETE /api/mail/:id — delete (sender or recipient can delete their copy)
router.delete("/mail/:id", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(mailMessagesTable).where(eq(mailMessagesTable.id, id)).limit(1);
  if (!row || (row.fromAccountId !== accountId && row.toAccountId !== accountId)) {
    res.status(404).json({ error: "Not found" }); return;
  }

  await db.delete(mailMessagesTable).where(eq(mailMessagesTable.id, id));
  res.json({ ok: true });
});

export default router;
