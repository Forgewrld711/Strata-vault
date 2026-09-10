import { motion } from "framer-motion";
import type { ReactElement } from "react";

export type CrystalType =
  | "ruby"
  | "sapphire"
  | "labradorite"
  | "clear_quartz"
  | "obsidian"
  | "rose_quartz"
  | "opal"
  | "lepidolite"
  | "moonstone"
  | "garnet"
  | "topaz"
  | "zircon";

export const CRYSTAL_LABELS: Record<CrystalType, string> = {
  ruby:        "Ruby",
  sapphire:    "Sapphire",
  labradorite: "Labradorite",
  clear_quartz:"Clear Quartz",
  obsidian:    "Obsidian",
  rose_quartz: "Rose Quartz",
  opal:        "Opal",
  lepidolite:  "Lepidolite",
  moonstone:   "Moonstone",
  garnet:      "Garnet",
  topaz:       "Topaz",
  zircon:      "Zircon",
};

export const CRYSTAL_MEANINGS: Record<CrystalType, string> = {
  ruby:        "Passion, courage, and the will to endure. For those who burn with purpose.",
  sapphire:    "Wisdom, clarity, and devotion to truth. For those who think before they feel.",
  labradorite: "Intuition, mystery, and the space between. You hold many truths at once and trust what can't be fully named.",
  clear_quartz:"Amplification, clarity, and pure presence. For those who channel rather than contain.",
  obsidian:    "Protection, depth, and unflinching honesty. For those who face what others look away from.",
  rose_quartz: "Compassion, tenderness, and the quiet strength of care. For those who love without condition.",
  opal:        "Imagination, play, and prismatic thinking. For those who see more colors than most.",
  lepidolite:  "Transition, peace, and letting go. You move through change with unusual grace — holding what matters and releasing what doesn't.",
  moonstone:   "Cycles, inner knowing, and new beginnings. You move with time rather than against it, feeling the pull of what's coming before it arrives.",
  garnet:      "Devotion, vitality, and returning. You love deeply and come back — to people, to places, to the things that formed you.",
  topaz:       "Clarity, truth, and manifestation. You see through noise to signal, and what you name tends to become real.",
  zircon:      "Ancient knowing, grounding, and memory as gift. You carry the past not as weight but as orientation — you know where you are because you know where you've been.",
};

// Accent color used for the glow halo around each crystal
export const CRYSTAL_GLOW: Record<CrystalType, string> = {
  ruby:        "rgba(220,20,60,0.5)",
  sapphire:    "rgba(30,80,220,0.5)",
  labradorite: "rgba(70,180,220,0.45)",
  clear_quartz:"rgba(200,220,255,0.4)",
  obsidian:    "rgba(80,60,120,0.4)",
  rose_quartz: "rgba(255,140,180,0.45)",
  opal:        "rgba(180,140,255,0.4)",
  lepidolite:  "rgba(190,150,225,0.5)",
  moonstone:   "rgba(200,215,255,0.5)",
  garnet:      "rgba(140,20,40,0.55)",
  topaz:       "rgba(220,175,40,0.5)",
  zircon:      "rgba(90,120,200,0.5)",
};

// ─── Individual crystal SVGs ──────────────────────────────────────────────────

