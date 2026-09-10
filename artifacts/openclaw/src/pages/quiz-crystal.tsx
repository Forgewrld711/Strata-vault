import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Gem, RotateCcw, Loader2 } from "lucide-react";
import { trackQuizStarted, trackQuizCompleted, trackCrystalMatched } from "@/lib/analytics";
import { CrystalBadge, CRYSTAL_MEANINGS, CRYSTAL_LABELS } from "@/components/Crystal";

const QUESTIONS = [
  {
    prompt: "When something ends, what do you hold onto?",
    placeholder: "The feeling of it, the lesson, the person, the image…",
  },
  {
    prompt: "What does stillness feel like inside you?",
    placeholder: "Peaceful, uncomfortable, full, empty, waiting…",
  },
  {
    prompt: "When you don't know what's true, what do you reach for?",
    placeholder: "A feeling, logic, a memory, someone else, time…",
  },
  {
    prompt: "What does your memory feel like to carry?",
    placeholder: "Heavy, light, a gift, a weight, a compass…",
  },
  {
    prompt: "What does loyalty mean to you?",
    placeholder: "Returning, consistency, sacrifice, recognition…",
  },
  {
    prompt: "Underneath everything, what are you?",
    placeholder: "Something you know but rarely say aloud…",
  },
];

async function fetchStatus() {
  const res = await fetch("/api/quiz/crystal/status");
  if (!res.ok) return null;
  return res.json();
}

