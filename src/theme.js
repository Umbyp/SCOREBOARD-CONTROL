// theme.js — "Broadcast Console" design system
// A single source of truth for the whole app. Restrained, instrument-panel
// aesthetic: neutral charcoals, hairline borders, team colors used as data,
// functional signal colors only. No rainbow gradients, no neon glow spam.

// ── Color tokens ──────────────────────────────────────────────
export const c = {
  // Base surfaces (cool charcoal, layered by lightness)
  bg:        "#0B0C0F",
  bgInset:   "#08090B",
  surface:   "#14161B",
  surface2:  "#191C22",
  raised:    "#1F232B",

  // Hairlines
  line:      "rgba(255,255,255,0.07)",
  lineSoft:  "rgba(255,255,255,0.045)",
  lineStrong:"rgba(255,255,255,0.13)",

  // Text
  text:      "#EDEFF3",
  dim:       "rgba(237,239,243,0.60)",
  mute:      "rgba(237,239,243,0.36)",
  faint:     "rgba(237,239,243,0.20)",

  // Functional signal colors (calm, not neon)
  live:      "#3FB98B",   // running / connected
  liveDim:   "rgba(63,185,139,0.14)",
  warn:      "#DDA13F",   // caution
  warnDim:   "rgba(221,161,63,0.14)",
  danger:    "#DE5B57",   // stop / destructive
  dangerDim: "rgba(222,91,87,0.13)",
  gold:      "#D8B65C",   // clock / period emphasis
  goldDim:   "rgba(216,182,92,0.12)",
};

// Default team identity colors (slightly softened from neon)
export const teamDefault = { A: "#E86A3A", B: "#2FA8DC" };

// ── Type ──────────────────────────────────────────────────────
// Two-voice system: Oswald for numerals + headings, Barlow Condensed for
// labels & UI. Tabular numerals everywhere numbers live.
export const font = {
  num:   "'Oswald', system-ui, sans-serif",     // scores, clocks
  head:  "'Oswald', system-ui, sans-serif",     // headings
  label: "'Barlow Condensed', system-ui, sans-serif", // labels, buttons
  body:  "'Barlow Condensed', system-ui, sans-serif",
};

export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&display=swap');";

// ── Radii / elevation ─────────────────────────────────────────
export const r = { sm: 8, md: 11, lg: 14, xl: 18, pill: 999 };
export const shadow = {
  sm: "0 2px 8px rgba(0,0,0,0.35)",
  md: "0 8px 24px rgba(0,0,0,0.45)",
  lg: "0 18px 48px rgba(0,0,0,0.60)",
};

// ── Style helpers ─────────────────────────────────────────────
// Small uppercase overline label — the ONE place letter-spacing is allowed.
export const overline = (extra = {}) => ({
  fontFamily: font.label,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: c.mute,
  ...extra,
});

// Panel surface
export const panel = (extra = {}) => ({
  background: c.surface,
  border: `1px solid ${c.line}`,
  borderRadius: r.lg,
  ...extra,
});

// Numeric readout
export const readout = (size, color = c.text, extra = {}) => ({
  fontFamily: font.num,
  fontWeight: 600,
  fontSize: size,
  lineHeight: 1,
  color,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
  ...extra,
});

// Button variants. tone: 'neutral' | 'live' | 'danger' | 'warn' | 'gold' | team color hex
export function btn(tone = "neutral", { active = false, ...extra } = {}) {
  const map = {
    neutral: { fg: c.dim,   bd: c.line,       bgA: "rgba(255,255,255,0.05)" },
    live:    { fg: c.live,  bd: "rgba(63,185,139,0.35)",  bgA: c.liveDim },
    danger:  { fg: c.danger,bd: "rgba(222,91,87,0.32)",   bgA: c.dangerDim },
    warn:    { fg: c.warn,  bd: "rgba(221,161,63,0.32)",  bgA: c.warnDim },
    gold:    { fg: c.gold,  bd: "rgba(216,182,92,0.32)",  bgA: c.goldDim },
  };
  const isHex = typeof tone === "string" && tone.startsWith("#");
  const t = isHex
    ? { fg: tone, bd: tone + "3A", bgA: tone + "16" }
    : (map[tone] || map.neutral);
  return {
    fontFamily: font.label,
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: active ? t.fg : t.fg,
    background: active ? t.bgA : "rgba(255,255,255,0.025)",
    border: `1px solid ${active ? t.bd : c.line}`,
    borderRadius: r.md,
    cursor: "pointer",
    transition: "background .14s, border-color .14s, filter .12s, transform .08s",
    ...extra,
  };
}
