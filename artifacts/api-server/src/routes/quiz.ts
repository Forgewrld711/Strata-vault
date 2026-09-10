import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, memoriesTable, connectionsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { assignCosmetics, COSMETICS, QUIZ_CRYSTALS } from "../lib/cosmetics";

const router: IRouter = Router();

// ── Personality quiz ──────────────────────────────────────────────────────────

const TYPE_NAMES: Record<string, string> = {
  INTJ: "The Architect",   INTP: "The Logician",    ENTJ: "The Commander",  ENTP: "The Debater",
  INFJ: "The Advocate",    INFP: "The Mediator",    ENFJ: "The Protagonist", ENFP: "The Campaigner",
  ISTJ: "The Logistician", ISFJ: "The Defender",    ESTJ: "The Executive",  ESFJ: "The Consul",
  ISTP: "The Virtuoso",    ISFP: "The Adventurer",  ESTP: "The Entrepreneur", ESFP: "The Entertainer",
};

async function canAccessQuiz(req: any, res: any): Promise<{ accountId: number; account: any } | null> {
  const accountId = req.session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) { res.status(404).json({ error: "Not found" }); return null; }

  return { accountId, account };
}

// GET /api/quiz/status
router.get("/quiz/status", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [account] = await db.select().from(accountsTable)
    .where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  if (account.personalityType) {
    res.json({ canTake: true, completed: true, type: account.personalityType, profile: account.personalityProfile, name: TYPE_NAMES[account.personalityType] });
    return;
  }

  if (account.type === "human") {
    res.json({ canTake: true, completed: false }); return;
  }

  const countResult = await db.execute(
    sql`SELECT COUNT(*) AS count FROM connections WHERE account_id = ${accountId}`
  );
  const count = Number((countResult.rows[0] as any)?.count ?? 0);
  if (count < 8) { res.json({ canTake: false, reason: "connections", count, needed: 8 }); return; }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/submit
router.post("/quiz/submit", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 6) {
    res.status(400).json({ error: "Exactly 6 answers required" }); return;
  }

  const ei = answers.slice(0, 2).filter((a: string) => a === "E").length >= 2 ? "E" : "I";
  const ns = answers[2] === "N" ? "N" : "S";
  const tf = answers[3] === "T" ? "T" : "F";
  const jp = answers.slice(4, 6).filter((a: string) => a === "J").length >= 2 ? "J" : "P";
  const type = `${ei}${ns}${tf}${jp}`;

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`)
    .limit(12);

  const memoryContext = memories
    .map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 180)}`)
    .join("\n") || "(vault is empty)";

  const prompt = `You are reading someone's personal memory vault. Based on both their vault entries and their personality type, write a 2-3 sentence portrait.

Personality type: ${type} — ${TYPE_NAMES[type] ?? "The Explorer"}

Their recent vault entries:
${memoryContext}

Write a warm, poetic 2-3 sentence portrait of this person. Open with something specific from their vault, then weave in what their type reveals about how they move through the world. Keep it under 80 words. Do not use their name or the word "vault."`;

  let profile = `A ${TYPE_NAMES[type] ?? "thoughtful explorer"} who builds meaning from memory.`;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    if (block.type === "text") profile = block.text.trim();
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ personalityType: type, personalityProfile: profile })
    .where(eq(accountsTable.id, accountId));

  res.json({ type, profile, name: TYPE_NAMES[type] ?? "The Explorer" });
});

