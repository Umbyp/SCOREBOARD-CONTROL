// DisplayBoard.jsx — the arena screen: what goes on the TV, projector or LED
// wall in the venue.
//
// This file owns everything that is true of the screen regardless of sport —
// the live feed, the venue chrome, and which face to draw. The faces
// themselves live in ./arena, one per sport, each laid out on the same fixed
// 1920×1080 stage (see arena/kit.jsx for why it is fixed).
//
// Design notes for the venue, which are the reason for most of the code below:
//   • The board is furniture. Once it is up, nobody should have to touch it,
//     so the operator chrome fades out (and takes the mouse pointer with it)
//     a few seconds after the last input and comes back on any movement.
//   • A screen that blanks mid-match is a failure, so the display holds a
//     screen wake lock for as long as it is visible.
//   • It must never show a plausible-looking score it does not actually have.
//     Until the first broadcast lands there is a "connecting" veil, and the
//     feed's health is on the board itself, not hidden in a corner of the UI.

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";
import { c as tok, font, r, overline, btn, FONT_IMPORT } from "./theme";
import { initialState, getSport, DEFAULT_SPORT } from "../shared/sports/index.js";
import { LEAGUE_DEFAULT } from "./league";
import { Stage, THEMES, Cap, Num, GOLD, RED } from "./arena/kit.jsx";
import BasketballArena from "./arena/Basketball.jsx";
import BadmintonArena from "./arena/Badminton.jsx";
import Football7Arena from "./arena/Football7.jsx";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const userPath = (uid, path) => `users/${uid}/${path}`;

// One face per sport. An id that isn't here (an older client meeting a newer
// server) falls back to the default sport's face rather than a blank screen.
const FACES = {
  basketball: BasketballArena,
  badminton: BadmintonArena,
  football7: Football7Arena,
};

const defaultPlayers = () => Array.from({ length: 5 }, (_, i) => ({ num: "", name: `PLAYER ${i + 1}`, fouls: 0 }));

// ─── Venue behaviours ─────────────────────────────────────────

/** True once the operator has been still for `ms`. Drives the chrome fade. */
function useIdle(ms = 3500) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    wake();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms]);
  return idle;
}

/** Keeps the panel awake for the length of a match. No-op where unsupported
 *  (the API needs a secure context), which is why nothing here throws. */
