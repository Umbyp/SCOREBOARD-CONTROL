// DisplayBoard.jsx — arena screen · "Broadcast Console" design system
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";
import { c as tok, font, r, overline, btn, FONT_IMPORT } from "./theme";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const DB_PATH    = "player_data";

// ─── Accent colors used on the arena face ─────────────────────
const GOLD = "#D8B65C", LIVE = "#3FB98B", RED = "#DE5B57";

// ─── THEMES CONFIG (refined, lower glare) ─────────────────────
const THEMES = {
  dark: {
    name: "Midnight (Dark)", bg: "#0B0C0F",
    panelLR: "rgba(20,22,27,0.92)", panelC: "rgba(15,16,20,0.92)",
    text: "#EDEFF3", textDim: "rgba(237,239,243,0.42)",
    border: "rgba(255,255,255,0.09)", stripe: "rgba(255,255,255,0.03)",
  },
  light: {
    name: "Daylight (Light)", bg: "#E6E9EE",
    panelLR: "rgba(255,255,255,0.95)", panelC: "rgba(238,241,245,0.96)",
    text: "#1B2430", textDim: "rgba(27,36,48,0.5)",
    border: "rgba(27,36,48,0.14)", stripe: "rgba(27,36,48,0.04)",
  },
  fiba: {
    name: "FIBA Blue", bg: "#04162B",
    panelLR: "rgba(10,38,68,0.92)", panelC: "rgba(6,24,46,0.92)",
    text: "#EDF3FA", textDim: "rgba(237,243,250,0.5)",
    border: "rgba(255,255,255,0.13)", stripe: "rgba(255,255,255,0.04)",
  },
  bulls: {
    name: "Arena Red", bg: "#1A0908",
    panelLR: "rgba(42,15,14,0.92)", panelC: "rgba(24,9,8,0.92)",
    text: "#F6ECEC", textDim: "rgba(246,236,236,0.5)",
    border: "rgba(255,120,120,0.16)", stripe: "rgba(255,255,255,0.04)",
  },
};

// ─── Helpers ──────────────────────────────────────────────────
function formatGameClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 600) {
    const totalSec = Math.floor(t / 10);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  }
  return `${Math.floor(t / 10)}.${Math.floor(t % 10)}`;
}
function formatShotClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 100) return String(Math.ceil(t / 10));
  return `${Math.floor(t / 10)}.${Math.floor(t % 10)}`;
}

const defaultPlayers = () => Array.from({ length: 5 }, (_, i) => ({ num: "", name: `PLAYER ${i + 1}`, fouls: 0 }));

// ─── Foul pip dots ────────────────────────────────────────────
function PlayerFoulPips({ count, color, theme }) {
  const c = count >= 5 ? RED : count >= 4 ? tok.warn : count >= 3 ? GOLD : color;
  return (
    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%",
          background: i <= count ? c : theme.stripe,
          border: `1px solid ${i <= count ? c : theme.border}`, transition: "all .25s" }} />
      ))}
    </div>
  );
}

