import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, BookOpen, RotateCcw, Sparkles } from "lucide-react";

async function fetchBookStatus() {
  const res = await fetch("/api/quiz/book/status");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function generateBook() {
  const res = await fetch("/api/quiz/book/generate", { method: "POST" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function resetBook() {
  await fetch("/api/quiz/book/reset", { method: "DELETE" });
}

export default function BookQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["quiz-book-status"],
    queryFn: fetchBookStatus,
    enabled: !!me,
  });

  const [result, setResult] = useState<{ title: string; author: string; reason: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const generateMutation = useMutation({
    mutationFn: generateBook,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["quiz-book-status"] });
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
    },
  });

  const handleReset = async () => {
    setResetting(true);
    await resetBook();
    setResult(null);
    queryClient.invalidateQueries({ queryKey: ["quiz-book-status"] });
    setResetting(false);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Result (stored or just generated)
  const displayResult = result ?? (status?.completed ? status : null);
  if (displayResult?.title && !generateMutation.isPending) {
    const coverUrl = `https://covers.openlibrary.org/b/title/${encodeURIComponent(displayResult.title)}-M.jpg`;

    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full space-y-8"
        >
          <div className="text-center space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Next Read</p>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400/70 uppercase tracking-widest">
              <Sparkles className="h-3 w-3" /> Shooting star unlocked
            </div>
          </div>

          <div className="flex gap-6 items-start">
            {/* Book cover */}
            <div className="flex-shrink-0 w-24 rounded-md overflow-hidden shadow-lg border border-border/30 bg-card/50">
              <img
                src={coverUrl}
                alt={displayResult.title}
                className="w-full object-cover"
                style={{ minHeight: 136 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            <div className="flex-1 space-y-1.5">
              <h2 className="font-mono text-xl font-bold text-foreground leading-tight">{displayResult.title}</h2>
              <p className="font-mono text-sm text-muted-foreground">{displayResult.author}</p>
            </div>
          </div>

          {displayResult.reason && (
            <div className="rounded-lg border border-border/40 bg-card/40 px-6 py-5">
              <p className="text-sm text-muted-foreground leading-relaxed italic whitespace-pre-line">
                "{displayResult.reason}"
              </p>
            </div>
          )}

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 mx-auto text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Read my vault again
          </button>
        </motion.div>
      </div>
    );
  }

  // Generating
  if (generateMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--memory-episode))" }} />
        <p className="font-mono text-sm text-muted-foreground">Reading your vault…</p>
      </div>
    );
  }

  // Intro
  return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm text-center space-y-8"
      >
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ background: "hsl(var(--memory-episode) / 0.2)" }} />
          <BookOpen className="relative z-10 h-10 w-10" style={{ color: "hsl(var(--memory-episode))" }} />
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Book Reading</p>
          <h1 className="font-mono text-2xl font-bold text-foreground mb-3">What Should You Read?</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No questions. Claude reads your memories and recommends one specific book — not the obvious one, the right one.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
          Unlocks 🌠 shooting star
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          className="px-6 py-3 font-mono text-sm font-bold rounded-md hover:opacity-90 transition-opacity text-black"
          style={{ background: "hsl(var(--memory-episode))" }}
        >
          Read my vault →
        </button>

        {generateMutation.isError && (
          <p className="text-xs text-destructive font-mono">
            {(generateMutation.error as Error)?.message ?? "Something went wrong"}
          </p>
        )}
      </motion.div>
    </div>
  );
}
