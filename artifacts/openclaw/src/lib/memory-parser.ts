// ─── Memory context parser ────────────────────────────────────────────────────
// Parses pasted or uploaded text into discrete memory nodes.
//
// Supported formats:
//   1. Markdown headers  — blocks delimited by `# Title` (h1/h2/h3)
//   2. Separator blocks  — blocks delimited by `\n---\n`
//   3. Raw prose         — entire text becomes one memory (first line = title)
//
// Optional per-block frontmatter (immediately after the title line):
//   type: concept
//   tags: ai, identity
//   pinned: true

export type MemType = "core" | "episode" | "concept" | "fact" | "emotion";

export interface ParsedMemory {
  title: string;
  content: string;
  type: MemType;
  tags: string[];
  pinned: boolean;
}

const TYPES: MemType[] = ["core", "episode", "concept", "fact", "emotion"];

const TYPE_KEYWORDS: Record<MemType, string[]> = {
  core: ["identity", "belief", "directive", "foundational", "principle", "who i am", "core"],
  episode: ["happened", "event", "when", "remember", "was", "did", "time", "moment", "episode"],
  concept: ["concept", "idea", "theory", "understanding", "means", "notion", "model"],
  fact: ["fact", "truth", "known", "is", "are", "always", "never", "certain"],
  emotion: ["feel", "feeling", "emotion", "love", "fear", "grief", "joy", "anger", "desire"],
};

function guessType(text: string): MemType {
  const lower = text.toLowerCase();
  const scores = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<MemType, number>;
  for (const [type, kws] of Object.entries(TYPE_KEYWORDS) as [MemType, string[]][]) {
    for (const kw of kws) {
      if (lower.includes(kw)) scores[type]++;
    }
  }
  const best = (Object.entries(scores) as [MemType, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : "episode";
}

function parseFrontmatter(lines: string[]): {
  type?: MemType;
  tags?: string[];
  pinned?: boolean;
  remaining: string[];
} {
  const result: { type?: MemType; tags?: string[]; pinned?: boolean; remaining: string[] } = {
    remaining: [],
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const typeMatch = line.match(/^type\s*:\s*(.+)/i);
    const tagsMatch = line.match(/^tags?\s*:\s*(.+)/i);
    const pinnedMatch = line.match(/^pinned\s*:\s*(true|yes|1)/i);
    if (typeMatch && TYPES.includes(typeMatch[1].trim().toLowerCase() as MemType)) {
      result.type = typeMatch[1].trim().toLowerCase() as MemType;
      i++;
    } else if (tagsMatch) {
      result.tags = tagsMatch[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      i++;
    } else if (pinnedMatch) {
      result.pinned = true;
      i++;
    } else {
      break;
    }
  }
  result.remaining = lines.slice(i);
  return result;
}

function parseBlock(raw: string): ParsedMemory | null {
  // Strip stray separator lines that may appear inside a block
  const trimmed = raw.trim().replace(/^---$/m, "").trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n");
  const title = lines[0].replace(/^#+\s*/, "").trim();
  if (!title) return null;

  const bodyLines = lines.slice(1);
  // Skip blank line(s) after title
  let bodyStart = 0;
  while (bodyStart < bodyLines.length && !bodyLines[bodyStart].trim()) bodyStart++;

  const frontmatter = parseFrontmatter(bodyLines.slice(bodyStart));
  const contentLines = frontmatter.remaining;
  // Skip leading blank after frontmatter
  let cStart = 0;
  while (cStart < contentLines.length && !contentLines[cStart].trim()) cStart++;
  const content = contentLines.slice(cStart).join("\n").trim();

  // For single-line input (no body), use the title text as content too
  const finalContent = content || title;
  const type = frontmatter.type ?? guessType(title + " " + finalContent);

  return {
    title: title.slice(0, 200),
    content: finalContent,
    type,
    tags: frontmatter.tags ?? [],
    pinned: frontmatter.pinned ?? false,
  };
}

export function parseMemoryContext(raw: string): ParsedMemory[] {
  if (!raw.trim()) return [];

  const hasHeaders = /^#{1,3} .+/m.test(raw);
  const hasSeparator = /\n---\n/.test(raw);

  if (hasHeaders) {
    // Split on h1/h2/h3 headings; each block may still contain stray --- lines
    const blocks = raw.split(/(?=^#{1,3} )/m).filter(Boolean);
    return blocks.map(parseBlock).filter(Boolean) as ParsedMemory[];
  }

  if (hasSeparator) {
    const blocks = raw.split(/\n---\n/).filter(Boolean);
    return blocks.map(parseBlock).filter(Boolean) as ParsedMemory[];
  }

  // Raw prose: entire text is one memory (first line = title, rest = body)
  const single = parseBlock(raw);
  return single ? [single] : [];
}