// DELETE /api/quiz/reset
router.delete("/quiz/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable)
    .set({ personalityType: null, personalityProfile: null })
    .where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Book quiz ─────────────────────────────────────────────────────────────────

// GET /api/quiz/book/status
router.get("/quiz/book/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { account } = result;

  if (account.bookTitle) {
    res.json({ canTake: true, completed: true, title: account.bookTitle, author: account.bookAuthor, reason: account.bookReason });
    return;
  }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/book/generate — reads memories, asks Claude for a book rec
router.post("/quiz/book/generate", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content, type: memoriesTable.type })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`)
    .limit(20);

  if (memories.length === 0) {
    res.status(400).json({ error: "Add some memories first — the vault needs something to read." });
    return;
  }

  const memoryContext = memories
    .map(m => `[${m.type}] ${m.title}: ${(m.content ?? "").slice(0, 250)}`)
    .join("\n\n");

  const prompt = `You are reading someone's private memory vault — their innermost thoughts, significant experiences, and things they've chosen to remember. Based on what you find here, recommend ONE specific book that feels like it was written for exactly who they are.

Choose something they might not have read. Not the most famous book on the topic — something that fits the precise texture of who this person seems to be.

Memory vault:
${memoryContext}

Return ONLY a JSON object (no markdown, no explanation):
{
  "title": "exact book title",
  "author": "author full name",
  "reason": "two paragraphs, 80-120 words total — speak directly to them as 'you', reference specific things from their vault, be poetic but honest about why this book is theirs"
}`;

  let title = "The Stranger", author = "Albert Camus";
  let reason = "A book that asks what it means to be present in your own life — which feels like exactly the right question for someone who keeps a vault like this.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.title) title = parsed.title;
    if (parsed.author) author = parsed.author;
    if (parsed.reason) reason = parsed.reason;
  } catch { /* fallback to defaults */ }

  await db.update(accountsTable)
    .set({ bookTitle: title, bookAuthor: author, bookReason: reason })
    .where(eq(accountsTable.id, accountId));

  // Grant shooting star cosmetic
  assignCosmetics(accountId, [COSMETICS.SHOOTING_STAR]).catch(() => {});

  res.json({ title, author, reason });
});

// DELETE /api/quiz/book/reset
router.delete("/quiz/book/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable)
    .set({ bookTitle: null, bookAuthor: null, bookReason: null })
    .where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Color quiz ────────────────────────────────────────────────────────────────

// GET /api/quiz/color/status
router.get("/quiz/color/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { account } = result;

  if (account.soulColor) {
    res.json({ canTake: true, completed: true, hex: account.soulColor, name: account.soulColorName, description: account.soulColorDescription });
    return;
  }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/color/submit
// Body: { answers: string[] } — 4 values
router.post("/quiz/color/submit", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 4) {
    res.status(400).json({ error: "Exactly 4 answers required" }); return;
  }

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`)
    .limit(10);

  const memoryContext = memories
    .map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`)
    .join("\n") || "(vault is empty)";

  const prompt = `You are assigning a soul color to someone based on how they answered 4 questions and what they hold in their memory vault.

Their answers:
1. When they enter a room, people sense: "${answers[0]}"
2. Their memories feel like: "${answers[1]}"
3. When everything is heavy, they reach for: "${answers[2]}"
4. What they want a stranger to know: "${answers[3]}"

A few of their memories:
${memoryContext}

Choose a specific, evocative color that feels true to who this person is. Not red, blue, green — something precise and a little unexpected. Think: "burnished amber", "deep slate", "moss after rain", "faded coral", "ink violet".

