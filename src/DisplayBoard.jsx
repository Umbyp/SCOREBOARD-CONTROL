// DisplayBoard.jsx — จอสนาม · No overlap · Firebase + Logo
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

// ─── Foul pip dots (5) ────────────────────────────────────────
function PlayerFoulPips({ count, color }) {
  const c = count >= 5 ? "#FF3333" : count >= 4 ? "#FF8C00" : count >= 3 ? "#FFD700" : color;
  return (
    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: i <= count ? c : "rgba(255,255,255,0.07)",
          border: `1px solid ${i <= count ? c : "rgba(255,255,255,0.1)"}`,
          boxShadow: i <= count && count >= 3 ? `0 0 4px ${c}` : "none",
          transition: "all 0.25s",
        }} />
      ))}
    </div>
  );
}

// ─── Player row ───────────────────────────────────────────────
function PlayerPanel({ players, color, align }) {
  const isLeft = align === "left";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {players.map((p, i) => {
        const fouls = p.fouls || 0;
        const isDQ  = fouls >= 5;
        const fc    = fouls >= 5 ? "#FF3333" : fouls >= 4 ? "#FF8C00" : fouls >= 3 ? "#FFD700" : "rgba(255,255,255,0.65)";
        return (
          <div key={i} style={{
            display: "flex",
            flexDirection: isLeft ? "row" : "row-reverse",
            alignItems: "center",
            padding: "5px 10px", gap: 6,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: isDQ ? "rgba(255,30,30,0.05)" : i % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
            opacity: isDQ ? 0.55 : 1,
            transition: "all 0.3s",
          }}>
            {/* # */}
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 16, color,
              width: 26, textAlign: "center",
              flexShrink: 0, opacity: 0.65,
            }}>{p.num || "—"}</div>

            {/* Name */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14, fontWeight: 600,
              color: isDQ ? "rgba(255,90,90,0.65)" : "rgba(255,255,255,0.88)",
              flex: 1, minWidth: 0,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              textAlign: isLeft ? "left" : "right",
            }}>{p.name || `PLAYER ${i + 1}`}</div>

            {/* Pips */}
            <PlayerFoulPips count={fouls} color={color} />

            {/* Count */}
            <div style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 15, fontWeight: 700, color: fc,
              width: 20, textAlign: "center", flexShrink: 0,
            }}>{fouls}</div>

            {/* OUT label (inline, no absolute) */}
            {isDQ && (
              <div style={{
                fontFamily: "'Bebas Neue'", fontSize: 8,
                letterSpacing: "0.1em", color: "#FF3333",
                background: "rgba(255,30,30,0.12)",
                border: "1px solid rgba(255,30,30,0.3)",
                padding: "1px 4px", borderRadius: 3, flexShrink: 0,
              }}>OUT</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Team foul dots (10) ─────────────────────────────────────
function TeamFoulDots({ count, color }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const active = i < count;
        const c = active && i >= 5 ? "#FF3333" : active && count >= 5 ? "#FFA500" : color;
        return (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: "50%",
            background: active ? c : "rgba(255,255,255,0.06)",
            border: `1px solid ${active ? c : "rgba(255,255,255,0.08)"}`,
            boxShadow: active ? `0 0 5px ${c}66` : "none",
            transition: "all 0.25s",
          }} />
        );
      })}
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────
function SidePanel({ team, players, teamName, logo, align }) {
  const isLeft = align === "left";
  const color  = team.color;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "rgba(7,7,16,0.99)",
      borderRight: isLeft ? `2px solid ${color}28` : "none",
      borderLeft:  isLeft ? "none" : `2px solid ${color}28`,
      overflow: "hidden", minWidth: 0,
    }}>

      {/* ── Header: logo + name + team fouls ── */}
      <div style={{
        padding: "10px 12px 8px",
        background: `linear-gradient(${isLeft ? 135 : 225}deg, ${color}15, rgba(0,0,0,0.45))`,
        borderBottom: `1px solid ${color}20`,
        flexShrink: 0,
      }}>
        {/* Row 1: accent bar + logo + name */}
        <div style={{
          display: "flex",
          flexDirection: isLeft ? "row" : "row-reverse",
          alignItems: "center", gap: 8, marginBottom: 7,
        }}>
          <div style={{ width: 3, height: 30, background: color, borderRadius: 2, flexShrink: 0 }} />

          {/* Logo */}
          {logo && (
            <div style={{
              width: 36, height: 36, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.3)", borderRadius: 6,
              border: `1px solid ${color}25`,
            }}>
              <img src={logo} alt="" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 3 }}
                onError={e => e.target.style.display = "none"} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0, textAlign: isLeft ? "left" : "right" }}>
            <div style={{
              fontFamily: "'Bebas Neue'",
              fontSize: 20, letterSpacing: "0.1em",
              color, lineHeight: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{teamName}</div>
            <div style={{
              fontFamily: "'Barlow Condensed'",
              fontSize: 8, fontWeight: 800,
              color: "rgba(255,255,255,0.2)", letterSpacing: "0.4em", marginTop: 1,
            }}>{isLeft ? "HOME" : "AWAY"}</div>
          </div>
        </div>

        {/* Row 2: team fouls counter + dots */}
        <div style={{
          display: "flex",
          flexDirection: isLeft ? "row" : "row-reverse",
          alignItems: "center", justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{ textAlign: isLeft ? "left" : "right" }}>
            <div style={{
              fontFamily: "'Barlow Condensed'",
              fontSize: 8, fontWeight: 800,
              color: "rgba(255,255,255,0.2)", letterSpacing: "0.3em",
            }}>TEAM FOULS</div>
            <div style={{
              fontFamily: "'Oswald'",
              fontSize: 26, fontWeight: 700, lineHeight: 1,
              color: team.teamFouls >= 10 ? "#FF3333"
                    : team.teamFouls >= 5 ? "#FFA500"
                    : "rgba(255,255,255,0.7)",
            }}>{team.teamFouls}</div>
          </div>
          <div style={{ flex: 1 }}>
            <TeamFoulDots count={team.teamFouls} color={color} />
            {team.teamFouls >= 5 && (
              <div style={{
                fontFamily: "'Bebas Neue'",
                fontSize: 9, letterSpacing: "0.25em",
                color: team.teamFouls >= 10 ? "#FF3333" : "#FFA500",
                textAlign: "center", marginTop: 3,
              }}>
                {team.teamFouls >= 10 ? "● DBL BONUS" : "● BONUS"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Column header labels ── */}
      <div style={{
        display: "flex",
        flexDirection: isLeft ? "row" : "row-reverse",
        padding: "3px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.25)",
        flexShrink: 0,
      }}>
        {["#", "PLAYER", "FOULS"].map((h, i) => (
          <div key={i} style={{
            fontFamily: "'Barlow Condensed'",
            fontSize: 8, fontWeight: 800,
            color: "rgba(255,255,255,0.18)", letterSpacing: "0.3em",
            width: i === 0 ? 26 : i === 2 ? 66 : undefined,
            flex: i === 1 ? 1 : undefined,
            textAlign: i === 1 ? (isLeft ? "left" : "right") : "center",
            paddingLeft: i === 1 && isLeft ? 6 : 0,
            paddingRight: i === 1 && !isLeft ? 6 : 0,
          }}>{h}</div>
        ))}
      </div>

      {/* ── Player list ── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <PlayerPanel players={players} color={color} align={align} />
      </div>
    </div>
  );
}

// ─── Timeout callout ─────────────────────────────────────────
function TimeoutCallout({ data }) {
  if (!data) return null;
  return (
    <div style={{
      position: "fixed",
      bottom: "8%", left: "50%",
      transform: "translateX(-50%)",
      animation: "to-slide 7s ease forwards",
      zIndex: 200,
      display: "flex", flexDirection: "column", alignItems: "center",
      pointerEvents: "none",
    }}>
      {/* Header badge */}
      <div style={{
        fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800,
        letterSpacing: "0.55em", color: "rgba(255,255,255,0.45)",
        background: "rgba(8,8,18,0.97)",
        padding: "4px 28px 3px",
        borderTopLeftRadius: 10, borderTopRightRadius: 10,
        border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
      }}>⏱ T I M E O U T  C A L L E D</div>

      {/* Main card */}
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "rgba(6,6,18,0.98)",
        border: `1px solid ${data.color}45`,
        borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
        overflow: "hidden",
        boxShadow: `0 20px 60px rgba(0,0,0,0.85), 0 0 50px ${data.color}22, inset 0 0 0 1px rgba(255,255,255,0.03)`,
        minWidth: 340,
      }}>
        {/* Left accent bar */}
        <div style={{ width: 6, background: data.color, flexShrink: 0 }} />

        {/* Content */}
        <div style={{ padding: "16px 32px 16px 20px", flex: 1 }}>
          {/* "ขอ TIMEOUT" label */}
          <div style={{
            fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 800,
            letterSpacing: "0.4em", color: `${data.color}88`, marginBottom: 4,
          }}>ขอ T I M E O U T</div>

          {/* Team name — BIG */}
          <div style={{
            fontFamily: "'Bebas Neue'", fontSize: 46, lineHeight: 0.9,
            color: data.color, letterSpacing: "0.06em",
            textShadow: `0 0 30px ${data.color}55`,
          }}>{data.name}</div>

          {/* Remaining */}
          <div style={{
            fontFamily: "'Barlow Condensed'", fontSize: 13, fontWeight: 600,
            color: "rgba(255,255,255,0.35)", marginTop: 6, letterSpacing: "0.1em",
          }}>
            เหลือ <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 800 }}>{data.remaining}</span> ครั้ง
          </div>
        </div>

        {/* Right: remaining pips */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 20px 0 0", gap: 8,
        }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: "50%",
              background: i < data.remaining ? data.color : "rgba(255,255,255,0.06)",
              border: `2px solid ${i < data.remaining ? data.color : "rgba(255,255,255,0.1)"}`,
              boxShadow: i < data.remaining ? `0 0 10px ${data.color}88` : "none",
              transition: "all 0.3s",
            }} />
          ))}
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

  const [fbA,         setFbA]         = useState({ name: "HOME", logo: "", players: defaultPlayers() });
  const [fbB,         setFbB]         = useState({ name: "AWAY", logo: "", players: defaultPlayers() });
  const [fbConnected, setFbConnected] = useState(false);
  const [flashA,      setFlashA]      = useState(null);
  const [flashB,      setFlashB]      = useState(null);
  const [toCallout,   setToCallout]   = useState(null);

  const prevScoreA = useRef(0);
  const prevScoreB = useRef(0);
  const prevToA    = useRef(2);
  const prevToB    = useRef(2);

  // Firebase subscribe
  useEffect(() => {
    const parse = (d, fallbackName) => ({
      name:    d?.name    || fallbackName,
      logo:    d?.logo    || "",
      players: Array.isArray(d?.players) ? d.players : defaultPlayers(),
    });
    const uA = onValue(ref(db, `${DB_PATH}/teamA`), s => {
      setFbA(parse(s.val(), "HOME")); setFbConnected(true);
    });
    const uB = onValue(ref(db, `${DB_PATH}/teamB`), s => {
      setFbB(parse(s.val(), "AWAY")); setFbConnected(true);
    });
    return () => { uA(); uB(); };
  }, []);

  // Socket.IO subscribe
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

  const { teamA, teamB, quarter, clockTenths, isRunning, shotClockTenths, possession, jumpBall } = state;
  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5  && shotClockTenths > 0;
  const shotWarn   = shotSec <= 10 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "#00E87A";
  const clockUp    = clockTenths === 0;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#050509",
      display: "flex", flexDirection: "column",
      overflow: "hidden", userSelect: "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;700&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
        @keyframes score-pop { 0%{transform:scale(1)} 35%{transform:scale(1.1)} 100%{transform:scale(1)} }
        @keyframes flash-up  { 0%{opacity:0;transform:translateX(-50%) translateY(0) scale(0.7)} 18%{opacity:1;transform:translateX(-50%) translateY(-22px) scale(1.15)} 80%{opacity:0.7;transform:translateX(-50%) translateY(-42px) scale(1)} 100%{opacity:0;transform:translateX(-50%) translateY(-58px)} }
        @keyframes to-slide  { 0%{opacity:0;transform:translateX(-50%) translateY(22px)} 12%{opacity:1;transform:translateX(-50%) translateY(0)} 85%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-16px)} }
        @keyframes clk-blink { 0%,100%{opacity:1} 50%{opacity:0.22} }
        @keyframes glow-flow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes poss-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════
          TOP BAR — ไม่มี position:absolute ไม่ทับใคร
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        height: 36, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px",
        background: "rgba(0,0,0,0.6)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 5, color: "rgba(255,255,255,0.35)",
          fontFamily: "'Bebas Neue'", fontSize: 10, letterSpacing: "0.2em",
          padding: "4px 10px", cursor: "pointer", flexShrink: 0,
        }}>← HOME</button>

        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 11, letterSpacing: "0.6em",
          color: "rgba(255,255,255,0.12)",
        }}>ARENA DISPLAY</div>

        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 100, flexShrink: 0,
          background: fbConnected ? "rgba(0,232,122,0.07)" : "rgba(255,85,85,0.07)",
          border: `1px solid ${fbConnected ? "rgba(0,232,122,0.2)" : "rgba(255,85,85,0.2)"}`,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 9, fontWeight: 800, letterSpacing: "0.25em",
          color: fbConnected ? "#00E87A" : "#FF6666",
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: fbConnected ? "#00E87A" : "#FF6666",
          }} />
          {fbConnected ? "FIREBASE LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN 3-COLUMN GRID — fills remaining space
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: "1fr minmax(300px, 32vw) 1fr",
      }}>

        {/* LEFT — Team A */}
        <SidePanel
          team={teamA}
          players={fbA.players}
          teamName={fbA.name || teamA.name}
          logo={fbA.logo}
          align="left"
        />

        {/* ══ CENTER ══ */}
        <div style={{
          display: "flex", flexDirection: "column",
          background: "radial-gradient(ellipse at 50% 25%, #0d0d24 0%, #050510 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}>

          {/* Top rainbow bar */}
          <div style={{
            height: 3, flexShrink: 0,
            background: `linear-gradient(90deg, ${teamA.color}, #FFD700, ${teamB.color})`,
            animation: "glow-flow 3s ease-in-out infinite",
          }} />

          <div style={{
            flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "space-evenly",
            padding: "10px 16px",
            gap: 4,
          }}>

            {/* ── QUARTER — ชัดเจน ── */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {/* Q circles */}
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                {[1,2,3,4].map(q => {
                  const active = quarter === q;
                  const done   = q < quarter;
                  return (
                    <div key={q} style={{
                      width: active ? 46 : 30, height: active ? 46 : 30,
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: active
                        ? `linear-gradient(135deg, ${teamA.color}, ${teamB.color})`
                        : done ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                      border: active
                        ? "2px solid rgba(255,255,255,0.35)"
                        : `1px solid rgba(255,255,255,${done ? "0.1" : "0.05"})`,
                      boxShadow: active ? `0 0 18px rgba(255,215,0,0.3)` : "none",
                      transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                    }}>
                      <span style={{
                        fontFamily: "'Bebas Neue'", fontSize: active ? 19 : 12,
                        color: active ? "#fff" : done ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)",
                        transition: "all 0.35s",
                      }}>Q{q}</span>
                    </div>
                  );
                })}
                {quarter >= 5 && (
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(135deg, #FFD700, #FF8C00)",
                    border: "2px solid rgba(255,255,255,0.35)",
                    boxShadow: "0 0 18px rgba(255,215,0,0.4)",
                  }}>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: "#fff" }}>OT{quarter > 5 ? quarter - 4 : ""}</span>
                  </div>
                )}
              </div>
              {/* Quarter label + Live badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  fontFamily: "'Bebas Neue'", fontSize: 26, letterSpacing: "0.1em", lineHeight: 1,
                  background: `linear-gradient(90deg, ${teamA.color}, ${teamB.color})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {quarter <= 4 ? `QUARTER  ${quarter}` : `OVERTIME${quarter > 5 ? " " + (quarter - 4) : ""}`}
                </div>
                <div style={{
                  fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800,
                  letterSpacing: "0.25em",
                  color: isRunning ? "#00E87A" : "rgba(255,255,255,0.22)",
                  background: isRunning ? "rgba(0,232,122,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isRunning ? "rgba(0,232,122,0.28)" : "rgba(255,255,255,0.07)"}`,
                  padding: "2px 8px", borderRadius: 100,
                }}>{isRunning ? "▶ LIVE" : "■ PAUSED"}</div>
              </div>
            </div>

            {/* Team names row */}
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 8 }}>
              <div style={{ flex: 1, textAlign: "right", fontFamily: "'Bebas Neue'", fontSize: "clamp(14px, 1.8vw, 22px)", color: teamA.color, letterSpacing: "0.06em", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamA.name}</div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.15)", letterSpacing: "0.3em", flexShrink: 0 }}>VS</div>
              <div style={{ flex: 1, textAlign: "left",  fontFamily: "'Bebas Neue'", fontSize: "clamp(14px, 1.8vw, 22px)", color: teamB.color, letterSpacing: "0.06em", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamB.name}</div>
            </div>

            {/* ── Scores ── */}
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>

              {/* Score A */}
              <div style={{ flex: 1, textAlign: "center", position: "relative", overflow: "visible" }}>
                {flashA && (
                  <div style={{
                    position: "absolute", top: 0, left: "50%",
                    fontFamily: "'Oswald'", fontSize: 28, fontWeight: 700,
                    color: teamA.color, textShadow: `0 0 16px ${teamA.color}`,
                    animation: "flash-up 2.2s ease forwards",
                    pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
                  }}>{flashA}</div>
                )}
                <div style={{
                  fontFamily: "'Oswald'",
                  fontSize: "clamp(56px, 8vw, 108px)",
                  fontWeight: 700, lineHeight: 1,
                  color: teamA.color, textShadow: `0 0 50px ${teamA.color}35`,
                  fontVariantNumeric: "tabular-nums",
                  animation: flashA ? "score-pop 0.3s ease" : "none",
                }}>{teamA.score}</div>
              </div>

              {/* Divider */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 6px", flexShrink: 0 }}>
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 9, letterSpacing: "0.3em", color: "rgba(255,255,255,0.1)" }}>VS</div>
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />
              </div>

              {/* Score B */}
              <div style={{ flex: 1, textAlign: "center", position: "relative", overflow: "visible" }}>
                {flashB && (
                  <div style={{
                    position: "absolute", top: 0, left: "50%",
                    fontFamily: "'Oswald'", fontSize: 28, fontWeight: 700,
                    color: teamB.color, textShadow: `0 0 16px ${teamB.color}`,
                    animation: "flash-up 2.2s ease forwards",
                    pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
                  }}>{flashB}</div>
                )}
                <div style={{
                  fontFamily: "'Oswald'",
                  fontSize: "clamp(56px, 8vw, 108px)",
                  fontWeight: 700, lineHeight: 1,
                  color: teamB.color, textShadow: `0 0 50px ${teamB.color}35`,
                  fontVariantNumeric: "tabular-nums",
                  animation: flashB ? "score-pop 0.3s ease" : "none",
                }}>{teamB.score}</div>
              </div>
            </div>

            {/* ── Possession + Jump Ball Arrow ──
                กฎบาส: ลูกศร Alternating Possession ชี้ไปทีมที่ได้ครอบครองต่อไป
                (ไม่ใช่ว่าใครเป็นคนโยน — แต่ใครจะได้บอล)
            ── */}
            <div style={{
              width: "100%", display: "flex", alignItems: "center",
              background: "rgba(0,0,0,0.2)", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.05)",
              padding: "5px 10px", gap: 0,
            }}>
              {/* Team A */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: possession === "teamA" ? teamA.color : "rgba(255,255,255,0.06)",
                  boxShadow: possession === "teamA" ? `0 0 7px ${teamA.color}` : "none",
                  transition: "all 0.3s",
                }} />
                <div style={{
                  fontFamily: "'Bebas Neue'", fontSize: 12, letterSpacing: "0.08em",
                  color: possession === "teamA" ? teamA.color : "rgba(255,255,255,0.15)",
                  transition: "all 0.3s",
                }}>{teamA.name}</div>
              </div>

              {/* Center arrow */}
              <div style={{ flexShrink: 0, padding: "0 6px", textAlign: "center" }}>
                {jumpBall ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <div style={{
                      fontFamily: "'Bebas Neue'", fontSize: 24,
                      color: possession === "teamA" ? teamA.color
                           : possession === "teamB" ? teamB.color : "#FFD700",
                      textShadow: `0 0 10px ${possession === "teamA" ? teamA.color : possession === "teamB" ? teamB.color : "#FFD700"}88`,
                      lineHeight: 1, animation: "poss-blink 1s ease-in-out infinite",
                    }}>
                      {possession === "teamA" ? "◀" : possession === "teamB" ? "▶" : "◆"}
                    </div>
                    <div style={{
                      fontFamily: "'Barlow Condensed'", fontSize: 7, fontWeight: 800,
                      color: "#FFD700", letterSpacing: "0.25em",
                    }}>JUMP</div>
                  </div>
                ) : (
                  <div style={{
                    fontFamily: "'Bebas Neue'", fontSize: 18,
                    color: possession === "teamA" ? teamA.color
                         : possession === "teamB" ? teamB.color : "rgba(255,255,255,0.08)",
                    transition: "all 0.3s",
                  }}>
                    {possession ? (possession === "teamA" ? "◀" : "▶") : "·"}
                  </div>
                )}
              </div>

              {/* Team B */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                <div style={{
                  fontFamily: "'Bebas Neue'", fontSize: 12, letterSpacing: "0.08em",
                  color: possession === "teamB" ? teamB.color : "rgba(255,255,255,0.15)",
                  transition: "all 0.3s",
                }}>{teamB.name}</div>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: possession === "teamB" ? teamB.color : "rgba(255,255,255,0.06)",
                  boxShadow: possession === "teamB" ? `0 0 7px ${teamB.color}` : "none",
                  transition: "all 0.3s",
                }} />
              </div>
            </div>

            {/* Game Clock */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "'Oswald'",
                fontSize: "clamp(46px, 6.5vw, 84px)",
                fontWeight: 700, lineHeight: 1,
                color: clockUp ? "#FF2222" : isRunning ? "#FFD700" : "rgba(255,255,255,0.92)",
                textShadow: clockUp ? "0 0 36px #FF000066" : isRunning ? "0 0 24px rgba(255,215,0,0.4)" : "none",
                fontVariantNumeric: "tabular-nums",
                animation: clockUp ? "clk-blink 0.7s infinite" : "none",
                transition: "color 0.3s",
              }}>{formatGameClock(clockTenths)}</div>
            </div>

            {/* Shot Clock */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "70%" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.2)", letterSpacing: "0.35em" }}>SHOT</div>
                <div style={{
                  fontFamily: "'Oswald'",
                  fontSize: "clamp(28px, 4vw, 52px)",
                  fontWeight: 700, lineHeight: 1,
                  color: shotColor,
                  textShadow: shotUrgent ? "0 0 28px rgba(255,30,30,0.9)" : shotWarn ? "0 0 16px rgba(255,165,0,0.5)" : "none",
                  fontVariantNumeric: "tabular-nums",
                  animation: shotUrgent ? "clk-blink 0.4s infinite" : "none",
                  transition: "color 0.3s",
                }}>{formatShotClock(shotClockTenths)}</div>
              </div>
              {/* Progress bar */}
              <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (shotClockTenths / 240) * 100)}%`, background: shotColor, borderRadius: 2, transition: "width 0.1s linear, background 0.3s" }} />
              </div>
            </div>

            {/* Timeouts */}
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 4 }}>
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 5 }}>
                {[1,2].map(i => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: i <= teamA.timeouts ? teamA.color : "rgba(255,255,255,0.07)", border: `1px solid ${i <= teamA.timeouts ? teamA.color : "rgba(255,255,255,0.1)"}`, boxShadow: i <= teamA.timeouts ? `0 0 6px ${teamA.color}77` : "none", transition: "all 0.2s" }} />
                ))}
              </div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.35em", flexShrink: 0, padding: "0 6px" }}>T/O</div>
              <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", gap: 5 }}>
                {[1,2].map(i => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: i <= teamB.timeouts ? teamB.color : "rgba(255,255,255,0.07)", border: `1px solid ${i <= teamB.timeouts ? teamB.color : "rgba(255,255,255,0.1)"}`, boxShadow: i <= teamB.timeouts ? `0 0 6px ${teamB.color}77` : "none", transition: "all 0.2s" }} />
                ))}
              </div>
            </div>

          </div>

          {/* Bottom rainbow bar */}
          <div style={{ height: 3, flexShrink: 0, background: `linear-gradient(90deg, ${teamA.color}, #FFD700, ${teamB.color})`, opacity: 0.45 }} />
        </div>

        {/* RIGHT — Team B */}
        <SidePanel
          team={teamB}
          players={fbB.players}
          teamName={fbB.name || teamB.name}
          logo={fbB.logo}
          align="right"
        />
      </div>

      {/* Timeout callout (fixed, centered, z-index safe) */}
      <TimeoutCallout data={toCallout} />
    </div>
  );
}