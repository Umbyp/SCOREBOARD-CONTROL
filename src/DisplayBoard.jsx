// DisplayBoard.jsx — จอสนาม อ่านข้อมูลผู้เล่นจาก Firebase Realtime
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const DB_PATH    = "player_data";

// ─── Helpers ──────────────────────────────────────────────────
function formatGameClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 600) {
    const totalSec = Math.floor(t / 10);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  }
  return `${String(Math.floor(t / 10)).padStart(2, "0")}.${Math.floor(t % 10)}`;
}
function formatShotClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 100) return String(Math.ceil(t / 10));
  return `${Math.floor(t / 10)}.${Math.floor(t % 10)}`;
}
function qLabel(q) { return q <= 4 ? `Q${q}` : `OT${q - 4}`; }

const defaultPlayers = () =>
  Array.from({ length: 5 }, (_, i) => ({ num: "", name: `PLAYER ${i + 1}`, fouls: 0 }));

// ─── Player foul pips ─────────────────────────────────────────
function PlayerFoulPips({ count, color }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= count;
        const c =
          count >= 5 ? "#FF3333" :
          count >= 4 ? "#FF8C00" :
          count >= 3 ? "#FFD700" : color;
        return (
          <div key={i} style={{
            width: 9, height: 9, borderRadius: "50%",
            background: active ? c : "rgba(255,255,255,0.07)",
            border: `1px solid ${active ? c : "rgba(255,255,255,0.1)"}`,
            boxShadow: active && count >= 3 ? `0 0 5px ${c}` : "none",
            transition: "all 0.25s", flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
}

// ─── Player list panel ────────────────────────────────────────
function PlayerPanel({ players, color, align }) {
  const isLeft = align === "left";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {players.map((p, i) => {
        const isDQ = (p.fouls || 0) >= 5;
        const foulColor =
          (p.fouls || 0) >= 5 ? "#FF3333" :
          (p.fouls || 0) >= 4 ? "#FF8C00" :
          (p.fouls || 0) >= 3 ? "#FFD700" :
          "rgba(255,255,255,0.65)";

        return (
          <div key={i} style={{
            display: "flex",
            flexDirection: isLeft ? "row" : "row-reverse",
            alignItems: "center",
            padding: "6px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: isDQ ? "rgba(255,30,30,0.05)"
                       : i % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
            opacity: isDQ ? 0.55 : 1,
            transition: "all 0.3s",
            position: "relative", gap: 0,
          }}>
            {/* # */}
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18, fontWeight: 700,
              color, width: 30, textAlign: "center",
              flexShrink: 0, opacity: 0.65,
            }}>{p.num || "—"}</div>

            {/* Name */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 15, fontWeight: 600,
              color: isDQ ? "rgba(255,90,90,0.65)" : "rgba(255,255,255,0.88)",
              flex: 1,
              padding: "0 6px",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              textAlign: isLeft ? "left" : "right",
            }}>{p.name || `PLAYER ${i + 1}`}</div>

            {/* Pips */}
            <div style={{ transform: isLeft ? "none" : "scaleX(-1)", flexShrink: 0 }}>
              <PlayerFoulPips count={p.fouls || 0} color={color} />
            </div>

            {/* Foul number */}
            <div style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 17, fontWeight: 700,
              color: foulColor,
              width: 24, textAlign: "center",
              flexShrink: 0,
              marginLeft: isLeft ? 5 : 0,
              marginRight: isLeft ? 0 : 5,
            }}>{p.fouls || 0}</div>

            {/* OUT badge */}
            {isDQ && (
              <div style={{
                position: "absolute",
                [isLeft ? "right" : "left"]: 5,
                fontFamily: "'Bebas Neue'", fontSize: 9,
                letterSpacing: "0.12em", color: "#FF3333",
                background: "rgba(255,30,30,0.12)",
                border: "1px solid rgba(255,30,30,0.3)",
                padding: "1px 5px", borderRadius: 3,
              }}>OUT</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Team fouls dot grid (10 dots) ───────────────────────────
function TeamFoulDots({ count, color }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const active = i < count;
        const c = active && i >= 5 ? "#FF3333"
                : active && count >= 5 ? "#FFA500"
                : color;
        return (
          <div key={i} style={{
            width: 11, height: 11, borderRadius: "50%",
            background: active ? c : "rgba(255,255,255,0.06)",
            border: `1px solid ${active ? c : "rgba(255,255,255,0.08)"}`,
            boxShadow: active ? `0 0 6px ${c}77` : "none",
            transition: "all 0.25s",
          }} />
        );
      })}
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────
function SidePanel({ team, players, teamName, align }) {
  const isLeft = align === "left";
  const color  = team.color;

  return (
    <div style={{
      background: "rgba(7, 7, 16, 0.99)",
      borderRight: isLeft ? `2px solid ${color}30` : "none",
      borderLeft:  isLeft ? "none" : `2px solid ${color}30`,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{
        padding: "10px 14px 9px",
        background: `linear-gradient(${isLeft ? 135 : 225}deg, ${color}18, rgba(0,0,0,0.5))`,
        borderBottom: `1px solid ${color}25`,
        display: "flex",
        flexDirection: isLeft ? "row" : "row-reverse",
        alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 4, height: 32, background: color, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: isLeft ? "left" : "right" }}>
          <div style={{
            fontFamily: "'Bebas Neue'",
            fontSize: 22, letterSpacing: "0.12em",
            color, lineHeight: 1,
          }}>{teamName}</div>
          <div style={{
            fontFamily: "'Barlow Condensed'",
            fontSize: 9, fontWeight: 800,
            color: "rgba(255,255,255,0.22)", letterSpacing: "0.4em",
            marginTop: 1,
          }}>{isLeft ? "HOME TEAM" : "AWAY TEAM"}</div>
        </div>
        {/* Team fouls badge */}
        <div style={{ textAlign: isLeft ? "right" : "left" }}>
          <div style={{
            fontFamily: "'Barlow Condensed'",
            fontSize: 9, fontWeight: 800,
            color: "rgba(255,255,255,0.22)", letterSpacing: "0.3em",
          }}>TEAM FOULS</div>
          <div style={{
            fontFamily: "'Oswald'",
            fontSize: 30, fontWeight: 700, lineHeight: 1,
            color: team.teamFouls >= 10 ? "#FF3333"
                  : team.teamFouls >= 5  ? "#FFA500"
                  : "rgba(255,255,255,0.7)",
          }}>{team.teamFouls}</div>
        </div>
      </div>

      {/* Column labels */}
      <div style={{
        display: "flex",
        flexDirection: isLeft ? "row" : "row-reverse",
        padding: "4px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.2)",
      }}>
        <span style={{ width: 30, fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.25em", textAlign: "center" }}>#</span>
        <span style={{ flex: 1, fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.25em", textAlign: isLeft ? "left" : "right", paddingLeft: isLeft ? 6 : 0, paddingRight: isLeft ? 0 : 6 }}>PLAYER</span>
        <span style={{ width: 70, fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.25em", textAlign: "center" }}>FOULS</span>
      </div>

      {/* Player list (scrollable if many players) */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PlayerPanel players={players} color={color} align={align} />
      </div>

      {/* Team fouls dots + bonus label */}
      <div style={{
        padding: "9px 14px 10px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.35)",
        display: "flex", flexDirection: "column", gap: 5, alignItems: "center",
      }}>
        <TeamFoulDots count={team.teamFouls} color={color} />
        {team.teamFouls >= 5 && (
          <div style={{
            fontFamily: "'Bebas Neue'",
            fontSize: 11, letterSpacing: "0.3em",
            color: team.teamFouls >= 10 ? "#FF3333" : "#FFA500",
            textShadow: `0 0 10px ${team.teamFouls >= 10 ? "#FF3333" : "#FFA500"}55`,
          }}>
            {team.teamFouls >= 10 ? "●● DOUBLE BONUS" : "● BONUS"}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DisplayBoard({ onBack }) {
  // Scoreboard state (from Socket.IO)
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, teamFouls: 0, timeouts: 2, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, teamFouls: 0, timeouts: 2, color: "#00D4FF" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });

  // Player data (from Firebase)
  const [fbA, setFbA] = useState({ name: "HOME", players: defaultPlayers() });
  const [fbB, setFbB] = useState({ name: "AWAY", players: defaultPlayers() });
  const [fbConnected, setFbConnected] = useState(false);

  // Animations
  const [flashA,    setFlashA]    = useState(null);
  const [flashB,    setFlashB]    = useState(null);
  const [toCallout, setToCallout] = useState(null);

  const prevScoreA = useRef(0);
  const prevScoreB = useRef(0);
  const prevToA    = useRef(2);
  const prevToB    = useRef(2);

  // ── Subscribe Firebase player data ────────────────────────
  useEffect(() => {
    const unsubA = onValue(ref(db, `${DB_PATH}/teamA`), (snap) => {
      const d = snap.val();
      if (d) {
        setFbA({
          name:    d.name    || "HOME",
          players: Array.isArray(d.players) ? d.players : defaultPlayers(),
        });
        setFbConnected(true);
      }
    }, (err) => {
      console.error("Firebase teamA error:", err);
    });

    const unsubB = onValue(ref(db, `${DB_PATH}/teamB`), (snap) => {
      const d = snap.val();
      if (d) {
        setFbB({
          name:    d.name    || "AWAY",
          players: Array.isArray(d.players) ? d.players : defaultPlayers(),
        });
        setFbConnected(true);
      }
    }, (err) => {
      console.error("Firebase teamB error:", err);
    });

    return () => { unsubA(); unsubB(); };
  }, []);

  // ── Subscribe Socket.IO scoreboard state ──────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { reconnection: true, reconnectionDelay: 1000 });
    socket.on("stateUpdate", (s) => {
      if (!s?.teamA) return;

      const da = s.teamA.score - prevScoreA.current;
      const db_ = s.teamB.score - prevScoreB.current;
      if (da > 0) { setFlashA(`+${da}`); setTimeout(() => setFlashA(null), 2200); }
      if (db_ > 0) { setFlashB(`+${db_}`); setTimeout(() => setFlashB(null), 2200); }
      prevScoreA.current = s.teamA.score;
      prevScoreB.current = s.teamB.score;

      if (prevToA.current > s.teamA.timeouts) {
        setToCallout({ name: s.teamA.name, color: s.teamA.color, remaining: s.teamA.timeouts });
        setTimeout(() => setToCallout(null), 7000);
      }
      if (prevToB.current > s.teamB.timeouts) {
        setToCallout({ name: s.teamB.name, color: s.teamB.color, remaining: s.teamB.timeouts });
        setTimeout(() => setToCallout(null), 7000);
      }
      prevToA.current = s.teamA.timeouts;
      prevToB.current = s.teamB.timeouts;

      setState(s);
    });
    const poll = setInterval(() => {
      if (!socket.connected)
        fetch(SOCKET_URL + "/api/state").then(r => r.json())
          .then(s => s?.teamA && setState(s)).catch(() => {});
    }, 2000);
    return () => { socket.disconnect(); clearInterval(poll); };
  }, []);

  // ── Derived values ────────────────────────────────────────
  const { teamA, teamB, quarter, clockTenths, isRunning,
          shotClockTenths, possession, jumpBall } = state;

  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5  && shotClockTenths > 0;
  const shotWarn   = shotSec <= 10 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "#00E87A";
  const clockUp    = clockTenths === 0;

  // Use Firebase name if available, else scoreboard name
  const nameA  = fbA.name || teamA.name;
  const nameB  = fbB.name || teamB.name;
  const playersA = fbA.players;
  const playersB = fbB.players;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#050509",
      display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative",
      userSelect: "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;700&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
        @keyframes score-pop { 0%{transform:scale(1)} 35%{transform:scale(1.1)} 100%{transform:scale(1)} }
        @keyframes flash-up  { 0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.7)} 18%{opacity:1;transform:translateX(-50%) translateY(-22px) scale(1.15)} 80%{opacity:0.7;transform:translateX(-50%) translateY(-42px) scale(1)} 100%{opacity:0;transform:translateX(-50%) translateY(-58px)} }
        @keyframes to-slide  { 0%{opacity:0;transform:translateX(-50%) translateY(22px)} 12%{opacity:1;transform:translateX(-50%) translateY(0)} 85%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-16px)} }
        @keyframes clk-blink { 0%,100%{opacity:1} 50%{opacity:0.22} }
        @keyframes glow-flow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      {/* Back */}
      <button onClick={onBack} style={{
        position: "absolute", top: 10, left: 10, zIndex: 60,
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 6, color: "rgba(255,255,255,0.28)",
        fontFamily: "'Bebas Neue'", fontSize: 11, letterSpacing: "0.2em",
        padding: "5px 12px", cursor: "pointer",
      }}>← HOME</button>

      {/* Firebase indicator */}
      <div style={{
        position: "absolute", top: 10, right: 10, zIndex: 60,
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 100,
        background: fbConnected ? "rgba(0,232,122,0.07)" : "rgba(255,85,85,0.07)",
        border: `1px solid ${fbConnected ? "rgba(0,232,122,0.2)" : "rgba(255,85,85,0.2)"}`,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 9, fontWeight: 800, letterSpacing: "0.25em",
        color: fbConnected ? "#00E87A" : "#FF6666",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: fbConnected ? "#00E87A" : "#FF6666",
          boxShadow: fbConnected ? "0 0 6px #00E87A" : "none",
        }} />
        {fbConnected ? "FIREBASE LIVE" : "FIREBASE OFF"}
      </div>

      {/* 3-column layout */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr minmax(340px, 36vw) 1fr",
        overflow: "hidden",
      }}>

        {/* LEFT — Team A */}
        <SidePanel
          team={teamA}
          players={playersA}
          teamName={nameA}
          align="left"
        />

        {/* CENTER */}
        <div style={{
          display: "flex", flexDirection: "column",
          background: "radial-gradient(ellipse at 50% 30%, #0d0d24 0%, #050510 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Top glow */}
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${teamA.color}, #FFD700, ${teamB.color})`,
            animation: "glow-flow 3s ease-in-out infinite",
          }} />

          <div style={{
            flex: 1,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "space-evenly",
            padding: "14px 18px",
          }}>

            {/* Period */}
            <div style={{
              fontFamily: "'Bebas Neue'",
              fontSize: 13, letterSpacing: "0.55em",
              color: "rgba(255,255,255,0.18)",
            }}>▸ {qLabel(quarter)} ▸ {isRunning ? "LIVE" : "PAUSED"}</div>

            {/* Team Names */}
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 8 }}>
              <div style={{
                flex: 1, textAlign: "right",
                fontFamily: "'Bebas Neue'",
                fontSize: "clamp(16px, 2vw, 26px)",
                color: teamA.color, letterSpacing: "0.08em", lineHeight: 1,
              }}>{teamA.name}</div>
              <div style={{
                fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800,
                color: "rgba(255,255,255,0.15)", letterSpacing: "0.3em", flexShrink: 0,
              }}>VS</div>
              <div style={{
                flex: 1, textAlign: "left",
                fontFamily: "'Bebas Neue'",
                fontSize: "clamp(16px, 2vw, 26px)",
                color: teamB.color, letterSpacing: "0.08em", lineHeight: 1,
              }}>{teamB.name}</div>
            </div>

            {/* Scores */}
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 0 }}>
              {/* A */}
              <div style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {flashA && (
                  <div style={{
                    position: "absolute", top: 0, left: "50%",
                    fontFamily: "'Oswald'", fontSize: 32, fontWeight: 700,
                    color: teamA.color, textShadow: `0 0 20px ${teamA.color}`,
                    animation: "flash-up 2.2s ease forwards",
                    pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
                  }}>{flashA}</div>
                )}
                <div style={{
                  fontFamily: "'Oswald'",
                  fontSize: "clamp(60px, 8.5vw, 116px)",
                  fontWeight: 700, lineHeight: 1,
                  color: teamA.color,
                  textShadow: `0 0 60px ${teamA.color}40`,
                  fontVariantNumeric: "tabular-nums",
                  animation: flashA ? "score-pop 0.3s ease" : "none",
                }}>{teamA.score}</div>
              </div>

              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 5, padding: "0 8px", flexShrink: 0,
              }}>
                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.09)" }} />
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 10, letterSpacing: "0.3em", color: "rgba(255,255,255,0.12)" }}>VS</div>
                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.09)" }} />
              </div>

              {/* B */}
              <div style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {flashB && (
                  <div style={{
                    position: "absolute", top: 0, left: "50%",
                    fontFamily: "'Oswald'", fontSize: 32, fontWeight: 700,
                    color: teamB.color, textShadow: `0 0 20px ${teamB.color}`,
                    animation: "flash-up 2.2s ease forwards",
                    pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
                  }}>{flashB}</div>
                )}
                <div style={{
                  fontFamily: "'Oswald'",
                  fontSize: "clamp(60px, 8.5vw, 116px)",
                  fontWeight: 700, lineHeight: 1,
                  color: teamB.color,
                  textShadow: `0 0 60px ${teamB.color}40`,
                  fontVariantNumeric: "tabular-nums",
                  animation: flashB ? "score-pop 0.3s ease" : "none",
                }}>{teamB.score}</div>
              </div>
            </div>

            {/* Possession */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                fontFamily: "'Bebas Neue'", fontSize: 12, letterSpacing: "0.2em",
                color: possession === "teamA" ? teamA.color : "rgba(255,255,255,0.08)",
                textShadow: possession === "teamA" ? `0 0 10px ${teamA.color}` : "none",
                transition: "all 0.3s",
              }}>▶ BALL</div>
              {jumpBall && (
                <div style={{
                  fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800,
                  color: "#FFD700", letterSpacing: "0.3em",
                  background: "rgba(255,215,0,0.1)",
                  padding: "2px 10px", borderRadius: 100,
                  border: "1px solid rgba(255,215,0,0.25)",
                }}>⊕ JUMP BALL</div>
              )}
              <div style={{
                fontFamily: "'Bebas Neue'", fontSize: 12, letterSpacing: "0.2em",
                color: possession === "teamB" ? teamB.color : "rgba(255,255,255,0.08)",
                textShadow: possession === "teamB" ? `0 0 10px ${teamB.color}` : "none",
                transition: "all 0.3s",
              }}>BALL ▶</div>
            </div>

            {/* Game Clock */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "'Oswald'",
                fontSize: "clamp(50px, 7vw, 92px)",
                fontWeight: 700, lineHeight: 1,
                color: clockUp    ? "#FF2222"
                      : isRunning  ? "#FFD700"
                      : "rgba(255,255,255,0.92)",
                textShadow: clockUp ? "0 0 40px #FF000077" : isRunning ? "0 0 28px rgba(255,215,0,0.45)" : "none",
                fontVariantNumeric: "tabular-nums",
                animation: clockUp ? "clk-blink 0.7s infinite" : "none",
                transition: "color 0.3s",
              }}>{formatGameClock(clockTenths)}</div>
            </div>

            {/* Shot Clock */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: "65%" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.22)", letterSpacing: "0.35em" }}>SHOT CLOCK</div>
                <div style={{
                  fontFamily: "'Oswald'",
                  fontSize: "clamp(30px, 4.2vw, 56px)",
                  fontWeight: 700, lineHeight: 1,
                  color: shotColor,
                  textShadow: shotUrgent ? "0 0 30px rgba(255,30,30,0.9)" : shotWarn ? "0 0 18px rgba(255,165,0,0.5)" : "none",
                  fontVariantNumeric: "tabular-nums",
                  animation: shotUrgent ? "clk-blink 0.4s infinite" : "none",
                  transition: "color 0.3s",
                }}>{formatShotClock(shotClockTenths)}</div>
              </div>
              <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (shotClockTenths / 240) * 100)}%`,
                  background: shotColor, borderRadius: 2,
                  transition: "width 0.1s linear, background 0.3s",
                }} />
              </div>
            </div>

            {/* Timeouts */}
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 5, paddingRight: 12 }}>
                {[1,2].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: i <= teamA.timeouts ? teamA.color : "rgba(255,255,255,0.07)",
                    border: `1px solid ${i <= teamA.timeouts ? teamA.color : "rgba(255,255,255,0.1)"}`,
                    boxShadow: i <= teamA.timeouts ? `0 0 7px ${teamA.color}88` : "none",
                    transition: "all 0.2s",
                  }} />
                ))}
              </div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.35em", flexShrink: 0 }}>TIMEOUT</div>
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", gap: 5, paddingLeft: 12 }}>
                {[1,2].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: i <= teamB.timeouts ? teamB.color : "rgba(255,255,255,0.07)",
                    border: `1px solid ${i <= teamB.timeouts ? teamB.color : "rgba(255,255,255,0.1)"}`,
                    boxShadow: i <= teamB.timeouts ? `0 0 7px ${teamB.color}88` : "none",
                    transition: "all 0.2s",
                  }} />
                ))}
              </div>
            </div>

          </div>

          {/* Bottom glow */}
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${teamA.color}, #FFD700, ${teamB.color})`,
            opacity: 0.5,
          }} />
        </div>

        {/* RIGHT — Team B */}
        <SidePanel
          team={teamB}
          players={playersB}
          teamName={nameB}
          align="right"
        />
      </div>

      {/* Timeout Callout */}
      {toCallout && (
        <div style={{
          position: "fixed",
          bottom: "11%", left: "50%",
          animation: "to-slide 7s ease forwards",
          zIndex: 200,
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800,
            letterSpacing: "0.5em", color: "rgba(255,255,255,0.28)",
            background: "rgba(8,8,18,0.95)",
            padding: "3px 20px 2px",
            borderTopLeftRadius: 8, borderTopRightRadius: 8,
            border: "1px solid rgba(255,255,255,0.09)", borderBottom: "none",
          }}>T I M E O U T</div>
          <div style={{
            display: "flex", alignItems: "center",
            background: "rgba(8,8,20,0.97)",
            border: `1px solid ${toCallout.color}40`,
            borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
            overflow: "hidden",
            boxShadow: `0 20px 60px rgba(0,0,0,0.85), 0 0 40px ${toCallout.color}20`,
          }}>
            <div style={{ width: 6, background: toCallout.color, alignSelf: "stretch" }} />
            <div style={{ padding: "16px 38px 16px 22px" }}>
              <div style={{
                fontFamily: "'Oswald'", fontSize: 38, fontWeight: 700, lineHeight: 1,
                color: toCallout.color, letterSpacing: "0.04em",
              }}>{toCallout.name}</div>
              <div style={{
                fontFamily: "'Barlow Condensed'", fontSize: 12,
                color: "rgba(255,255,255,0.28)", marginTop: 4, letterSpacing: "0.15em",
              }}>เหลือ {toCallout.remaining} ครั้ง</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}