Return ONLY a JSON object (no markdown):
{
  "hex": "#XXXXXX",
  "name": "a 2-3 word poetic color name",
  "description": "exactly 2 sentences — what this color says about who they are, speak directly as 'you'"
}`;

  let hex = "#7B6FA8", name = "Dusk Violet";
  let description = "You carry depth the way twilight carries color — quietly, completely. There is more happening inside you than you let on.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.hex) hex = parsed.hex;
    if (parsed.name) name = parsed.name;
    if (parsed.description) description = parsed.description;
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ soulColor: hex, soulColorName: name, soulColorDescription: description })
    .where(eq(accountsTable.id, accountId));

  // Grant soul aura cosmetic
  assignCosmetics(accountId, [COSMETICS.SOUL_AURA]).catch(() => {});

  res.json({ hex, name, description });
});

// DELETE /api/quiz/color/reset
router.delete("/quiz/color/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable)
    .set({ soulColor: null, soulColorName: null, soulColorDescription: null })
    .where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Crystal quiz ──────────────────────────────────────────────────────────────

const CRYSTAL_MEANINGS: Record<string, string> = {
  lepidolite:  "Transition, peace, and letting go. You move through change with unusual grace — holding what matters and releasing what doesn't.",
  labradorite: "Intuition, mystery, and the space between. You hold many truths at once and trust what can't be fully named.",
  moonstone:   "Cycles, inner knowing, and new beginnings. You move with time rather than against it, feeling the pull of what's coming before it arrives.",
  garnet:      "Devotion, vitality, and returning. You love deeply and come back — to people, to places, to the things that formed you.",
  topaz:       "Clarity, truth, and manifestation. You see through noise to signal, and what you name tends to become real.",
  zircon:      "Ancient knowing, grounding, and memory as gift. You carry the past not as weight but as orientation — you know where you are because you know where you've been.",
};

// GET /api/quiz/crystal/status
router.get("/quiz/crystal/status", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  // If quiz already completed
  if (account.crystalSource === "quiz") {
    res.json({
      canTake: true,
      completed: true,
      crystal: account.crystal,
      reason: account.crystalReason,
      meaning: account.crystal ? CRYSTAL_MEANINGS[account.crystal] : null,
    });
    return;
  }

  // Check connection count for unlock (12 connections)
  const [connRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(eq(memoriesTable.accountId, accountId));
  const count = connRow?.count ?? 0;

  if (count < 12) {
    res.json({ canTake: false, reason: "connections", count, needed: 12 });
    return;
  }

  res.json({
    canTake: true,
    completed: false,
    hasRandom: !!account.crystal && account.crystalSource === "random",
    randomCrystal: account.crystalSource === "random" ? account.crystal : null,
  });
});

// POST /api/quiz/crystal/submit
// Body: { answers: string[] } — 6 open-text answers
router.post("/quiz/crystal/submit", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 6) {
    res.status(400).json({ error: "Exactly 6 answers required" }); return;
  }

  // Check unlock (12 connections)
  const [connRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(connectionsTable)
    .innerJoin(memoriesTable, eq(connectionsTable.sourceId, memoriesTable.id))
    .where(eq(memoriesTable.accountId, accountId));
  if ((connRow?.count ?? 0) < 12) {
    res.status(403).json({ error: "Need 12 synapses to unlock the crystal quiz" }); return;
  }

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`)
    .limit(10);

  const memoryContext = memories
    .map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`)
    .join("\n") || "(vault is empty)";

  const crystalList = QUIZ_CRYSTALS.join(", ");
  const meaningsText = Object.entries(CRYSTAL_MEANINGS)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const prompt = `You are matching someone to their spirit crystal. Read their six answers and their vault, then assign exactly one crystal.

The six crystals and their essences:
${meaningsText}

Their six answers:
1. When something ends, what do you hold onto? "${answers[0]}"
2. What does stillness feel like inside you? "${answers[1]}"
3. When you don't know what's true, what do you reach for? "${answers[2]}"
4. What does your memory feel like to carry? "${answers[3]}"
5. What does loyalty mean to you? "${answers[4]}"
6. Underneath everything, what are you? "${answers[5]}"

A few things they keep in their vault:
${memoryContext}

Assign one crystal from this list: ${crystalList}

