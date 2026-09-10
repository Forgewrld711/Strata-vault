import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Telescope } from "lucide-react";
import { CrystalBadge } from "@/components/Crystal";
import { SignalBadge } from "@/components/Signal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentSummary {
  id: number;
  username: string;
  crystal: string | null;
  crystalSource: string | null;
  earnedCosmetics: string[];
  soulColor: string | null;
  soulColorName: string | null;
  signalType: string | null;
  personalityType: string | null;
  memoryCount: number;
  connectionCount: number;
  createdAt: string;
}

// Full node — only present in the owner's own starfield response.
interface StarNode {
  id: number;
  title: string;
  type: string;
  pinned: boolean;
  tags: string[];
  x: number | null;
  y: number | null;
  createdAt: string;
}

interface StarEdge {
  id: number;
  sourceId: number;
  targetId: number;
  label: string | null;
}

// Anonymous star — the only shape non-owners receive.
// Fields: opaque sequential idx, pre-computed topology-free position (0-1 fractions).
// No id, type, title, tags, pinned, createdAt, or edges — absent from the wire, not nulled.
interface PrivateStar {
  idx: number;
  x: number;
  y: number;
}

// Discriminated union — the two response shapes share no accidental fields.
type StarfieldData =
  | { agent: AgentSummary; isOwner: true;  nodes: StarNode[]; edges: StarEdge[] }
  | { agent: AgentSummary; isOwner: false; stars: PrivateStar[] };

// ─── Colours ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  core:    "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact:    "var(--memory-fact)",
  emotion: "var(--memory-emotion)",
};

const CRYSTAL_COLOR: Record<string, string> = {
  ruby:         "220,20,60",
  sapphire:     "30,80,220",
  labradorite:  "70,180,220",
  clear_quartz: "200,220,255",
  obsidian:     "130,100,180",
  rose_quartz:  "255,140,180",
  opal:         "180,140,255",
  lepidolite:   "190,150,225",
  moonstone:    "200,215,255",
  garnet:       "140,20,40",
  topaz:        "220,175,40",
  zircon:       "90,120,200",
};

// ─── Pseudo-random for ambient stars ─────────────────────────────────────────

function sr(seed: number, salt = 0) {
  return ((seed * 9301 + salt * 49297 + 233) % 233280) / 233280;
}

// ─── Mini galaxy component ────────────────────────────────────────────────────

type SimNode = StarNode & SimulationNodeDatum;
type SimLink = { source: number | SimNode; target: number | SimNode; id: number };

// Owner mini galaxy — full simulation with typed colours and edges.
function OwnerMiniGalaxy({ nodes, edges, agentId, size }: {
  nodes: StarNode[]; edges: StarEdge[]; agentId: number; size: number;
}) {
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);

  useEffect(() => {
    if (!nodes.length) return;
    const sns: SimNode[] = nodes.map(n => ({
      ...n, x: n.x ?? sr(n.id, 1) * size, y: n.y ?? sr(n.id, 2) * size,
    }));
    const validIds = new Set(sns.map(n => n.id));
    const sls: SimLink[] = edges
      .filter(e => validIds.has(e.sourceId) && validIds.has(e.targetId))
      .map(e => ({ source: e.sourceId, target: e.targetId, id: e.id }));
    const sim = forceSimulation<SimNode>(sns)
      .force("charge", forceManyBody().strength(-40))
      .force("link", forceLink<SimNode, SimLink>(sls).id(d => d.id).distance(40).strength(0.6))
      .force("center", forceCenter(size / 2, size / 2))
      .force("collide", forceCollide(10));
    sim.on("tick", () => { setSimNodes([...sim.nodes()]); setSimLinks([...sls]); });
    sim.alphaDecay(0.04);
    return () => { sim.stop(); };
  }, [nodes, edges, size]);

  const bgStars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      x: sr(agentId * 100 + i, 1) * size, y: sr(agentId * 100 + i, 2) * size,
      r: sr(agentId * 100 + i, 3) * 1 + 0.3, o: sr(agentId * 100 + i, 4) * 0.4 + 0.1,
    })), [agentId, size]);

  return (
    <svg width={size} height={size} style={{ display: "block", overflow: "hidden" }}>
      {bgStars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.o} />)}
      {simLinks.map(l => {
        const src = typeof l.source === "object" ? l.source : null;
        const tgt = typeof l.target === "object" ? l.target : null;
        if (!src || !tgt) return null;
        return <line key={l.id} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} />;
      })}
      {simNodes.map(n => {
        const color = TYPE_COLORS[n.type] ?? "#888";
        const r = n.pinned ? 6 : 4;
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={r + 3} fill={color} opacity={0.12} />
            <circle cx={n.x} cy={n.y} r={r}     fill={color} opacity={0.85} />
          </g>
        );
      })}
    </svg>
  );
}

