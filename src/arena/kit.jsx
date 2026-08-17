// arena/kit.jsx — the shared vocabulary of the venue screens.
//
// Everything an arena face draws is laid out on a FIXED 1920×1080 stage and
// then scaled as a whole to fit the screen it is plugged into. That is the one
// decision the rest of this folder is built on, so it is worth stating plainly:
//
//   • A scoreboard is read from across a hall, not from a desk. Sizes have to
//     be chosen for that distance and then *stay* in proportion — a layout
//     built from `vw` units silently rewrites its own hierarchy on every
//     different screen, and a 42" TV in a school gym, a 4K panel and a
//     1366×768 projector would each get a different design.
//   • With a fixed stage there is exactly one composition to design and check.
//     Plug it into anything and it is the same board, larger or smaller.
//
// So: all measurements below are stage pixels, and 1 stage pixel = 1 screen
// pixel only on a true 1080p display.

import { useEffect, useState } from "react";
import { c as tok, font, overline } from "../theme";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

// For the operator chrome and the timeout callout only — both paint on their
// own dark surface rather than on the themed stage, so they use the console
// tokens directly. Anything drawn ON the board asks the theme (see below).
export const GOLD = tok.gold;
export const RED  = tok.danger;

// ─── Themes ───────────────────────────────────────────────────
// Venue lighting varies wildly: a dark hall wants low glare, a daylit sports
// centre needs the opposite or the screen reads as a grey rectangle.
//
// Signal colours travel WITH the theme rather than coming straight from
// theme.js. The console's gold, green and red are tuned to sit on a near-black
// panel; dropped onto the daylight background they turn into pale smudges,
// which defeats the one theme whose whole job is a bright room. So each theme
// carries its own tuned trio and the faces below ask the theme, never the
// global tokens, for an accent.
const SIGNAL_DARK = {
  accent: tok.gold, accentTint: "rgba(228,191,85,0.12)", accentLine: "rgba(228,191,85,0.42)",
  ok:     tok.live, okTint:     "rgba(63,185,139,0.14)", okLine:     "rgba(63,185,139,0.36)",
  alert:  tok.danger, alertTint: "rgba(222,91,87,0.15)", alertLine:  "rgba(222,91,87,0.42)",
  warn:   tok.warn,
  // A whole-column wash (badminton's serving side) needs to be far fainter
  // than a pill tint or it swamps the score sitting on top of it.
  accentWash: "rgba(228,191,85,0.055)",
};
const SIGNAL_LIGHT = {
  accent: "#8A6A0E", accentTint: "rgba(138,106,14,0.13)", accentLine: "rgba(138,106,14,0.42)",
  ok:     "#1C7A56", okTint:     "rgba(28,122,86,0.13)",  okLine:     "rgba(28,122,86,0.38)",
  alert:  "#B23A36", alertTint:  "rgba(178,58,54,0.13)",  alertLine:  "rgba(178,58,54,0.42)",
  warn:   "#9A6B12",
  accentWash: "rgba(138,106,14,0.075)",
};

export const THEMES = {
  dark: {
    name: "Midnight (Dark)", bg: "#0B0C0F",
    panelLR: "rgba(20,22,27,0.92)", panelC: "rgba(15,16,20,0.92)",
    text: "#EDEFF3", textDim: "rgba(237,239,243,0.42)",
    border: "rgba(255,255,255,0.09)", stripe: "rgba(255,255,255,0.03)",
    ...SIGNAL_DARK,
  },
  light: {
    name: "Daylight (Light)", bg: "#E6E9EE",
    panelLR: "rgba(255,255,255,0.95)", panelC: "rgba(238,241,245,0.96)",
    text: "#1B2430", textDim: "rgba(27,36,48,0.5)",
    border: "rgba(27,36,48,0.14)", stripe: "rgba(27,36,48,0.04)",
    ...SIGNAL_LIGHT,
  },
  fiba: {
    name: "FIBA Blue", bg: "#04162B",
    panelLR: "rgba(10,38,68,0.92)", panelC: "rgba(6,24,46,0.92)",
    text: "#EDF3FA", textDim: "rgba(237,243,250,0.5)",
    border: "rgba(255,255,255,0.13)", stripe: "rgba(255,255,255,0.04)",
    ...SIGNAL_DARK,
  },
  bulls: {
    name: "Arena Red", bg: "#1A0908",
    panelLR: "rgba(42,15,14,0.92)", panelC: "rgba(24,9,8,0.92)",
    text: "#F6ECEC", textDim: "rgba(246,236,236,0.5)",
    border: "rgba(255,120,120,0.16)", stripe: "rgba(255,255,255,0.04)",
    ...SIGNAL_DARK,
  },
};