function Ruby() {
  return (
    <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ruby-body" x1="24" y1="3" x2="24" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF4560" />
          <stop offset="45%"  stopColor="#C0143C" />
          <stop offset="100%" stopColor="#6B0020" />
        </linearGradient>
        <linearGradient id="ruby-table" x1="12" y1="14" x2="36" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF8090" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9B0030" stopOpacity="0.6" />
        </linearGradient>
        <filter id="ruby-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <polygon points="24,3 43,13 43,43 24,53 5,43 5,13" fill="url(#ruby-body)" />
      <polygon points="24,14 36,20 36,36 24,42 12,36 12,20" fill="url(#ruby-table)" opacity="0.85" />
      <line x1="24" y1="3"  x2="24" y2="14" stroke="#FF6070" strokeWidth="0.6" opacity="0.7" />
      <line x1="43" y1="13" x2="36" y2="20" stroke="#FF6070" strokeWidth="0.6" opacity="0.7" />
      <line x1="43" y1="43" x2="36" y2="36" stroke="#7B0020" strokeWidth="0.6" opacity="0.7" />
      <line x1="24" y1="53" x2="24" y2="42" stroke="#7B0020" strokeWidth="0.6" opacity="0.7" />
      <line x1="5"  y1="43" x2="12" y2="36" stroke="#7B0020" strokeWidth="0.6" opacity="0.7" />
      <line x1="5"  y1="13" x2="12" y2="20" stroke="#FF6070" strokeWidth="0.6" opacity="0.7" />
      <line x1="15" y1="16" x2="20" y2="22" stroke="rgba(255,220,230,0.7)" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="24,3 43,13 43,43 24,53 5,43 5,13" fill="none" stroke="#FF2050" strokeWidth="0.8" opacity="0.8" />
    </svg>
  );
}

function Sapphire() {
  return (
    <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sap-body" x1="24" y1="3" x2="24" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#4488FF" />
          <stop offset="45%"  stopColor="#1A3FCC" />
          <stop offset="100%" stopColor="#06105A" />
        </linearGradient>
        <linearGradient id="sap-table" x1="12" y1="14" x2="36" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#88AAFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0A2090" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <polygon points="24,3 43,13 43,43 24,53 5,43 5,13" fill="url(#sap-body)" />
      <polygon points="24,14 36,20 36,36 24,42 12,36 12,20" fill="url(#sap-table)" opacity="0.85" />
      <line x1="24" y1="3"  x2="24" y2="14" stroke="#6699FF" strokeWidth="0.6" opacity="0.7" />
      <line x1="43" y1="13" x2="36" y2="20" stroke="#6699FF" strokeWidth="0.6" opacity="0.7" />
      <line x1="43" y1="43" x2="36" y2="36" stroke="#102080" strokeWidth="0.6" opacity="0.7" />
      <line x1="24" y1="53" x2="24" y2="42" stroke="#102080" strokeWidth="0.6" opacity="0.7" />
      <line x1="5"  y1="43" x2="12" y2="36" stroke="#102080" strokeWidth="0.6" opacity="0.7" />
      <line x1="5"  y1="13" x2="12" y2="20" stroke="#6699FF" strokeWidth="0.6" opacity="0.7" />
      <line x1="15" y1="16" x2="20" y2="22" stroke="rgba(200,220,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="24,3 43,13 43,43 24,53 5,43 5,13" fill="none" stroke="#3366FF" strokeWidth="0.8" opacity="0.8" />
    </svg>
  );
}

function Labradorite() {
  return (
    <svg viewBox="0 0 48 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lab-base" x1="0" y1="0" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#2A2540" />
          <stop offset="100%" stopColor="#191428" />
        </linearGradient>
        <linearGradient id="lab-flash" x1="8" y1="10" x2="38" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00D4FF" stopOpacity="0" />
          <stop offset="35%"  stopColor="#4ECDC4" stopOpacity="0.75" />
          <stop offset="65%"  stopColor="#0099CC" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0044AA" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M10,6 C6,4 4,8 4,14 L4,38 C4,44 8,48 14,48 L34,48 C40,48 44,44 44,38 L44,14 C44,8 42,4 38,6 L28,3 C24,2 18,2 10,6 Z"
        fill="url(#lab-base)" />
      <path d="M10,6 C6,4 4,8 4,14 L4,38 C4,44 8,48 14,48 L34,48 C40,48 44,44 44,38 L44,14 C44,8 42,4 38,6 L28,3 C24,2 18,2 10,6 Z"
        fill="url(#lab-flash)" />
      <path d="M12,20 L22,14" stroke="rgba(100,200,230,0.25)" strokeWidth="0.7" />
      <path d="M12,28 L30,18" stroke="rgba(100,200,230,0.2)"  strokeWidth="0.7" />
      <path d="M14,36 L36,24" stroke="rgba(60,160,200,0.2)"   strokeWidth="0.7" />
      <path d="M12,6 C18,3 28,3 36,6" stroke="rgba(160,220,240,0.4)" strokeWidth="1" fill="none" />
      <path d="M10,6 C6,4 4,8 4,14 L4,38 C4,44 8,48 14,48 L34,48 C40,48 44,44 44,38 L44,14 C44,8 42,4 38,6 L28,3 C24,2 18,2 10,6 Z"
        fill="none" stroke="rgba(80,160,200,0.5)" strokeWidth="0.8" />
    </svg>
  );
}

function ClearQuartz() {
  return (
    <svg viewBox="0 0 40 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cq-body" x1="0" y1="0" x2="40" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(230,240,255,0.55)" />
          <stop offset="50%"  stopColor="rgba(200,218,255,0.35)" />
          <stop offset="100%" stopColor="rgba(180,200,240,0.45)" />
        </linearGradient>
        <linearGradient id="cq-point" x1="0" y1="0" x2="40" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(240,248,255,0.8)" />
          <stop offset="100%" stopColor="rgba(190,215,255,0.5)" />
        </linearGradient>
      </defs>
      <rect x="8" y="18" width="24" height="40" rx="1" fill="url(#cq-body)" />
      <polygon points="20,2 32,18 8,18" fill="url(#cq-point)" />
      <line x1="16" y1="18" x2="16" y2="58" stroke="rgba(220,235,255,0.4)" strokeWidth="0.7" />
      <line x1="24" y1="18" x2="24" y2="58" stroke="rgba(220,235,255,0.4)" strokeWidth="0.7" />
      <line x1="20" y1="2" x2="16" y2="18" stroke="rgba(240,248,255,0.6)" strokeWidth="0.7" />
      <line x1="20" y1="2" x2="24" y2="18" stroke="rgba(180,210,255,0.4)" strokeWidth="0.7" />
      <line x1="11" y1="22" x2="11" y2="50" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="8" y="55" width="24" height="3" rx="1" fill="rgba(180,200,240,0.4)" />
      <polygon points="20,2 32,18 8,18"    fill="none" stroke="rgba(200,225,255,0.6)" strokeWidth="0.8" />
      <rect    x="8" y="18" width="24" height="40" rx="1" fill="none" stroke="rgba(200,225,255,0.5)" strokeWidth="0.8" />
    </svg>
  );
}

function Obsidian() {
  return (
    <svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="obs-body" x1="0" y1="0" x2="40" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1A1420" />
          <stop offset="50%"  stopColor="#0D0A12" />
          <stop offset="100%" stopColor="#060408" />
        </linearGradient>
        <linearGradient id="obs-sheen" x1="0" y1="0" x2="40" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3D2B5C" />
          <stop offset="100%" stopColor="#1A1020" />
        </linearGradient>
      </defs>
      <rect x="8" y="16" width="24" height="40" rx="1" fill="url(#obs-body)" />
      <polygon points="20,2 34,16 6,16" fill="url(#obs-sheen)" />
      <rect x="10" y="18" width="6" height="36" rx="1" fill="rgba(80,50,120,0.18)" />
      <line x1="16" y1="16" x2="16" y2="56" stroke="rgba(100,70,150,0.2)"  strokeWidth="0.7" />
      <line x1="24" y1="16" x2="24" y2="56" stroke="rgba(50,35,80,0.2)"    strokeWidth="0.7" />
      <line x1="20" y1="2"  x2="14" y2="16" stroke="rgba(120,90,170,0.4)"  strokeWidth="0.7" />
      <line x1="20" y1="2"  x2="26" y2="16" stroke="rgba(60,40,100,0.3)"   strokeWidth="0.7" />
      <line x1="11" y1="20" x2="11" y2="44" stroke="rgba(160,120,200,0.35)" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="20,2 34,16 6,16"                  fill="none" stroke="rgba(100,70,160,0.6)" strokeWidth="0.8" />
      <rect    x="8" y="16" width="24" height="40" rx="1" fill="none" stroke="rgba(80,55,130,0.5)"  strokeWidth="0.8" />
    </svg>
  );
}

function RoseQuartz() {
  return (
    <svg viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rq-fill" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFD6E8" />
          <stop offset="40%"  stopColor="#FFB0CC" />
          <stop offset="100%" stopColor="#E8709A" />
        </linearGradient>
        <linearGradient id="rq-inner" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,230,240,0.7)" />
          <stop offset="100%" stopColor="rgba(220,130,170,0.3)" />
        </linearGradient>
      </defs>
      <path d="M24,42 C10,32 2,22 2,14 C2,8 6,4 12,4 C16,4 20,7 24,11 C28,7 32,4 36,4 C42,4 46,8 46,14 C46,22 38,32 24,42 Z"
        fill="url(#rq-fill)" />
      <path d="M24,36 C13,28 7,20 8,14 C8,10 11,8 14,8 C18,8 21,11 24,15 C27,11 30,8 34,8 C37,8 40,10 40,14 C41,20 35,28 24,36 Z"
        fill="url(#rq-inner)" opacity="0.6" />
      <path d="M13,8 C12,10 12,13 14,15" stroke="rgba(255,245,250,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M24,42 C10,32 2,22 2,14 C2,8 6,4 12,4 C16,4 20,7 24,11 C28,7 32,4 36,4 C42,4 46,8 46,14 C46,22 38,32 24,42 Z"
        fill="none" stroke="rgba(220,120,160,0.7)" strokeWidth="0.8" />
    </svg>
  );
}

