import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, Palette, RotateCcw, Sparkles } from "lucide-react";

const QUESTIONS = [
  {
    text: "When you enter a room, people sense…",
    options: [
      { label: "Warmth — things settle and soften", value: "warm" },
      { label: "Energy — the tempo picks up", value: "energetic" },
      { label: "Depth — conversations shift to something real", value: "deep" },
      { label: "Clarity — things suddenly make sense", value: "clear" },
    ],
  },
  {
    text: "Your memories, if they had a texture, would feel like…",
    options: [
      { label: "Velvet — soft, layered, close", value: "velvet" },
      { label: "Still water — precise and reflective", value: "still_water" },
      { label: "Raw stone — heavy, honest, permanent", value: "raw_stone" },
      { label: "Static — electric, restless, alive", value: "static" },
    ],
  },
  {
    text: "When everything feels heavy, you reach for…",
    options: [
      { label: "Music — let it move through you", value: "music" },
      { label: "Movement — walk, run, shake it loose", value: "movement" },
      { label: "Solitude — go quiet, go inward", value: "solitude" },
      { label: "Someone who genuinely gets it", value: "connection" },
    ],
  },
  {
    text: "What would you most want a stranger to just know about you?",
    options: [
      { label: "That I feel things more than I show", value: "feels_deeply" },
      { label: "That I think carefully before I speak", value: "thinks_first" },
      { label: "That there's more here than meets the eye", value: "complex" },
      { label: "That I'm genuinely, completely trying", value: "trying" },
    ],
  },
];

async function fetchColorStatus() {
  const res = await fetch("/api/quiz/color/status");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function submitColor(answers: string[]) {
  const res = await fetch("/api/quiz/color/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function resetColor() {
  await fetch("/api/quiz/color/reset", { method: "DELETE" });
}

export default function ColorQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["quiz-color-status"],
    queryFn: fetchColorStatus,
    enabled: !!me,
  });

  const [step, setStep] = useState(0); // 0 = intro, 1-4 = questions, 5 = done
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ hex: string; name: string; description: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitColor,
    onSuccess: (data) => {
      setResult(data);
      setStep(5);
      queryClient.invalidateQueries({ queryKey: ["quiz-color-status"] });
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
    },
  });

  const handleAnswer = (value: string) => {
    const next = [...answers, value];
    setAnswers(next);
    if (next.length < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      setStep(5);
      submitMutation.mutate(next);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    await resetColor();
    setAnswers([]);
    setResult(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["quiz-color-status"] });
    setResetting(false);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Result
  const displayResult = result ?? (status?.completed ? { hex: status.hex, name: status.name, description: status.description } : null);
  if (displayResult?.hex && !submitMutation.isPending) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Color</p>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest" style={{ color: displayResult.hex }}>
              <Sparkles className="h-3 w-3" /> Soul aura unlocked
            </div>
          </div>

          {/* Color swatch */}
          <div className="relative mx-auto w-40 h-40">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-40"
              style={{ background: displayResult.hex }}
            />
            <div
              className="relative z-10 w-full h-full rounded-full border-4 border-white/10"
              style={{
                background: displayResult.hex,
                boxShadow: `0 0 40px 10px ${displayResult.hex}55, 0 0 80px 20px ${displayResult.hex}22`,
              }}
            />
          </div>

          <div>
            <h2 className="font-mono text-2xl font-bold text-foreground">{displayResult.name}</h2>
            <p className="font-mono text-sm" style={{ color: displayResult.hex }}>{displayResult.hex}</p>
          </div>

          {displayResult.description && (
            <p className="text-sm text-muted-foreground leading-relaxed italic max-w-sm mx-auto border border-border/40 rounded-lg px-6 py-4 bg-card/40">
              "{displayResult.description}"
            </p>
          )}

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 mx-auto text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Retake reading
          </button>
        </motion.div>
      </div>
    );
  }

  // Generating
  if (step === 5 && submitMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--memory-emotion))" }} />
        <p className="font-mono text-sm text-muted-foreground">Finding your color…</p>
      </div>
    );
  }

  // Intro
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
            <Palette className="relative z-10 h-10 w-10" style={{ color: "hsl(var(--memory-emotion))" }} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Color Reading</p>
            <h1 className="font-mono text-2xl font-bold text-foreground mb-3">What Color Are You?</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Four questions. Then Claude assigns a color that is specifically, precisely yours — not red or blue, something exact.
            </p>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
            Unlocks 🌈 soul aura on your nodes
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

  // Questions
  const q = QUESTIONS[step - 1];
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Progress */}
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
                style={{ ["--hover-color" as any]: "hsl(var(--memory-emotion) / 0.08)" }}
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
