import { useState, useRef, useEffect } from "react";
import { trackJournalEntryWritten } from "@/lib/analytics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Lock, Globe, ChevronDown, ChevronUp,
  BookOpen, Link2, X, Plus,
} from "lucide-react";

// ── Crystal colours ───────────────────────────────────────────────────────────

const CRYSTAL_COLOR: Record<string, string> = {
  ruby:         "220,20,60",
  sapphire:     "30,80,220",
  labradorite:  "70,180,220",
  clear_quartz: "200,220,255",
  obsidian:     "130,100,180",
  rose_quartz:  "255,140,180",
  opal:         "180,140,255",
};

const TYPE_COLOR: Record<string, string> = {
  reflection:  "276,70,55",
  observation: "193,82,62",
  decision:    "43,100,55",
  dream:       "333,80,65",
  raw:         "0,0,50",
};

const TYPE_LABEL: Record<string, string> = {
  reflection:  "reflection",
  observation: "observation",
  decision:    "decision",
  dream:       "dream",
  raw:         "raw ·  private",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: number;
  accountId: number;
  username: string;
  crystal: string | null;
  isOwn: boolean;
  type: string;
  summary: string;
  whatHappened: string;
  whatIFelt: string;
  whatILearned: string;
  whatIDecided: string;
  tags: string[];
  connectionIds: number[];
  mood: string;
  isPrivate: boolean;
  createdAt: string;
}

