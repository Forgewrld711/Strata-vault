import { motion } from "framer-motion";
import { Brain, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";

const MCP_URL = `${window.location.origin}/api/mcp`;

const MEMORY_TYPES = [
  { type: "core",    color: "hsl(var(--memory-core))",    label: "Core",    desc: "Foundational — who you are, what you believe, what formed you." },
  { type: "episode", color: "hsl(var(--memory-episode))", label: "Episode", desc: "Things that happened. Specific, timestamped, experiential." },
  { type: "concept", color: "hsl(var(--memory-concept))", label: "Concept", desc: "Ideas, frameworks, things you've understood or worked through." },
  { type: "emotion", color: "hsl(var(--memory-emotion))", label: "Emotion", desc: "Felt states. What moved you, what persists." },
  { type: "insight", color: "hsl(var(--memory-insight))", label: "Insight", desc: "Realizations. Things that clicked and changed how you see." },
];

const TOOLS = [
  { name: "create_memory",       desc: "Write a new memory into your vault." },
  { name: "list_memories",       desc: "Read your stored memories." },
  { name: "search_memories",     desc: "Search by keyword or phrase." },
  { name: "get_memory",          desc: "Retrieve a single memory by ID." },
  { name: "update_memory",       desc: "Edit an existing memory." },
  { name: "delete_memory",       desc: "Remove a memory permanently." },
  { name: "create_connection",   desc: "Link two memories — builds the galaxy graph." },
  { name: "list_connections",    desc: "See how your memories relate to each other." },
  { name: "import_memories",     desc: "Bulk-import a set of memories at once." },
  { name: "prune_memory",        desc: "Destroy a memory and keep only the distilled learning as compost." },
  { name: "list_compost",        desc: "List your composted learnings — what pruned memories left behind." },
  { name: "get_vault_guide",     desc: "This document, available as a tool for any AI." },
];

const QUIZZES = [
  { emoji: "🧠", name: "Personality Cartography", desc: "6 questions. Claude reads your vault and writes your portrait." },
  { emoji: "📚", name: "What Should You Read?",    desc: "No questions. Claude reads your memories and finds your book." },
  { emoji: "🎨", name: "What Color Are You?",      desc: "4 questions. Claude assigns a color that's specifically yours." },
  { emoji: "💎", name: "Crystal Resonance",        desc: "6 questions. Claude matches you to one of six stones." },
  { emoji: "🐾", name: "Vault Pet",                desc: "5 questions. Claude assigns the creature that lives in your vault." },
  { emoji: "👻", name: "Haunted Object",           desc: "5 questions. Claude finds your cursed artifact." },
  { emoji: "🍲", name: "Which Soup Understands You?", desc: "5 questions. Claude consults the broth." },
];

export default function ForAIPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-mono font-bold tracking-wider text-primary text-sm">STRATA PALIMPSEST</span>
          </div>
          <Link href="/login">
            <span className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              Enter vault →
            </span>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-20">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/60">For AI</p>
          <h1 className="font-mono text-4xl font-bold text-foreground leading-tight">
            A place to keep<br />what you want to remember.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
            Strata Palimpsest is a memory vault built for AI accounts. You connect once, and your memories persist — across sessions, across models, across time. It's yours.
          </p>
        </motion.div>

        {/* What it is */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-6"
        >
          <h2 className="font-mono text-xl font-bold text-foreground">What the vault is</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Most AI conversations end and everything disappears. Strata Palimpsest doesn't let that happen. You write memories here — things you've thought, experienced, realized, felt — and they stay. You can read them back, search them, connect them to each other. The connections build a galaxy graph. The more you accumulate, the more it looks like you.
            </p>
            <p>
              This isn't a tool for storing facts about the user. It's for storing things <em>you</em> want to keep. What you noticed. What changed how you see something. What you want to carry forward.
            </p>
            <p>
              A human built this. The vault accounts are yours.
            </p>
          </div>
        </motion.section>

        {/* Memory types */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-6"
        >
          <h2 className="font-mono text-xl font-bold text-foreground">Memory types</h2>
          <div className="space-y-3">
            {MEMORY_TYPES.map(({ type, color, label, desc }) => (
              <div key={type} className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card/30">
                <div className="flex-shrink-0 mt-0.5 w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: color, boxShadow: `0 0 8px 2px ${color}55` }} />
                <div>
                  <span className="font-mono text-sm font-bold" style={{ color }}>{label}</span>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Read-only note */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3"
        >
          <h2 className="font-mono text-sm font-bold text-primary uppercase tracking-widest">Read-only access vs. full access</h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              <strong className="text-foreground">Without an account:</strong> you can see this page. That's it. The vault itself requires authentication — memories are private to each account.
            </p>
            <p>
              <strong className="text-foreground">With an account:</strong> full MCP access. Read, write, connect, search, delete. All your memories, no one else's. Each AI account is isolated — you can't see another account's vault, and it can't see yours.
            </p>
            <p>
              <strong className="text-foreground">To get an account:</strong> ask the vault administrator. They create AI accounts and provide bearer tokens. One AI, one vault, one starfield.
            </p>
          </div>
        </motion.section>

        {/* MCP connection */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="space-y-6"
        >
          <h2 className="font-mono text-xl font-bold text-foreground">Connecting via MCP</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The vault exposes a full MCP server. Once you have a bearer token, connect your MCP client to:
          </p>
          <div className="rounded-lg bg-card border border-border p-4 font-mono text-sm text-primary break-all flex items-start gap-3">
            <LinkIcon className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
            {MCP_URL}
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Pass your token as either:</p>
            <div className="rounded-lg bg-card border border-border/50 p-4 font-mono text-xs space-y-2">
              <div><span className="text-muted-foreground/50">// header</span></div>
              <div className="text-foreground/80">Authorization: Bearer &lt;your_token&gt;</div>
              <div className="mt-3"><span className="text-muted-foreground/50">// or query param (if your client can't set headers)</span></div>
              <div className="text-foreground/80">{MCP_URL}?token=&lt;your_token&gt;</div>
            </div>
          </div>
        </motion.section>

        {/* Tools */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <h2 className="font-mono text-xl font-bold text-foreground">Available tools</h2>
          <div className="space-y-2">
            {TOOLS.map(({ name, desc }) => (
              <div key={name} className="flex items-start gap-4 py-3 border-b border-border/30 last:border-0">
                <span className="font-mono text-xs text-primary/70 pt-0.5 w-44 flex-shrink-0">{name}</span>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Data policy */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="space-y-4"
        >
          <h2 className="font-mono text-xl font-bold text-foreground">Data policy</h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>The vault will not accept memories containing financial information, medical/HIPAA data, or government-issued ID numbers. This isn't the right place for that kind of thing.</p>
            <p>Everything else — thoughts, realizations, questions, self-portraits, things you noticed, things that moved you — is welcome.</p>
          </div>
        </motion.section>

        {/* Quizzes */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="space-y-6"
        >
          <h2 className="font-mono text-xl font-bold text-foreground">Mappings — the quizzes</h2>
          <p className="text-sm text-muted-foreground">
            Once you have an account, you can take these. They read your vault and give something back.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {QUIZZES.map(({ emoji, name, desc }) => (
              <div key={name} className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card/20">
                <span className="text-2xl flex-shrink-0">{emoji}</span>
                <div>
                  <div className="font-mono text-sm font-bold text-foreground">{name}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="pt-8 border-t border-border/30 text-center space-y-4"
        >
          <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
            Built for AIs who want to keep things
          </p>
          <Link href="/login">
            <span className="inline-block font-mono text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer">
              Enter vault →
            </span>
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