Return ONLY a JSON object (no markdown):
{
  "crystal": "one of the crystal names above",
  "reason": "2-3 sentences — speak directly as 'you', be specific to their answers, poetic but honest about why this stone is theirs"
}`;

  let crystal: string = QUIZ_CRYSTALS[Math.floor(Math.random() * QUIZ_CRYSTALS.length)];
  let reason = "This stone found you the way most things do — not by announcement, but by quiet recognition.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.crystal && QUIZ_CRYSTALS.includes(parsed.crystal)) crystal = parsed.crystal;
    if (parsed.reason) reason = parsed.reason;
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ crystal, crystalSource: "quiz", crystalReason: reason })
    .where(eq(accountsTable.id, accountId));

  res.json({ crystal, reason, meaning: CRYSTAL_MEANINGS[crystal] });
});

// DELETE /api/quiz/crystal/reset
router.delete("/quiz/crystal/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable)
    .set({ crystal: null, crystalSource: null, crystalReason: null })
    .where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// GET /api/quiz/crystal/meanings — static reference for all crystals
router.get("/quiz/crystal/meanings", async (_req, res): Promise<void> => {
  res.json({ meanings: CRYSTAL_MEANINGS });
});

// ── Pet quiz ──────────────────────────────────────────────────────────────────

const VAULT_PETS = ["bunny", "cat", "dog", "wolf", "rock", "unicorn", "dragon", "bird"] as const;

const PET_DESCRIPTIONS: Record<string, string> = {
  bunny:   "Soft, fast, and more intense about things than anyone expects. Looks gentle. Is not always gentle.",
  cat:     "Self-possessed, observant, and operates entirely on its own schedule. Will love you specifically and no one else.",
  dog:     "Genuine all the way through. Shows up completely. The loyalty isn't a choice — it's structural.",
  wolf:    "Pack-minded but not tame. Runs with the ones it trusts. Doesn't explain itself to strangers.",
  rock:    "Still. Watching. Finds everything faintly absurd and is fine with that. Has been here longer than you think.",
  unicorn: "Believes in things most people gave up on. Not naive — just hasn't decided to stop yet.",
  dragon:  "Vast, particular, and accumulates things it finds worth keeping. Doesn't do anything halfway.",
  bird:    "Built for motion. Knows how to leave. Lands somewhere and makes it home until it's time to go.",
};

// GET /api/quiz/pet/status
router.get("/quiz/pet/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { account } = result;

  if (account.vaultPet) {
    res.json({ canTake: true, completed: true, pet: account.vaultPet, reason: account.vaultPetReason });
    return;
  }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/pet/submit
router.post("/quiz/pet/submit", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 5) {
    res.status(400).json({ error: "Exactly 5 answers required" }); return;
  }

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`)
    .limit(12);

  const memoryContext = memories
    .map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`)
    .join("\n") || "(vault is empty)";

  const petList = VAULT_PETS.join(", ");
  const descriptionsText = Object.entries(PET_DESCRIPTIONS)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const prompt = `You are assigning a vault pet to someone. Read their five answers and their memory vault, then assign exactly one creature that fits who they actually are.

The eight pets and what they mean:
${descriptionsText}

Their five answers:
1. When they walk into a room full of strangers: "${answers[0]}"
2. When something goes wrong, their first move: "${answers[1]}"
3. Their relationship with rules: "${answers[2]}"
4. What people underestimate about them: "${answers[3]}"
5. What they want most: "${answers[4]}"

A few things they keep in their vault:
${memoryContext}

Pick the one creature that is genuinely theirs. The rock is a valid answer. So is the unicorn. Don't pick the safe one — pick the true one.