function Opal() {
  return (
    <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="opal-base" cx="40%" cy="38%" r="55%">
          <stop offset="0%"   stopColor="#F0EEFF" />
          <stop offset="60%"  stopColor="#D8D0F4" />
          <stop offset="100%" stopColor="#B0A8D8" />
        </radialGradient>
        <linearGradient id="opal-fire1" x1="0" y1="0" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF6B9D" stopOpacity="0.55" />
          <stop offset="30%"  stopColor="#FFD700" stopOpacity="0.4"  />
          <stop offset="60%"  stopColor="#00E5FF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#B44FFF" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="opal-fire2" x1="48" y1="0" x2="0" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#50FF80" stopOpacity="0.3"  />
          <stop offset="50%"  stopColor="#FF8C42" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4488FF" stopOpacity="0.3"  />
        </linearGradient>
        <filter id="opal-blur">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      <ellipse cx="24" cy="28" rx="20" ry="24" fill="url(#opal-base)" />
      <ellipse cx="24" cy="28" rx="20" ry="24" fill="url(#opal-fire1)" />
      <ellipse cx="24" cy="28" rx="20" ry="24" fill="url(#opal-fire2)" />
      <ellipse cx="18" cy="18" rx="8"  ry="6"  fill="rgba(255,255,255,0.35)" />
      <ellipse cx="16" cy="17" rx="3"  ry="2"  fill="rgba(255,255,255,0.55)" />
      <ellipse cx="24" cy="28" rx="20" ry="24" fill="none" stroke="rgba(180,160,230,0.6)" strokeWidth="0.8" />
    </svg>
  );
}

