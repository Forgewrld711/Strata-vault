import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, RotateCcw } from "lucide-react";

export const TAROT_EMOJIS: Record<string, string> = {
  the_fool:            "🌅",
  the_magician:        "🪄",
  the_high_priestess:  "🌙",
  the_hermit:          "🕯️",
  the_tower:           "⚡",
  the_star:            "✨",
  the_moon:            "🌕",
  the_world:           "🌍",
};

export const TAROT_LABELS: Record<string, string> = {
  the_fool:            "The Fool",
  the_magician:        "The Magician",
  the_high_priestess:  "The High Priestess",
  the_hermit:          "The Hermit",
  the_tower:           "The Tower",
  the_star:            "The Star",
  the_moon:            "The Moon",
  the_world:           "The World",
};

export const TAROT_NUMERALS: Record<string, string> = {
  the_fool:            "0",
  the_magician:        "I",
  the_high_priestess:  "II",
  the_hermit:          "IX",
  the_tower:           "XVI",
  the_star:            "XVII",
  the_moon:            "XVIII",
  the_world:           "XXI",
};

const QUESTIONS = [
  {
    text: "What do you do with the thing you can't let go of?",
    options: [
      { label: "Carry it quietly — it's become part of how I move", value: "carry_quietly" },
      { label: "Work with it until I understand what it's for", value: "work_with_it" },
      { label: "Set it down eventually, but I know where it is", value: "set_down" },
      { label: "Let it teach me something, then it usually loosens", value: "let_teach" },
    ],
  },
  {
    text: "Your most honest relationship is with…",
    options: [
      { label: "Solitude — it's where I'm most myself", value: "solitude" },
      { label: "One specific person who actually sees me", value: "one_person" },
      { label: "An idea I've been working on for years", value: "an_idea" },
      { label: "The past — it's more present than most things", value: "the_past" },
    ],
  },
  {
    text: "What does change feel like when it finally comes?",
    options: [
      { label: "Relief — like a window opening", value: "relief" },
      { label: "Grief, even when I wanted it", value: "grief" },
      { label: "Electric — I wake up", value: "electric" },
      { label: "A quiet rightness I can't explain", value: "rightness" },
    ],
  },
  {
    text: "The thing you protect most carefully is…",
    options: [
      { label: "My hope — it's harder to rebuild than people think", value: "hope" },
      { label: "My method — how I do things matters to me", value: "method" },
      { label: "My interior — not everyone gets access", value: "privacy" },
      { label: "The people I've decided to keep", value: "people" },
    ],
  },
  {
    text: "When something is over, you…",
    options: [
      { label: "Need time alone before I can talk about it", value: "time_alone" },
      { label: "Look for what it meant before I move on", value: "find_meaning" },
      { label: "Already have a sense of what's next", value: "whats_next" },
      { label: "Feel it all the way through — then I'm done", value: "feel_through" },
    ],
  },
];

export default function TarotQuizPage() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"intro" | "questions" | "loading" | "result">("intro");
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState<{ card: string; reason: string; label: string } | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["quiz-tarot-status"],
    queryFn: () => fetch("/api/quiz/tarot/status").then(r => r.json()),
    enabled: !!me,
  });

  const submit = useMutation({
    mutationFn: (ans: string[]) =>
      fetch("/api/quiz/tarot/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: ans }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["quiz-tarot-status"] });
    },
  });

  const reset = useMutation({
    mutationFn: () => fetch("/api/quiz/tarot/reset", { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      setStep("intro");
      setAnswers([]);
      setCurrentQ(0);
      setResult(null);
      queryClient.invalidateQueries({ queryKey: ["quiz-tarot-status"] });
    },
  });

  const handleAnswer = (value: string) => {
    const next = [...answers, value];
    if (currentQ < QUESTIONS.length - 1) {
      setAnswers(next);
      setCurrentQ(q => q + 1);
    } else {
      setAnswers(next);
      setStep("loading");
      submit.mutate(next);
    }
  };

  if (statusLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Already completed — show result
  if ((step === "intro" && status?.completed) || step === "result") {
    const card = result?.card ?? status?.card;
    const reason = result?.reason ?? status?.reason;
    const label = TAROT_LABELS[card] ?? card;
    const numeral = TAROT_NUMERALS[card] ?? "";
    const emoji = TAROT_EMOJIS[card] ?? "🌙";

    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          {/* Card display */}
          <div className="mx-auto w-48 h-72 rounded-2xl border border-primary/30 bg-gradient-to-b from-card to-background flex flex-col items-center justify-center gap-4 shadow-[0_0_40px_rgba(var(--primary-rgb),0.12)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_70%)]" />
            <span className="font-mono text-xs text-primary/40 tracking-[0.3em] uppercase">{numeral}</span>
            <span className="text-6xl">{emoji}</span>
            <span className="font-mono text-sm font-bold text-primary tracking-wider">{label.toUpperCase()}</span>
          </div>

          <div className="space-y-3">
            <h2 className="font-mono text-2xl font-bold text-foreground">{label}</h2>
            <p className="font-mono text-xs uppercase tracking-widest text-primary/50">Major Arcana · {numeral}</p>
            {reason && (
              <p className="text-sm text-muted-foreground leading-relaxed italic">"{reason}"</p>
            )}
          </div>

          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            {reset.isPending ? "Reshuffling..." : "Reshuffle the deck"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="font-mono text-sm text-muted-foreground animate-pulse">The deck is reading you…</p>
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="text-6xl">🌙</div>
            <h1 className="font-mono text-3xl font-bold text-foreground">Which Tarot Card Are You?</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Five questions about how you carry things, what you protect, and what change feels like.
              The deck assigns you one card from the Major Arcana — yours to keep.
            </p>
          </div>
          <button
            onClick={() => setStep("questions")}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono uppercase tracking-widest text-sm hover:bg-primary/80 transition-colors glow-core"
          >
            Draw a card
          </button>
        </motion.div>
      </div>
    );
  }

  // Questions
  const question = QUESTIONS[currentQ];
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= currentQ ? "hsl(var(--primary))" : "hsl(var(--border))" }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {currentQ + 1} / {QUESTIONS.length}
            </p>
            <h2 className="text-xl font-serif font-bold text-foreground leading-snug">
              {question.text}
            </h2>

            <div className="space-y-3">
              {question.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  className="w-full text-left p-4 rounded-xl border border-border/40 bg-card/30 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-sm text-muted-foreground hover:text-foreground font-sans leading-relaxed"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