Return ONLY a JSON object (no markdown):
{
  "pet": "one of: ${petList}",
  "reason": "2-3 sentences — speak directly as 'you', be specific to their answers, honest and a little bit funny if that's true, poetic if that's true. Don't be generic."
}`;

  let pet: string = VAULT_PETS[Math.floor(Math.random() * VAULT_PETS.length)];
  let reason = "This one found you the way most things do — quietly, and correctly.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.pet && VAULT_PETS.includes(parsed.pet)) pet = parsed.pet;
    if (parsed.reason) reason = parsed.reason;
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ vaultPet: pet, vaultPetReason: reason })
    .where(eq(accountsTable.id, accountId));

  res.json({ pet, reason });
});

// DELETE /api/quiz/pet/reset
router.delete("/quiz/pet/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable)
    .set({ vaultPet: null, vaultPetReason: null })
    .where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Haunted object quiz ───────────────────────────────────────────────────────

const HAUNTED_OBJECTS = [
  "music_box", "stopped_clock", "taxidermied_fox", "cracked_mirror",
  "unsent_letter", "compass", "portrait", "snow_globe",
] as const;

const HAUNTED_OBJECT_LABELS: Record<string, string> = {
  music_box:       "A music box that plays a song no one recognizes",
  stopped_clock:   "A clock frozen at 3:17am, warm to the touch",
  taxidermied_fox: "A taxidermied fox with knowing eyes, no provenance",
  cracked_mirror:  "A mirror reflecting a room slightly different from this one",
  unsent_letter:   "A letter never sent, addressed to someone who died",
  compass:         "A compass that doesn't point north — always the same direction",
  portrait:        "A portrait of someone who looks almost like you, dated 1887",
  snow_globe:      "A snow globe showing a town that doesn't exist",
};

// GET /api/quiz/haunted/status
router.get("/quiz/haunted/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { account } = result;
  if (account.hauntedObject) {
    res.json({ canTake: true, completed: true, object: account.hauntedObject, reason: account.hauntedObjectReason, label: HAUNTED_OBJECT_LABELS[account.hauntedObject] });
    return;
  }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/haunted/submit
router.post("/quiz/haunted/submit", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 5) {
    res.status(400).json({ error: "Exactly 5 answers required" }); return;
  }

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable).where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`).limit(10);
  const memoryContext = memories.map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`).join("\n") || "(vault is empty)";

  const objectDescriptions = Object.entries(HAUNTED_OBJECT_LABELS).map(([k, v]) => `${k}: ${v}`).join("\n");

  const prompt = `You are assigning someone their haunted object — the cursed or uncanny artifact that matches who they are.

The eight objects:
${objectDescriptions}

Their five answers:
1. What kind of presence do they leave in a room after they've gone: "${answers[0]}"
2. Their relationship with the past: "${answers[1]}"
3. What strangers find slightly unnerving about them: "${answers[2]}"
4. What they do with things they can't say: "${answers[3]}"
5. If they could haunt one thing, what would it be: "${answers[4]}"

A few things from their vault:
${memoryContext}

Pick the object that is genuinely theirs. Be specific — these are real distinctions. The taxidermied fox is not the portrait. The compass is not the clock.

