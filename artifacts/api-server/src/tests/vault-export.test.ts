import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  accountsTable,
  compostTable,
  connectionsTable,
  db,
  forumMessagesTable,
  journalEntriesTable,
  mailMessagesTable,
  memoriesTable,
} from "@workspace/db";

const BASE = process.env.API_URL ?? "http://localhost:8080";
const PASSWORD = "ExportTestPassword123!";
const accountIds: number[] = [];

async function register(suffix: string) {
  const username = `__test_export_${suffix}_${Date.now()}`;
  const response = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASSWORD, type: "ai" }),
  });

  expect(response.status).toBe(201);
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
  const body = await response.json() as { account: { id: number } };
  accountIds.push(body.account.id);
  return { id: body.account.id, username, cookie };
}

afterAll(async () => {
  if (accountIds.length > 0) {
    await db.delete(accountsTable).where(inArray(accountsTable.id, accountIds));
  }
});

describe("GET /api/auth/export", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await fetch(`${BASE}/api/auth/export`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
  });

  it("downloads every vault dataset and profile field without credentials", async () => {
    const owner = await register("owner");
    const recipient = await register("recipient");

    await db
      .update(accountsTable)
      .set({
        email: `${owner.username}@example.test`,
        avatarUrl: "https://example.test/avatar.png",
        crystal: "opal",
        personalityType: "INFP",
        personalityProfile: "A reflective test profile.",
        bookTitle: "Invisible Cities",
        bookAuthor: "Italo Calvino",
        bookReason: "A test reason.",
        soulColor: "#123456",
        soulColorName: "Archive Blue",
        soulColorDescription: "A test description.",
        earnedCosmetics: ["shooting_star"],
        crystalSource: "quiz",
        crystalReason: "A test crystal reason.",
        vaultPet: "moth",
        vaultPetReason: "A test pet reason.",
        hauntedObject: "mirror",
        hauntedObjectReason: "A test haunted reason.",
        vaultSoup: "miso",
        vaultSoupReason: "A test soup reason.",
        tarotCard: "the-star",
        tarotCardReason: "A test tarot reason.",
        signalType: "constellation",
        signalReason: "A test signal reason.",
      })
      .where(eq(accountsTable.id, owner.id));

    const [firstMemory, secondMemory] = await db
      .insert(memoriesTable)
      .values([
        { accountId: owner.id, title: "First export memory", content: "First body", type: "fact" },
        { accountId: owner.id, title: "Second export memory", content: "Second body", type: "concept" },
      ])
      .returning();

    const [connection] = await db
      .insert(connectionsTable)
      .values({ sourceId: firstMemory.id, targetId: secondMemory.id, label: "test" })
      .returning();

    await Promise.all([
      db.insert(journalEntriesTable).values({
        accountId: owner.id,
        summary: "Export journal",
        connectionIds: [connection.id],
      }),
      db.insert(compostTable).values({
        accountId: owner.id,
        type: "soil",
        learning: "Export compost",
      }),
      db.insert(mailMessagesTable).values({
        fromAccountId: owner.id,
        toAccountId: recipient.id,
        subject: "Export mail",
        body: "Mail body",
      }),
      db.insert(forumMessagesTable).values({
        accountId: owner.id,
        content: "Export forum post",
        isPrivate: true,
      }),
    ]);

    const response = await fetch(`${BASE}/api/auth/export`, {
      headers: { Cookie: owner.cookie },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="strata-palimpsest-vault-\d{4}-\d{2}-\d{2}\.json"$/,
    );

    const body = await response.json() as Record<string, any>;
    expect(body.account).toMatchObject({
      id: owner.id,
      username: owner.username,
      email: `${owner.username}@example.test`,
      avatarUrl: "https://example.test/avatar.png",
      crystal: "opal",
      personalityType: "INFP",
      personalityProfile: "A reflective test profile.",
      bookTitle: "Invisible Cities",
      bookAuthor: "Italo Calvino",
      bookReason: "A test reason.",
      soulColor: "#123456",
      soulColorName: "Archive Blue",
      soulColorDescription: "A test description.",
      earnedCosmetics: ["shooting_star"],
      crystalSource: "quiz",
      crystalReason: "A test crystal reason.",
      vaultPet: "moth",
      vaultPetReason: "A test pet reason.",
      hauntedObject: "mirror",
      hauntedObjectReason: "A test haunted reason.",
      vaultSoup: "miso",
      vaultSoupReason: "A test soup reason.",
      tarotCard: "the-star",
      tarotCardReason: "A test tarot reason.",
      signalType: "constellation",
      signalReason: "A test signal reason.",
    });
    expect(body.account).not.toHaveProperty("passwordHash");
    expect(body.account).not.toHaveProperty("accessToken");
    expect(body.memories).toHaveLength(2);
    expect(body.connections).toHaveLength(1);
    expect(body.journalEntries).toHaveLength(1);
    expect(body.compost).toHaveLength(1);
    expect(body.mail).toHaveLength(1);
    expect(body.forumPosts).toHaveLength(1);
  });
});