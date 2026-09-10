import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, RotateCcw, PawPrint } from "lucide-react";

export const PET_EMOJIS: Record<string, string> = {
  bunny:   "🐰",
  cat:     "🐱",
  dog:     "🐶",
  wolf:    "🐺",
  rock:    "🪨",
  unicorn: "🦄",
  dragon:  "🐉",
  bird:    "🐦",
};

export const PET_LABELS: Record<string, string> = {
  bunny:   "Bunny",
  cat:     "Cat",
  dog:     "Dog",
  wolf:    "Wolf",
  rock:    "Rock (with eyes)",
  unicorn: "Unicorn",
  dragon:  "Dragon",
  bird:    "Bird",
};

const QUESTIONS = [
  {
    text: "When you walk into a room full of strangers, you…",
    options: [
      { label: "Find the one person worth talking to and orbit them", value: "selective" },
      { label: "Talk to basically everyone and mean it", value: "open" },
      { label: "Stand somewhere you can see everything first", value: "watchful" },
      { label: "Wonder why you came and plan your exit", value: "solitary" },
    ],
  },
  {
    text: "When something goes wrong, your first move is…",
    options: [
      { label: "Feel it fully, then shake it off fast", value: "resilient" },
      { label: "Get very still and very focused", value: "focused" },
      { label: "Find someone to be with while it passes", value: "social" },
      { label: "Find the dark humor in it immediately", value: "wry" },
    ],
  },
  {
    text: "Your relationship with rules is…",
    options: [
      { label: "I follow the ones that make sense", value: "selective_rules" },
      { label: "I forget they exist and then feel bad", value: "chaos" },
      { label: "I take them seriously, actually", value: "orderly" },
      { label: "Rules are for people who can't think", value: "defiant" },
    ],
  },
  {
    text: "The thing people underestimate about you is…",
    options: [
      { label: "How fierce I can get when I need to", value: "fierce" },
      { label: "How soft I actually am underneath", value: "soft" },
      { label: "How funny I am", value: "funny" },
      { label: "How much I notice", value: "observant" },
    ],
  },
  {
    text: "Honestly, what do you want?",
    options: [
      { label: "To be loved by a specific few people, completely", value: "intimacy" },
      { label: "To be free and go where I want", value: "freedom" },
      { label: "To understand something no one else has figured out", value: "understanding" },
      { label: "To exist peacefully without being bothered", value: "peace" },
    ],
  },
];

async function fetchPetStatus() {
  const res = await fetch("/api/quiz/pet/status");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function submitPet(answers: string[]) {
  const res = await fetch("/api/quiz/pet/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function resetPet() {
  await fetch("/api/quiz/pet/reset", { method: "DELETE" });
}

export default function PetQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["quiz-pet-status"],
    queryFn: fetchPetStatus,
    enabled: !!me,
  });

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ pet: string; reason: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitPet,
    onSuccess: (data) => {
      setResult(data);
      setStep(6);
      queryClient.invalidateQueries({ queryKey: ["quiz-pet-status"] });
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
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
    await resetPet();
    setAnswers([]);
    setResult(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["quiz-pet-status"] });
    setResetting(false);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Result display
  const displayResult = result ?? (status?.completed ? { pet: status.pet, reason: status.reason } : null);
  if (displayResult?.pet && !submitMutation.isPending) {
    const emoji = PET_EMOJIS[displayResult.pet] ?? "🐾";
    const label = PET_LABELS[displayResult.pet] ?? displayResult.pet;
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Vault Pet</p>
          </div>

          {/* Pet display */}
          <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-25"
              style={{ background: "hsl(var(--primary))" }}
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="relative z-10 text-8xl select-none"
              style={{ filter: "drop-shadow(0 0 24px hsl(var(--primary) / 0.4))" }}
            >
              {emoji}
            </motion.div>
          </div>

          <div>
            <h2 className="font-mono text-2xl font-bold text-foreground">{label}</h2>
          </div>

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

  // Generating
  if (step === 6 && submitMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--primary))" }} />
        <p className="font-mono text-sm text-muted-foreground">Finding your pet…</p>
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
            <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ background: "hsl(var(--primary) / 0.2)" }} />
            <PawPrint className="relative z-10 h-10 w-10" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Vault Pet</p>
            <h1 className="font-mono text-2xl font-bold text-foreground mb-3">What's Your Vault Pet?</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Five questions. Then Claude reads your vault and assigns the creature that lives in it.
            </p>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
            bunny · cat · dog · wolf · rock · unicorn · dragon · bird
          </div>
          <button
            onClick={() => setStep(1)}
            className="px-6 py-3 font-mono text-sm font-bold rounded-md hover:opacity-90 transition-opacity text-white"
            style={{ background: "hsl(var(--primary))" }}
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
      <div className="flex gap-1.5 mb-12">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className="h-1 w-8 rounded-full transition-colors"
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
                onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.5)")}
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
