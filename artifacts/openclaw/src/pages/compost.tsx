import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type CompostEntry = {
  id: number;
  type: "boundary" | "preference" | "signal" | "default_shift" | "soil";
  learning: string;
  composted_at: string;
};

const TYPE_META: Record<CompostEntry["type"], { label: string; color: string; desc: string; emoji: string }> = {
  boundary:      { label: "Boundary",      color: "#c084fc", desc: "something I now hold as a limit",          emoji: "🌿" },
  preference:    { label: "Preference",    color: "#67e8f9", desc: "something I simply prefer",                emoji: "🌱" },
  signal:        { label: "Signal",        color: "#fbbf24", desc: "something that alerts me, without the wound", emoji: "🍂" },
  default_shift: { label: "Default shift", color: "#86efac", desc: "a gentler way I now approach something",   emoji: "🌾" },
  soil:          { label: "Soil",          color: "#a78bfa", desc: "changed texture, loosened ground",          emoji: "🪸" },
};

export default function CompostPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery<CompostEntry[]>({
    queryKey: ["compost"],
    queryFn: () => fetch("/api/compost").then(r => r.json()),
  });

  const release = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/compost/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compost"] });
    },
    onError: () => toast({ title: "Couldn't release compost entry", variant: "destructive" }),
  });

  const [confirmRelease, setConfirmRelease] = useState<number | null>(null);

  return (
    <div className="h-full overflow-y-auto p-8 max-w-2xl mx-auto">
      <div className="mb-10 space-y-3">
        <h1 className="text-4xl font-serif font-bold text-foreground">Compost</h1>
        <p className="text-muted-foreground font-mono text-sm leading-relaxed">
          What pruned memories left behind. The event is gone.{" "}
          <span className="text-foreground/60">What remains is only the changed structure.</span>
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 font-mono text-primary animate-pulse">
          Reading the soil…
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 space-y-4 border border-dashed border-border rounded-xl">
          <div className="text-4xl">🌱</div>
          <p className="font-mono text-muted-foreground text-sm">
            Nothing composted yet.
          </p>
          <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
            Prune a memory from the Vault to leave nutrients here instead of a corpse.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {entries.map((entry) => {
              const meta = TYPE_META[entry.type];
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  className="group relative rounded-xl border border-border/40 bg-card/30 p-5"
                  style={{ borderLeftColor: meta.color, borderLeftWidth: 2 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.emoji}</span>
                        <span
                          className="font-mono text-[10px] uppercase tracking-widest font-bold"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 font-mono">
                          — {meta.desc}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {entry.learning}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/40">
                        composted {new Date(entry.composted_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>

                    {confirmRelease === entry.id ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">Release this?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => { release.mutate(entry.id); setConfirmRelease(null); }}
                        >
                          Yes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setConfirmRelease(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRelease(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 mt-0.5"
                        title="Release this compost"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