// ─── New quiz crystals ────────────────────────────────────────────────────────

function Lepidolite() {
  return (
    <svg viewBox="0 0 48 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lep-top" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#C8A8E0" />
          <stop offset="50%"  stopColor="#DEC0F0" />
          <stop offset="100%" stopColor="#B898D0" />
        </linearGradient>
        <linearGradient id="lep-mid" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#A888C8" />
          <stop offset="50%"  stopColor="#C8A8E0" />
          <stop offset="100%" stopColor="#9878B8" />
        </linearGradient>
        <linearGradient id="lep-bot" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#8868B0" />
          <stop offset="50%"  stopColor="#A888C8" />
          <stop offset="100%" stopColor="#7858A0" />
        </linearGradient>
      </defs>
      {/* Mica plate layers — stacked flat slabs */}
      <path d="M6,34 L10,38 L38,38 L42,34 L44,28 L4,28 Z" fill="url(#lep-bot)" />
      <path d="M4,28 L44,28 L46,22 L2,22 Z" fill="url(#lep-mid)" />
      <path d="M2,22 L46,22 L44,16 L4,16 Z" fill="url(#lep-top)" />
      <path d="M4,16 L44,16 L42,10 L6,10 Z" fill="url(#lep-top)" opacity="0.85" />
      <path d="M6,10 L42,10 L40,5 L8,5 Z" fill="url(#lep-top)" opacity="0.7" />
      {/* Layer separation lines */}
      <line x1="2"  y1="22" x2="46" y2="22" stroke="rgba(255,240,255,0.35)" strokeWidth="0.8" />
      <line x1="4"  y1="16" x2="44" y2="16" stroke="rgba(255,240,255,0.3)"  strokeWidth="0.8" />
      <line x1="6"  y1="10" x2="42" y2="10" stroke="rgba(255,240,255,0.25)" strokeWidth="0.8" />
      {/* Mica sheen — diagonal highlight */}
      <line x1="8"  y1="6"  x2="20" y2="38" stroke="rgba(255,230,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="5"  x2="26" y2="38" stroke="rgba(255,245,255,0.2)" strokeWidth="1" strokeLinecap="round" />
      {/* Gold mica flecks */}
      <circle cx="14" cy="13" r="0.8" fill="rgba(255,220,160,0.6)" />
      <circle cx="28" cy="19" r="0.7" fill="rgba(255,220,160,0.5)" />
      <circle cx="20" cy="31" r="0.9" fill="rgba(255,220,160,0.55)" />
      <circle cx="36" cy="13" r="0.6" fill="rgba(255,220,160,0.45)" />
      {/* Outer border */}
      <path d="M6,34 L10,38 L38,38 L42,34 L44,28 L46,22 L44,16 L42,10 L40,5 L8,5 L6,10 L4,16 L2,22 L4,28 Z"
        fill="none" stroke="rgba(200,170,230,0.5)" strokeWidth="0.8" />
    </svg>
  );
}

