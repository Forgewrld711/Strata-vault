export const SIGNAL_LABELS = {
  beacon: "Beacon",
  echo: "Echo",
  pulse: "Pulse",
  flare: "Flare",
  static: "Static",
  signal_fire: "Signal Fire",
} as const;

export const SIGNAL_GLYPHS = {
  beacon: "◈",
  echo: "◌",
  pulse: "⟡",
  flare: "✧",
  static: "⁘",
  signal_fire: "⌁",
} as const;

export const SIGNAL_COLORS = {
  beacon: "#f2c46d",
  echo: "#b8a0ff",
  pulse: "#ff83b5",
  flare: "#ff9a62",
  static: "#83c8d8",
  signal_fire: "#e58b6d",
} as const;

export type SignalType = keyof typeof SIGNAL_LABELS;

export function SignalBadge({
  type,
  size = "sm",
  showLabel = false,
}: {
  type?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  if (!type || !(type in SIGNAL_GLYPHS)) return null;
  const signal = type as SignalType;
  const color = SIGNAL_COLORS[signal];
  const sizeClass = size === "lg" ? "text-6xl" : size === "md" ? "text-3xl" : "text-base";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono leading-none ${sizeClass}`}
      style={{ color, textShadow: `0 0 12px ${color}80` }}
      title={`${SIGNAL_LABELS[signal]} signal`}
      aria-label={`${SIGNAL_LABELS[signal]} signal`}
    >
      <span aria-hidden="true">{SIGNAL_GLYPHS[signal]}</span>
      {showLabel && <span className="text-sm font-bold tracking-wide">{SIGNAL_LABELS[signal]}</span>}
    </span>
  );
}