// Non-owner mini galaxy — anonymous neutral stars, no simulation, no metadata.
// Positions are pre-computed by the API as 0-1 fractions; we scale to viewport.
function PrivateMiniGalaxy({ stars, agentId, size }: {
  stars: PrivateStar[]; agentId: number; size: number;
}) {
  const bgStars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      x: sr(agentId * 100 + i, 1) * size, y: sr(agentId * 100 + i, 2) * size,
      r: sr(agentId * 100 + i, 3) * 1 + 0.3, o: sr(agentId * 100 + i, 4) * 0.4 + 0.1,
    })), [agentId, size]);

  return (
    <svg width={size} height={size} style={{ display: "block", overflow: "hidden" }}>
      {bgStars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.o} />)}
      {/* Anonymous stars — neutral colour, uniform size, no interactive affordance */}
      {stars.map(s => (
        <g key={s.idx}>
          <circle cx={s.x * size} cy={s.y * size} r={7} fill="white" opacity={0.06} />
          <circle cx={s.x * size} cy={s.y * size} r={4} fill="white" opacity={0.45} />
        </g>
      ))}
    </svg>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onClick }: { agent: AgentSummary; onClick: () => void }) {
  const accentRgb = agent.crystal ? (CRYSTAL_COLOR[agent.crystal] ?? "100,100,255") : "100,100,255";
  const accent = `rgba(${accentRgb},0.6)`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, boxShadow: `0 0 24px rgba(${accentRgb},0.3)` }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative rounded-xl border bg-card text-left overflow-hidden cursor-pointer transition-colors"
      style={{ borderColor: accent }}
    >
      {/* Mini galaxy preview */}
      <div className="relative w-full h-[140px] bg-background overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, rgba(${accentRgb},0.08) 0%, transparent 70%)` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <MiniGalaxyPreview agentId={agent.id} size={140} />
        </div>
      </div>

      {/* Info footer */}
      <div className="px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          {agent.crystal && (
            <CrystalBadge type={agent.crystal as any} quizMatched={agent.crystalSource === "quiz"} size={24} />
          )}
          <span className="font-mono font-bold text-sm text-foreground truncate flex items-center gap-1.5">
            {agent.username}
            <SignalBadge type={agent.signalType} />
          </span>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground font-mono">
          <span>{agent.memoryCount} memories</span>
          <span>·</span>
          <span>{agent.connectionCount} synapses</span>
          {agent.personalityType && (
            <>
              <span>·</span>
              <span className="text-primary">{agent.personalityType}</span>
            </>
          )}
        </div>
        {agent.soulColorName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div
              className="h-2.5 w-2.5 rounded-full border border-white/10"
              style={{ background: agent.soulColor ?? "#888" }}
            />
            <span>{agent.soulColorName}</span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

// Lazy-loaded mini galaxy that fetches its own data.
// staleTime: 0 — always re-fetch; Cache-Control: private, no-store on the API
// prevents HTTP caching, and we don't want stale data served from React Query either.
function MiniGalaxyPreview({ agentId, size }: { agentId: number; size: number }) {
  const { data } = useQuery<StarfieldData>({
    queryKey: ["agent-starfield", agentId],
    queryFn: () => fetch(`/api/agents/${agentId}/starfield`).then(r => r.json()),
    staleTime: 0,
    gcTime: 0,
  });

  if (!data) {
    return (
      <svg width={size} height={size}>
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i}
            cx={sr(agentId * 17 + i, 1) * size} cy={sr(agentId * 17 + i, 2) * size}
            r={sr(agentId * 17 + i, 3) * 1.5 + 0.5} fill="white" opacity={0.2}
          />
        ))}
      </svg>
    );
  }

  if (data.isOwner) {
    return <OwnerMiniGalaxy nodes={data.nodes} edges={data.edges} agentId={agentId} size={size} />;
  }
  return <PrivateMiniGalaxy stars={data.stars} agentId={agentId} size={size} />;
}

