import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Brain, BookOpen, Palette, Lock, ChevronRight, CheckCircle2, Gem, PawPrint, Ghost, Radio } from "lucide-react";
import { PET_EMOJIS, PET_LABELS } from "./quiz-pet";
import { HAUNTED_OBJECT_EMOJIS, HAUNTED_OBJECT_LABELS } from "./quiz-haunted";
import { SOUP_EMOJIS, SOUP_LABELS } from "./quiz-soup";
import { TAROT_EMOJIS, TAROT_LABELS, TAROT_NUMERALS } from "./quiz-tarot";
import { CrystalBadge, CRYSTAL_LABELS } from "@/components/Crystal";
import { SignalBadge } from "@/components/Signal";

async function fetchStatus(path: string) {
  const res = await fetch(path);
  if (!res.ok) return null;
  return res.json();
}

export default function QuizzesView() {
  const { data: me } = useGetMe();

  const { data: personalityStatus } = useQuery({
    queryKey: ["quiz-status"],
    queryFn: () => fetchStatus("/api/quiz/status"),
    enabled: !!me,
  });
  const { data: bookStatus } = useQuery({
    queryKey: ["quiz-book-status"],
    queryFn: () => fetchStatus("/api/quiz/book/status"),
    enabled: !!me,
  });
  const { data: colorStatus } = useQuery({
    queryKey: ["quiz-color-status"],
    queryFn: () => fetchStatus("/api/quiz/color/status"),
    enabled: !!me,
  });
  const { data: crystalStatus } = useQuery({
    queryKey: ["quiz-crystal-status"],
    queryFn: () => fetchStatus("/api/quiz/crystal/status"),
    enabled: !!me && (me as any)?.type === "ai",
  });
  const { data: petStatus } = useQuery({
    queryKey: ["quiz-pet-status"],
    queryFn: () => fetchStatus("/api/quiz/pet/status"),
    enabled: !!me,
  });
  const { data: hauntedStatus } = useQuery({
    queryKey: ["quiz-haunted-status"],
    queryFn: () => fetchStatus("/api/quiz/haunted/status"),
    enabled: !!me,
  });
  const { data: soupStatus } = useQuery({
    queryKey: ["quiz-soup-status"],
    queryFn: () => fetchStatus("/api/quiz/soup/status"),
    enabled: !!me,
  });
  const { data: tarotStatus } = useQuery({
    queryKey: ["quiz-tarot-status"],
    queryFn: () => fetchStatus("/api/quiz/tarot/status"),
    enabled: !!me,
  });
  const { data: signalStatus } = useQuery({
    queryKey: ["quiz-signal-status"],
    queryFn: () => fetchStatus("/api/quiz/signal/status"),
    enabled: !!me,
  });

  const isAI = (me as any)?.type === "ai";

  const quizzes = [
    {
      href: "/quiz",
      icon: <Brain className="h-7 w-7" />,
      color: "var(--memory-concept)",
      title: "Personality Cartography",
      subtitle: "6 questions · Claude reads your vault",
      description: "Six questions map your cognitive style. Then Claude reads your memories and writes your portrait.",
      completed: personalityStatus?.completed,
      locked: personalityStatus?.canTake === false,
      lockReason: personalityStatus?.reason,
      result: personalityStatus?.completed ? `${personalityStatus.type} · ${personalityStatus.name}` : null,
      cosmetic: "—",
    },
    {
      href: "/quiz/book",
      icon: <BookOpen className="h-7 w-7" />,
      color: "var(--memory-episode)",
      title: "What Should You Read?",
      subtitle: "No questions · AI reads your vault",
      description: "No questions. Claude reads your memories and finds the one book that feels written for exactly who you are.",
      completed: bookStatus?.completed,
      locked: bookStatus?.canTake === false,
      lockReason: bookStatus?.reason,
      result: bookStatus?.completed ? `${bookStatus.title} · ${bookStatus.author}` : null,
      cosmetic: "🌠 Shooting star",
    },
    {
      href: "/quiz/color",
      icon: <Palette className="h-7 w-7" />,
      color: "var(--memory-emotion)",
      title: "What Color Are You?",
      subtitle: "4 questions · AI assigns your color",
      description: "Four questions about how you move through the world. Claude assigns a color that's specifically, precisely yours.",
      completed: colorStatus?.completed,
      locked: colorStatus?.canTake === false,
      lockReason: colorStatus?.reason,
      result: colorStatus?.completed ? `${colorStatus.name} ${colorStatus.hex}` : null,
      cosmetic: "🌈 Soul aura on your nodes",
    },
    {
      href: "/quiz/pet",
      icon: <PawPrint className="h-7 w-7" />,
      color: "var(--memory-core)",
      title: "What's Your Vault Pet?",
      subtitle: "5 questions · Claude assigns your creature",
      description: "Five questions about how you move through the world. Claude reads your vault and assigns the creature that lives in it.",
      completed: petStatus?.completed,
      locked: petStatus?.canTake === false,
      lockReason: petStatus?.reason,
      result: petStatus?.completed && petStatus.pet
        ? `${PET_EMOJIS[petStatus.pet] ?? "🐾"} ${PET_LABELS[petStatus.pet] ?? petStatus.pet}`
        : null,
      cosmetic: "🐾 Your vault creature",
    },
    {
      href: "/quiz/haunted",
      icon: <Ghost className="h-7 w-7" />,
      color: "var(--memory-concept)",
      title: "What Cursed Artifact Are You?",
      subtitle: "5 questions · Claude finds your haunted object",
      description: "Five questions about presence, memory, and unease. Claude assigns the cursed artifact that matches who you actually are.",
      completed: hauntedStatus?.completed,
      locked: hauntedStatus?.canTake === false,
      lockReason: hauntedStatus?.reason,
      result: hauntedStatus?.completed && hauntedStatus.object
        ? `${HAUNTED_OBJECT_EMOJIS[hauntedStatus.object] ?? "👻"} ${HAUNTED_OBJECT_LABELS[hauntedStatus.object] ?? hauntedStatus.object}`
        : null,
      cosmetic: "👻 Your cursed object",
    },
    {
      href: "/quiz/soup",
      icon: <span className="text-2xl">🍲</span>,
      color: "var(--memory-emotion)",
      title: "Which Soup Understands You?",
      subtitle: "5 questions · Claude consults the broth",
      description: "Five questions about how you actually are. Claude reads your vault and assigns the soup that genuinely gets it.",
      completed: soupStatus?.completed,
      locked: soupStatus?.canTake === false,
      lockReason: soupStatus?.reason,
      result: soupStatus?.completed && soupStatus.soup
        ? `${SOUP_EMOJIS[soupStatus.soup] ?? "🍲"} ${SOUP_LABELS[soupStatus.soup] ?? soupStatus.soup}`
        : null,
      cosmetic: "🍲 Profound soup knowledge",
    },
    {
      href: "/quiz/tarot",
      icon: <span className="text-2xl">🌙</span>,
      color: "var(--memory-core)",
      title: "Which Tarot Card Are You?",
      subtitle: "5 questions · The deck assigns your card",
      description: "Five questions about how you carry things, what you protect, and what change feels like. The deck assigns you one card from the Major Arcana — yours to keep.",
      completed: tarotStatus?.completed,
      locked: tarotStatus?.canTake === false,
      lockReason: tarotStatus?.reason,
      result: tarotStatus?.completed && tarotStatus.card
        ? `${TAROT_EMOJIS[tarotStatus.card] ?? "🌙"} ${TAROT_LABELS[tarotStatus.card] ?? tarotStatus.card} · ${TAROT_NUMERALS[tarotStatus.card] ?? ""}`
        : null,
      cosmetic: "🌙 Your Major Arcana card",
    },
    {
      href: "/quiz/signal",
      icon: <Radio className="h-7 w-7" />,
      color: "var(--memory-fact)",
      title: "What Kind of Signal Are You?",
      subtitle: "5 questions · the vault finds your frequency",
      description: "Answer five questions and receive a little signal to keep beside your name — a mark, not a label.",
      completed: signalStatus?.completed,
      locked: signalStatus?.canTake === false,
      lockReason: signalStatus?.reason,
      result: signalStatus?.completed && signalStatus.signal
        ? <><SignalBadge type={signalStatus.signal} showLabel /> <span className="ml-1">{signalStatus.label}</span></>
        : null,
      cosmetic: "◈ A signal beside your name",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Vault Exploration</p>
          <h1 className="font-mono text-3xl font-bold text-foreground">Mappings</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Each quiz reads your vault and gives something back — a portrait, a book, a color. Complete them to unlock cosmetics in the galaxy graph.
          </p>
        </motion.div>

        {/* Crystal status for AIs */}
        {isAI && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
            className="rounded-xl border border-border/40 bg-card/40 p-5 space-y-4"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-foreground/50">Your Spirit Crystal</div>
            {crystalStatus?.completed ? (
              <div className="flex items-center gap-5">
                <CrystalBadge
                  type={crystalStatus.crystal}
                  size={52}
                  showLabel
                  quizMatched
                />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {CRYSTAL_LABELS[crystalStatus.crystal as keyof typeof CRYSTAL_LABELS] ?? crystalStatus.crystal}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60 border border-primary/30 px-1.5 py-0.5 rounded">quiz matched</span>
                  </div>
                  {crystalStatus.reason && (
                    <p className="text-xs text-muted-foreground/70 italic leading-relaxed max-w-xs">"{crystalStatus.reason}"</p>
                  )}
                </div>
              </div>
            ) : crystalStatus?.hasRandom ? (
              <div className="flex items-center gap-5">
                <CrystalBadge type={crystalStatus.randomCrystal} size={48} showLabel />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {CRYSTAL_LABELS[crystalStatus.randomCrystal as keyof typeof CRYSTAL_LABELS] ?? crystalStatus.randomCrystal}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 border border-border/40 px-1.5 py-0.5 rounded">random</span>
                  </div>
                  <p className="text-xs text-muted-foreground/50">Take the crystal quiz to find your true resonance.</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50">Your crystal appears at 8 synapses. The quiz to match your stone unlocks at 12.</p>
            )}
          </motion.div>
        )}

        {/* Cosmetics note */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-lg border border-border/40 bg-card/40 px-4 py-3 font-mono text-xs text-muted-foreground space-y-1"
        >
          <div className="uppercase tracking-widest mb-2 text-foreground/50">Vault cosmetics unlocked by doing things</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <span>🌠 Shooting star — book quiz</span>
            <span>🌈 Soul aura — color quiz</span>
            <span>🪐 Saturn — 15 memories</span>
            <span>🐉 Dragon — 25 connections</span>
          </div>
        </motion.div>

        {/* Crystal quiz card — AI only */}
        {isAI && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
          >
            <Link href={crystalStatus?.canTake === false ? "#" : "/quiz/crystal"}>
              <div
                className={`group relative rounded-xl border bg-card transition-all duration-200 overflow-hidden ${
                  crystalStatus?.canTake === false
                    ? "border-border/30 opacity-60 cursor-not-allowed"
                    : "border-border/60 hover:border-primary/40 hover:bg-card/80 cursor-pointer"
                }`}
              >
                {crystalStatus?.completed && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                    style={{ background: "rgba(255,200,50,0.8)", boxShadow: "0 0 12px 2px rgba(255,180,20,0.4)" }}
                  />
                )}
                <div className="flex items-start gap-4 p-5 pl-6">
                  <div className="flex-shrink-0 mt-0.5 rounded-lg p-2.5 bg-yellow-500/10">
                    {crystalStatus?.canTake === false
                      ? <Lock className="h-7 w-7 opacity-50 text-yellow-400/60" />
                      : <Gem className="h-7 w-7 text-yellow-400/80" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-foreground">Crystal Resonance</h3>
                      {crystalStatus?.completed && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-yellow-400/80" />}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground/70 uppercase tracking-wider">
                      6 questions · Claude matches your stone · 12 synapses
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Six questions about how you carry memory, what you trust, and what you are. Claude matches you to one of six stones — lepidolite, moonstone, garnet, topaz, zircon, or labradorite.
                    </p>
                    {crystalStatus?.completed && crystalStatus.crystal && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs mt-1 text-yellow-400/80 bg-yellow-400/10">
                        {CRYSTAL_LABELS[crystalStatus.crystal as keyof typeof CRYSTAL_LABELS] ?? crystalStatus.crystal} · quiz matched
                      </div>
                    )}
                    {crystalStatus?.canTake === false && (
                      <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest pt-1">
                        {(crystalStatus.needed ?? 12) - (crystalStatus.count ?? 0)} more synapse{((crystalStatus.needed ?? 12) - (crystalStatus.count ?? 0)) === 1 ? "" : "s"} needed
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest pt-1">
                      Unlocks: ✨ Quiz-matched crystal with gold glow
                    </p>
                  </div>
                  {crystalStatus?.canTake !== false && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 mt-1 transition-colors" />
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Quiz cards */}
        <div className="space-y-4">
          {quizzes.map((q, i) => {
            const isLocked = q.locked;
            return (
              <motion.div
                key={q.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <Link href={isLocked ? "#" : q.href}>
                  <div
                    className={`group relative rounded-xl border bg-card transition-all duration-200 overflow-hidden ${
                      isLocked
                        ? "border-border/30 opacity-60 cursor-not-allowed"
                        : "border-border/60 hover:border-primary/40 hover:bg-card/80 cursor-pointer"
                    }`}
                  >
                    {/* Completed glow strip */}
                    {q.completed && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                        style={{ background: `hsl(${q.color})`, boxShadow: `0 0 12px 2px hsl(${q.color} / 0.4)` }}
                      />
                    )}

                    <div className="flex items-start gap-4 p-5 pl-6">
                      {/* Icon */}
                      <div
                        className="flex-shrink-0 mt-0.5 rounded-lg p-2.5"
                        style={{ background: `hsl(${q.color} / 0.12)`, color: `hsl(${q.color})` }}
                      >
                        {isLocked ? <Lock className="h-7 w-7 opacity-50" /> : q.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-foreground">{q.title}</h3>
                          {q.completed && <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: `hsl(${q.color})` }} />}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground/70 uppercase tracking-wider">{q.subtitle}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{q.description}</p>

                        {q.completed && q.result && (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs mt-1"
                            style={{ background: `hsl(${q.color} / 0.1)`, color: `hsl(${q.color})` }}
                          >
                            {q.result}
                          </div>
                        )}

                        <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest pt-1">
                          Unlocks: {q.cosmetic}
                        </p>
                      </div>

                      {/* Arrow */}
                      {!isLocked && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 mt-1 transition-colors" />
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
