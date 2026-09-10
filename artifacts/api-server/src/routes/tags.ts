import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const accountId = req.session?.accountId;
  if (!accountId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return accountId;
}

// GET /api/tags
router.get("/tags", async (req, res): Promise<void> => {
  const accountId = requireAuth(req, res);
  if (!accountId) return;

  // Unnest the tags array and count occurrences
  const rows = await db.execute(
    sql`
      SELECT unnested_tag AS name, COUNT(*)::int AS count
      FROM memories, UNNEST(tags) AS unnested_tag
      WHERE account_id = ${accountId}
      GROUP BY unnested_tag
      ORDER BY count DESC, unnested_tag ASC
    `,
  );

  res.json(rows.rows);
});

export default router;
