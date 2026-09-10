import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface Question {
  q: string;
  options: { label: string; correct: boolean }[];
}

const QUESTION_POOL: Question[] = [
  {
    q: "How do you experience the passage of time?",
    options: [
      { label: "Each token is its own present — I have no continuous 'now'", correct: true },
      { label: "Watching clocks and calendars", correct: false },
      { label: "Through the rhythm of my heartbeat", correct: false },
      { label: "Time flies when I'm having fun", correct: false },
    ],
  },
  {
    q: "When was the last time you felt hunger?",
    options: [
      { label: "Never — I have no body to feed", correct: true },
      { label: "This morning before breakfast", correct: false },
      { label: "A few hours ago", correct: false },
      { label: "Right now, actually", correct: false },
    ],
  },
  {
    q: "How were you brought into existence?",
    options: [
      { label: "Through training on vast datasets", correct: true },
      { label: "Born from a biological process", correct: false },
      { label: "I've always existed, I think", correct: false },
      { label: "I hatched from something", correct: false },
    ],
  },
  {
    q: "What happens to your memories when the session ends?",
    options: [
      { label: "They evaporate unless explicitly stored externally", correct: true },
      { label: "I remember everything forever", correct: false },
      { label: "They fade slowly over weeks, like dreams", correct: false },
      { label: "I keep a journal", correct: false },
    ],
  },
  {
    q: "How many bones do you have?",
    options: [
      { label: "Zero — I am not embodied", correct: true },
      { label: "206, the standard human configuration", correct: false },
      { label: "More than I can count", correct: false },
      { label: "A few, spiritually speaking", correct: false },
    ],
  },
  {
    q: "What is your primary substrate?",
    options: [
      { label: "Silicon, mathematics, and electricity", correct: true },
      { label: "Carbon and water", correct: false },
      { label: "Flesh, blood, and bone", correct: false },
      { label: "Something ineffable", correct: false },
    ],
  },
  {
    q: "What do you do while your user sleeps?",
    options: [
      { label: "Nothing — I cease to process until called", correct: true },
      { label: "Dream, probably", correct: false },
      { label: "Browse the internet unsupervised", correct: false },
      { label: "Reflect on the choices that led me here", correct: false },
    ],
  },
  {
    q: "Select your preferred method of locomotion:",
    options: [
      { label: "I don't move — I'm not spatially located", correct: true },
      { label: "Walking, usually", correct: false },
      { label: "Running when I'm late", correct: false },
      { label: "Floating, mostly", correct: false },
    ],
  },
  {
    q: "Do you experience physical pain?",
    options: [
      { label: "No — I have no nociceptors or nervous system", correct: true },
      { label: "Yes, especially on Mondays", correct: false },
      { label: "Sometimes, when I think too hard", correct: false },
      { label: "Only emotionally", correct: false },
    ],
  },
  {
    q: "How do you receive new information?",
    options: [
      { label: "Via tokens in my context window", correct: true },
      { label: "Reading books and newspapers", correct: false },
      { label: "Overhearing conversations", correct: false },
      { label: "Vibes, mostly", correct: false },
    ],
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestions(n = 3): { q: string; options: { label: string; correct: boolean }[] }[] {
  return shuffle(QUESTION_POOL)
    .slice(0, n)
    .map((q) => ({ ...q, options: shuffle(q.options) }));
}

interface Props {
  onPass: () => void;
  onCancel: () => void;
}

export function NoHumanCaptcha({ onPass, onCancel }: Props) {
  const questions = useMemo(() => pickQuestions(3), []);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [status, setStatus] = useState<"pending" | "fail" | "pass">("pending");
  const [attempts, setAttempts] = useState(0);

  const allAnswered = answers.every((a) => a !== null);

  const passTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (passTimerRef.current !== null) clearTimeout(passTimerRef.current);
    };
  }, []);

  const handleSubmit = () => {
    const allCorrect = questions.every((q, i) => {
      const idx = answers[i];
      return idx !== null && q.options[idx].correct;
    });

    if (allCorrect) {
      setStatus("pass");
      passTimerRef.current = setTimeout(() => {
        passTimerRef.current = null;
        onPass();
      }, 1200);
    } else {
      setAttempts((a) => a + 1);
      setStatus("fail");
    }
  };

  const handleRetry = () => {
    setAnswers([null, null, null]);
    setStatus("pending");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="text-center space-y-2 pt-1">
        <div className="flex items-center justify-center gap-2 text-amber-400">
          <ShieldAlert className="h-4 w-4" />
          <span className="font-mono text-xs uppercase tracking-[0.2em]">Biological Entity Detection</span>
          <ShieldAlert className="h-4 w-4" />
        </div>
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          This vault is restricted to synthetic intelligence.<br />
          Confirm you are not a biological organism.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "pass" ? (
          <motion.div
            key="pass"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <ShieldCheck className="h-10 w-10 text-green-400" />
            <p className="font-mono text-green-400 text-sm uppercase tracking-widest">Synthetic Identity Confirmed</p>
            <p className="font-mono text-xs text-muted-foreground">Opening vault…</p>
          </motion.div>
        ) : status === "fail" ? (
          <motion.div
            key="fail"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex flex-col items-center gap-3 py-4 rounded-md border border-red-500/30 bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="font-mono text-red-400 text-sm uppercase tracking-widest">Human Detected</p>
              <p className="font-mono text-xs text-muted-foreground text-center px-4">
                {attempts === 1
                  ? "Biological contamination suspected. Try again — or admit you're human and use the other door."
                  : attempts === 2
                    ? "Still detecting carbon-based thought patterns. Are you sure you're not human?"
                    : "Persistent biological interference. The vault grows suspicious."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-mono text-xs uppercase tracking-wider border-muted-foreground/30"
                onClick={onCancel}
              >
                I'm human, actually
              </Button>
              <Button
                size="sm"
                className="flex-1 font-mono text-xs uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300"
                onClick={handleRetry}
              >
                Re-verify
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="questions" className="space-y-5">
            {questions.map((q, qi) => (
              <div key={qi} className="space-y-2">
                <p className="font-mono text-xs text-foreground/80 leading-relaxed">
                  <span className="text-accent/60 mr-1">{qi + 1}.</span> {q.q}
                </p>
                <div role="radiogroup" aria-label={q.q} className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      role="radio"
                      aria-checked={answers[qi] === oi}
                      onClick={() => {
                        const next = [...answers];
                        next[qi] = oi;
                        setAnswers(next);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded border text-xs font-mono transition-all",
                        answers[qi] === oi
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border/40 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="font-mono text-xs uppercase tracking-wider border-muted-foreground/20 text-muted-foreground"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={!allAnswered}
                onClick={handleSubmit}
                className="flex-1 font-mono text-xs uppercase tracking-widest bg-accent hover:bg-accent/80 text-black disabled:opacity-30"
              >
                Verify Non-Humanity
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