function Moonstone() {
  return (
    <svg viewBox="0 0 44 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="moon-base" cx="42%" cy="35%" r="58%">
          <stop offset="0%"   stopColor="#F4F0FF" />
          <stop offset="45%"  stopColor="#D8DCFF" />
          <stop offset="100%" stopColor="#B0B8E8" />
        </radialGradient>
        <radialGradient id="moon-adular" cx="50%" cy="55%" r="45%">
          <stop offset="0%"   stopColor="#80B0FF" stopOpacity="0.65" />
          <stop offset="40%"  stopColor="#6090EE" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#4060CC" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon-dome" cx="35%" cy="28%" r="40%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>
      </defs>
      {/* Oval cabochon body */}
      <ellipse cx="22" cy="27" rx="18" ry="23" fill="url(#moon-base)" />
      {/* Adularescence — the floating blue glow */}
      <ellipse cx="22" cy="27" rx="18" ry="23" fill="url(#moon-adular)" />
      {/* Dome highlight — simulates the rounded surface */}
      <ellipse cx="22" cy="27" rx="18" ry="23" fill="url(#moon-dome)" />
      {/* Bright specular */}
      <ellipse cx="16" cy="17" rx="5" ry="3.5" fill="rgba(255,255,255,0.6)" />
      <ellipse cx="15" cy="16" rx="2" ry="1.5" fill="rgba(255,255,255,0.8)" />
      {/* Subtle inner arc — moon's internal glow band */}
      <path d="M8,32 Q22,20 36,32" stroke="rgba(140,180,255,0.35)" strokeWidth="1.5" fill="none" />
      {/* Star point at top */}
      <line x1="22" y1="4" x2="22" y2="8" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1="19" y1="5" x2="22" y2="8" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <line x1="25" y1="5" x2="22" y2="8" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      {/* Outer stroke */}
      <ellipse cx="22" cy="27" rx="18" ry="23" fill="none" stroke="rgba(170,185,235,0.55)" strokeWidth="0.8" />
    </svg>
  );
}