// ─── Player row ───────────────────────────────────────────────
function PlayerPanel({ players, color, align, theme }) {
  const isLeft = align === "left";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {players.map((p, i) => {
        const fouls = p.fouls || 0;
        const isDQ  = fouls >= 5;
        const fc    = fouls >= 5 ? RED : fouls >= 4 ? tok.warn : fouls >= 3 ? GOLD : theme.text;
        return (
          <div key={i} style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse",
            alignItems: "center", padding: "6px 12px", gap: 8, borderBottom: `1px solid ${theme.border}`,
            background: isDQ ? "rgba(222,91,87,0.14)" : i % 2 === 0 ? theme.stripe : "transparent", transition: "all .3s" }}>
            <div style={{ fontFamily: font.num, fontSize: 18, fontWeight: 700, color: isDQ ? RED : color, width: 28, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{p.num || "—"}</div>
            <div style={{ fontFamily: font.body, fontSize: 15, fontWeight: 600, color: isDQ ? "rgba(222,91,87,0.85)" : theme.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: isLeft ? "left" : "right" }}>{p.name || `PLAYER ${i + 1}`}</div>
            <PlayerFoulPips count={fouls} color={color} theme={theme} />
            <div style={{ fontFamily: font.num, fontSize: 18, fontWeight: 700, color: fc, width: 24, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fouls}</div>
            {isDQ && <div style={{ ...overline({ fontSize: 9, color: "#fff", letterSpacing: "0.08em" }), background: RED, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>OUT</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Team foul dots (5) ───────────────────────────────────────
function TeamFoulDots({ count, color, theme }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= count;
        const c = active && count >= 5 ? RED : color;
        return <div key={i} style={{ width: 14, height: 14, borderRadius: "50%",
          background: active ? c : theme.stripe, border: `1px solid ${active ? c : theme.border}`, transition: "all .25s" }} />;
      })}
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────
function SidePanel({ team, players, teamName, logo, align, theme }) {
  const isLeft = align === "left";
  const color  = team.color;
  const displayFouls = Math.min(team.teamFouls, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", background: theme.panelLR,
      borderRight: isLeft ? `1px solid ${color}45` : "none", borderLeft: isLeft ? "none" : `1px solid ${color}45`, overflow: "hidden", minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 12px", background: `linear-gradient(${isLeft ? 135 : 225}deg, ${color}2A, ${theme.panelC})`, borderBottom: `1px solid ${color}45`, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 4, height: 34, background: color, borderRadius: 2, flexShrink: 0 }} />
          {logo && (
            <div style={{ width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.28)", borderRadius: r.sm, border: `1px solid ${color}45` }}>
              <img src={logo} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} onError={e => e.target.style.display = "none"} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, textAlign: isLeft ? "left" : "right" }}>
            <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 26, letterSpacing: "0.03em", color, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamName}</div>
            <div style={{ ...overline({ fontSize: 10, color: theme.textDim, letterSpacing: "0.28em", marginTop: 3 }) }}>{isLeft ? "HOME" : "AWAY"}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ textAlign: isLeft ? "left" : "right" }}>
            <div style={{ ...overline({ fontSize: 10, color: theme.textDim, letterSpacing: "0.16em" }) }}>TEAM FOULS</div>
            <div style={{ fontFamily: font.num, fontSize: 32, fontWeight: 700, lineHeight: 1, color: team.teamFouls >= 5 ? RED : theme.text, fontVariantNumeric: "tabular-nums" }}>{displayFouls}</div>
          </div>
          <div style={{ flex: 1 }}>
            <TeamFoulDots count={team.teamFouls} color={color} theme={theme} />
            {team.teamFouls >= 5 && <div style={{ ...overline({ fontSize: 12, color: RED, letterSpacing: "0.18em" }), textAlign: "center", marginTop: 5 }}>● BONUS</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse", padding: "5px 12px", borderBottom: `1px solid ${theme.border}`, background: theme.stripe, flexShrink: 0 }}>
        {["#", "PLAYER", "FOULS"].map((h, i) => (
          <div key={i} style={{ ...overline({ fontSize: 9.5, color: theme.textDim, letterSpacing: "0.14em" }), width: i === 0 ? 28 : i === 2 ? 70 : undefined, flex: i === 1 ? 1 : undefined, textAlign: i === 1 ? (isLeft ? "left" : "right") : "center" }}>{h}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <PlayerPanel players={players} color={color} align={align} theme={theme} />
      </div>
    </div>
  );
}

// ─── Timeout callout ─────────────────────────────────────────
function TimeoutCallout({ data }) {
  if (!data) return null;
  return (
    <div style={{ position: "fixed", bottom: "8%", left: "50%", transform: "translateX(-50%)", animation: "to-slide 7s ease forwards", zIndex: 200, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...overline({ fontSize: 14, color: "#fff", letterSpacing: "0.36em" }), background: RED, padding: "5px 30px", borderTopLeftRadius: r.sm, borderTopRightRadius: r.sm }}>TIMEOUT CALLED</div>
      <div style={{ display: "flex", alignItems: "stretch", background: "rgba(15,16,20,0.98)", border: `1px solid ${data.color}`, borderBottomLeftRadius: r.md, borderBottomRightRadius: r.md, boxShadow: "0 20px 50px rgba(0,0,0,0.7)", minWidth: 400 }}>
        <div style={{ width: 6, background: data.color }} />
        <div style={{ padding: "20px 30px", flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 50, lineHeight: 1, color: data.color, letterSpacing: "0.03em" }}>{data.name}</div>
          <div style={{ fontFamily: font.body, fontSize: 16, fontWeight: 500, color: tok.dim, marginTop: 8, letterSpacing: "0.06em" }}>เหลือ <span style={{ color: "#fff", fontFamily: font.num, fontSize: 20, fontWeight: 700 }}>{data.remaining}</span> ครั้ง</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function DisplayBoard({ onBack }) {
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, teamFouls: 0, timeouts: 2, color: "#E86A3A" },
    teamB: { name: "AWAY", score: 0, teamFouls: 0, timeouts: 2, color: "#2FA8DC" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });

  const [fbA, setFbA] = useState({ name: "HOME", logo: "", players: defaultPlayers() });
  const [fbB, setFbB] = useState({ name: "AWAY", logo: "", players: defaultPlayers() });
  const [dbConnected, setDbConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const fbConnected = dbConnected && socketConnected;
  const [flashA, setFlashA] = useState(null);
  const [flashB, setFlashB] = useState(null);
  const [toCallout, setToCallout] = useState(null);

  const [themeId, setThemeId] = useState(() => localStorage.getItem("arena_theme") || "dark");
  const [customBg, setCustomBg] = useState(() => localStorage.getItem("arena_custom_bg") || "");
  const currentTheme = THEMES[themeId] || THEMES.dark;

  const prevScoreA = useRef(0);
  const prevScoreB = useRef(0);
  const prevToA    = useRef(2);
  const prevToB    = useRef(2);

  useEffect(() => {
    const parse = (d, fallback) => ({ name: d?.name || fallback, logo: d?.logo || "", players: Array.isArray(d?.players) ? d.players : defaultPlayers() });
    const uA = onValue(ref(db, `${DB_PATH}/teamA`), s => setFbA(parse(s.val(), "HOME")));
    const uB = onValue(ref(db, `${DB_PATH}/teamB`), s => setFbB(parse(s.val(), "AWAY")));
    const uConn = onValue(ref(db, ".info/connected"), s => setDbConnected(!!s.val()));
    return () => { uA(); uB(); uConn(); };
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { reconnection: true });
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("stateUpdate", (s) => {
      if (!s?.teamA) return;
      if (s.teamA.score > prevScoreA.current) { setFlashA(`+${s.teamA.score - prevScoreA.current}`); setTimeout(() => setFlashA(null), 2000); }
      if (s.teamB.score > prevScoreB.current) { setFlashB(`+${s.teamB.score - prevScoreB.current}`); setTimeout(() => setFlashB(null), 2000); }
      prevScoreA.current = s.teamA.score; prevScoreB.current = s.teamB.score;
      if (prevToA.current > s.teamA.timeouts) { setToCallout({ name: s.teamA.name, color: s.teamA.color, remaining: s.teamA.timeouts }); setTimeout(() => setToCallout(null), 7000); }
      if (prevToB.current > s.teamB.timeouts) { setToCallout({ name: s.teamB.name, color: s.teamB.color, remaining: s.teamB.timeouts }); setTimeout(() => setToCallout(null), 7000); }
      prevToA.current = s.teamA.timeouts; prevToB.current = s.teamB.timeouts;
      setState(s);
    });
    return () => socket.disconnect();
  }, []);

  const { teamA, teamB, quarter, clockTenths, isRunning, shotClockTenths, possession, jumpBall } = state;
  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? RED : GOLD;
  const clockUp    = clockTenths === 0;

  return (
    <div style={{ width: "100vw", height: "100vh", background: customBg || currentTheme.bg,
      display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none", transition: "background .3s ease", color: currentTheme.text }}>
      <style>{`
        ${FONT_IMPORT}
        @keyframes score-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
        @keyframes flash-up{0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.8)}20%{opacity:1;transform:translateX(-50%) translateY(-30px) scale(1.15)}80%{opacity:1;transform:translateX(-50%) translateY(-50px) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-70px)}}
        @keyframes to-slide{0%{opacity:0;transform:translateX(-50%) translateY(30px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-20px)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:2px;}
      `}</style>

      {/* TOP BAR */}
      <div style={{ height: 42, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", background: "rgba(8,9,11,0.82)", borderBottom: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ ...btn("neutral"), color: tok.dim, padding: "5px 12px", fontSize: 12, letterSpacing: "0.1em" }}>← HOME</button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...overline({ fontSize: 10, color: "rgba(255,255,255,0.5)" }) }}>THEME</span>
            <select value={themeId} onChange={(e) => { setThemeId(e.target.value); localStorage.setItem("arena_theme", e.target.value); }} style={{
              background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.14)", borderRadius: r.sm, padding: "3px 8px", outline: "none", cursor: "pointer", fontFamily: font.body, fontSize: 13 }}>
              {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k} style={{ color: "#000" }}>{v.name}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...overline({ fontSize: 10, color: "rgba(255,255,255,0.5)" }) }}>BG</span>
            <input type="color" value={customBg || currentTheme.bg} onChange={(e) => { setCustomBg(e.target.value); localStorage.setItem("arena_custom_bg", e.target.value); }} style={{ width: 22, height: 22, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
            {customBg && <button onClick={() => { setCustomBg(""); localStorage.removeItem("arena_custom_bg"); }} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 13 }}>✕</button>}
          </div>
        </div>
        <div style={{ ...overline({ fontSize: 13, color: "rgba(255,255,255,0.32)", letterSpacing: "0.32em" }) }}>ARENA DISPLAY</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: r.pill,
          background: fbConnected ? tok.liveDim : tok.dangerDim, ...overline({ fontSize: 10.5, color: fbConnected ? LIVE : RED, letterSpacing: "0.12em" }) }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: fbConnected ? LIVE : RED }} />
          {fbConnected ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr minmax(360px, 38vw) 1fr" }}>
        <SidePanel team={teamA} players={fbA.players} teamName={teamA.name || fbA.name} logo={fbA.logo} align="left" theme={currentTheme} />

        {/* CENTER PANEL */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
          background: currentTheme.panelC, borderLeft: `1px solid ${currentTheme.border}`, borderRight: `1px solid ${currentTheme.border}`, padding: "20px 0", transition: "background .3s" }}>

          {/* GAME CLOCK & PERIOD */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: -6 }}>
              <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 30, color: GOLD, letterSpacing: "0.06em" }}>
                {quarter <= 4 ? `PERIOD ${quarter}` : `OT ${quarter - 4}`}
              </div>
              <div style={{ ...overline({ fontSize: 13, color: isRunning ? LIVE : currentTheme.textDim, letterSpacing: "0.16em" }),
                background: isRunning ? tok.liveDim : currentTheme.stripe, padding: "4px 12px", borderRadius: r.sm }}>
                {isRunning ? "LIVE" : "PAUSED"}
              </div>
            </div>
            <div style={{ fontFamily: font.num, fontSize: "clamp(80px,12vw,150px)", fontWeight: 700, lineHeight: 1.1,
              color: clockUp ? RED : currentTheme.text, fontVariantNumeric: "tabular-nums" }}>
              {formatGameClock(clockTenths)}
            </div>
          </div>

          <div style={{ width: "80%", height: 1, background: currentTheme.border, margin: "8px 0" }} />

          {/* SCORES */}
          <div style={{ display: "flex", width: "100%", alignItems: "center", position: "relative", padding: "10px 0" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px" }}>
              <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 34, color: teamA.color, letterSpacing: "0.03em", marginBottom: 6 }}>{teamA.name}</div>
              <div style={{ position: "relative" }}>
                {flashA && <div style={{ position: "absolute", top: -20, left: "50%", fontFamily: font.num, fontSize: 40, fontWeight: 700, color: teamA.color, animation: "flash-up 2s ease forwards", pointerEvents: "none" }}>{flashA}</div>}
                <div style={{ fontFamily: font.num, fontSize: "clamp(70px,10vw,130px)", fontWeight: 700, lineHeight: 1, color: teamA.color, fontVariantNumeric: "tabular-nums", animation: flashA ? "score-pop .3s ease" : "none" }}>{teamA.score}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 50, flexShrink: 0 }}>
              <div style={{ width: 1, height: 42, background: currentTheme.border }} />
              <div style={{ ...overline({ fontSize: 16, color: currentTheme.textDim }), margin: "8px 0" }}>VS</div>
              <div style={{ width: 1, height: 42, background: currentTheme.border }} />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px" }}>
              <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 34, color: teamB.color, letterSpacing: "0.03em", marginBottom: 6 }}>{teamB.name}</div>
              <div style={{ position: "relative" }}>
                {flashB && <div style={{ position: "absolute", top: -20, left: "50%", fontFamily: font.num, fontSize: 40, fontWeight: 700, color: teamB.color, animation: "flash-up 2s ease forwards", pointerEvents: "none" }}>{flashB}</div>}
                <div style={{ fontFamily: font.num, fontSize: "clamp(70px,10vw,130px)", fontWeight: 700, lineHeight: 1, color: teamB.color, fontVariantNumeric: "tabular-nums", animation: flashB ? "score-pop .3s ease" : "none" }}>{teamB.score}</div>
              </div>
            </div>
          </div>

          {/* POSSESSION & JUMP BALL */}
          <div style={{ width: "85%", display: "flex", alignItems: "center", background: currentTheme.stripe, borderRadius: r.md,
            border: `1px solid ${currentTheme.border}`, padding: "8px 16px", margin: "10px 0 15px" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: font.num, fontSize: 22, color: possession === "teamA" ? teamA.color : "transparent", transition: "all .3s", lineHeight: 1 }}>◀</div>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: possession === "teamA" ? teamA.color : currentTheme.border, transition: "all .3s" }} />
              <div style={{ ...overline({ fontSize: 16, color: possession === "teamA" ? teamA.color : currentTheme.textDim, letterSpacing: "0.06em" }), transition: "all .3s" }}>
                {possession === "teamA" ? "POSS" : teamA.name}
              </div>
            </div>

            <div style={{ flexShrink: 0, padding: "0 10px", textAlign: "center" }}>
              {jumpBall ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ fontSize: 22, color: GOLD, lineHeight: 1 }}>◆</div>
                  <div style={{ ...overline({ fontSize: 10, color: GOLD, letterSpacing: "0.16em" }) }}>JUMP</div>
                </div>
              ) : (
                <div style={{ ...overline({ fontSize: 11, color: currentTheme.border, letterSpacing: "0.16em" }) }}>BALL</div>
              )}
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <div style={{ ...overline({ fontSize: 16, color: possession === "teamB" ? teamB.color : currentTheme.textDim, letterSpacing: "0.06em" }), transition: "all .3s" }}>
                {possession === "teamB" ? "POSS" : teamB.name}
              </div>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: possession === "teamB" ? teamB.color : currentTheme.border, transition: "all .3s" }} />
              <div style={{ fontFamily: font.num, fontSize: 22, color: possession === "teamB" ? teamB.color : "transparent", transition: "all .3s", lineHeight: 1 }}>▶</div>
            </div>
          </div>

          {/* SHOT CLOCK & TIMEOUTS */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 20px" }}>
            <div style={{ ...overline({ fontSize: 13, color: currentTheme.textDim, letterSpacing: "0.32em", marginBottom: -2 }) }}>SHOT CLOCK</div>
            <div style={{ fontFamily: font.num, fontSize: "clamp(60px,8vw,100px)", fontWeight: 700, lineHeight: 1.1, color: shotColor, fontVariantNumeric: "tabular-nums" }}>
              {formatShotClock(shotClockTenths)}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 10,
              background: currentTheme.stripe, padding: "10px 20px", borderRadius: r.sm, border: `1px solid ${currentTheme.border}` }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= teamA.timeouts ? teamA.color : currentTheme.border }} />)}
              </div>
              <div style={{ ...overline({ fontSize: 12, color: currentTheme.textDim, letterSpacing: "0.16em" }) }}>TIMEOUTS</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= teamB.timeouts ? teamB.color : currentTheme.border }} />)}
              </div>
            </div>
          </div>
        </div>

        <SidePanel team={teamB} players={fbB.players} teamName={teamB.name || fbB.name} logo={fbB.logo} align="right" theme={currentTheme} />
      </div>

      <TimeoutCallout data={toCallout} />
    </div>
  );
}