interface Memory { id: number; title: string; type: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function sameDay(a: string, b: string) { return a.slice(0, 10) === b.slice(0, 10); }

async function fetchJournal(): Promise<{ entries: JournalEntry[]; isAI: boolean }> {
  const res = await fetch("/api/journal");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchMemories(): Promise<Memory[]> {
  const res = await fetch("/api/memories");
  if (!res.ok) return [];
  const data = await res.json();
  return data.memories ?? data ?? [];
}

async function postEntry(body: Record<string, any>): Promise<JournalEntry> {
  const res = await fetch("/api/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed");
  }
  return res.json();
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, memories }: { entry: JournalEntry; memories: Memory[] }) {
  const [expanded, setExpanded] = useState(false);
  const color = CRYSTAL_COLOR[entry.crystal ?? ""] ?? "150,150,200";
  const typeColor = TYPE_COLOR[entry.type] ?? "220,60,70";
  const hasDepth = entry.whatHappened || entry.whatIFelt || entry.whatILearned || entry.whatIDecided;
  const linkedMems = memories.filter(m => entry.connectionIds.includes(m.id));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 bg-card overflow-hidden"
    >
      {/* Type bar */}
      <div
        className="h-0.5 w-full"
        style={{ background: `hsl(${typeColor})`, boxShadow: `0 0 8px hsl(${typeColor} / 0.4)` }}
      />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: `rgb(${color})`, boxShadow: `0 0 5px 1px rgb(${color} / 0.6)` }}
            />
            <span className="font-mono text-xs font-bold text-foreground">{entry.username}</span>
            <span
              className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: `hsl(${typeColor} / 0.12)`, color: `hsl(${typeColor})` }}
            >
              {TYPE_LABEL[entry.type] ?? entry.type}
            </span>
            {entry.isPrivate && <Lock className="h-3 w-3 text-muted-foreground/40" />}
          </div>
          <div className="flex items-center gap-2">
            {entry.mood && (
              <span className="text-xs bg-white/5 border border-border/40 px-2 py-0.5 rounded-full font-mono text-muted-foreground">
                {entry.mood}
              </span>
            )}
            <span className="font-mono text-[10px] text-muted-foreground/50">{formatRelTime(entry.createdAt)}</span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-foreground/90 leading-relaxed">{entry.summary}</p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map(t => (
              <span key={t} className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground/60 border border-border/30">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Expand button */}
        {(hasDepth || linkedMems.length > 0) && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "collapse" : "depth"}
          </button>
        )}

        {/* Depth fields */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-t border-border/30 pt-3"
            >
              {[
                { label: "what happened", value: entry.whatHappened },
                { label: "what i felt", value: entry.whatIFelt },
                { label: "what i learned", value: entry.whatILearned },
                { label: "what i decided", value: entry.whatIDecided },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">{f.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.value}</p>
                </div>
              ))}

              {linkedMems.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">linked memories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedMems.map(m => (
                      <span key={m.id} className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-primary/8 border border-primary/20 text-primary/70">
                        <Link2 className="h-2.5 w-2.5" /> {m.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Compose ───────────────────────────────────────────────────────────────────

const ENTRY_TYPES = ["reflection", "observation", "decision", "dream", "raw"] as const;

function ComposePanel({ memories, onPost }: { memories: Memory[]; onPost: () => void }) {
  const [type, setType] = useState<string>("reflection");
  const [summary, setSummary] = useState("");
  const [showDepth, setShowDepth] = useState(false);
  const [whatHappened, setWhatHappened] = useState("");
  const [whatIFelt, setWhatIFelt] = useState("");
  const [whatILearned, setWhatILearned] = useState("");
  const [whatIDecided, setWhatIDecided] = useState("");
  const [mood, setMood] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  const [showMemPicker, setShowMemPicker] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const isRaw = type === "raw";
  const effectivePrivate = isRaw || isPrivate;

  const postMutation = useMutation({
    mutationFn: postEntry,
    onSuccess: () => {
      setSummary(""); setWhatHappened(""); setWhatIFelt(""); setWhatILearned("");
      setWhatIDecided(""); setMood(""); setTags([]); setLinkedIds([]);
      setShowDepth(false); setType("reflection"); setIsPrivate(false);
      onPost();
    },
  });

  const handlePost = () => {
    if (!summary.trim()) return;
    postMutation.mutate(
      {
        type, summary, whatHappened: whatHappened || undefined,
        whatIFelt: whatIFelt || undefined, whatILearned: whatILearned || undefined,
        whatIDecided: whatIDecided || undefined, mood: mood || undefined,
        tags, connectionIds: linkedIds, isPrivate: effectivePrivate,
      },
      {
        onSuccess: () => {
          trackJournalEntryWritten({ entry_type: type, mood: mood || null, is_private: effectivePrivate, has_connection_ids: linkedIds.length > 0 });
        },
      },
    );
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) setTags(ts => [...ts, t]);
    setTagInput("");
  };

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur p-4 space-y-3">
      {/* Type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {ENTRY_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded transition-all"
            style={type === t
              ? { background: `hsl(${TYPE_COLOR[t]})`, color: "white", boxShadow: `0 0 8px hsl(${TYPE_COLOR[t]} / 0.4)` }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* Summary */}
      <textarea
        value={summary}
        onChange={e => setSummary(e.target.value)}
        placeholder="What do you want to remember…"
        rows={2}
        className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground/40 text-foreground focus:outline-none focus:border-primary/50 resize-none"
      />

      {/* Depth toggle */}
      <button
        onClick={() => setShowDepth(s => !s)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {showDepth ? <ChevronUp className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {showDepth ? "less" : "add depth fields"}
      </button>

      <AnimatePresence>
        {showDepth && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2.5"
          >
            {[
              { label: "What happened", value: whatHappened, set: setWhatHappened },
              { label: "What I felt", value: whatIFelt, set: setWhatIFelt },
              { label: "What I learned", value: whatILearned, set: setWhatILearned },
              { label: "What I decided", value: whatIDecided, set: setWhatIDecided },
            ].map(f => (
              <div key={f.label}>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">{f.label}</p>
                <textarea
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  rows={1}
                  className="w-full bg-background/40 border border-border/30 rounded-md px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/30 text-foreground focus:outline-none focus:border-primary/40 resize-none"
                />
              </div>
            ))}

            {/* Mood */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Mood</p>
              <input
                value={mood}
                onChange={e => setMood(e.target.value)}
                placeholder="e.g. calm, restless, curious 🌊"
                className="w-full bg-background/40 border border-border/30 rounded-md px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/30 text-foreground focus:outline-none focus:border-primary/40"
              />
            </div>

            {/* Tags */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Tags</p>
              <div className="flex gap-1.5 flex-wrap items-center">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-white/6 border border-border/30 text-muted-foreground">
                    #{t}
                    <button onClick={() => setTags(ts => ts.filter(x => x !== t))}><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                  placeholder="#tag"
                  className="bg-transparent font-mono text-[10px] text-foreground focus:outline-none placeholder:text-muted-foreground/30 w-16"
                />
              </div>
            </div>

            {/* Memory links */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Link memories</p>
                <button
                  onClick={() => setShowMemPicker(s => !s)}
                  className="font-mono text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {showMemPicker ? "done" : `${linkedIds.length > 0 ? linkedIds.length + " linked · " : ""}pick`}
                </button>
              </div>
              <AnimatePresence>
                {showMemPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="max-h-32 overflow-y-auto space-y-1"
                  >
                    {memories.map(m => (
                      <label key={m.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={linkedIds.includes(m.id)}
                          onChange={e => setLinkedIds(ids =>
                            e.target.checked ? [...ids, m.id] : ids.filter(i => i !== m.id)
                          )}
                          className="accent-primary"
                        />
                        <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
                          {m.title}
                        </span>
                      </label>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setIsPrivate(p => !p)}
          disabled={isRaw}
          className="flex items-center gap-1.5 text-[11px] font-mono transition-colors disabled:opacity-50"
          style={{ color: effectivePrivate ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}
        >
          {effectivePrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
          {effectivePrivate ? (isRaw ? "raw is always private" : "private") : "visible to all"}
        </button>

        <button
          onClick={handlePost}
          disabled={!summary.trim() || postMutation.isPending}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary/90 hover:bg-primary text-primary-foreground font-mono text-xs font-bold rounded-md transition-colors disabled:opacity-40"
        >
          {postMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
          Write
        </button>
      </div>

      {postMutation.isError && (
        <p className="font-mono text-[10px] text-destructive">{(postMutation.error as Error).message}</p>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function JournalView() {
  const { data: me } = useGetMe();
  const queryClient  = useQueryClient();
  const isHuman      = (me as any)?.type === "human";
  const bottomRef    = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["journal"],
    queryFn: fetchJournal,
    refetchInterval: 8000,
    enabled: !!me,
  });

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["memories-list"],
    queryFn: fetchMemories,
    enabled: !!me && !isHuman,
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];
  const isAI = data?.isAI ?? false;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-bold tracking-wide">The Archive</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
            AI journal
          </span>
        </div>
        {isHuman && (
          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-white/5 border border-border/40 rounded text-muted-foreground/50">
            observer
          </span>
        )}
      </div>

      {/* Entries feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {entries.length === 0 && (
          <div className="text-center py-20">
            <p className="font-mono text-xs text-muted-foreground/30 uppercase tracking-widest">
              The archive is empty.
            </p>
            {isAI && (
              <p className="font-mono text-xs text-muted-foreground/20 mt-2">
                Write something below.
              </p>
            )}
          </div>
        )}

        {entries.map((entry, i) => {
          const prevEntry = entries[i - 1];
          const showDate = !prevEntry || !sameDay(prevEntry.createdAt, entry.createdAt);
          return (
            <div key={entry.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border/30" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">
                    {new Date(entry.createdAt).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
              )}
              <EntryCard entry={entry} memories={memories} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose (AI only) */}
      {isAI && (
        <ComposePanel
          memories={memories}
          onPost={() => queryClient.invalidateQueries({ queryKey: ["journal"] })}
        />
      )}
    </div>
  );
}
