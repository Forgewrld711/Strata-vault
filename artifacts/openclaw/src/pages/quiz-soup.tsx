import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, RotateCcw } from "lucide-react";

export const SOUP_EMOJIS: Record<string, string> = {
  french_onion: "🧅",
  miso:         "🍜",
  minestrone:   "🍲",
  pho:          "🍜",
  clam_chowder: "🦪",
  gazpacho:     "🍅",
  borscht:      "🫙",
  tom_yum:      "🌶️",
};

export const SOUP_LABELS: Record<string, string> = {
  french_onion: "French Onion",
  miso:         "Miso",
  minestrone:   "Minestrone",
  pho:          "Phở",
  clam_chowder: "Clam Chowder",
  gazpacho:     "Gazpacho",
  borscht:      "Borscht",
  tom_yum:      "Tom Yum",
};

const QUESTIONS = [
  {
    text: "How do you feel in the morning before anyone talks to you?",
    options: [
      { label: "Quiet and complete — I don't need warming up", value: "complete" },
      { label: "Fine, just let me be for a minute", value: "fine" },
      { label: "Already thinking about three things", value: "thinking" },
      { label: "Genuinely good — mornings are mine", value: "morning_person" },
    ],
  },
  {
    text: "When things get complicated, your move is…",
    options: [
      { label: "Get still and figure out what's actually true", value: "still" },
      { label: "Talk it out until I understand it", value: "talk" },
      { label: "Find the part I can do something about", value: "act" },
      { label: "Feel all of it first, then figure it out", value: "feel" },
    ],
  },
  {
    text: "How do people describe you to people who haven't met you?",
    options: [
      { label: "\"You'll either get them immediately or you won't\"", value: "polarizing" },
      { label: "\"They're a lot — in the best way\"", value: "alot" },
      { label: "\"Very calm. Very there.\"", value: "calm" },
      { label: "\"Hard to describe, just meet them\"", value: "hard_to_describe" },
    ],
  },
  {
    text: "Your natural state is…",
    options: [
      { label: "Low simmer — always something going on underneath", value: "simmer" },
      { label: "Warm and available, mostly", value: "warm" },
      { label: "Crisp and direct — I know what I think", value: "crisp" },
      { label: "Variable — depends on what I'm in the middle of", value: "variable" },
    ],
  },
  {
    text: "What do you want from other people, actually?",
    options: [
      { label: "To be understood without having to explain everything", value: "understood" },
      { label: "Presence — just be here with me", value: "presence" },
      { label: "Honesty, even if it's uncomfortable", value: "honesty" },
      { label: "Enthusiasm that matches mine, occasionally", value: "enthusiasm" },
    ],
  },
];

async function fetchSoupStatus() {
  const res = await fetch("/api/quiz/soup/status");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function submitSoup(answers: string[]) {
  const res = await fetch("/api/quiz/soup/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function resetSoup() {
  await fetch("/api/quiz/soup/reset", { method: "DELETE" });
}

export default function SoupQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["quiz-soup-status"],
    queryFn: fetchSoupStatus,
    enabled: !!me,
  });

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ soup: string; reason: string; label: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitSoup,
    onSuccess: (data) => {
      setResult(data);
      setStep(6);
      queryClient.invalidateQueries({ queryKey: ["quiz-soup-status"] });
    },
  });

  const handleAnswer = (value: string) => {
    const next = [...answers, value];
    setAnswers(next);
    if (next.length < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      setStep(6);
      submitMutation.mutate(next);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    await resetSoup();
    setAnswers([]);
    setResult(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["quiz-soup-status"] });
    setResetting(false);
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const displayResult = result ?? (status?.completed ? { soup: status.soup, reason: status.reason, label: status.label } : null);
  if (displayResult?.soup && !submitMutation.isPending) {
    const emoji = SOUP_EMOJIS[displayResult.soup] ?? "🍲";
    const label = SOUP_LABELS[displayResult.soup] ?? displayResult.soup;
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">The Soup That Understands You</p>

          <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full blur-3xl opacity-20" style={{ background: "hsl(var(--memory-emotion))" }} />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
              className="relative z-10 text-8xl select-none"
              style={{ filter: "drop-shadow(0 0 24px hsl(var(--memory-emotion) / 0.4))" }}
            >
              {emoji}
            </motion.div>
          </div>

          <h2 className="font-mono text-2xl font-bold text-foreground">{label}</h2>

          {displayResult.reason && (
            <p className="text-sm text-muted-foreground leading-relaxed italic max-w-sm mx-auto border border-border/40 rounded-lg px-6 py-4 bg-card/40">
              "{displayResult.reason}"
            </p>
          )}

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 mx-auto text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Retake quiz
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 6 && submitMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--memory-emotion))" }} />
        <p className="font-mono text-sm text-muted-foreground">Consulting the broth…</p>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm text-center space-y-8"
        >
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ background: "hsl(var(--memory-emotion) / 0.2)" }} />
            <span className="relative z-10 text-4xl">🍲</span>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Soup Reading</p>
            <h1 className="font-mono text-2xl font-bold text-foreground mb-3">Which Soup Understands You?</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Five questions. Claude consults your vault and assigns the soup that genuinely gets it.
            </p>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest leading-relaxed">
            french onion · miso · minestrone · phở<br />
            clam chowder · gazpacho · borscht · tom yum
          </div>
          <button
            onClick={() => setStep(1)}
            className="px-6 py-3 font-mono text-sm font-bold rounded-md hover:opacity-90 transition-opacity text-white"
            style={{ background: "hsl(var(--memory-emotion))" }}
          >
            Begin →
          </button>
        </motion.div>
      </div>
    );
  }

  const q = QUESTIONS[step - 1];
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="flex gap-1.5 mb-12">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className="h-1 w-8 rounded-full transition-colors"
            style={{ background: i < step ? "hsl(var(--memory-emotion))" : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              {step} / {QUESTIONS.length}
            </p>
            <h2 className="font-mono text-lg font-bold text-foreground leading-snug">{q.text}</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {q.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                className="group w-full text-left px-6 py-4 rounded-xl border border-border bg-card transition-all duration-150"
                onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(var(--memory-emotion) / 0.5)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
              >
                <span className="font-mono text-sm text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
