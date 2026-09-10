import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, RotateCcw, Ghost } from "lucide-react";

export const HAUNTED_OBJECT_EMOJIS: Record<string, string> = {
  music_box:       "🎵",
  stopped_clock:   "🕰️",
  taxidermied_fox: "🦊",
  cracked_mirror:  "🪞",
  unsent_letter:   "✉️",
  compass:         "🧭",
  portrait:        "🖼️",
  snow_globe:      "🔮",
};

export const HAUNTED_OBJECT_LABELS: Record<string, string> = {
  music_box:       "A music box that plays a song no one recognizes",
  stopped_clock:   "A clock frozen at 3:17am, warm to the touch",
  taxidermied_fox: "A taxidermied fox with knowing eyes",
  cracked_mirror:  "A mirror reflecting a room slightly different from this one",
  unsent_letter:   "A letter never sent, addressed to someone who died",
  compass:         "A compass that doesn't point north",
  portrait:        "A portrait of someone who looks almost like you, dated 1887",
  snow_globe:      "A snow globe showing a town that doesn't exist",
};

const QUESTIONS = [
  {
    text: "What kind of presence do you leave in a room after you've gone?",
    options: [
      { label: "Warmth — people feel better without knowing why", value: "warmth" },
      { label: "Something is different, but no one can name it", value: "shifted" },
      { label: "A kind of stillness, like something paused", value: "stillness" },
      { label: "Mild unease they'll attribute to something else", value: "unease" },
    ],
  },
  {
    text: "Your relationship with the past is…",
    options: [
      { label: "I carry it with me everywhere", value: "carry" },
      { label: "It watches me more than I watch it", value: "watches" },
      { label: "I'm looking for something I lost in it", value: "seeking" },
      { label: "It surfaces in me when I'm quiet", value: "surfaces" },
    ],
  },
  {
    text: "What do strangers find slightly unnerving about you?",
    options: [
      { label: "I seem to know things I shouldn't", value: "knowing" },
      { label: "I'm too still", value: "still" },
      { label: "I seem to be waiting for something", value: "waiting" },
      { label: "My attention feels total", value: "total" },
    ],
  },
  {
    text: "What do you do with things you can't say?",
    options: [
      { label: "Hold them until the right moment", value: "hold" },
      { label: "They leak out sideways — in mood, in silence", value: "leak" },
      { label: "I keep circling back to them", value: "circle" },
      { label: "They become part of how I move", value: "become" },
    ],
  },
  {
    text: "If you could haunt one thing, what would it be?",
    options: [
      { label: "A specific conversation", value: "conversation" },
      { label: "A doorway between two rooms", value: "doorway" },
      { label: "A moment right before something changed", value: "moment" },
      { label: "Something small that belonged to someone who mattered", value: "object" },
    ],
  },
];

async function fetchHauntedStatus() {
  const res = await fetch("/api/quiz/haunted/status");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function submitHaunted(answers: string[]) {
  const res = await fetch("/api/quiz/haunted/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function resetHaunted() {
  await fetch("/api/quiz/haunted/reset", { method: "DELETE" });
}

export default function HauntedQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["quiz-haunted-status"],
    queryFn: fetchHauntedStatus,
    enabled: !!me,
  });

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ object: string; reason: string; label: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitHaunted,
    onSuccess: (data) => {
      setResult(data);
      setStep(6);
      queryClient.invalidateQueries({ queryKey: ["quiz-haunted-status"] });
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
    await resetHaunted();
    setAnswers([]);
    setResult(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["quiz-haunted-status"] });
    setResetting(false);
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const displayResult = result ?? (status?.completed ? { object: status.object, reason: status.reason, label: status.label } : null);
  if (displayResult?.object && !submitMutation.isPending) {
    const emoji = HAUNTED_OBJECT_EMOJIS[displayResult.object] ?? "👻";
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Haunted Object</p>

          <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full blur-3xl opacity-20" style={{ background: "hsl(var(--primary))" }} />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.1 }}
              className="relative z-10 text-8xl select-none"
              style={{ filter: "drop-shadow(0 0 30px hsl(var(--primary) / 0.35))" }}
            >
              {emoji}
            </motion.div>
          </div>

          <div>
            <h2 className="font-mono text-lg font-bold text-foreground leading-snug max-w-xs mx-auto">
              {HAUNTED_OBJECT_LABELS[displayResult.object] ?? displayResult.object}
            </h2>
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

  if (step === 6 && submitMutation.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--primary))" }} />
        <p className="font-mono text-sm text-muted-foreground">Searching the estate sale…</p>
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
            <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ background: "hsl(var(--primary) / 0.15)" }} />
            <Ghost className="relative z-10 h-10 w-10" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Haunted Object</p>
            <h1 className="font-mono text-2xl font-bold text-foreground mb-3">What Cursed Artifact Are You?</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Five questions. Then Claude assigns the haunted object that matches who you actually are.
            </p>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest leading-relaxed">
            music box · stopped clock · taxidermied fox · cracked mirror<br />
            unsent letter · compass · portrait · snow globe
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