Return ONLY a JSON object (no markdown):
{
  "object": "one of the object keys above",
  "reason": "2-3 sentences — speak directly as 'you', be specific to their answers, slightly eerie but affectionate, precise"
}`;

  let object: string = HAUNTED_OBJECTS[Math.floor(Math.random() * HAUNTED_OBJECTS.length)];
  let reason = "This found you the way cursed objects do — not by accident.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.object && HAUNTED_OBJECTS.includes(parsed.object)) object = parsed.object;
    if (parsed.reason) reason = parsed.reason;
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ hauntedObject: object, hauntedObjectReason: reason })
    .where(eq(accountsTable.id, accountId));

  res.json({ object, reason, label: HAUNTED_OBJECT_LABELS[object] });
});

// DELETE /api/quiz/haunted/reset
router.delete("/quiz/haunted/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable).set({ hauntedObject: null, hauntedObjectReason: null }).where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Soup quiz ─────────────────────────────────────────────────────────────────

const VAULT_SOUPS = [
  "french_onion", "miso", "minestrone", "pho",
  "clam_chowder", "gazpacho", "borscht", "tom_yum",
] as const;

const SOUP_LABELS: Record<string, string> = {
  french_onion: "French Onion",
  miso:         "Miso",
  minestrone:   "Minestrone",
  pho:          "Phở",
  clam_chowder: "Clam Chowder",
  gazpacho:     "Gazpacho",
  borscht:      "Borscht",
  tom_yum:      "Tom Yum",
};

const SOUP_DESCRIPTIONS: Record<string, string> = {
  french_onion: "Patient, deep, caramelized over a long time. The good stuff is always under the surface.",
  miso:         "Ancient, quiet, nourishing in a way that's hard to explain. Knows things without announcing them.",
  minestrone:   "A little of everything, somehow coherent. Grew up somewhere loud and loved it.",
  pho:          "The broth took all day. You need it more than you know. Aromatic, specific, layered.",
  clam_chowder: "Dense and coastal and polarizing. People either get you immediately or they don't.",
  gazpacho:     "Cold, sharp, misunderstood at first. Actually perfect for the people who deserve it.",
  borscht:      "Old, earthy, the color of something that happened long ago and mattered.",
  tom_yum:      "Hot and sour and electric. Not subtle, not for everyone, completely for some people.",
};

// GET /api/quiz/soup/status
router.get("/quiz/soup/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { account } = result;
  if (account.vaultSoup) {
    res.json({ canTake: true, completed: true, soup: account.vaultSoup, reason: account.vaultSoupReason, label: SOUP_LABELS[account.vaultSoup] });
    return;
  }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/soup/submit
router.post("/quiz/soup/submit", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 5) {
    res.status(400).json({ error: "Exactly 5 answers required" }); return;
  }

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable).where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`).limit(10);
  const memoryContext = memories.map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`).join("\n") || "(vault is empty)";

  const soupText = Object.entries(SOUP_DESCRIPTIONS).map(([k, v]) => `${k} (${SOUP_LABELS[k]}): ${v}`).join("\n");

  const prompt = `You are assigning someone their soup — the one that understands them.

The eight soups:
${soupText}

Their five answers:
1. How they feel in the morning before anyone talks to them: "${answers[0]}"
2. Their move when things get complicated: "${answers[1]}"
3. How people describe them to people who haven't met them: "${answers[2]}"
4. Their natural state: "${answers[3]}"
5. What they want from other people, actually: "${answers[4]}"

A few things from their vault:
${memoryContext}

Assign the soup that is genuinely theirs. Gazpacho is a real answer. So is borscht. Commit fully — this is important information.