function Garnet() {
  return (
    <svg viewBox="0 0 48 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="gar-body" cx="38%" cy="32%" r="60%">
          <stop offset="0%"   stopColor="#C02040" />
          <stop offset="45%"  stopColor="#8B1525" />
          <stop offset="100%" stopColor="#4A0810" />
        </radialGradient>
        <linearGradient id="gar-table" x1="14" y1="14" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#E04060" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#6A0A1A" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* Dodecahedron-like body — rounder than ruby */}
      <polygon points="24,3 36,8 44,18 44,34 36,44 24,49 12,44 4,34 4,18 12,8" fill="url(#gar-body)" />
      {/* Inner table — slightly smaller, offset */}
      <polygon points="24,12 33,16 38,24 36,34 27,40 21,40 12,34 10,24 15,16" fill="url(#gar-table)" opacity="0.8" />
      {/* Facet lines from crown to girdle */}
      <line x1="24" y1="3"  x2="24" y2="12" stroke="#D03050" strokeWidth="0.6" opacity="0.65" />
      <line x1="36" y1="8"  x2="33" y2="16" stroke="#D03050" strokeWidth="0.6" opacity="0.65" />
      <line x1="44" y1="18" x2="38" y2="24" stroke="#901828" strokeWidth="0.6" opacity="0.65" />
      <line x1="44" y1="34" x2="36" y2="34" stroke="#601015" strokeWidth="0.6" opacity="0.65" />
      <line x1="36" y1="44" x2="27" y2="40" stroke="#601015" strokeWidth="0.6" opacity="0.65" />
      <line x1="24" y1="49" x2="24" y2="40" stroke="#601015" strokeWidth="0.6" opacity="0.65" />
      <line x1="12" y1="44" x2="21" y2="40" stroke="#601015" strokeWidth="0.6" opacity="0.65" />
      <line x1="4"  y1="34" x2="12" y2="34" stroke="#601015" strokeWidth="0.6" opacity="0.65" />
      <line x1="4"  y1="18" x2="10" y2="24" stroke="#901828" strokeWidth="0.6" opacity="0.65" />
      <line x1="12" y1="8"  x2="15" y2="16" stroke="#D03050" strokeWidth="0.6" opacity="0.65" />
      {/* Highlight */}
      <line x1="14" y1="11" x2="19" y2="18" stroke="rgba(255,180,190,0.65)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Outer stroke */}
      <polygon points="24,3 36,8 44,18 44,34 36,44 24,49 12,44 4,34 4,18 12,8" fill="none" stroke="#B01830" strokeWidth="0.8" opacity="0.75" />
    </svg>
  );
}

