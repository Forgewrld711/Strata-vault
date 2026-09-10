import { useListMemories, ListMemoriesType, Memory } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Search, Tag as TagIcon, Calendar, ArrowRight, Zap, Sprout, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";

const TYPE_COLORS = {
  core: "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact: "var(--memory-fact)",
  emotion: "var(--memory-emotion)"
};

type CompostResult = { id: number; type: string; learning: string; composted_at: string };

export default function VaultView() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ListMemoriesType | "all">("all");

  const { data: memories, isLoading } = useListMemories({
    q: search || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  return (
    <div className="h-full flex flex-col p-8 max-w-6xl mx-auto">
      <div className="mb-8 space-y-4">
        <h1 className="text-4xl font-serif font-bold text-foreground">Memory Vault</h1>
        <p className="text-muted-foreground font-mono">Cataloging structural, episodic, and emotional data fragments.</p>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10 bg-card border-border font-mono h-12 text-lg focus-visible:ring-primary shadow-inner"
            placeholder="Search memory contents, titles, or #tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            className="font-mono text-xs uppercase"
            onClick={() => setTypeFilter("all")}
          >
            All
          </Button>
          {(["core", "episode", "concept", "fact", "emotion"] as const).map(type => (
            <Button
              key={type}
              variant="outline"
              className="font-mono text-xs uppercase transition-all"
              style={{
                borderColor: typeFilter === type ? `hsl(${TYPE_COLORS[type]})` : undefined,
                color: typeFilter === type ? `hsl(${TYPE_COLORS[type]})` : undefined,
                backgroundColor: typeFilter === type ? `hsl(${TYPE_COLORS[type]} / 0.1)` : undefined,
              }}
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-2 font-mono text-primary animate-pulse">
            <span>[</span><span>SEARCHING</span><span>]</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-20">
          {memories?.length === 0 ? (
            <div className="text-center py-20 font-mono text-muted-foreground border border-dashed border-border rounded-xl">
              No matching records found in the vault.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memories?.map(memory => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ memory }: { memory: Memory }) {
  const color = TYPE_COLORS[memory.type];
  const [pruning, setPruning] = useState<"idle" | "confirm" | "working" | "done">("idle");
  const [compostResult, setCompostResult] = useState<CompostResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const prune = useMutation({
    mutationFn: () =>
      fetch("/api/compost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId: memory.id }),
      }).then(async r => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
        return r.json() as Promise<CompostResult>;
      }),
    onSuccess: (result) => {
      setCompostResult(result);
      setPruning("done");
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      queryClient.invalidateQueries({ queryKey: ["compost"] });
    },
    onError: () => {
      setPruning("idle");
      toast({ title: "Couldn't prune this memory", description: "The memory has not been changed.", variant: "destructive" });
    },
  });

  if (dismissed) return null;

  // After successful compost — show the result card, then let user dismiss
  if (pruning === "done" && compostResult) {
    const TYPE_EMOJI: Record<string, string> = {
      boundary: "🌿", preference: "🌱", signal: "🍂", default_shift: "🌾", soil: "🪸",
    };
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="h-full p-5 rounded-xl border border-green-900/40 bg-green-950/20 flex flex-col gap-3 relative"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-green-400/70">
            {TYPE_EMOJI[compostResult.type] ?? "🌱"} composted
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed italic">{compostResult.learning}</p>
        <p className="text-[10px] font-mono text-muted-foreground/40">Memory is gone. The learning remains.</p>
      </motion.div>
    );
  }

  return (
    <div className="group block h-full p-5 rounded-xl bg-card border border-border hover:border-white/20 transition-all duration-300 relative overflow-hidden flex flex-col"
      style={{ '--hover-glow': color } as React.CSSProperties}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br from-[hsl(var(--hover-glow))] to-transparent pointer-events-none" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <Badge variant="outline" className="font-mono text-[10px] uppercase border-white/10 bg-background/50" style={{ color: `hsl(${color})` }}>
          {memory.type}
        </Badge>
        {memory.pinned && <Zap className="h-4 w-4" style={{ color: `hsl(${color})` }} />}
      </div>

      <Link href={`/memories/${memory.id}`}>
        <h3 className="text-lg font-serif font-bold text-foreground mb-2 line-clamp-2 group-hover:text-[hsl(var(--hover-glow))] transition-colors relative z-10 cursor-pointer">
          {memory.title}
        </h3>

        <p className="text-sm text-muted-foreground font-sans line-clamp-3 mb-6 flex-1 relative z-10">
          {memory.content}
        </p>
      </Link>

      <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground relative z-10">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(memory.createdAt).toLocaleDateString()}
        </div>

        <div className="flex items-center gap-2">
          {/* Prune button */}
          {pruning === "idle" && (
            <button
              onClick={(e) => { e.preventDefault(); setPruning("confirm"); }}
              className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity flex items-center gap-1 text-green-700 hover:text-green-400"
              title="Prune this memory — keep the learning, release the event"
            >
              <Sprout className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase">Prune</span>
            </button>
          )}
          {pruning === "confirm" && (
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Compost this?</span>
              <button
                onClick={(e) => { e.preventDefault(); setPruning("working"); prune.mutate(); }}
                className="text-[10px] text-green-400 hover:text-green-300 font-bold uppercase"
              >
                Yes
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setPruning("idle"); }}
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground uppercase"
              >
                No
              </button>
            </span>
          )}
          {pruning === "working" && (
            <span className="text-[10px] font-mono text-green-400/60 animate-pulse">Composting…</span>
          )}

          <Link href={`/memories/${memory.id}`}>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300 text-[hsl(var(--hover-glow))]">
              <span className="uppercase text-[10px]">Open</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* Confirm overlay */}
      <AnimatePresence>
        {pruning === "confirm" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-4 z-20 p-6 text-center"
          >
            <Sprout className="h-8 w-8 text-green-500" />
            <div className="space-y-1.5">
              <p className="font-mono text-sm font-bold text-foreground">Prune this memory?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The event is released. Claude extracts only what it taught — a boundary, preference, signal, or shift — and stores that in Compost. No reconstruction possible.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-600 text-white font-mono text-xs"
                onClick={() => { setPruning("working"); prune.mutate(); }}
              >
                Compost it
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="font-mono text-xs"
                onClick={() => setPruning("idle")}
              >
                Keep it
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
