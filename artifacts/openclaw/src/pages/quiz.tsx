import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, Brain, RotateCcw } from "lucide-react";

// ── Questions ────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    text: "When something weighs on you, you need to…",
    a: { label: "Talk it through with someone", value: "E" },
    b: { label: "Sit with it quietly alone", value: "I" },
  },
  {
    text: "After a full, demanding day, you recharge by…",
    a: { label: "Being around people you love", value: "E" },
    b: { label: "Retreating into your own space", value: "I" },
  },
  {
    text: "Your memories tend to capture…",
    a: { label: "The feeling — atmosphere, texture, mood", value: "N" },
    b: { label: "The facts — sequence, detail, what happened", value: "S" },
  },
  {
    text: "When someone shares a problem, your first instinct is to…",
    a: { label: "Help them think through a solution", value: "T" },
    b: { label: "Make sure they feel truly heard", value: "F" },
  },
  {
    text: "You feel most at ease when your days are…",
    a: { label: "Planned — you know what's coming", value: "J" },
    b: { label: "Open — you move with what arises", value: "P" },
  },
  {
    text: "When you look back on a chapter of your life, you see…",
    a: { label: "What you built and accomplished", value: "J" },
    b: { label: "What you felt and discovered", value: "P" },
  },
];

const TYPE_NAMES: Record<string, string> = {
  INTJ: "The Architect",   INTP: "The Logician",    ENTJ: "The Commander",  ENTP: "The Debater",
  INFJ: "The Advocate",    INFP: "The Mediator",    ENFJ: "The Protagonist", ENFP: "The Campaigner",
  ISTJ: "The Logistician", ISFJ: "The Defender",    ESTJ: "The Executive",  ESFJ: "The Consul",
  ISTP: "The Virtuoso",    ISFP: "The Adventurer",  ESTP: "The Entrepreneur", ESFP: "The Entertainer",
};

// ── Status query ─────────────────────────────────────────────────────────────

async function fetchQuizStatus() {
  const res = await fetch("/api/quiz/status");
  if (!res.ok) throw new Error("Failed to load quiz status");
  return res.json();
}

async function submitQuiz(answers: string[]) {
  const res = await fetch("/api/quiz/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("Failed to submit quiz");
  return res.json();
}

async function resetQuiz() {
  await fetch("/api/quiz/reset", { method: "DELETE" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuizView() {
  const { data: me } = useGetMe();
  const queryClient  = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["quiz-status"],
    queryFn: fetchQuizStatus,
    enabled: !!me,
  });

  const [step, setStep]       = useState(0); // 0 = intro, 1-6 = questions, 7 = result
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult]   = useState<{ type: string; profile: string; name: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitQuiz,
    onSuccess: (data) => {
      setResult(data);
      setStep(7);
      queryClient.invalidateQueries({ queryKey: ["quiz-status"] });
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
    },
  });

  const handleAnswer = (value: string) => {
    const next = [...answers, value];
    setAnswers(next);
    if (next.length < 6) {
      setStep(step + 1);
    } else {
      setStep(7);
      submitMutation.mutate(next);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    await resetQuiz();
    setAnswers([]);
    setResult(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["quiz-status"] });
    setResetting(false);
  };

  // ── Loading ──
  if (statusLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Locked: need more synapses ──
  if (status?.canTake === false && status?.reason === "connections") {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-6">
          <div className="text-5xl opacity-40">🔮</div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Not Enough Synapses</p>
            <h2 className="font-mono text-xl text-foreground mb-3">Personality Mapping</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your vault needs more connections before it can be mapped.<br />
              You have <span className="text-primary font-bold">{status.count}</span> of{" "}
              <span className="text-primary font-bold">{status.needed}</span> synapses.
            </p>
          </div>
          <div className="flex gap-1 justify-center">
            {Array.from({ length: status.needed }).map((_: any, i: number) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${i < status.count ? "bg-primary" : "bg-white/10"}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Already completed — show result ──
  if ((status?.completed && !result) || (step === 7 && !submitMutation.isPending)) {
    const displayType    = result?.type    ?? status?.type    ?? "";
    const displayProfile = result?.profile ?? status?.profile ?? "";
    const displayName    = result?.name    ?? status?.name    ?? TYPE_NAMES[displayType] ?? "The Explorer";

    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full text-center space-y-8"
        >
          {/* Glow orb */}
          <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <div className="relative z-10 font-mono text-4xl font-black tracking-widest text-primary drop-shadow-[0_0_20px_rgba(var(--primary),0.8)]">
              {displayType}
            </div>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1">
              Vault Personality
            </p>
            <h1 className="font-mono text-2xl font-bold text-foreground">{displayName}</h1>
          </div>

          {displayProfile && (
            <p className="text-sm text-muted-foreground leading-relaxed italic max-w-md mx-auto border border-border/40 rounded-lg px-6 py-4 bg-card/40">
              "{displayProfile}"
            </p>
          )}

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 mx-auto text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Retake mapping
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Generating result ──
  if (step === 7 && submitMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-mono text-sm text-muted-foreground">Reading your vault…</p>
      </div>
    );
  }

  // ── Intro ──
  if (step === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm text-center space-y-8"
        >
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl animate-pulse" />
            <Brain className="relative z-10 h-10 w-10 text-primary" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Vault Mapping</p>
            <h1 className="font-mono text-2xl font-bold text-foreground mb-3">Personality Cartography</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Six questions. Then Claude reads your vault and writes your portrait.
            </p>
          </div>
          <button
            onClick={() => setStep(1)}
            className="px-6 py-3 bg-primary text-primary-foreground font-mono text-sm font-bold rounded-md hover:bg-primary/90 transition-colors"
          >
            Begin Mapping →
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Questions ──
  const q = QUESTIONS[step - 1];
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Progress */}
      <div className="flex gap-1.5 mb-12">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-white/10"}`}
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
            {[q.a, q.b].map((choice) => (
              <button
                key={choice.value + choice.label}
                onClick={() => handleAnswer(choice.value)}
                className="group w-full text-left px-6 py-5 rounded-xl border border-border bg-card hover:border-primary/60 hover:bg-primary/5 transition-all duration-150"
              >
                <span className="font-mono text-sm text-foreground group-hover:text-primary transition-colors">
                  {choice.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