// ─── Clock formatting ─────────────────────────────────────────
export function formatGameClock(tenths, showTenths = true) {
  const t = Math.max(0, tenths);
  if (t > 600 || !showTenths) {
    const totalSec = Math.floor(t / 10);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  }
  return `${Math.floor(t / 10)}.${Math.floor(t % 10)}`;
}

export function formatShotClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 100) return String(Math.ceil(t / 10));
  return `${Math.floor(t / 10)}.${Math.floor(t % 10)}`;
}

/** Stoppage time, shown the way a football board shows it: +3:14 */
export function formatAdded(tenths) {
  const s = Math.floor(Math.max(0, tenths) / 10);
  return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Stage ────────────────────────────────────────────────────
/**
 * Scales the 1920×1080 stage to the viewport and centres it.
 *
 * `overscan` shrinks it a few percent: older TVs and some projectors crop the
 * edges of the signal, which would eat the header and the outer panels. The
 * surround is painted the same colour as the stage so the letterbox is
 * invisible rather than a pair of black bars.
 */
export function Stage({ bg, overscan = false, children }) {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // Entering fullscreen resizes the window, but Safari fires the change
    // event before the new size is readable — measure again on the next frame.
    const onFs = () => requestAnimationFrame(measure);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const scale = Math.min(vp.w / STAGE_W, vp.h / STAGE_H) * (overscan ? 0.92 : 1);

  return (
    <div style={{
      position: "fixed", inset: 0, background: bg, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: STAGE_W, height: STAGE_H, flexShrink: 0,
        transform: `scale(${scale})`, transformOrigin: "center center",
        display: "flex", flexDirection: "column", background: bg,
        position: "relative", overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Text primitives ──────────────────────────────────────────
/** Small uppercase caption. Never below 18 stage px — that is the floor for
 *  legibility at the back of a hall. */
export const Cap = ({ size = 22, color, track = "0.22em", align, children, style }) => (
  <div style={{
    ...overline({ fontSize: Math.max(18, size), color: color || tok.mute, letterSpacing: track }),
    textAlign: align, ...style,
  }}>{children}</div>
);

/** Tabular numeral readout — scores, clocks, counts. */
export const Num = ({ size, color, weight = 700, children, style }) => (
  <div style={{
    fontFamily: font.num, fontSize: size, fontWeight: weight, lineHeight: 1,
    color, fontVariantNumeric: "tabular-nums", ...style,
  }}>{children}</div>
);

/** A team or player name — clipped rather than wrapped, so it can never push
 *  the score out of position. */
export const Name = ({ size, color, align = "center", children, style }) => (
  <div style={{
    fontFamily: font.head, fontWeight: 600, fontSize: size, lineHeight: 1.08,
    letterSpacing: "0.03em", color, textAlign: align,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    maxWidth: "100%", ...style,
  }}>{children}</div>
);

// ─── Indicator dots and pips ──────────────────────────────────
export function Dots({ count, total, color, theme, size = 20, gap = 9, justify = "center" }) {
  return (
    <div style={{ display: "flex", gap, justifyContent: justify, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < count;
        return <div key={i} style={{
          width: size, height: size, borderRadius: "50%",
          background: on ? color : theme.stripe,
          border: `${Math.max(1, size / 12)}px solid ${on ? color : theme.border}`,
          transition: "background .25s, border-color .25s",
        }} />;
      })}
    </div>
  );
}

/** Wide bars, one per game — badminton's "games won" reads better as bars than
 *  dots because there are only two or three of them. */
export function Bars({ count, total, color, theme, w = 58, h = 14, gap = 11 }) {
  return (
    <div style={{ display: "flex", gap, justifyContent: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: w, height: h, borderRadius: h / 2,
          background: i < count ? color : theme.stripe,
          border: `1px solid ${i < count ? color : theme.border}`,
          transition: "background .25s, border-color .25s",
        }} />
      ))}
    </div>
  );
}

// ─── League branding ──────────────────────────────────────────
function LeagueSeal({ size = 30, color = GOLD }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4">
      <circle cx="12" cy="12" r="9.4" />
      <path d="M12 2.6v18.8M2.6 12h18.8M5 5c3.5 2.5 3.5 11.5 0 14M19 5c-3.5 2.5-3.5 11.5 0 14" strokeOpacity="0.75" />
    </svg>
  );
}