function Topaz() {
  return (
    <svg viewBox="0 0 40 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tpz-body" x1="0" y1="18" x2="40" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#F0C840" />
          <stop offset="40%"  stopColor="#D0A020" />
          <stop offset="100%" stopColor="#8A6008" />
        </linearGradient>
        <linearGradient id="tpz-point" x1="0" y1="0" x2="40" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFE070" />
          <stop offset="100%" stopColor="#D0A820" />
        </linearGradient>
        <linearGradient id="tpz-inner" x1="8" y1="18" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,230,100,0.55)" />
          <stop offset="100%" stopColor="rgba(180,120,10,0.25)" />
        </linearGradient>
      </defs>
      {/* Tower body */}
      <rect x="8" y="18" width="24" height="42" rx="1" fill="url(#tpz-body)" />
      {/* Hexagonal termination */}
      <polygon points="20,2 32,18 8,18" fill="url(#tpz-point)" />
      {/* Inner brightness column */}
      <rect x="14" y="20" width="12" height="38" rx="1" fill="url(#tpz-inner)" opacity="0.7" />
      {/* Facet lines */}
      <line x1="16" y1="18" x2="16" y2="60" stroke="rgba(255,210,60,0.4)"  strokeWidth="0.7" />
      <line x1="24" y1="18" x2="24" y2="60" stroke="rgba(160,100,10,0.35)" strokeWidth="0.7" />
      {/* Point facets */}
      <line x1="20" y1="2" x2="16" y2="18" stroke="rgba(255,240,130,0.65)" strokeWidth="0.8" />
      <line x1="20" y1="2" x2="24" y2="18" stroke="rgba(200,150,20,0.5)"  strokeWidth="0.8" />
      {/* Bright highlight streak */}
      <line x1="11" y1="22" x2="11" y2="52" stroke="rgba(255,240,180,0.7)" strokeWidth="1.4" strokeLinecap="round" />
      {/* Sparkle point at tip */}
      <line x1="20" y1="0" x2="20" y2="4"   stroke="rgba(255,240,100,0.8)" strokeWidth="1" />
      <line x1="18" y1="1" x2="22" y2="3"   stroke="rgba(255,240,100,0.5)" strokeWidth="0.7" />
      {/* Bottom */}
      <rect x="8" y="57" width="24" height="3" rx="1" fill="rgba(160,100,8,0.5)" />
      {/* Outer strokes */}
      <polygon points="20,2 32,18 8,18"     fill="none" stroke="rgba(255,210,60,0.65)"  strokeWidth="0.8" />
      <rect    x="8" y="18" width="24" height="42" rx="1" fill="none" stroke="rgba(200,150,20,0.55)" strokeWidth="0.8" />
    </svg>
  );
}

function Zircon() {
  return (
    <svg viewBox="0 0 48 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="zirc-body" cx="42%" cy="36%" r="58%">
          <stop offset="0%"   stopColor="#A8C0E8" />
          <stop offset="45%"  stopColor="#6080B8" />
          <stop offset="100%" stopColor="#304880" />
        </radialGradient>
        <linearGradient id="zirc-table" x1="14" y1="14" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#C8E0FF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#5070A8" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="zirc-core" cx="45%" cy="38%" r="30%">
          <stop offset="0%"   stopColor="rgba(220,240,255,0.9)" />
          <stop offset="100%" stopColor="rgba(220,240,255,0)"   />
        </radialGradient>
      </defs>
      {/* Round brilliant cut body */}
      <circle cx="24" cy="26" r="20" fill="url(#zirc-body)" />
      {/* Table (flat top facet area) */}
      <polygon points="24,8 33,12 38,20 36,30 28,36 20,36 12,30 10,20 15,12" fill="url(#zirc-table)" opacity="0.85" />
      {/* Brilliant inner fire */}
      <circle cx="24" cy="26" r="20" fill="url(#zirc-core)" />
      {/* Facet lines — star pattern */}
      <line x1="24" y1="6"  x2="24" y2="14" stroke="rgba(200,225,255,0.5)" strokeWidth="0.7" />
      <line x1="38" y1="15" x2="33" y2="21" stroke="rgba(200,225,255,0.5)" strokeWidth="0.7" />
      <line x1="42" y1="28" x2="35" y2="28" stroke="rgba(200,225,255,0.4)" strokeWidth="0.7" />
      <line x1="35" y1="41" x2="30" y2="36" stroke="rgba(150,180,220,0.4)" strokeWidth="0.7" />
      <line x1="24" y1="46" x2="24" y2="38" stroke="rgba(150,180,220,0.4)" strokeWidth="0.7" />
      <line x1="13" y1="41" x2="18" y2="36" stroke="rgba(150,180,220,0.4)" strokeWidth="0.7" />
      <line x1="6"  y1="28" x2="13" y2="28" stroke="rgba(200,225,255,0.4)" strokeWidth="0.7" />
      <line x1="10" y1="15" x2="15" y2="21" stroke="rgba(200,225,255,0.5)" strokeWidth="0.7" />
      {/* Bright sparkle highlight */}
      <circle cx="17" cy="17" r="3.5" fill="rgba(255,255,255,0.45)" />
      <circle cx="16" cy="16" r="1.5" fill="rgba(255,255,255,0.75)" />
      {/* Cross-sparkle at highlight */}
      <line x1="16" y1="13" x2="16" y2="19" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
      <line x1="13" y1="16" x2="19" y2="16" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
      {/* Outer stroke */}
      <circle cx="24" cy="26" r="20" fill="none" stroke="rgba(140,175,230,0.6)" strokeWidth="0.8" />
      {/* Culet sparkle at bottom */}
      <line x1="24" y1="44" x2="24" y2="48" stroke="rgba(180,210,255,0.5)" strokeWidth="1" />
      <line x1="22" y1="46" x2="26" y2="46" stroke="rgba(180,210,255,0.4)" strokeWidth="0.8" />
    </svg>
  );
}