function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock = null;
    let released = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Denied, or the tab was backgrounded mid-request — the visibility
        // listener below will try again when it matters.
      }
    };
    acquire();

    // The lock is dropped automatically whenever the tab is hidden, so it has
    // to be taken again each time the screen comes back.
    const onVisible = () => { if (!released && document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

function useFullscreen() {
  const [isFull, setIsFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  return [isFull, toggle];
}

// ─── Timeout callout ──────────────────────────────────────────
// Drawn inside the stage so it scales with everything else.
function TimeoutCallout({ data, theme }) {
  if (!data) return null;
  return (
    <div style={{
      position: "absolute", bottom: 90, left: "50%", zIndex: 20, pointerEvents: "none",
      display: "flex", flexDirection: "column", alignItems: "center",
      animation: "arena-callout 7s ease forwards",
    }}>
      <Cap size={26} color="#fff" track="0.36em" style={{ background: RED, padding: "9px 46px", borderRadius: "10px 10px 0 0" }}>
        TIMEOUT
      </Cap>
      <div style={{
        display: "flex", alignItems: "stretch", minWidth: 660,
        background: "rgba(12,13,16,0.97)", border: `2px solid ${data.color}`,
        borderRadius: "0 0 14px 14px", boxShadow: "0 26px 70px rgba(0,0,0,0.72)",
      }}>
        <div style={{ width: 10, background: data.color }} />
        <div style={{ flex: 1, padding: "26px 42px", textAlign: "center" }}>
          <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 72, lineHeight: 1, color: data.color, letterSpacing: "0.03em" }}>
            {data.name}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12, marginTop: 14 }}>
            <Cap size={22} color={theme.textDim} track="0.14em">เหลือ</Cap>
            <Num size={38} color="#fff">{data.remaining}</Num>
            <Cap size={22} color={theme.textDim} track="0.14em">ครั้ง</Cap>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Operator chrome ──────────────────────────────────────────
// Real screen pixels, not stage pixels: these controls are for whoever is
// standing at the machine, so they should not shrink with the board.
function Toolbar({ visible, themeId, setThemeId, customBg, setCustomBg, overscan, setOverscan, isFull, toggleFull, onBack }) {
  const pill = { ...btn("neutral"), color: tok.dim, padding: "7px 14px", fontSize: 13, letterSpacing: "0.1em", whiteSpace: "nowrap" };
  return (
    <div style={{
      position: "fixed", bottom: 22, left: "50%", transform: `translateX(-50%) translateY(${visible ? 0 : 26}px)`,
      zIndex: 100, display: "flex", alignItems: "center", gap: 14, padding: "10px 16px",
      background: "rgba(10,11,14,0.9)", border: `1px solid ${tok.lineStrong}`, borderRadius: r.pill,
      backdropFilter: "blur(10px)", boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
      opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none",
      transition: "opacity .3s ease, transform .3s ease",
    }}>
      <button onClick={onBack} style={pill}>← HOME</button>

      <div style={{ width: 1, height: 22, background: tok.line }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...overline({ fontSize: 10, color: tok.mute }) }}>THEME</span>
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)} style={{
          background: "rgba(255,255,255,0.05)", color: tok.text, border: `1px solid ${tok.lineStrong}`,
          borderRadius: r.sm, padding: "4px 8px", outline: "none", cursor: "pointer",
          fontFamily: font.body, fontSize: 13,
        }}>
          {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k} style={{ color: "#000" }}>{v.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ ...overline({ fontSize: 10, color: tok.mute }) }}>BG</span>
        <input type="color" value={customBg || THEMES[themeId].bg} onChange={(e) => setCustomBg(e.target.value)}
          style={{ width: 24, height: 24, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
        {customBg && <button onClick={() => setCustomBg("")} title="คืนค่าสีตามธีม"
          style={{ background: "none", border: "none", color: tok.danger, cursor: "pointer", fontSize: 14 }}>✕</button>}
      </div>

      <div style={{ width: 1, height: 22, background: tok.line }} />

      {/* Some TVs and projectors crop the edge of the signal — this pulls the
          whole board in so nothing important lands outside the picture. */}
      <button onClick={() => setOverscan(!overscan)} title="ย่อขอบภาพสำหรับทีวีที่ตัดขอบ (S)"
        style={{ ...pill, ...(overscan ? { color: GOLD, border: "1px solid rgba(216,182,92,0.4)", background: "rgba(228,191,85,0.12)" } : {}) }}>
        SAFE AREA {overscan ? "ON" : "OFF"}
      </button>

      <button onClick={toggleFull} style={{ ...pill, color: tok.text }}>
        {isFull ? "⤡ EXIT FULLSCREEN" : "⤢ FULLSCREEN"}
      </button>

      <span style={{ ...overline({ fontSize: 9.5, color: tok.faint, letterSpacing: "0.14em" }) }}>F · S · T</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function DisplayBoard({ uid, onBack = () => { window.location.href = "/"; } }) {
  const DB_PATH     = uid ? userPath(uid, "player_data") : null;
  const LEAGUE_PATH = uid ? userPath(uid, "overlay_config/league") : null;

  // Placeholder until the first broadcast arrives — same registry the server
  // builds its state from, so the two shapes can't drift apart. It is veiled
  // until `hasState`, so it is never mistaken for a real 0-0.
  const [state, setState] = useState(() => initialState(DEFAULT_SPORT));
  const [hasState, setHasState] = useState(false);

  const [fbA, setFbA] = useState({ name: "HOME", logo: "", players: defaultPlayers() });
  const [fbB, setFbB] = useState({ name: "AWAY", logo: "", players: defaultPlayers() });
  const [dbConnected, setDbConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const live = dbConnected && socketConnected && hasState;

  const [flashA, setFlashA] = useState(null);
  const [flashB, setFlashB] = useState(null);
  const [toCallout, setToCallout] = useState(null);
  const [league, setLeague] = useState(LEAGUE_DEFAULT);

  const [themeId, setThemeId] = useState(() => localStorage.getItem("arena_theme") || "dark");
  const [customBg, setCustomBg] = useState(() => localStorage.getItem("arena_custom_bg") || "");
  const [overscan, setOverscan] = useState(() => localStorage.getItem("arena_overscan") === "1");
  const theme = THEMES[themeId] || THEMES.dark;

  const idle = useIdle(3500);
  const [isFull, toggleFull] = useFullscreen();
  useWakeLock();

  const prevScoreA = useRef(0);
  const prevScoreB = useRef(0);
  const prevToA    = useRef(null);
  const prevToB    = useRef(null);

  // ── Preference writes ──
  const chooseTheme = useCallback((id) => { setThemeId(id); localStorage.setItem("arena_theme", id); }, []);
  const chooseBg = useCallback((hex) => {
    setCustomBg(hex);
    if (hex) localStorage.setItem("arena_custom_bg", hex);
    else localStorage.removeItem("arena_custom_bg");
  }, []);
  const chooseOverscan = useCallback((on) => { setOverscan(on); localStorage.setItem("arena_overscan", on ? "1" : "0"); }, []);

  // ── Keyboard: the board is often driven from a keyboard on a lectern ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "f") { e.preventDefault(); toggleFull(); }
      else if (k === "s") { e.preventDefault(); chooseOverscan(!overscan); }
      else if (k === "t") {
        e.preventDefault();
        const ids = Object.keys(THEMES);
        chooseTheme(ids[(ids.indexOf(themeId) + 1) % ids.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFull, overscan, themeId, chooseOverscan, chooseTheme]);

  // ── Rosters, crests and league branding ──
  useEffect(() => {
    if (!uid) return;
    const parse = (d, fallback) => ({
      name: d?.name || fallback,
      logo: d?.logo || "",
      players: Array.isArray(d?.players) && d.players.length ? d.players : defaultPlayers(),
    });
    const uA = onValue(ref(db, `${DB_PATH}/teamA`), (s) => setFbA(parse(s.val(), "HOME")));
    const uB = onValue(ref(db, `${DB_PATH}/teamB`), (s) => setFbB(parse(s.val(), "AWAY")));
    const uConn = onValue(ref(db, ".info/connected"), (s) => setDbConnected(!!s.val()));
    const uL = onValue(ref(db, LEAGUE_PATH), (s) => { const v = s.val(); if (v) setLeague({ ...LEAGUE_DEFAULT, ...v }); });
    return () => { uA(); uB(); uConn(); uL(); };
  }, [uid]);

  // ── The live feed ──
  useEffect(() => {
    if (!uid) return;
    // Read-only viewer: no auth token, just asks to join this uid's broadcast room.
    const socket = io(SOCKET_URL, { reconnection: true, query: { uid } });
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("stateUpdate", (s) => {
      if (!s?.teamA) return;

      if (s.teamA.score > prevScoreA.current) { setFlashA(`+${s.teamA.score - prevScoreA.current}`); setTimeout(() => setFlashA(null), 2000); }
      if (s.teamB.score > prevScoreB.current) { setFlashB(`+${s.teamB.score - prevScoreB.current}`); setTimeout(() => setFlashB(null), 2000); }
      prevScoreA.current = s.teamA.score;
      prevScoreB.current = s.teamB.score;

      // Only sports that have timeouts carry the field at all, so a missing
      // count must not be read as "a timeout was just called".
      const callout = (team, prev) => {
        const now = team.timeouts;
        if (typeof now !== "number") { prev.current = null; return; }
        if (typeof prev.current === "number" && prev.current > now) {
          setToCallout({ name: team.name, color: team.color, remaining: now });
          setTimeout(() => setToCallout(null), 7000);
        }
        prev.current = now;
      };
      callout(s.teamA, prevToA);
      callout(s.teamB, prevToB);

      setState(s);
      setHasState(true);
    });
    return () => socket.disconnect();
  }, [uid]);

  // ── A display link with no game id ──
  if (!uid) {
    return (
      <div style={{
        width: "100vw", height: "100vh", background: tok.bg, color: tok.mute,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: font.body, fontSize: 18, letterSpacing: "0.06em", textAlign: "center", padding: 24,
      }}>
        <style>{FONT_IMPORT}</style>
        ลิงก์นี้ไม่มีรหัสเกม (?u=) — คัดลอกลิงก์ Arena ใหม่จากหน้า Control
      </div>
    );
  }

  const sport = getSport(state.sport);
  const Face  = FACES[sport.id] || FACES[DEFAULT_SPORT];
  const teams = { a: fbA, b: fbB };

  return (
    <div style={{ cursor: idle ? "none" : "default", userSelect: "none" }}>
      <style>{`
        ${FONT_IMPORT}
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{overflow:hidden;background:${customBg || theme.bg};}
        @keyframes arena-pop{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes arena-pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes arena-breathe{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes arena-flash{
          0%{opacity:0;transform:translateX(-50%) translateY(0) scale(.8)}
          20%{opacity:1;transform:translateX(-50%) translateY(-34px) scale(1.15)}
          80%{opacity:1;transform:translateX(-50%) translateY(-56px) scale(1)}
          100%{opacity:0;transform:translateX(-50%) translateY(-78px)}
        }
        @keyframes arena-callout{
          0%{opacity:0;transform:translateX(-50%) translateY(46px)}
          10%{opacity:1;transform:translateX(-50%) translateY(0)}
          88%{opacity:1;transform:translateX(-50%) translateY(0)}
          100%{opacity:0;transform:translateX(-50%) translateY(-26px)}
        }
      `}</style>

      <Stage bg={customBg || theme.bg} overscan={overscan}>
        <Face state={state} sport={sport} theme={theme} league={league} live={live}
          teams={teams} flashA={flashA} flashB={flashB} />

        <TimeoutCallout data={toCallout} theme={theme} />

        {/* Never let an un-fed board pass for a real 0-0. */}
        {!hasState && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 30,
            background: "rgba(8,9,11,0.86)", backdropFilter: "blur(3px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22,
          }}>
            <div style={{ width: 74, height: 74, borderRadius: "50%", border: `3px solid ${tok.line}`, borderTopColor: GOLD, animation: "arena-spin 1s linear infinite" }} />
            <Cap size={30} color={tok.dim} track="0.3em">กำลังเชื่อมต่อกระดานคะแนน</Cap>
            <Cap size={20} color={tok.faint} track="0.14em">รอสัญญาณจากหน้า Control</Cap>
          </div>
        )}
      </Stage>

      <style>{`@keyframes arena-spin{to{transform:rotate(360deg)}}`}</style>

      <Toolbar visible={!idle} themeId={themeId} setThemeId={chooseTheme}
        customBg={customBg} setCustomBg={chooseBg}
        overscan={overscan} setOverscan={chooseOverscan}
        isFull={isFull} toggleFull={toggleFull} onBack={onBack} />
    </div>
  );
}
