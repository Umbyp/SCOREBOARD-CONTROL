// DisplayBoard.jsx — จอสนาม · Pro FIBA Layout · Themes · 5 Fouls & Poss Arrow
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const DB_PATH    = "player_data";

// ─── THEMES CONFIG ────────────────────────────────────────────
const THEMES = {
  dark: {
    name: "Midnight (Dark)",
    bg: "#05050A",
    panelLR: "rgba(15,15,20,0.85)",
    panelC: "rgba(10,10,15,0.85)",
    text: "#FFFFFF",
    textDim: "rgba(255,255,255,0.4)",
    border: "rgba(255,255,255,0.1)",
    stripe: "rgba(255,255,255,0.03)"
  },
  light: {
    name: "Daylight (Light)",
    bg: "#E2E8F0",
    panelLR: "rgba(255,255,255,0.95)",
    panelC: "rgba(240,244,248,0.95)",
    text: "#1E293B",
    textDim: "rgba(30,41,59,0.5)",
    border: "rgba(30,41,59,0.15)",
    stripe: "rgba(30,41,59,0.04)"
  },
  fiba: {
    name: "FIBA Blue",
    bg: "#021124",
    panelLR: "rgba(8,35,65,0.9)",
    panelC: "rgba(4,20,40,0.9)",
    text: "#FFFFFF",
    textDim: "rgba(255,255,255,0.5)",
    border: "rgba(255,255,255,0.15)",
    stripe: "rgba(255,255,255,0.04)"
  },
  bulls: {
    name: "Arena Red",
    bg: "#1A0505",
    panelLR: "rgba(40,10,10,0.9)",
    panelC: "rgba(20,5,5,0.9)",
    text: "#FFFFFF",
    textDim: "rgba(255,255,255,0.5)",
    border: "rgba(255,100,100,0.15)",
    stripe: "rgba(255,255,255,0.04)"
  }
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
  const c = count >= 5 ? "#FF3333" : count >= 4 ? "#FF8C00" : count >= 3 ? "#FFD700" : color;
  return (
    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: i <= count ? c : theme.stripe,
          border: `1px solid ${i <= count ? c : theme.border}`,
          boxShadow: i <= count && count >= 3 ? `0 0 5px ${c}` : "none",
          transition: "all 0.25s",
        }} />
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
        const fc    = fouls >= 5 ? "#FF3333" : fouls >= 4 ? "#FF8C00" : fouls >= 3 ? "#FFD700" : theme.text;
        return (
          <div key={i} style={{
            display: "flex", flexDirection: isLeft ? "row" : "row-reverse",
            alignItems: "center", padding: "6px 12px", gap: 8,
            borderBottom: `1px solid ${theme.border}`,
            background: isDQ ? "rgba(255,30,30,0.15)" : i % 2 === 0 ? theme.stripe : "transparent",
            transition: "all 0.3s",
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: isDQ ? "#FF3333" : color, width: 28, textAlign: "center", flexShrink: 0, fontWeight: 700 }}>{p.num || "—"}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: isDQ ? "#FF6666" : theme.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: isLeft ? "left" : "right" }}>{p.name || `PLAYER ${i + 1}`}</div>
            <PlayerFoulPips count={fouls} color={color} theme={theme} />
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: fc, width: 24, textAlign: "center", flexShrink: 0 }}>{fouls}</div>
            {isDQ && <div style={{ fontFamily: "'Bebas Neue'", fontSize: 10, letterSpacing: "0.1em", color: "#FFF", background: "#FF3333", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>OUT</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Team foul dots (ปรับเป็น 5 จุด) ───────────────────────────
function TeamFoulDots({ count, color, theme }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= count;
        const c = active && count >= 5 ? "#FF3333" : color; // เปลี่ยนเป็นสีแดงถ้าครบ 5
        return (
          <div key={i} style={{ 
            width: 14, height: 14, borderRadius: "50%", 
            background: active ? c : theme.stripe, 
            border: `1px solid ${active ? c : theme.border}`, 
            boxShadow: active ? `0 0 8px ${c}88` : "none", 
            transition: "all 0.25s" 
          }} />
        );
      })}
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────
function SidePanel({ team, players, teamName, logo, align, theme }) {
  const isLeft = align === "left";
  const color  = team.color;
  
  // จำกัดการแสดงผลตัวเลขฟาวล์สูงสุดที่ 5
  const displayFouls = Math.min(team.teamFouls, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", background: theme.panelLR, borderRight: isLeft ? `2px solid ${color}40` : "none", borderLeft: isLeft ? "none" : `2px solid ${color}40`, overflow: "hidden", minWidth: 0 }}>
      {/* ── Header ── */}
      <div style={{ padding: "12px 16px 10px", background: `linear-gradient(${isLeft ? 135 : 225}deg, ${color}35, ${theme.panelC})`, borderBottom: `2px solid ${color}40`, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 4, height: 36, background: color, borderRadius: 2, flexShrink: 0 }} />
          {logo && (
            <div style={{ width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: `1px solid ${color}40` }}>
              <img src={logo} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} onError={e => e.target.style.display = "none"} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, textAlign: isLeft ? "left" : "right" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, letterSpacing: "0.08em", color, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamName}</div>
            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: theme.textDim, letterSpacing: "0.3em", marginTop: 2 }}>{isLeft ? "HOME" : "AWAY"}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ textAlign: isLeft ? "left" : "right" }}>
            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: theme.textDim, letterSpacing: "0.2em" }}>TEAM FOULS</div>
            <div style={{ fontFamily: "'Oswald'", fontSize: 32, fontWeight: 700, lineHeight: 1, color: team.teamFouls >= 5 ? "#FF3333" : theme.text }}>{displayFouls}</div>
          </div>
          <div style={{ flex: 1 }}>
            <TeamFoulDots count={team.teamFouls} color={color} theme={theme} />
            {/* แสดงคำว่า BONUS เมื่อฟาวล์ถึง 5 */}
            {team.teamFouls >= 5 && <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.2em", color: "#FF3333", textAlign: "center", marginTop: 4 }}>● BONUS</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: isLeft ? "row" : "row-reverse", padding: "4px 12px", borderBottom: `1px solid ${theme.border}`, background: theme.stripe, flexShrink: 0 }}>
        {["#", "PLAYER", "FOULS"].map((h, i) => (
          <div key={i} style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: theme.textDim, letterSpacing: "0.2em", width: i === 0 ? 28 : i === 2 ? 70 : undefined, flex: i === 1 ? 1 : undefined, textAlign: i === 1 ? (isLeft ? "left" : "right") : "center" }}>{h}</div>
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
      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 800, letterSpacing: "0.5em", color: "#FFF", background: "#FF2222", padding: "4px 30px", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>⏱ TIMEOUT CALLED</div>
      <div style={{ display: "flex", alignItems: "stretch", background: "rgba(10,10,15,0.98)", border: `2px solid ${data.color}`, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, boxShadow: `0 20px 50px rgba(0,0,0,0.9), 0 0 40px ${data.color}44`, minWidth: 400 }}>
        <div style={{ width: 8, background: data.color }} />
        <div style={{ padding: "20px 30px", flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 54, lineHeight: 1, color: data.color, letterSpacing: "0.05em", textShadow: `0 0 20px ${data.color}66` }}>{data.name}</div>
          <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginTop: 8, letterSpacing: "0.1em" }}>เหลือ <span style={{ color: "#FFF", fontSize: 20 }}>{data.remaining}</span> ครั้ง</div>
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
    teamA: { name: "HOME", score: 0, teamFouls: 0, timeouts: 2, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, teamFouls: 0, timeouts: 2, color: "#00D4FF" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });

  const [fbA, setFbA] = useState({ name: "HOME", logo: "", players: defaultPlayers() });
  const [fbB, setFbB] = useState({ name: "AWAY", logo: "", players: defaultPlayers() });
  const [fbConnected, setFbConnected] = useState(false);
  const [flashA, setFlashA] = useState(null);
  const [flashB, setFlashB] = useState(null);
  const [toCallout, setToCallout] = useState(null);

  // ── Theme State ──
  const [themeId, setThemeId] = useState(() => localStorage.getItem("arena_theme") || "dark");
  const [customBg, setCustomBg] = useState(() => localStorage.getItem("arena_custom_bg") || "");
  const currentTheme = THEMES[themeId] || THEMES.dark;

  const prevScoreA = useRef(0);
  const prevScoreB = useRef(0);
  const prevToA    = useRef(2);
  const prevToB    = useRef(2);

  useEffect(() => {
    const parse = (d, fallback) => ({ name: d?.name || fallback, logo: d?.logo || "", players: Array.isArray(d?.players) ? d.players : defaultPlayers() });
    const uA = onValue(ref(db, `${DB_PATH}/teamA`), s => { setFbA(parse(s.val(), "HOME")); setFbConnected(true); });
    const uB = onValue(ref(db, `${DB_PATH}/teamB`), s => { setFbB(parse(s.val(), "AWAY")); setFbConnected(true); });
    return () => { uA(); uB(); };
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { reconnection: true });
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
  const shotColor  = shotUrgent ? "#FF2222" : "#FFD700";
  const clockUp    = clockTenths === 0;

  return (
    <div style={{
      width: "100vw", height: "100vh", 
      background: customBg || currentTheme.bg,
      display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none",
      transition: "background 0.3s ease",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;700&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
        @keyframes score-pop { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }
        @keyframes flash-up { 0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.8)} 20%{opacity:1;transform:translateX(-50%) translateY(-30px) scale(1.2)} 80%{opacity:1;transform:translateX(-50%) translateY(-50px) scale(1)} 100%{opacity:0;transform:translateX(-50%) translateY(-70px)} }
        @keyframes to-slide { 0%{opacity:0;transform:translateX(-50%) translateY(30px)} 15%{opacity:1;transform:translateX(-50%) translateY(0)} 85%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-20px)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>

      {/* ── TOP BAR (Controls) ── */}
      <div style={{
        height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", background: "rgba(0,0,0,0.8)", borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, color: "#FFF", fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: "0.1em", padding: "4px 12px", cursor: "pointer" }}>← HOME</button>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 4 }}>
            <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>THEME:</span>
            <select 
              value={themeId} 
              onChange={(e) => { setThemeId(e.target.value); localStorage.setItem("arena_theme", e.target.value); }}
              style={{ background: "transparent", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: "2px 6px", outline: "none", cursor: "pointer", fontFamily: "system-ui", fontSize: 12 }}
            >
              {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k} style={{ color: "#000" }}>{v.name}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 4 }}>
            <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>BG OVERRIDE:</span>
            <input type="color" value={customBg || currentTheme.bg} onChange={(e) => { setCustomBg(e.target.value); localStorage.setItem("arena_custom_bg", e.target.value); }} style={{ width: 20, height: 20, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
            {customBg && <button onClick={() => { setCustomBg(""); localStorage.removeItem("arena_custom_bg"); }} style={{ background: "none", border: "none", color: "#FF5555", cursor: "pointer", fontSize: 12, fontWeight: "bold" }}>✕</button>}
          </div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: "0.4em", color: "rgba(255,255,255,0.3)" }}>ARENA DISPLAY</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 4, background: fbConnected ? "rgba(0,232,122,0.1)" : "rgba(255,85,85,0.1)", color: fbConnected ? "#00E87A" : "#FF6666", fontFamily: "'Barlow Condensed'", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: fbConnected ? "#00E87A" : "#FF6666" }} />
          {fbConnected ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr minmax(360px, 38vw) 1fr" }}>

        <SidePanel team={teamA} players={fbA.players} teamName={fbA.name || teamA.name} logo={fbA.logo} align="left" theme={currentTheme} />

        {/* ── CENTER PANEL (Pro Layout) ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
          background: currentTheme.panelC, borderLeft: `2px solid ${currentTheme.border}`, borderRight: `2px solid ${currentTheme.border}`,
          padding: "20px 0", transition: "background 0.3s"
        }}>
          
          {/* 1. TOP: GAME CLOCK & QUARTER */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: -10 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "#FFD700", letterSpacing: "0.1em" }}>
                {quarter <= 4 ? `PERIOD ${quarter}` : `OT ${quarter - 4}`}
              </div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 800, color: isRunning ? "#00E87A" : currentTheme.textDim, background: isRunning ? "rgba(0,232,122,0.15)" : currentTheme.stripe, padding: "4px 12px", borderRadius: 4, letterSpacing: "0.2em" }}>
                {isRunning ? "LIVE" : "PAUSED"}
              </div>
            </div>
            <div style={{
              fontFamily: "'Oswald'", fontSize: "clamp(80px, 12vw, 150px)", fontWeight: 700, lineHeight: 1.1,
              color: clockUp ? "#FF2222" : currentTheme.text, textShadow: clockUp ? "0 0 40px rgba(255,0,0,0.5)" : "none",
              fontVariantNumeric: "tabular-nums"
            }}>
              {formatGameClock(clockTenths)}
            </div>
          </div>

          <div style={{ width: "80%", height: 2, background: currentTheme.border, margin: "10px 0" }} />

          {/* 2. MIDDLE: SCORES WITH CLEAR SEPARATION */}
          <div style={{ display: "flex", width: "100%", alignItems: "center", position: "relative", padding: "10px 0" }}>
            
            {/* Team A Side */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: teamA.color, letterSpacing: "0.05em", marginBottom: 5 }}>{teamA.name}</div>
              <div style={{ position: "relative" }}>
                {flashA && <div style={{ position: "absolute", top: -20, left: "50%", fontFamily: "'Oswald'", fontSize: 40, fontWeight: 700, color: teamA.color, textShadow: `0 0 20px ${teamA.color}`, animation: "flash-up 2s ease forwards", pointerEvents: "none" }}>{flashA}</div>}
                <div style={{ fontFamily: "'Oswald'", fontSize: "clamp(70px, 10vw, 130px)", fontWeight: 700, lineHeight: 1, color: teamA.color, fontVariantNumeric: "tabular-nums", animation: flashA ? "score-pop 0.3s ease" : "none" }}>{teamA.score}</div>
              </div>
            </div>

            {/* Center VS Divider */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 50, flexShrink: 0 }}>
              <div style={{ width: 2, height: 45, background: currentTheme.border }} />
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: currentTheme.textDim, margin: "8px 0", letterSpacing: "0.1em" }}>VS</div>
              <div style={{ width: 2, height: 45, background: currentTheme.border }} />
            </div>

            {/* Team B Side */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: teamB.color, letterSpacing: "0.05em", marginBottom: 5 }}>{teamB.name}</div>
              <div style={{ position: "relative" }}>
                {flashB && <div style={{ position: "absolute", top: -20, left: "50%", fontFamily: "'Oswald'", fontSize: 40, fontWeight: 700, color: teamB.color, textShadow: `0 0 20px ${teamB.color}`, animation: "flash-up 2s ease forwards", pointerEvents: "none" }}>{flashB}</div>}
                <div style={{ fontFamily: "'Oswald'", fontSize: "clamp(70px, 10vw, 130px)", fontWeight: 700, lineHeight: 1, color: teamB.color, fontVariantNumeric: "tabular-nums", animation: flashB ? "score-pop 0.3s ease" : "none" }}>{teamB.score}</div>
              </div>
            </div>
          </div>

          {/* 3. POSSESSION & JUMP BALL BAR (Moved to Bottom) */}
          <div style={{
            width: "85%", display: "flex", alignItems: "center",
            background: currentTheme.stripe, borderRadius: 12,
            border: `1px solid ${currentTheme.border}`,
            padding: "8px 16px", margin: "10px 0 15px 0"
          }}>
            {/* Team A Poss (Arrow points LEFT to Team A if they have possession) */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: "'Oswald'", fontSize: 24, color: possession === "teamA" ? teamA.color : "transparent", textShadow: possession === "teamA" ? `0 0 12px ${teamA.color}` : "none", transition: "all 0.3s", lineHeight: 1, marginTop: -2 }}>◀</div>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: possession === "teamA" ? teamA.color : currentTheme.border, boxShadow: possession === "teamA" ? `0 0 10px ${teamA.color}` : "none", transition: "all 0.3s" }} />
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: possession === "teamA" ? teamA.color : currentTheme.textDim, transition: "all 0.3s", letterSpacing: "0.05em" }}>
                {possession === "teamA" ? "POSS" : teamA.name}
              </div>
            </div>

            {/* Jump Ball Center */}
            <div style={{ flexShrink: 0, padding: "0 10px", textAlign: "center" }}>
              {jumpBall ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "#FFD700", textShadow: "0 0 12px rgba(255,215,0,0.8)", lineHeight: 1 }}>◆</div>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: "#FFD700", letterSpacing: "0.2em" }}>JUMP</div>
                </div>
              ) : (
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800, color: currentTheme.border, letterSpacing: "0.2em" }}>BALL</div>
              )}
            </div>

            {/* Team B Poss (Arrow points RIGHT to Team B if they have possession) */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: possession === "teamB" ? teamB.color : currentTheme.textDim, transition: "all 0.3s", letterSpacing: "0.05em" }}>
                {possession === "teamB" ? "POSS" : teamB.name}
              </div>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: possession === "teamB" ? teamB.color : currentTheme.border, boxShadow: possession === "teamB" ? `0 0 10px ${teamB.color}` : "none", transition: "all 0.3s" }} />
              <div style={{ fontFamily: "'Oswald'", fontSize: 24, color: possession === "teamB" ? teamB.color : "transparent", textShadow: possession === "teamB" ? `0 0 12px ${teamB.color}` : "none", transition: "all 0.3s", lineHeight: 1, marginTop: -2 }}>▶</div>
            </div>
          </div>

          {/* 4. BOTTOM: SHOT CLOCK & TIMEOUTS */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 20px" }}>
            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 800, color: currentTheme.textDim, letterSpacing: "0.4em", marginBottom: -5 }}>SHOT CLOCK</div>
            <div style={{
              fontFamily: "'Oswald'", fontSize: "clamp(60px, 8vw, 100px)", fontWeight: 700, lineHeight: 1.1,
              color: shotColor, textShadow: shotUrgent ? "0 0 30px rgba(255,30,30,0.8)" : "0 0 20px rgba(255,215,0,0.3)",
              fontVariantNumeric: "tabular-nums"
            }}>
              {formatShotClock(shotClockTenths)}
            </div>

            {/* Timeouts Display */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 10, background: currentTheme.stripe, padding: "10px 20px", borderRadius: 8, border: `1px solid ${currentTheme.border}` }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= teamA.timeouts ? teamA.color : currentTheme.border }} />)}
              </div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, fontWeight: 800, color: currentTheme.textDim, letterSpacing: "0.2em" }}>TIMEOUTS</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= teamB.timeouts ? teamB.color : currentTheme.border }} />)}
              </div>
            </div>
          </div>

        </div>

        <SidePanel team={teamB} players={fbB.players} teamName={fbB.name || teamB.name} logo={fbB.logo} align="right" theme={currentTheme} />
      </div>

      <TimeoutCallout data={toCallout} />
    </div>
  );
}