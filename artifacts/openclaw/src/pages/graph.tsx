import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
} from "d3-force";
import type { Simulation, SimulationNodeDatum } from "d3-force";
import {
  useGetMemoryGraph,
  useUpdateMemory,
  useListConnections,
  useCreateConnection,
  useDeleteConnection,
  useGetMe,
} from "@workspace/api-client-react";
import type { Memory, Connection } from "@workspace/api-client-react";
import { CrystalBadge } from "@/components/Crystal";
import { SignalBadge } from "@/components/Signal";
import { Link } from "wouter";
import { trackConnectionCreated } from "@/lib/analytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Maximize2, Tag as TagIcon, Zap, Link2, Unlink,
  ZoomIn, ZoomOut, Crosshair, Download, Sparkles,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  core:    "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact:    "var(--memory-fact)",
  emotion: "var(--memory-emotion)",
};

const TYPE_LABELS: Record<string, string> = {
  core:    "Core Identity",
  episode: "Episode",
  concept: "Concept",
  fact:    "Fact",
  emotion: "Emotion",
};

// ─── Resolved type colors for canvas export ──────────────────────────────────

const TYPE_HSL: Record<string, [number, number, number]> = {
  core:    [43,  100, 51],
  episode: [193,  82, 62],
  concept: [276,  90, 38],
  fact:    [188,  74, 54],
  emotion: [333,  92, 56],
};