// ─── Crystal map ─────────────────────────────────────────────────────────────

const CRYSTAL_SVGS: Record<CrystalType, () => ReactElement> = {
  ruby:        Ruby,
  sapphire:    Sapphire,
  labradorite: Labradorite,
  clear_quartz: ClearQuartz,
  obsidian:    Obsidian,
  rose_quartz: RoseQuartz,
  opal:        Opal,
  lepidolite:  Lepidolite,
  moonstone:   Moonstone,
  garnet:      Garnet,
  topaz:       Topaz,
  zircon:      Zircon,
};

// ─── Public component ────────────────────────────────────────────────────────

interface CrystalBadgeProps {
  type: string;
  size?: number;
  showLabel?: boolean;
  showMeaning?: boolean;
  quizMatched?: boolean;
  className?: string;
}

export function CrystalBadge({ type, size = 48, showLabel = true, showMeaning = false, quizMatched = false, className = "" }: CrystalBadgeProps) {
  const ct = type as CrystalType;
  const SVGComponent = CRYSTAL_SVGS[ct];
  const label   = CRYSTAL_LABELS[ct]   ?? type;
  const glow    = CRYSTAL_GLOW[ct]     ?? "rgba(200,200,255,0.4)";
  const meaning = CRYSTAL_MEANINGS[ct] ?? null;

  if (!SVGComponent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", damping: 14, stiffness: 120, delay: 0.3 }}
      className={`flex flex-col items-center gap-1.5 select-none ${className}`}
    >
      {/* Crystal with floating pulse */}
      <div className="relative flex items-center justify-center">
        {/* Gold bloom for quiz-matched crystals */}
        {quizMatched && (
          <div
            className="absolute pointer-events-none"
            style={{
              width: size * 2.2,
              height: size * 2.2,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at 50% 65%, rgba(255,200,50,0.5) 0%, rgba(255,160,10,0.28) 30%, rgba(220,130,0,0.1) 55%, transparent 75%)",
              filter: "blur(6px)",
              transform: "translateY(10%)",
              zIndex: 0,
            }}
          />
        )}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: quizMatched ? 4 : 3.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: size,
            position: "relative",
            zIndex: 1,
            filter: quizMatched
              ? `drop-shadow(0 0 8px ${glow}) drop-shadow(0 0 20px ${glow}) drop-shadow(0 0 6px rgba(255,180,20,0.45))`
              : `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 14px ${glow})`,
          }}
        >
          <SVGComponent />
        </motion.div>
      </div>

      {showLabel && (
        <span
          className="font-mono text-[10px] uppercase tracking-widest opacity-70"
          style={{ color: "white", textShadow: quizMatched ? `0 0 8px rgba(255,200,50,0.6), 0 0 6px ${glow}` : `0 0 6px ${glow}` }}
        >
          {label}
        </span>
      )}

      {showMeaning && meaning && (
        <p className="font-mono text-[10px] text-muted-foreground/70 text-center leading-relaxed max-w-[180px]">
          {meaning}
        </p>
      )}
    </motion.div>
  );
}