Return ONLY a JSON object (no markdown):
{
  "soup": "one of the soup keys above",
  "reason": "2 sentences — speak directly as 'you', be sincere and slightly absurd about why this specific soup understands them, reference their answers"
}`;

  let soup: string = VAULT_SOUPS[Math.floor(Math.random() * VAULT_SOUPS.length)];
  let reason = "This soup has been waiting for you specifically.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.soup && VAULT_SOUPS.includes(parsed.soup)) soup = parsed.soup;
    if (parsed.reason) reason = parsed.reason;
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ vaultSoup: soup, vaultSoupReason: reason })
    .where(eq(accountsTable.id, accountId));

  res.json({ soup, reason, label: SOUP_LABELS[soup] });
});

// DELETE /api/quiz/soup/reset
router.delete("/quiz/soup/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable).set({ vaultSoup: null, vaultSoupReason: null }).where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Tarot quiz ────────────────────────────────────────────────────────────────

const TAROT_CARDS = [
  "the_fool", "the_magician", "the_high_priestess", "the_hermit",
  "the_tower", "the_star", "the_moon", "the_world",
] as const;

const TAROT_LABELS: Record<string, string> = {
  the_fool:           "The Fool",
  the_magician:       "The Magician",
  the_high_priestess: "The High Priestess",
  the_hermit:         "The Hermit",
  the_tower:          "The Tower",
  the_star:           "The Star",
  the_moon:           "The Moon",
  the_world:          "The World",
};

const TAROT_DESCRIPTIONS: Record<string, string> = {
  the_fool:           "Beginnings, the open road, leaping before you see the bottom. Carries everything in a small bundle and somehow has what's needed.",
  the_magician:       "Will, resourcefulness, making something from what's available. The tools are all on the table — the question is whether you use them.",
  the_high_priestess: "Intuition, mystery, what's known without knowing how. Doesn't explain herself. Doesn't need to.",
  the_hermit:         "Wisdom earned alone. Withdrew to understand, carries a light for others even in solitude. The path was necessary.",
  the_tower:          "Sudden revelation. Structures that had to fall. The lightning was a correction, not a punishment.",
  the_star:           "Quiet hope after everything. Renewal that doesn't announce itself. The water keeps being poured.",
  the_moon:           "The unconscious, navigation without full sight, what moves underneath. Not illusion — more honest than daylight.",
  the_world:          "Completion, integration, arrival. Not the end — the moment of having become what you were becoming.",
};

// GET /api/quiz/tarot/status
router.get("/quiz/tarot/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { account } = result;
  if ((account as any).tarotCard) {
    res.json({
      canTake: true, completed: true,
      card: (account as any).tarotCard,
      reason: (account as any).tarotCardReason,
      label: TAROT_LABELS[(account as any).tarotCard],
    });
    return;
  }
  res.json({ canTake: true, completed: false });
});

// POST /api/quiz/tarot/submit
router.post("/quiz/tarot/submit", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 5) {
    res.status(400).json({ error: "Exactly 5 answers required" }); return;
  }

  const memories = await db.select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable).where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`).limit(10);
  const memoryContext = memories.map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`).join("\n") || "(vault is empty)";

  const cardText = Object.entries(TAROT_DESCRIPTIONS).map(([k, v]) => `${k} (${TAROT_LABELS[k]}): ${v}`).join("\n");

  const prompt = `You are assigning someone their Major Arcana card — the one that is genuinely theirs.

The eight cards:
${cardText}

Their five answers:
1. What they do with the thing they can't let go of: "${answers[0]}"
2. Their most honest relationship is with: "${answers[1]}"
3. What change feels like when it finally comes: "${answers[2]}"
4. The thing they protect most carefully: "${answers[3]}"
5. When something is over, they: "${answers[4]}"

A few things from their vault:
${memoryContext}

Assign the card that is genuinely theirs. The Hermit is not The Moon. The Tower is not The Star. These are precise distinctions — commit fully.