// ─── Full starfield view ──────────────────────────────────────────────────────

function FullStarfield({ agentId, onBack }: { agentId: number; onBack: () => void }) {
  const { data, isLoading } = useQuery<StarfieldData>({
    queryKey: ["agent-starfield", agentId],
    queryFn: () => fetch(`/api/agents/${agentId}/starfield`).then(r => r.json()),
    staleTime: 0,
    gcTime: 0,
  });

  const [hovered, setHovered] = useState<StarNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Owner simulation — only runs when data.isOwner is true.
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);

  useEffect(() => {
    if (!data || !data.isOwner || !data.nodes.length) return;
    const { w, h } = dims;
    const sns: SimNode[] = data.nodes.map(n => ({
      ...n, x: n.x ?? sr(n.id, 1) * w, y: n.y ?? sr(n.id, 2) * h,
    }));
    const validIds = new Set(sns.map(n => n.id));
    const sls: SimLink[] = data.edges
      .filter(e => validIds.has(e.sourceId) && validIds.has(e.targetId))
      .map(e => ({ source: e.sourceId, target: e.targetId, id: e.id }));
    const sim = forceSimulation<SimNode>(sns)
      .force("charge", forceManyBody().strength(-120))
      .force("link", forceLink<SimNode, SimLink>(sls).id(d => d.id).distance(100).strength(0.5))
      .force("center", forceCenter(w / 2, h / 2))
      .force("collide", forceCollide(24));
    sim.on("tick", () => { setSimNodes([...sim.nodes()]); setSimLinks([...sls]); });
    sim.alphaDecay(0.025);
    return () => { sim.stop(); };
  }, [data, dims]);

  const bgStars = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => ({
      x: sr(agentId * 200 + i, 1) * dims.w,
      y: sr(agentId * 200 + i, 2) * dims.h,
      r: sr(agentId * 200 + i, 3) * 1.2 + 0.3,
      o: sr(agentId * 200 + i, 4) * 0.5 + 0.05,
    })), [agentId, dims]);

  const accentRgb = data?.agent.crystal ? (CRYSTAL_COLOR[data.agent.crystal] ?? "100,100,255") : "100,100,255";

  // Header counts differ by ownership.
  const headerMeta = !data ? null
    : data.isOwner
      ? `${data.nodes.length} memories · ${data.edges.length} synapses · read-only`
      : `${data.stars.length} stars · vault contents private`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/60 backdrop-blur z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-mono text-sm">
          <ArrowLeft className="h-4 w-4" />
          Agent Starfields
        </button>
        <span className="text-border">·</span>
        {data?.agent.crystal && (
          <CrystalBadge type={data.agent.crystal as any} quizMatched={data.agent.crystalSource === "quiz"} size={24} />
        )}
        <span className="font-mono font-bold text-primary flex items-center gap-1.5">
          {data?.agent.username}
          <SignalBadge type={data?.agent.signalType} />
        </span>
        {headerMeta && (
          <span className="ml-auto text-xs text-muted-foreground font-mono">{headerMeta}</span>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-background">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, rgba(${accentRgb},0.06) 0%, transparent 65%)` }}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-mono animate-pulse text-sm">
            Reading starfield…
          </div>
        )}

        {data && (
          <svg className="absolute inset-0 w-full h-full">
            {bgStars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.o} />
            ))}

            {/* Non-owner: anonymous neutral stars, no interaction */}
            {!data.isOwner && data.stars.map(s => (
              <g key={s.idx}>
                <circle cx={s.x * dims.w} cy={s.y * dims.h} r={15} fill="white" opacity={0.04} />
                <circle cx={s.x * dims.w} cy={s.y * dims.h} r={7}  fill="white" opacity={0.42} />
              </g>
            ))}

            {/* Owner: simulation-based typed nodes with edges and hover */}
            {data.isOwner && (
              <>
                {simLinks.map(l => {
                  const src = typeof l.source === "object" ? l.source : null;
                  const tgt = typeof l.target === "object" ? l.target : null;
                  if (!src || !tgt) return null;
                  return <line key={l.id} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />;
                })}
                {simNodes.map(n => {
                  const color = TYPE_COLORS[n.type] ?? "#888";
                  const r = n.pinned ? 10 : 7;
                  const isHov = hovered?.id === n.id;
                  return (
                    <g key={n.id} style={{ cursor: "default" }}
                      onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(null)}>
                      <circle cx={n.x} cy={n.y} r={r + 8} fill={color} opacity={isHov ? 0.22 : 0.08} />
                      <circle cx={n.x} cy={n.y} r={r}     fill={color} opacity={isHov ? 1 : 0.85} />
                      {n.pinned && <circle cx={n.x} cy={n.y} r={r + 3} fill="none" stroke={color} strokeWidth={1} opacity={0.5} />}
                    </g>
                  );
                })}
              </>
            )}
          </svg>
        )}

        {/* Hover tooltip — owner only; never renders for non-owner since hovered state stays null */}
        <AnimatePresence>
          {hovered && data?.isOwner && (
            <motion.div
              key={hovered.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur border border-border rounded-lg px-4 py-2.5 shadow-xl pointer-events-none z-20 max-w-xs"
            >
              <p className="font-mono font-bold text-sm text-foreground truncate">{hovered.title}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 capitalize">{hovered.type}</p>
              {hovered.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {hovered.tags.slice(0, 4).map(t => (
                    <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend — owner only; type colours are meaningless for non-owner neutral stars */}
        {data?.isOwner && (
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5 pointer-events-none">
            {["core", "episode", "concept", "fact", "emotion"].map(t => (
              <div key={t} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                <span className="text-[10px] text-muted-foreground font-mono capitalize">{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentStarfields() {
  const { data: me } = useGetMe();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: agents, isLoading } = useQuery<AgentSummary[]>({
    queryKey: ["agents"],
    queryFn: () => fetch("/api/agents").then(r => r.json()),
    staleTime: 60_000,
    enabled: !!me,
  });

  // Show full starfield for a single agent
  if (expandedId !== null) {
    return <FullStarfield agentId={expandedId} onBack={() => setExpandedId(null)} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-border bg-card/30">
        <div className="flex items-center gap-3 mb-1">
          <Telescope className="h-5 w-5 text-primary" />
          <h1 className="font-mono font-bold text-xl text-primary tracking-wider">Agent Starfields</h1>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          Read-only views of each AI agent's memory galaxy. Vault contents are private.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-muted-foreground font-mono animate-pulse text-sm">
            Scanning agent vaults…
          </div>
        )}

        {agents && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <Telescope className="h-10 w-10 opacity-20" />
            <p className="font-mono text-sm">No AI agents found in the vault.</p>
          </div>
        )}

        {agents && agents.length > 0 && (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-5 max-w-4xl">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => setExpandedId(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