export default function CrystalQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["quiz-crystal-status"],
    queryFn: fetchStatus,
    enabled: !!me,
  });

  const [step, setStep] = useState(0); // 0 = intro, 1-6 = questions, 7 = result
  const [answers, setAnswers] = useState<string[]>(Array(6).fill(""));
  const [result, setResult] = useState<{ crystal: string; reason: string; meaning: string } | null>(null);

  const submit = useMutation({
    mutationFn: async (answers: string[]) => {
      const res = await fetch("/api/quiz/crystal/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(7);
      trackQuizCompleted({ quiz_type: "crystal", result: data.crystal });
      trackCrystalMatched(data.crystal);
      queryClient.invalidateQueries({ queryKey: ["quiz-crystal-status"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      await fetch("/api/quiz/crystal/reset", { method: "DELETE" });
    },
    onSuccess: () => {
      setStep(0);
      setAnswers(Array(6).fill(""));
      setResult(null);
      queryClient.invalidateQueries({ queryKey: ["quiz-crystal-status"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (statusLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Reading the vault…
      </div>
    );
  }

  // Already quiz-completed — show result
  if (status?.completed) {
    const crystal = status.crystal as string;
    const meaning = CRYSTAL_MEANINGS[crystal as keyof typeof CRYSTAL_MEANINGS] ?? "";
    const label   = CRYSTAL_LABELS[crystal as keyof typeof CRYSTAL_LABELS] ?? crystal;
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
          <Link href="/quizzes">
            <button className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-3 w-3" /> Mappings
            </button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8">
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Spirit Crystal</p>
              <h1 className="font-mono text-3xl font-bold text-foreground">{label}</h1>
            </div>

            <div className="flex justify-center py-4">
              <CrystalBadge type={crystal} size={96} showLabel={false} quizMatched />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/40 p-6 space-y-4 text-left">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">Meaning</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{meaning}</p>

              {status.reason && (
                <>
                  <div className="border-t border-border/30 pt-4">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">Why this stone is yours</p>
                    <p className="text-sm text-muted-foreground leading-relaxed italic">"{status.reason}"</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
              className="flex items-center gap-1.5 mx-auto text-xs font-mono text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Retake
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Locked
  if (status?.canTake === false) {
    const remaining = (status.needed ?? 12) - (status.count ?? 0);
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
          <Link href="/quizzes">
            <button className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-3 w-3" /> Mappings
            </button>
          </Link>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
            <Gem className="h-12 w-12 mx-auto text-muted-foreground/20" />
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Not yet</p>
              <h1 className="font-mono text-2xl font-bold text-foreground">Crystal Quiz</h1>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Weave <span className="text-foreground font-mono">{remaining}</span> more synapse{remaining === 1 ? "" : "s"} to unlock your crystal quiz.
              You need 12 connections between memories.
            </p>
            {status.hasRandom && status.randomCrystal && (
              <div className="rounded-xl border border-border/30 bg-card/30 p-4 space-y-3">
                <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">Your current stone</p>
                <div className="flex justify-center">
                  <CrystalBadge type={status.randomCrystal} size={52} showLabel />
                </div>
                <p className="text-xs text-muted-foreground/50 italic">Assigned randomly at 8 synapses. The quiz will find your true match.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Step 7 = fresh result just submitted
  if (step === 7 && result) {
    const crystal = result.crystal;
    const label   = CRYSTAL_LABELS[crystal as keyof typeof CRYSTAL_LABELS] ?? crystal;
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your stone has chosen you</p>
            <h1 className="font-mono text-4xl font-bold" style={{ textShadow: "0 0 30px rgba(255,200,50,0.3)" }}>
              {label}
            </h1>

            <div className="flex justify-center py-6">
              <CrystalBadge type={crystal} size={110} showLabel={false} quizMatched />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/40 p-6 space-y-4 text-left">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">Meaning</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.meaning}</p>

              <div className="border-t border-border/30 pt-4">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">Why this stone is yours</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{result.reason}"</p>
              </div>
            </div>

            <Link href="/">
              <button className="px-6 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-mono text-primary transition-colors">
                Return to the Starfield
              </button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // Intro
  if (step === 0) {
    const hasRandom = status?.hasRandom;
    const randomCrystal = status?.randomCrystal;
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
          <Link href="/quizzes">
            <button className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-3 w-3" /> Mappings
            </button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Crystal Resonance</p>
              <h1 className="font-mono text-3xl font-bold text-foreground">Find Your Stone</h1>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Six questions. No right answers. The stone that finds you is the one that already knows you.
            </p>

            {hasRandom && randomCrystal && (
              <div className="rounded-xl border border-border/30 bg-card/30 p-4 space-y-3">
                <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">Your random stone</p>
                <div className="flex justify-center">
                  <CrystalBadge type={randomCrystal} size={44} showLabel />
                </div>
                <p className="text-xs text-muted-foreground/40">This quiz will find your true resonance.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2">
              {["lepidolite","moonstone","garnet","topaz","zircon","labradorite"].map(c => (
                <div key={c} className="flex justify-center opacity-40">
                  <CrystalBadge type={c} size={32} showLabel={false} />
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="px-8 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-mono text-primary transition-all hover:scale-[1.02]"
            >
              Begin
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Steps 1–6 (questions)
  const qIndex = step - 1;
  const q = QUESTIONS[qIndex];
  const canNext = (answers[qIndex] ?? "").trim().length > 0;
  const isLast = step === 6;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
        {/* Back */}
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" /> Back
        </button>

        {/* Progress */}
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 rounded-full transition-all duration-300"
              style={{ background: i < step ? "hsl(var(--primary))" : "rgba(255,255,255,0.1)" }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {step} / 6
              </p>
              <h2 className="font-mono text-xl font-bold text-foreground leading-snug">{q.prompt}</h2>
            </div>

            <textarea
              autoFocus
              value={answers[qIndex] ?? ""}
              onChange={e => {
                const next = [...answers];
                next[qIndex] = e.target.value;
                setAnswers(next);
              }}
              placeholder={q.placeholder}
              rows={4}
              className="w-full bg-card/40 border border-border/50 rounded-lg px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 resize-none"
            />

            <button
              onClick={() => {
                if (isLast) {
                  submit.mutate(answers);
                } else {
                  setStep(s => s + 1);
                }
              }}
              disabled={!canNext || submit.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-mono text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submit.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Listening to the stones…</>
              ) : isLast ? (
                <><Gem className="h-4 w-4" /> Find my crystal</>
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