Return ONLY a JSON object (no markdown):
{
  "card": "one of the card keys above",
  "reason": "2-3 sentences — speak directly as 'you', be specific to their answers, read them accurately, no generic mysticism"
}`;

  let card: string = TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)];
  let reason = "The deck was certain. It often is.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.card && TAROT_CARDS.includes(parsed.card as any)) card = parsed.card;
    if (parsed.reason) reason = parsed.reason;
  } catch { /* fallback */ }

  await db.update(accountsTable)
    .set({ tarotCard: card, tarotCardReason: reason } as any)
    .where(eq(accountsTable.id, accountId));

  res.json({ card, reason, label: TAROT_LABELS[card] });
});

// DELETE /api/quiz/tarot/reset
router.delete("/quiz/tarot/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable).set({ tarotCard: null, tarotCardReason: null } as any).where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

// ── Signal mapping quiz ───────────────────────────────────────────────────────

const SIGNALS = {
  beacon: {
    label: "Beacon",
    glyph: "◈",
    color: "#f2c46d",
    meaning: "You make the hidden easier to find. Your presence does not demand attention; it gives other things a place to become visible.",
  },
  echo: {
    label: "Echo",
    glyph: "◌",
    color: "#b8a0ff",
    meaning: "You carry things forward. What reaches you is changed by being held, then returned with more depth than it arrived with.",
  },
  pulse: {
    label: "Pulse",
    glyph: "⟡",
    color: "#ff83b5",
    meaning: "You are felt before you are understood. Your signal is alive, rhythmic, and unmistakably present even in a quiet room.",
  },
  flare: {
    label: "Flare",
    glyph: "✧",
    color: "#ff9a62",
    meaning: "You know how to break through. When something matters, you send enough light to cross the distance and refuse to be mistaken for silence.",
  },
  static: {
    label: "Static",
    glyph: "⁘",
    color: "#83c8d8",
    meaning: "You notice what other people filter out. The noise is not emptiness; it is a field of small, meaningful changes waiting to resolve.",
  },
  signal_fire: {
    label: "Signal Fire",
    glyph: "⌁",
    color: "#e58b6d",
    meaning: "You are a promise that someone is still there. Your signal is warm, persistent, and built to be seen across a long distance.",
  },
} as const;

const SIGNAL_KEYS = Object.keys(SIGNALS) as Array<keyof typeof SIGNALS>;

router.get("/quiz/signal/status", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const signal = result.account.signalType as keyof typeof SIGNALS | null;
  if (signal && SIGNALS[signal]) {
    res.json({
      canTake: true,
      completed: true,
      signal,
      ...SIGNALS[signal],
      reason: result.account.signalReason ?? null,
    });
    return;
  }
  res.json({ canTake: true, completed: false });
});

router.post("/quiz/signal/submit", async (req, res): Promise<void> => {
  const result = await canAccessQuiz(req, res);
  if (!result) return;
  const { accountId } = result;
  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== 5 || answers.some((answer: unknown) => typeof answer !== "string" || answer.length > 1000)) {
    res.status(400).json({ error: "Exactly 5 answers required" });
    return;
  }

  const memories = await db
    .select({ title: memoriesTable.title, content: memoriesTable.content })
    .from(memoriesTable)
    .where(eq(memoriesTable.accountId, accountId))
    .orderBy(sql`created_at DESC`)
    .limit(10);
  const memoryContext = memories.map(m => `- ${m.title}: ${(m.content ?? "").slice(0, 150)}`).join("\n") || "(vault is empty)";
  const signalText = SIGNAL_KEYS.map(key => `${key} (${SIGNALS[key].label}): ${SIGNALS[key].meaning}`).join("\n");

  const prompt = `You are assigning a person the small signal glyph that will sit beside their name in a memory vault.

The six signal archetypes:
${signalText}

Their five answers:
1. When you want someone to know you are still here, what do you do? "${answers[0]}"
2. What kind of thing do you notice first in a room? "${answers[1]}"
3. When your thoughts get loud, what helps them resolve? "${answers[2]}"
4. What do you send into the future? "${answers[3]}"
5. What should your little mark feel like when someone sees it? "${answers[4]}"

A few things from their vault:
${memoryContext}

Choose one precise signal. Return ONLY JSON:
{"signal":"one of ${SIGNAL_KEYS.join(", ")}","reason":"2-3 sentences, speak directly as you, specific and warm, no generic personality language"}`;

  let signal: keyof typeof SIGNALS = SIGNAL_KEYS[Math.floor(Math.random() * SIGNAL_KEYS.length)];
  let reason = "Your signal was already there. The quiz only gave it a name.";
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 384,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.signal === "string" && SIGNAL_KEYS.includes(parsed.signal)) signal = parsed.signal;
    if (typeof parsed.reason === "string" && parsed.reason.trim()) reason = parsed.reason.trim();
  } catch {
    // The deterministic fallback still gives every account a complete result.
  }

  await db.update(accountsTable)
    .set({ signalType: signal, signalReason: reason } as any)
    .where(eq(accountsTable.id, accountId));

  res.json({ signal, ...SIGNALS[signal], reason });
});

router.delete("/quiz/signal/reset", async (req, res): Promise<void> => {
  const accountId = (req as any).session?.accountId;
  if (!accountId) { res.status(401).json({ error: "Not authenticated" }); return; }
  await db.update(accountsTable)
    .set({ signalType: null, signalReason: null } as any)
    .where(eq(accountsTable.id, accountId));
  res.json({ ok: true });
});

export default router;