/** A team crest. Renders nothing at all when there is no logo, so the layouts
 *  can reserve the space themselves and stay symmetrical either way. */
export function Crest({ logo, size, color }) {
  if (!logo) return null;
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, borderRadius: 14,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.22)", border: `2px solid ${color}45`, overflow: "hidden",
    }}>
      <img src={logo} alt="" style={{ width: size * 0.82, height: size * 0.82, objectFit: "contain" }}
        onError={(e) => { e.target.style.display = "none"; }} />
    </div>
  );
}

// ─── Header strip, shared by every sport face ─────────────────
export function ArenaHeader({ league, sportLabel, live, theme }) {
  return (
    <div style={{
      height: 96, flexShrink: 0, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 44px",
      borderBottom: `1px solid ${theme.border}`, background: theme.panelC,
    }}>
      {/* League identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, width: 520 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          border: league.logo ? "none" : `2px solid ${theme.accent}`,
          background: league.logo ? "transparent" : theme.accentTint,
        }}>
          {league.logo
            ? <img src={league.logo} alt="" style={{ width: 52, height: 52, objectFit: "contain" }}
                onError={(e) => { e.target.style.display = "none"; }} />
            : <LeagueSeal size={30} color={theme.accent} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <Cap size={21} color={theme.text} track="0.14em" style={{ opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {league.line1}{league.line2 ? ` · ${league.line2}` : ""}
          </Cap>
          {league.year && <Num size={22} color={theme.accent} style={{ marginTop: 3 }}>{league.year}</Num>}
        </div>
      </div>

      {/* Which sport is on the board */}
      <Cap size={26} color={theme.textDim} track="0.42em" style={{ flex: 1, textAlign: "center" }}>
        {sportLabel}
      </Cap>

      {/* Feed health — the one thing an operator glances at from the floor */}
      <div style={{ width: 520, display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 11, padding: "8px 20px", borderRadius: 999,
          background: live ? theme.okTint : theme.alertTint,
          border: `1px solid ${live ? theme.okLine : theme.alertLine}`,
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%", background: live ? theme.ok : theme.alert,
            animation: live ? "arena-pulse 2.4s ease-in-out infinite" : "none",
          }} />
          <Cap size={20} color={live ? theme.ok : theme.alert} track="0.2em">{live ? "LIVE" : "OFFLINE"}</Cap>
        </div>
      </div>
    </div>
  );
}

/**
 * The score-changed flourish. Fixed size and absolutely positioned so a "+3"
 * appearing above a score can never nudge the score itself.
 */
export function ScoreFlash({ value, color, size = 68 }) {
  if (!value) return null;
  return (
    <div style={{
      position: "absolute", top: -size * 0.5, left: "50%", pointerEvents: "none",
      fontFamily: font.num, fontSize: size, fontWeight: 700, color,
      animation: "arena-flash 2s ease forwards",
    }}>{value}</div>
  );
}
