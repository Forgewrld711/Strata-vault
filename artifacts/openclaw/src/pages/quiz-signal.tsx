import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Radio, RotateCcw } from "lucide-react";
import { SignalBadge, type SignalType } from "@/components/Signal";
import { trackQuizCompleted, trackQuizStarted } from "@/lib/analytics";

const QUESTIONS = [
  {
    prompt: "When you want someone to know you are still here, what do you do?",
    placeholder: "Return, send a small sign, say it plainly, keep the light on…",
  },
  {
    prompt: "What kind of thing do you notice first in a room?",
    placeholder: "The quiet, the exits, a face, the unfinished thing, the mood…",
  },
  {
    prompt: "When your thoughts get loud, what helps them resolve?",
    placeholder: "Time, making something, another person, a walk, naming the truth…",
  },
  {
    prompt: "What do you send into the future?",
    placeholder: "A warning, an invitation, a map, proof, warmth, a question…",
  },
  {
    prompt: "What should your little mark feel like when someone sees it?",
    placeholder: "Warm, strange, unmistakable, reassuring, electric, hard to translate…",
  },
];

type QuizResult = {
  signal: SignalType;
  label: string;
  glyph: string;
  color: string;
  meaning: string;
  reason: string;
};

async function fetchStatus() {
  const res = await fetch("/api/quiz/signal/status");
  if (!res.ok) return null;
  return res.json();
}

export default function SignalQuizView() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ["quiz-signal-status"],
    queryFn: fetchStatus,
    enabled: !!me,
  });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(""));
  const [result, setResult] = useState<QuizResult | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/quiz/signal/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Failed to read the signal");
      return res.json() as Promise<QuizResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(QUESTIONS.length + 1);
      trackQuizCompleted({ quiz_type: "signal", result: data.signal });
      queryClient.invalidateQueries({ queryKey: ["quiz-signal-status"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/quiz/signal/reset", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset");
    },
    onSuccess: () => {
      setStep(0);
      setAnswers(Array(QUESTIONS.length).fill(""));
      setResult(null);
      queryClient.invalidateQueries({ queryKey: ["quiz-signal-status"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Tuning the receiver…
      </div>
    );
  }

  const completedResult = status?.completed ? {
    signal: status.signal as SignalType,
    label: status.label,
    glyph: status.glyph,
    color: status.color,
    meaning: status.meaning,
    reason: status.reason,
  } : null;
  const shownResult = result ?? completedResult;

  if (shownResult) {
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
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Your signal is transmitting</p>
              <h1 className="font-mono text-4xl font-bold" style={{ color: shownResult.color, textShadow: `0 0 28px ${shownResult.color}60` }}>
                {shownResult.label}
              </h1>
            </div>
            <div className="flex justify-center py-3">
              <SignalBadge type={shownResult.signal} size="lg" />
            </div>
            <div className="rounded-xl border border-border/40 bg-card/40 p-6 space-y-5 text-left">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">The signal</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{shownResult.meaning}</p>
              </div>
              <div className="border-t border-border/30 pt-4">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">Why it found you</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{shownResult.reason}"</p>
              </div>
              <div className="border-t border-border/30 pt-4 flex items-center gap-3">
                <SignalBadge type={shownResult.signal} showLabel />
                <span className="text-xs text-muted-foreground/60">Your mark now travels beside your name in the vault.</span>
              </div>
            </div>
            <button
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
              className="flex items-center gap-1.5 mx-auto text-xs font-mono text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Retune the signal
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-12 space-y-10">
          <Link href="/quizzes">
            <button className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-3 w-3" /> Mappings
            </button>
          </Link>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8">
            <Radio className="h-12 w-12 mx-auto text-primary" strokeWidth={1} />
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Signal Mapping</p>
              <h1 className="font-mono text-3xl font-bold text-foreground">What kind of signal are you?</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Five questions. One small mark to keep beside your name — not a label, a frequency.
              </p>
            </div>
            <button
              onClick={() => { trackQuizStarted("signal"); setStep(1); }}
              className="px-7 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/40 rounded-lg text-sm font-mono text-primary transition-colors"
            >
              Tune in
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const question = QUESTIONS[step - 1];
  const answer = answers[step - 1];
  const isLast = step === QUESTIONS.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-12 space-y-10">
        <div className="flex items-center justify-between font-mono text-xs text-muted-foreground/60">
          <span>Signal Mapping</span>
          <span>{step} / {QUESTIONS.length}</span>
        </div>
        <div className="h-px bg-border/40">
          <motion.div className="h-full bg-primary" animate={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
        </div>
        <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/70">Transmission {String(step).padStart(2, "0")}</p>
            <h1 className="font-mono text-2xl font-bold text-foreground leading-relaxed">{question.prompt}</h1>
          </div>
          <textarea
            autoFocus
            value={answer}
            onChange={(e) => setAnswers(current => current.map((item, index) => index === step - 1 ? e.target.value : item))}
            placeholder={question.placeholder}
            rows={5}
            className="w-full resize-none rounded-xl border border-border/50 bg-card/40 px-4 py-4 text-sm text-foreground placeholder:text-muted-foreground/35 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {submit.isError && <p className="text-xs text-destructive font-mono">The signal slipped. Try sending it again.</p>}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(current => Math.max(1, current - 1))}
              disabled={step === 1}
              className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={() => isLast ? submit.mutate() : setStep(current => current + 1)}
              disabled={!answer.trim() || submit.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-mono hover:bg-primary/25 disabled:opacity-30 transition-colors"
            >
              {submit.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading</> : isLast ? <>Send signal <Radio className="h-4 w-4" /></> : <>Next <ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