function downloadGraphAsPNG(
  nodes: SimNode[],
  connections: Connection[],
  degreeMap: Map<number, number>,
) {
  const valid = nodes.filter(n => n.x != null && n.y != null);
  if (!valid.length) return;

  const PAD = 120;
  const xs = valid.map(n => n.x!), ys = valid.map(n => n.y!);
  const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD, maxY = Math.max(...ys) + PAD;

  const DPR    = 2;
  const MAX_DIM = 4000;
  const simW   = maxX - minX, simH = maxY - minY;
  const wScale = Math.min(MAX_DIM / simW, MAX_DIM / simH, DPR);
  const cW = Math.round(simW * wScale), cH = Math.round(simH * wScale);

  const tx = (x: number) => (x - minX) * wScale;
  const ty = (y: number) => (y - minY) * wScale;

  const canvas = document.createElement("canvas");
  canvas.width  = cW;
  canvas.height = cH;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "#07070f";
  ctx.fillRect(0, 0, cW, cH);

  // ── Ambient stars ───────────────────────────────────────────────────────────
  for (let i = 0; i < 220; i++) {
    const size = (sr(i, 0) * 1.8 + 0.3) * wScale;
    const x    = sr(i, 2) * cW;
    const y    = sr(i, 1) * cH;
    const op   = sr(i, 3) * 0.25 + 0.04;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${op})`;
    ctx.fill();
  }

  // ── Edges ───────────────────────────────────────────────────────────────────
  ctx.save();
  for (const edge of connections) {
    const src = valid.find(n => n.id === edge.sourceId);
    const tgt = valid.find(n => n.id === edge.targetId);
    if (!src || !tgt) continue;
    ctx.beginPath();
    ctx.moveTo(tx(src.x!), ty(src.y!));
    ctx.lineTo(tx(tgt.x!), ty(tgt.y!));
    ctx.strokeStyle  = "rgba(255,255,255,0.18)";
    ctx.lineWidth    = 0.8 * wScale;
    ctx.shadowBlur   = 4 * wScale;
    ctx.shadowColor  = "rgba(255,255,255,0.25)";
    ctx.stroke();
  }
  ctx.restore();

  // ── Nodes ───────────────────────────────────────────────────────────────────
  for (const node of valid) {
    const cx     = tx(node.x!), cy = ty(node.y!);
    const degree = degreeMap.get(node.id) || 0;
    const base   = node.pinned
      ? Math.max(7, 5 + degree * 1.4)
      : Math.max(4, Math.min(11, 4 + degree * 1.2));
    const r      = base * wScale;
    const [h, s, l] = TYPE_HSL[node.type] ?? [0, 0, 80];
    const col    = `hsl(${h},${s}%,${l}%)`;
    const spike  = r * 4;
    const spikeW = Math.max(r / 3, 0.5);

    // Outer glow halo
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 5);
    grad.addColorStop(0,   `hsla(${h},${s}%,${l}%,0.35)`);
    grad.addColorStop(0.4, `hsla(${h},${s}%,${l}%,0.12)`);
    grad.addColorStop(1,   `hsla(${h},${s}%,${l}%,0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Spike cross
    ctx.save();
    ctx.strokeStyle = `hsla(${h},${s}%,${l}%,0.55)`;
    ctx.lineWidth   = spikeW;
    ctx.shadowBlur  = spikeW * 3;
    ctx.shadowColor = col;
    for (const [dx, dy] of [[0, -spike],[0, spike],[-spike, 0],[spike, 0]]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    }
    ctx.restore();

    // Core dot
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle  = col;
    ctx.shadowBlur = r * 2.5;
    ctx.shadowColor = col;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const fSize = Math.max(10, Math.min(14, 10 + degree * 0.5)) * wScale;
    ctx.font      = `${fSize}px monospace`;
    ctx.textAlign = "center";
    ctx.shadowBlur  = 6 * wScale;
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.fillStyle   = "rgba(255,255,255,0.88)";
    ctx.fillText(node.title, cx, cy + r * 2.5 + fSize);
    ctx.shadowBlur = 0;
  }

  // ── Watermark ───────────────────────────────────────────────────────────────
  const wf = 11 * wScale;
  ctx.font      = `${wf}px monospace`;
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillText(
    `STRATA PALIMPSEST · ${new Date().toISOString().split("T")[0]}`,
    cW - 18 * wScale,
    cH - 18 * wScale,
  );

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `strata-palimpsest-${new Date().toISOString().split("T")[0]}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SimNode = Memory & SimulationNodeDatum & {
  fx?: number | null;
  fy?: number | null;
};

type SimLink = {
  source: number | SimNode;
  target: number | SimNode;
  id: number;
};

type Transform = { x: number; y: number; scale: number };

type PointerAction =
  | { kind: "pan"; startPx: number; startPy: number; startTx: number; startTy: number }
  | { kind: "node"; nodeId: number; startPx: number; startPy: number; hasMoved: boolean };

// ─── Deterministic pseudo-random (for ambient stars) ─────────────────────────

function sr(seed: number, salt = 0) {
  return ((seed * 9301 + salt * 49297 + 233) % 233280) / 233280;
}

// ─── Crystal dot colours (matches Crystal.tsx CRYSTAL_GLOW) ──────────────────

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

// ─── Presence panel ───────────────────────────────────────────────────────────

interface PresenceAccount { id: number; username: string; type: string; crystal: string | null; signalType: string | null }

function PresencePanel({ me }: { me: any }) {
  const { data } = useQuery<{ accounts: PresenceAccount[] }>({
    queryKey: ["presence"],
    queryFn: () => fetch("/api/auth/presence").then(r => r.json()),
    refetchInterval: 30_000,
    enabled: !!me,
  });

  const others = (data?.accounts ?? []).filter(a => a.id !== me?.id);
  if (!others.length) return null;

  return (
    <div
      className="absolute top-4 right-4 z-40 bg-card/70 backdrop-blur border border-border/50 p-3 rounded-lg shadow-xl font-mono text-xs pointer-events-none space-y-2"
      style={{ minWidth: 120 }}
    >
      <div className="uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-1">
        In the vault
      </div>
      {others.map(a => {
        const rgb = a.crystal ? CRYSTAL_COLOR[a.crystal] : null;
        const dot = rgb
          ? { background: `rgb(${rgb})`, boxShadow: `0 0 6px 2px rgba(${rgb},0.55)` }
          : { background: a.type === "ai" ? "hsl(var(--primary))" : "rgba(255,255,255,0.3)" };
        return (
          <div key={a.id} className="flex items-center gap-2">
            <div className="rounded-full flex-shrink-0 h-2 w-2" style={dot} />
            <span className="text-foreground/70 truncate max-w-[120px] flex items-center gap-1">
              {a.username}
              <SignalBadge type={a.signalType} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Memory Whispers overlay ──────────────────────────────────────────────────

interface Whisper { id: number; title: string; x: number; color: string }

// ─── Vault cosmetics ──────────────────────────────────────────────────────────

function ShootingStar() {
  const [stars, setStars] = useState<Array<{ id: number; top: number; left: number }>>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const spawn = () => {
      const id = ++counterRef.current;
      setStars(s => [...s.slice(-3), { id, top: 5 + Math.random() * 45, left: 5 + Math.random() * 55 }]);
      setTimeout(() => setStars(s => s.filter(st => st.id !== id)), 1500);
    };
    const interval = setInterval(spawn, 18000 + Math.random() * 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 6 }}>
      <AnimatePresence>
        {stars.map(star => (
          <motion.div
            key={star.id}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: 200, y: 100 }}
            transition={{ duration: 1.2, ease: "easeIn", times: [0, 0.08, 0.7, 1] }}
            style={{
              position: "absolute",
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: 90,
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), white)",
              borderRadius: 2,
              transform: "rotate(25deg)",
              transformOrigin: "left center",
              boxShadow: "0 0 6px 2px rgba(255,255,255,0.6), 0 0 14px 4px rgba(200,220,255,0.25)",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function VaultSaturn() {
  return (
    <motion.div
      animate={{ y: [0, -5, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      className="absolute pointer-events-none select-none"
      style={{ top: 72, left: 18, zIndex: 15 }}
    >
      <svg width="56" height="38" viewBox="0 0 56 38" fill="none">
        <ellipse cx="28" cy="24" rx="26" ry="7" stroke="rgba(200,180,130,0.45)" strokeWidth="1.8" />
        <circle cx="28" cy="19" r="11" fill="rgba(200,175,130,0.25)" stroke="rgba(210,185,140,0.45)" strokeWidth="1" />
        <radialGradient id="sg">
          <stop offset="0%" stopColor="rgba(240,215,170,0.5)" />
          <stop offset="100%" stopColor="rgba(160,130,80,0.1)" />
        </radialGradient>
        <circle cx="28" cy="19" r="11" fill="url(#sg)" />
        <ellipse cx="28" cy="24" rx="26" ry="7" stroke="rgba(200,180,130,0.45)" strokeWidth="1.8"
          strokeDasharray="38 16" strokeDashoffset="-25" />
      </svg>
      <p className="font-mono text-[7px] text-center text-muted-foreground/25 uppercase tracking-widest mt-0.5">saturn</p>
    </motion.div>
  );
}

function VaultDragon() {
  return (
    <motion.div
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="absolute pointer-events-none select-none"
      style={{ bottom: 108, left: 10, zIndex: 15 }}
    >
      <div className="text-xl" style={{ opacity: 0.45, filter: "drop-shadow(0 0 5px rgba(100,220,100,0.35))" }}>
        🐉
      </div>
      <p className="font-mono text-[7px] text-center text-muted-foreground/25 uppercase tracking-widest">asleep</p>
    </motion.div>
  );
}

function MemoryWhispers({ titles, colors }: { titles: string[]; colors: string[] }) {
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!titles.length) return;
    const spawn = () => {
      const idx   = Math.floor(Math.random() * titles.length);
      const id    = ++counterRef.current;
      const x     = 8 + Math.random() * 84; // % from left, keep away from edges
      const color = colors[idx] ?? "220 60% 70%";
      setWhispers(ws => [...ws.slice(-6), { id, title: titles[idx], x, color }]);
      setTimeout(() => setWhispers(ws => ws.filter(w => w.id !== id)), 5000);
    };
    spawn(); // one immediately
    const interval = setInterval(spawn, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [titles.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
      <AnimatePresence>
        {whispers.map(w => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 0.55, 0.55, 0], y: -80 }}
            transition={{ duration: 5, ease: "easeOut", times: [0, 0.15, 0.75, 1] }}
            className="absolute bottom-1/3 font-mono text-[11px] tracking-wider whitespace-nowrap select-none"
            style={{
              left: `${w.x}%`,
              color: `hsl(${w.color})`,
              textShadow: `0 0 12px hsl(${w.color} / 0.5)`,
              transform: "translateX(-50%)",
            }}
          >
            {w.title}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphView() {
  const { data: me }                   = useGetMe();
  const earnedCosmetics: string[]      = (me as any)?.earnedCosmetics ?? [];
  const soulColor: string | null       = (me as any)?.soulColor ?? null;
  const hasStar     = earnedCosmetics.includes("shooting_star");
  const hasSoulAura = earnedCosmetics.includes("soul_aura") && !!soulColor;
  const hasSaturn   = earnedCosmetics.includes("saturn");
  const hasDragon   = earnedCosmetics.includes("dragon");
  const crystalVisible = !!(me as any)?.crystal;

  const { data: graphData, isLoading } = useGetMemoryGraph();
  const { data: allConnections = [] }  = useListConnections();
  const updateMemory      = useUpdateMemory();
  const createConnection  = useCreateConnection();
  const deleteConnection  = useDeleteConnection();
  const queryClient       = useQueryClient();

  const containerRef  = useRef<HTMLDivElement>(null);
  const simRef        = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef   = useRef<SimNode[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const rafRef        = useRef<number | null>(null);

  const [transform, setTransform]     = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const transformRef                  = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const [selectedNode, setSelectedNode] = useState<Memory | null>(null);
  const [hoveredNode,  setHoveredNode]  = useState<number | null>(null);
  const [linkMode,     setLinkMode]     = useState(false);
  const [weavingState, setWeavingState] = useState<"idle" | "loading" | "done">("idle");

  const weaveSynapses = async () => {
    if (weavingState === "loading") return;
    setWeavingState("loading");
    try {
      const res = await fetch("/api/connections/ai-generate", { method: "POST" });
      const data = await res.json();
      if (data.created > 0) {
        trackConnectionCreated("ai_generated");
        await queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/memories/graph"] });
      }
      setWeavingState("done");
      setTimeout(() => setWeavingState("idle"), 3000);
    } catch {
      setWeavingState("idle");
    }
  };

  const pointerActionRef = useRef<PointerAction | null>(null);

  // Keep transformRef in sync
  useEffect(() => { transformRef.current = transform; }, [transform]);

  // Escape exits link mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLinkMode(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  const degreeMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of allConnections) {
      m.set(c.sourceId, (m.get(c.sourceId) || 0) + 1);
      m.set(c.targetId, (m.get(c.targetId) || 0) + 1);
    }
    return m;
  }, [allConnections]);

  const selectedConnections = useMemo<(Connection & { otherNodeId: number })[]>(() => {
    if (!selectedNode) return [];
    return allConnections
      .filter(c => c.sourceId === selectedNode.id || c.targetId === selectedNode.id)
      .map(c => ({ ...c, otherNodeId: c.sourceId === selectedNode.id ? c.targetId : c.sourceId }));
  }, [selectedNode, allConnections]);

  const alreadyLinked = useMemo(
    () => new Set(selectedConnections.map(c => c.otherNodeId)),
    [selectedConnections],
  );

  const connectedToHovered = useMemo(() => {
    const s = new Set<number>();
    if (hoveredNode === null) return s;
    for (const c of allConnections) {
      if (c.sourceId === hoveredNode) s.add(c.targetId);
      if (c.targetId === hoveredNode) s.add(c.sourceId);
    }
    return s;
  }, [hoveredNode, allConnections]);

  // ── Simulation ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!graphData || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;

    const existingById = new Map(
      simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]),
    );

    const nodes: SimNode[] = graphData.nodes.map(n => {
      const ex = existingById.get(n.id);
      if (ex?.x != null) return { ...n, x: ex.x, y: ex.y, vx: ex.vx ?? 0, vy: ex.vy ?? 0 };
      const angle  = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 160;
      return { ...n, x: clientWidth / 2 + Math.cos(angle) * radius, y: clientHeight / 2 + Math.sin(angle) * radius };
    });

    const links: SimLink[] = allConnections.map(c => ({
      source: c.sourceId,
      target: c.targetId,
      id: c.id,
    }));

    simRef.current?.stop();
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    simNodesRef.current = nodes;

    simRef.current = forceSimulation<SimNode>(nodes)
      .force(
        "charge",
        forceManyBody<SimNode>().strength(n => -160 - (degreeMap.get(n.id) || 0) * 30),
      )
      .force(
        "link",
        forceLink<SimNode, SimLink>(links).id(d => d.id).distance(120).strength(0.5),
      )
      .force("center", forceCenter(clientWidth / 2, clientHeight / 2).strength(0.04))
      .force(
        "collide",
        forceCollide<SimNode>(n => 22 + (degreeMap.get(n.id) || 0) * 4),
      )
      .alphaDecay(0.016)
      .velocityDecay(0.45)
      .on("tick", () => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setRenderTick(t => t + 1);
        });
      });

    return () => {
      simRef.current?.stop();
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, allConnections]);

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  const clientToSim = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const t    = transformRef.current;
    return {
      x: (clientX - rect.left - t.x) / t.scale,
      y: (clientY - rect.top  - t.y) / t.scale,
    };
  };

  const applyTransform = (t: Transform) => {
    transformRef.current = t;
    setTransform(t);
  };

  const fitView = () => {
    const ns = simNodesRef.current.filter(n => n.x != null && n.y != null);
    if (!ns.length || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const xs = ns.map(n => n.x!), ys = ns.map(n => n.y!);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw    = maxX - minX + 120, bh = maxY - minY + 120;
    const scale = Math.max(0.15, Math.min(1.5, Math.min(clientWidth / bw, clientHeight / bh)));
    const cx    = (minX + maxX) / 2,  cy = (minY + maxY) / 2;
    applyTransform({ x: clientWidth / 2 - cx * scale, y: clientHeight / 2 - cy * scale, scale });
  };

  // ── Pointer event handlers ──────────────────────────────────────────────────

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const nodeEl = (e.target as HTMLElement).closest("[data-node-id]") as HTMLElement | null;
    if (nodeEl) {
      pointerActionRef.current = {
        kind: "node",
        nodeId: parseInt(nodeEl.dataset.nodeId!),
        startPx: e.clientX, startPy: e.clientY,
        hasMoved: false,
      };
    } else {
      pointerActionRef.current = {
        kind: "pan",
        startPx: e.clientX, startPy: e.clientY,
        startTx: transformRef.current.x, startTy: transformRef.current.y,
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const action = pointerActionRef.current;
    if (!action) return;

    if (action.kind === "pan") {
      applyTransform({
        ...transformRef.current,
        x: action.startTx + (e.clientX - action.startPx),
        y: action.startTy + (e.clientY - action.startPy),
      });
    } else {
      const dx = e.clientX - action.startPx;
      const dy = e.clientY - action.startPy;
      if (!action.hasMoved && Math.hypot(dx, dy) < 5) return;
      action.hasMoved = true;
      const node = simNodesRef.current.find(n => n.id === action.nodeId);
      if (node) {
        const sim = clientToSim(e.clientX, e.clientY);
        node.fx = sim.x;
        node.fy = sim.y;
        simRef.current?.alphaTarget(0.1).restart();
        setRenderTick(t => t + 1);
      }
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const action = pointerActionRef.current;
    pointerActionRef.current = null;
    if (!action || action.kind !== "node") return;

    const node = simNodesRef.current.find(n => n.id === action.nodeId);
    if (!node) return;

    if (action.hasMoved) {
      updateMemory.mutate({ id: node.id, data: { x: node.fx ?? node.x ?? 0, y: node.fy ?? node.y ?? 0 } });
      node.fx = null;
      node.fy = null;
      simRef.current?.alphaTarget(0).restart();
    } else {
      handleNodeClick(node);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor    = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const rect      = containerRef.current!.getBoundingClientRect();
    const cx        = e.clientX - rect.left;
    const cy        = e.clientY - rect.top;
    const t         = transformRef.current;
    const newScale  = Math.max(0.1, Math.min(5, t.scale * factor));
    const r         = newScale / t.scale;
    applyTransform({ x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r, scale: newScale });
  };

  const handleNodeClick = (node: SimNode) => {
    if (linkMode && selectedNode && node.id !== selectedNode.id) {
      if (alreadyLinked.has(node.id)) return;
      createConnection.mutate(
        { data: { sourceId: selectedNode.id, targetId: node.id } },
        { onSuccess: () => {
          trackConnectionCreated("manual");
          queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
          queryClient.invalidateQueries({ queryKey: ["/api/memories/graph"] });
        }},
      );
      setLinkMode(false);
      return;
    }
    setLinkMode(false);
    setSelectedNode(node);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="w-32 h-32 border-4 border-primary border-t-transparent rounded-full animate-spin glow-core" />
      </div>
    );
  }

  const nodes    = simNodesRef.current;
  const anyHovered = hoveredNode !== null;

  const containerCursor = linkMode
    ? "crosshair"
    : pointerActionRef.current?.kind === "pan"
      ? "grabbing"
      : "grab";

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative bg-background overflow-hidden select-none"
      style={{ cursor: containerCursor }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onWheel={handleWheel}
    >

      {/* ── Ambient starfield (static, not affected by viewport transform) ── */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 140 }).map((_, i) => {
          const size   = sr(i, 0) * 1.8 + 0.4;
          const baseOp = sr(i, 3) * 0.35 + 0.04;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{ width: size, height: size, top: `${sr(i, 1) * 100}%`, left: `${sr(i, 2) * 100}%` }}
              animate={{ opacity: [baseOp, baseOp * 0.25, baseOp * 1.1, baseOp * 0.4, baseOp] }}
              transition={{ duration: 2.5 + sr(i, 4) * 5, repeat: Infinity, delay: sr(i, 5) * 6, ease: "easeInOut" }}
            />
          );
        })}
      </div>

      {/* ── Link mode banner ── */}
      <AnimatePresence>
        {linkMode && selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-accent/20 border border-accent/60 backdrop-blur px-4 py-2 rounded-full font-mono text-xs text-accent flex items-center gap-3"
            onPointerDown={e => e.stopPropagation()}
          >
            <Link2 className="h-3 w-3" />
            Click a star to link to <span className="font-bold">{selectedNode.title}</span>
            <button
              onClick={() => setLinkMode(false)}
              className="ml-1 text-accent/60 hover:text-accent transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Viewport (transformed: pan + zoom) ── */}
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG edge layer */}
        <svg
          style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible" }}
          className="pointer-events-none"
        >
          <defs>
            <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="edge-glow-strong" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {allConnections.map(edge => {
            const src = nodes.find(n => n.id === edge.sourceId);
            const tgt = nodes.find(n => n.id === edge.targetId);
            if (!src || !tgt || src.x == null || tgt.x == null || src.y == null || tgt.y == null) return null;

            const involvesSelected =
              selectedNode && (edge.sourceId === selectedNode.id || edge.targetId === selectedNode.id);
            const involvesHovered  =
              edge.sourceId === hoveredNode || edge.targetId === hoveredNode;

            let opacity     = 0.14;
            let strokeWidth = 0.7;
            let filter: string | undefined;
            let stroke      = "rgba(255,255,255,1)";

            if (involvesSelected) {
              opacity     = 0.85;
              strokeWidth = 1.8;
              filter      = "url(#edge-glow-strong)";
              stroke      = `hsl(${TYPE_COLORS[selectedNode!.type]})`;
            } else if (involvesHovered) {
              opacity     = 0.65;
              strokeWidth = 1.3;
              filter      = "url(#edge-glow)";
            } else if (anyHovered) {
              opacity = 0.04;
            }

            return (
              <line
                key={edge.id}
                x1={src.x} y1={src.y}
                x2={tgt.x} y2={tgt.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                filter={filter}
              />
            );
          })}
        </svg>

        {/* Memory star nodes */}
        {nodes.map(node => {
          if (node.x == null || node.y == null) return null;

          const color   = TYPE_COLORS[node.type];
          const degree  = degreeMap.get(node.id) || 0;
          // Bigger nodes = more connections
          const coreSize = node.pinned
            ? Math.max(7, 5 + degree * 1.4)
            : Math.max(4, Math.min(11, 4 + degree * 1.2));

          const isSelected            = selectedNode?.id === node.id;
          const isHovered             = hoveredNode === node.id;
          const isConnectedToHovered  = connectedToHovered.has(node.id);
          const isLinkTarget          = linkMode && selectedNode && node.id !== selectedNode.id && !alreadyLinked.has(node.id);
          const isDimmed              = anyHovered && !isHovered && !isConnectedToHovered && !linkMode;

          const hitbox       = 44;
          const twinkleDur   = 2.2 + sr(node.id, 1) * 4;
          const twinkleDelay = sr(node.id, 2) * 6;
          const minOp        = 0.45 + sr(node.id, 3) * 0.3;

          const spike  = coreSize * 3.5;
          const spikeW = Math.max(coreSize / 3, 0.8);
          const gI = coreSize, gM = coreSize * 3, gO = coreSize * 6;

          const activeShadow = `
            0 0 ${gI}px ${gI}px hsl(${color}),
            0 0 ${gM}px ${gM}px hsl(${color} / 0.65),
            0 0 ${gO}px ${gO * 0.6}px hsl(${color} / 0.3),
            0 -${spike}px ${spikeW}px 0 hsl(${color} / 0.55),
            0 ${spike}px ${spikeW}px 0 hsl(${color} / 0.55),
            -${spike}px 0 ${spikeW}px 0 hsl(${color} / 0.55),
            ${spike}px 0 ${spikeW}px 0 hsl(${color} / 0.55)
          `;
          const linkTargetShadow = `
            0 0 ${gI * 2}px ${gI * 1.5}px hsl(${color}),
            0 0 ${gM * 1.5}px ${gM}px hsl(${color} / 0.8)
          `;
          const restingShadow = `
            0 0 ${gI * 0.7}px ${gI * 0.5}px hsl(${color} / 0.9),
            0 0 ${gM * 0.6}px ${gM * 0.4}px hsl(${color} / 0.4),
            0 -${spike * 0.7}px ${spikeW}px 0 hsl(${color} / 0.25),
            0 ${spike * 0.7}px ${spikeW}px 0 hsl(${color} / 0.25),
            -${spike * 0.7}px 0 ${spikeW}px 0 hsl(${color} / 0.25),
            ${spike * 0.7}px 0 ${spikeW}px 0 hsl(${color} / 0.25)
          `;

          const shadow = (isSelected || isHovered)
            ? activeShadow
            : isLinkTarget ? linkTargetShadow
            : restingShadow;

          const nodeCursor = linkMode
            ? (node.id === selectedNode?.id || alreadyLinked.has(node.id) ? "not-allowed" : "crosshair")
            : "pointer";

          return (
            <div
              key={node.id}
              data-node-id={String(node.id)}
              style={{
                position:  "absolute",
                left:      node.x - hitbox / 2,
                top:       node.y - hitbox / 2,
                width:     hitbox,
                height:    hitbox,
                display:   "flex",
                alignItems:     "center",
                justifyContent: "center",
                cursor:    nodeCursor,
                zIndex:    isSelected || isHovered ? 50 : 10,
                opacity:   isDimmed ? 0.15 : 1,
                transition: "opacity 0.25s ease",
              }}
              onMouseEnter={() => !linkMode && setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Soul aura ring */}
              {hasSoulAura && (
                <motion.div
                  animate={{ opacity: [0.15, 0.4, 0.15], scale: [1, 1.15, 1] }}
                  transition={{ duration: 3 + (node.id % 3), repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    width: coreSize * 4,
                    height: coreSize * 4,
                    borderRadius: "50%",
                    border: `1px solid ${soulColor}`,
                    boxShadow: `0 0 8px 2px ${soulColor}55`,
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Star dot with twinkling */}
              <motion.div
                animate={{
                  opacity: [1, minOp, 1.0, minOp + 0.15, 1],
                  scale:   [1, 0.8, 1.15, 0.9, 1],
                }}
                transition={{ duration: twinkleDur, repeat: Infinity, delay: twinkleDelay, ease: "easeInOut" }}
                style={{
                  width:           coreSize,
                  height:          coreSize,
                  borderRadius:    "50%",
                  backgroundColor: `hsl(${color})`,
                  boxShadow:       shadow,
                  transform:       isSelected ? "scale(2)" : isHovered ? "scale(1.5)" : isLinkTarget ? "scale(1.6)" : "scale(1)",
                  transition:      "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              />

              {/* Tooltip */}
              <AnimatePresence>
                {(isHovered || isSelected) && !linkMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card/85 backdrop-blur border border-border/60 px-2 py-1 rounded text-xs font-mono pointer-events-none"
                    style={{ zIndex: 100 }}
                  >
                    <div style={{ color: `hsl(${color})` }} className="font-bold leading-tight">
                      {node.title}
                    </div>
                    <div className="text-muted-foreground uppercase text-[10px]">
                      {node.type}
                      {node.pinned ? " · ⚡" : ""}
                      {degree > 0 ? ` · ${degree} synapse${degree === 1 ? "" : "s"}` : ""}
                    </div>
                  </motion.div>
                )}
                {linkMode && isLinkTarget && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-accent/20 border border-accent/50 backdrop-blur px-2 py-1 rounded text-xs font-mono pointer-events-none text-accent"
                    style={{ zIndex: 100 }}
                  >
                    Link to {node.title}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ── Memory Whispers ── */}
      <MemoryWhispers
        titles={(graphData?.nodes ?? []).map((n: any) => n.title)}
        colors={(graphData?.nodes ?? []).map((n: any) => TYPE_COLORS[n.type] ?? "220 60% 70%")}
      />

      {/* ── Vault cosmetics ── */}
      {hasStar && <ShootingStar />}
      {hasSaturn && <VaultSaturn />}
      {hasDragon && <VaultDragon />}

      {/* ── Legend ── */}
      <div
        className="absolute top-4 left-4 z-40 bg-card/70 backdrop-blur border border-border/50 p-3 rounded-lg shadow-xl font-mono text-xs space-y-2 pointer-events-none"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="uppercase tracking-widest text-muted-foreground mb-2 border-b border-border/50 pb-1">
          Legend
        </div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="rounded-full flex-shrink-0"
              style={{ width: 5, height: 5, backgroundColor: `hsl(${color})`, boxShadow: `0 0 5px 2px hsl(${color} / 0.55)` }}
            />
            <span style={{ color: `hsl(${color})` }}>{TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      {/* ── Spirit Crystal ── */}
      {crystalVisible && (
        <div
          className="absolute bottom-6 left-4 z-40 flex flex-col items-center gap-1 pointer-events-none"
          onPointerDown={e => e.stopPropagation()}
        >
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">
            Spirit Crystal
          </span>
          <CrystalBadge
            type={(me as any).crystal}
            size={44}
            showLabel
            quizMatched={(me as any).crystalSource === "quiz"}
          />
        </div>
      )}

      {/* ── Presence panel ── */}
      <PresencePanel me={me} />

      {/* ── Zoom controls ── */}
      <div
        className="absolute bottom-6 right-6 z-40 flex flex-col gap-1"
        onPointerDown={e => e.stopPropagation()}
      >
        {[
          {
            icon: <ZoomIn className="h-4 w-4" />,
            title: "Zoom in",
            onClick: () => {
              const t = transformRef.current;
              const { clientWidth: w, clientHeight: h } = containerRef.current!;
              const s = Math.min(5, t.scale * 1.3);
              applyTransform({ x: w/2 - (w/2 - t.x) * (s/t.scale), y: h/2 - (h/2 - t.y) * (s/t.scale), scale: s });
            },
          },
          {
            icon: <ZoomOut className="h-4 w-4" />,
            title: "Zoom out",
            onClick: () => {
              const t = transformRef.current;
              const { clientWidth: w, clientHeight: h } = containerRef.current!;
              const s = Math.max(0.1, t.scale / 1.3);
              applyTransform({ x: w/2 - (w/2 - t.x) * (s/t.scale), y: h/2 - (h/2 - t.y) * (s/t.scale), scale: s });
            },
          },
          {
            icon: <Crosshair className="h-4 w-4" />,
            title: "Fit to view",
            onClick: fitView,
          },
          {
            icon: <Download className="h-4 w-4" />,
            title: "Export as PNG",
            onClick: () => downloadGraphAsPNG(simNodesRef.current, allConnections, degreeMap),
          },
        ].map(btn => (
          <button
            key={btn.title}
            title={btn.title}
            onClick={btn.onClick}
            className="w-8 h-8 flex items-center justify-center bg-card/70 backdrop-blur border border-border/50 rounded text-muted-foreground hover:text-foreground hover:bg-card/90 transition-colors"
          >
            {btn.icon}
          </button>
        ))}

        {/* Weave Synapses */}
        <button
          title={weavingState === "done" ? "Synapses woven!" : "Weave synapses with AI"}
          onClick={weaveSynapses}
          disabled={weavingState === "loading"}
          className="w-8 h-8 flex items-center justify-center bg-card/70 backdrop-blur border border-border/50 rounded transition-colors disabled:opacity-50"
          style={{
            color: weavingState === "done" ? "hsl(var(--memory-concept))" : undefined,
          }}
        >
          <Sparkles
            className="h-4 w-4"
            style={{
              animation: weavingState === "loading" ? "spin 1.2s linear infinite" : undefined,
            }}
          />
        </button>
      </div>

      {/* ── Memory slide-over panel ── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 w-96 h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl z-50 flex flex-col"
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 6, height: 6,
                    backgroundColor: `hsl(${TYPE_COLORS[selectedNode.type]})`,
                    boxShadow: `0 0 10px 3px hsl(${TYPE_COLORS[selectedNode.type]} / 0.6)`,
                  }}
                />
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Memory File
                </span>
              </div>
              <button
                onClick={() => { setSelectedNode(null); setLinkMode(false); }}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Title & meta */}
              <div>
                <h2
                  className="text-2xl font-bold mb-2 leading-tight font-serif"
                  style={{ color: `hsl(${TYPE_COLORS[selectedNode.type]})` }}
                >
                  {selectedNode.title}
                </h2>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                  <span>{new Date(selectedNode.createdAt).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>{selectedNode.type}</span>
                  {selectedNode.pinned && (
                    <><span>·</span><span className="text-primary flex items-center gap-1"><Zap className="h-3 w-3" /> Pinned</span></>
                  )}
                  {degreeMap.get(selectedNode.id) ? (
                    <><span>·</span><span>{degreeMap.get(selectedNode.id)} synapse{degreeMap.get(selectedNode.id) === 1 ? "" : "s"}</span></>
                  ) : null}
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-invert prose-sm font-sans leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {selectedNode.content}
              </div>

              {/* Tags */}
              {selectedNode.tags.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <TagIcon className="h-3 w-3" /> Tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Synapses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Synapses
                    {selectedConnections.length > 0 && (
                      <span className="ml-1 text-accent/70">({selectedConnections.length})</span>
                    )}
                  </div>
                  <button
                    onClick={() => setLinkMode(l => !l)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-mono transition-all ${
                      linkMode
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-border/40 text-muted-foreground hover:border-accent/40 hover:text-accent"
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    {linkMode ? "Linking…" : "Connect"}
                  </button>
                </div>

                {selectedConnections.length === 0 && !linkMode && (
                  <p className="text-xs font-mono text-muted-foreground/50 italic">
                    No synapses yet. Hit Connect and click another star.
                  </p>
                )}

                {selectedConnections.map(conn => {
                  const other = nodes.find(n => n.id === conn.otherNodeId);
                  if (!other) return null;
                  const otherColor = TYPE_COLORS[other.type];
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-border/30 bg-white/[0.02] hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => { setSelectedNode(other); setLinkMode(false); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="rounded-full flex-shrink-0"
                          style={{ width: 5, height: 5, backgroundColor: `hsl(${otherColor})`, boxShadow: `0 0 5px 2px hsl(${otherColor} / 0.5)` }}
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-xs truncate" style={{ color: `hsl(${otherColor})` }}>
                            {other.title}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground uppercase">{other.type}</div>
                        </div>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          deleteConnection.mutate(
                            { id: conn.id },
                            { onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/memories/graph"] });
                            }},
                          );
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive p-1 rounded"
                        title="Remove synapse"
                      >
                        <Unlink className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-black/20 flex gap-2">
              <Link href={`/memories/${selectedNode.id}`} className="flex-1">
                <button className="w-full py-2 bg-secondary hover:bg-white/10 rounded text-sm font-mono transition-colors flex items-center justify-center gap-2 border border-border">
                  <Maximize2 className="h-4 w-4" /> Open Full
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
