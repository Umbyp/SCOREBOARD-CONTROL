import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

// ─── Format Helpers ────────────────────────────────────────────────────────
function formatGameClock(tenths) {
  if (tenths > 600) {
    // แสดง MM:SS (ปัดขึ้น)
    const totalSec = Math.ceil(tenths / 10);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else {
    // แสดง SS.2 (ทศนิยม 1 ตำแหน่ง, ขั้น 0.2 วินาที)
    const s = Math.floor(tenths / 10);
    const t = tenths % 10;
    // round t to nearest even (0,2,4,6,8) เพื่อให้สอดคล้อง tick 0.2s
    const t2 = Math.floor(t / 2) * 2;
    return `${String(s).padStart(2, "0")}.${t2}`;
  }
}

function formatShotClock(tenths) {
  if (tenths > 100) return String(Math.ceil(tenths / 10));
  // ทศนิยม 0.2 วินาที
  const s = Math.floor(tenths / 10);
  const t = tenths % 10;
  const t2 = Math.floor(t / 2) * 2;
  return `${s}.${t2}`;
}

function send(type, team, value) {
  socket.emit("action", { type, team, value });
}

// ─── 5-Dot Team Foul Indicator ─────────────────────────────────────────────
function FoulDots({ count, color }) {
  // 5 dots: dot 5 = BONUS threshold
  const isBonus = count >= 5;
  const dotColor = isBonus ? "#FF4040" : color;
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          width: 22, height: 22, borderRadius: "50%",
          background: i < count ? dotColor : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${i < count ? dotColor : "rgba(255,255,255,0.1)"}`,
          boxShadow: i < count ? `0 0 8px ${dotColor}99` : "none",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: i < count ? "scale(1)" : "scale(0.85)",
        }} />
      ))}
    </div>
  );
}

// ─── Timeout Pips ──────────────────────────────────────────────────────────
function TimeoutPips({ count, color }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: "50%",
          background: i < count ? color : "rgba(255,255,255,0.06)",
          border: `1px solid ${i < count ? color : "rgba(255,255,255,0.1)"}`,
          boxShadow: i < count ? `0 0 5px ${color}88` : "none",
          transition: "all 0.2s",
        }} />
      ))}
    </div>
  );
}

// ─── Team Score Card ───────────────────────────────────────────────────────
function TeamCard({ team, teamKey, side }) {
  const color = team.color;
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const saveName = () => { send("teamName", teamKey, nameInput.toUpperCase()); setEditing(false); };

  const isBonus = team.teamFouls >= 5;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0e1a 0%, #0a0a14 100%)",
      border: `1px solid ${color}22`,
      borderRadius: 20,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Color accent bar top ── */}
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

      {/* ── Team name ── */}
      <div style={{ padding: "18px 22px 0", display: "flex", alignItems: "center", gap: 10 }}>
        {editing ? (
          <input autoFocus value={nameInput} maxLength={8}
            onChange={(e) => setNameInput(e.target.value.toUpperCase())}
            onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${color}`, outline: "none", color, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, letterSpacing: "0.2em", width: 160 }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{ color, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, letterSpacing: "0.2em", cursor: "pointer", fontWeight: 900 }}>
            {team.name}
          </span>
        )}
        <button onClick={() => setEditing(true)} style={{ color, opacity: 0.3, fontSize: 14, background: "none", border: "none", cursor: "pointer", padding: 0 }}>✏️</button>

        {isBonus && (
          <div style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, background: "rgba(255,64,64,0.15)", border: "1px solid rgba(255,64,64,0.4)", color: "#FF4040", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 12, letterSpacing: "0.15em", animation: "pulse 1.2s ease-in-out infinite" }}>
            ● BONUS
          </div>
        )}
      </div>

      {/* ── Big Score ── */}
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 140, lineHeight: 0.9, color, fontWeight: 900, textShadow: `0 0 80px ${color}44, 0 0 120px ${color}22` }}>
          {team.score}
        </div>
      </div>

      {/* ── Score buttons ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, padding: "0 16px 16px" }}>
        {["+1", "+2", "+3"].map((label, i) => (
          <button key={label} onClick={() => send("score", teamKey, i + 1)} style={{
            background: `${color}14`, border: `1px solid ${color}33`, color,
            fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26,
            padding: "14px 0", borderRadius: 12, cursor: "pointer",
            transition: "all 0.12s", fontWeight: 900,
          }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.92)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
            {label}
          </button>
        ))}
        <button onClick={() => send("score", teamKey, -1)} style={{
          background: "rgba(255,60,60,0.12)", border: "1px solid rgba(255,60,60,0.3)", color: "#FF6060",
          fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26,
          padding: "14px 0", borderRadius: 12, cursor: "pointer", transition: "all 0.12s", fontWeight: 900,
        }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.92)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
          -1
        </button>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 16px" }} />

      {/* ── Stats area ── */}
      <div style={{ padding: "14px 16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Personal Fouls — number only, clean */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 11, letterSpacing: "0.4em" }}>PERSONAL FOULS</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={() => send("foul", teamKey, 1)} disabled={team.fouls >= 6} style={{
                background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.25)", color: "#FF7070",
                fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "6px 14px", borderRadius: 8, cursor: "pointer", opacity: team.fouls >= 6 ? 0.3 : 1,
              }}>+ FOUL</button>
              <button onClick={() => send("foul", teamKey, -1)} disabled={team.fouls <= 0} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)",
                fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "6px 12px", borderRadius: 8, cursor: "pointer", opacity: team.fouls <= 0 ? 0.3 : 1,
              }}>UNDO</button>
            </div>
          </div>
          {/* Large foul number */}
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 56, color: team.fouls >= 5 ? "#FF4040" : "rgba(255,255,255,0.9)", lineHeight: 1, textShadow: team.fouls >= 5 ? "0 0 20px #FF404066" : "none", fontWeight: 900 }}>
            {team.fouls}
          </div>
        </div>

        {/* Team Fouls — 5 dots */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 11, letterSpacing: "0.4em" }}>
              TEAM FOULS <span style={{ opacity: 0.5 }}>/ QTR</span>
            </div>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: isBonus ? "#FF4040" : "rgba(255,255,255,0.7)", fontWeight: 900 }}>
              {team.teamFouls}
            </div>
          </div>
          <FoulDots count={Math.min(team.teamFouls, 5)} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={() => send("teamFoul", teamKey, 1)} style={{
              flex: 1, background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)", color: "#FF8888",
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "7px 0", borderRadius: 8, cursor: "pointer",
            }}>+ TEAM FOUL</button>
            <button onClick={() => send("teamFoul", teamKey, -1)} disabled={team.teamFouls <= 0} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)",
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "7px 12px", borderRadius: 8, cursor: "pointer", opacity: team.teamFouls <= 0 ? 0.3 : 1,
            }}>-1</button>
            <button onClick={() => send("teamFoulReset", teamKey)} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)",
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
            }}>CLR</button>
          </div>
        </div>

        {/* Timeouts — pips */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 11, letterSpacing: "0.4em" }}>TIMEOUTS</div>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: "rgba(255,255,255,0.7)", fontWeight: 900 }}>{team.timeouts}</div>
          </div>
          <TimeoutPips count={team.timeouts} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={() => send("timeout", teamKey, -1)} disabled={team.timeouts <= 0} style={{
              flex: 1, background: `${color}12`, border: `1px solid ${color}30`, color,
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "7px 0", borderRadius: 8, cursor: "pointer", opacity: team.timeouts <= 0 ? 0.3 : 1,
            }}>USE T.O.</button>
            <button onClick={() => send("timeout", teamKey, 1)} disabled={team.timeouts >= 7} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)",
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, padding: "7px 16px", borderRadius: 8, cursor: "pointer", opacity: team.timeouts >= 7 ? 0.3 : 1,
            }}>+1</button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Center Column ─────────────────────────────────────────────────────────
function CenterCol({ state }) {
  const { clockTenths, isRunning, quarter, shotClockTenths, shotRunning, possession, jumpBall } = state;

  const shotSec = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5;
  const shotWarn = shotSec <= 10;
  const shotColor = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "#00E87A";
  const clockDecimal = clockTenths <= 600;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;

  const presets = [
    { label: "12:00", t: 7200 }, { label: "10:00", t: 6000 },
    { label: "05:00", t: 3000 }, { label: "02:00", t: 1200 },
    { label: "01:00", t: 600 },  { label: "00:30", t: 300 },
  ];

  const btnBase = {
    fontFamily: "'Bebas Neue', Impact, sans-serif",
    border: "none", cursor: "pointer", borderRadius: 10, transition: "all 0.12s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ═══ SHOT CLOCK ═══ */}
      <div style={{
        background: shotUrgent ? "linear-gradient(160deg,#1a0505,#0e0e1a)" : "linear-gradient(160deg,#0e0e1a,#0a0a14)",
        border: `2px solid ${shotUrgent ? "rgba(255,51,51,0.55)" : shotWarn ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20, padding: "20px 20px 16px",
        boxShadow: shotUrgent ? "0 0 50px rgba(255,40,40,0.2), inset 0 0 30px rgba(255,40,40,0.06)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 12, letterSpacing: "0.5em", textAlign: "center", marginBottom: 4 }}>SHOT CLOCK</div>

        {/* Number */}
        <div style={{ textAlign: "center", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 148, lineHeight: 0.88, color: shotColor, fontWeight: 900,
          textShadow: shotUrgent ? "0 0 60px rgba(255,40,40,0.9), 0 0 120px rgba(255,40,40,0.4)" : shotWarn ? "0 0 40px rgba(255,165,0,0.6)" : `0 0 40px ${shotColor}55`,
          animation: shotUrgent && shotRunning ? "urgentPulse 0.45s ease-in-out infinite" : "none", transition: "color 0.2s, text-shadow 0.2s" }}>
          {formatShotClock(shotClockTenths)}
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", margin: "10px 0" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (shotClockTenths / 240) * 100)}%`, background: shotColor, boxShadow: `0 0 10px ${shotColor}`, borderRadius: 2, transition: "width 0.15s linear, background 0.3s" }} />
        </div>

        {/* START/STOP */}
        <button onClick={() => send("shotClockToggle")} style={{
          ...btnBase, width: "100%", padding: "14px 0", fontSize: 20, letterSpacing: "0.15em",
          background: shotRunning ? "rgba(255,60,60,0.14)" : "rgba(0,232,122,0.1)",
          border: shotRunning ? "1.5px solid rgba(255,60,60,0.45)" : "1.5px solid rgba(0,232,122,0.35)",
          color: shotRunning ? "#FF5555" : "#00E87A", marginBottom: 8,
        }}>
          {shotRunning ? "⏹  STOP" : "▶  START"}
        </button>

        {/* 24 / 14 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[{ s: 24, label: "24", color: "#FFD700", border: "rgba(255,215,0,0.4)", bg: "rgba(255,215,0,0.1)" },
            { s: 14, label: "14", color: "#FFA500", border: "rgba(255,165,0,0.4)", bg: "rgba(255,165,0,0.1)" }].map(p => (
            <button key={p.s} onClick={() => send("shotClockSet", null, p.s)} style={{
              ...btnBase, padding: "16px 0", fontSize: 42, color: p.color,
              background: p.bg, border: `1.5px solid ${p.border}`,
              boxShadow: `0 0 20px ${p.color}18`,
            }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, textAlign: "center", marginTop: 8, letterSpacing: "0.1em" }}>
          24 / 14 → RESET + นับทันที
        </div>
      </div>

      {/* ═══ POSSESSION ═══ */}
      <div style={{ background: "linear-gradient(160deg,#0e0e1a,#0a0a14)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 16 }}>
        <div style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 11, letterSpacing: "0.5em", textAlign: "center", marginBottom: 12 }}>POSSESSION / JUMP BALL</div>

        {/* Arrow visual */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 8px" }}>
          {[
            { key: "teamA", label: "HOME", color: "#FF6B35", symbol: "◀" },
            { key: null, label: jumpBall ? "JUMP" : "—", color: "#FFD700", symbol: "⊕", isJump: true },
            { key: "teamB", label: "AWAY", color: "#00D4FF", symbol: "▶" },
          ].map((item, idx) => {
            const active = item.isJump ? jumpBall : possession === item.key;
            return (
              <div key={idx} style={{ textAlign: "center", transition: "all 0.2s" }}>
                <div style={{ fontSize: item.isJump ? 28 : 26, color: item.color, opacity: active ? 1 : 0.18, transform: active ? "scale(1.25)" : "scale(1)", filter: active ? `drop-shadow(0 0 10px ${item.color})` : "none", transition: "all 0.25s", animation: active && item.isJump ? "pulse 0.8s infinite" : "none" }}>
                  {item.symbol}
                </div>
                <div style={{ color: active ? item.color : "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "'Bebas Neue', Impact, sans-serif", marginTop: 3 }}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
          {[
            { label: "◀ HOME", action: () => send("possession", null, possession === "teamA" ? null : "teamA"), active: possession === "teamA", color: "#FF6B35" },
            { label: "JUMP ⊕", action: () => send("jumpBall"), active: jumpBall, color: "#FFD700" },
            { label: "AWAY ▶", action: () => send("possession", null, possession === "teamB" ? null : "teamB"), active: possession === "teamB", color: "#00D4FF" },
          ].map((b, i) => (
            <button key={i} onClick={b.action} style={{
              ...btnBase, padding: "10px 0", fontSize: 12, letterSpacing: "0.08em",
              background: b.active ? `${b.color}18` : "rgba(255,255,255,0.04)",
              border: b.active ? `1.5px solid ${b.color}55` : "1px solid rgba(255,255,255,0.08)",
              color: b.active ? b.color : "rgba(255,255,255,0.35)",
              boxShadow: b.active ? `0 0 16px ${b.color}22` : "none",
            }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ GAME CLOCK ═══ */}
      <div style={{ background: "linear-gradient(160deg,#0e0e1a,#0a0a14)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: 20, padding: 16 }}>
        <div style={{ color: "rgba(255,215,0,0.6)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 11, letterSpacing: "0.5em", textAlign: "center", marginBottom: 8 }}>GAME CLOCK</div>

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: clockDecimal ? 68 : 58, lineHeight: 1, fontWeight: 900, color: isRunning ? "#FFD700" : "rgba(255,255,255,0.92)", textShadow: isRunning ? "0 0 40px rgba(255,215,0,0.7), 0 0 80px rgba(255,215,0,0.3)" : "none", transition: "all 0.2s" }}>
            {formatGameClock(clockTenths)}
          </div>
          <div style={{ color: isRunning ? "rgba(255,215,0,0.7)" : "rgba(255,255,255,0.2)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, letterSpacing: "0.4em", marginTop: 2 }}>
            {qLabel} {isRunning ? "▶ LIVE" : "■ PAUSED"}
          </div>
        </div>

        {/* START/STOP + RESET */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <button onClick={() => send("clockToggle")} style={{
            ...btnBase, padding: "13px 0", fontSize: 18, letterSpacing: "0.1em",
            background: isRunning ? "rgba(255,60,60,0.14)" : "rgba(0,232,122,0.1)",
            border: isRunning ? "1.5px solid rgba(255,60,60,0.45)" : "1.5px solid rgba(0,232,122,0.35)",
            color: isRunning ? "#FF5555" : "#00E87A",
          }}>
            {isRunning ? "⏹ STOP" : "▶ START"}
          </button>
          <button onClick={() => send("clockReset", null, clockTenths)} style={{
            ...btnBase, padding: "13px 0", fontSize: 18, letterSpacing: "0.1em",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)",
          }}>
            ↺ RESET
          </button>
        </div>

        {/* +/- 1s */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <button onClick={() => send("clockAdjust", null, 10)} style={{ ...btnBase, padding: "8px 0", fontSize: 15, background: "rgba(0,232,122,0.07)", border: "1px solid rgba(0,232,122,0.18)", color: "rgba(0,232,122,0.7)" }}>+1s</button>
          <button onClick={() => send("clockAdjust", null, -10)} style={{ ...btnBase, padding: "8px 0", fontSize: 15, background: "rgba(255,60,60,0.07)", border: "1px solid rgba(255,60,60,0.18)", color: "rgba(255,100,100,0.7)" }}>-1s</button>
        </div>

        {/* Presets */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => send("clockSet", null, p.t)} style={{
              ...btnBase, padding: "8px 0", fontSize: 13, letterSpacing: "0.05em",
              background: clockTenths === p.t ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.03)",
              border: clockTenths === p.t ? "1px solid rgba(255,215,0,0.35)" : "1px solid rgba(255,255,255,0.07)",
              color: clockTenths === p.t ? "#FFD700" : "rgba(255,255,255,0.3)",
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Quarter */}
        <div style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 11, letterSpacing: "0.4em", marginBottom: 6 }}>PERIOD</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map(q => (
            <button key={q} onClick={() => send("quarter", null, q)} style={{
              ...btnBase, flex: 1, padding: "10px 0", fontSize: 15,
              background: quarter === q ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              border: quarter === q ? "1px solid rgba(255,215,0,0.45)" : "1px solid rgba(255,255,255,0.07)",
              color: quarter === q ? "#FFD700" : "rgba(255,255,255,0.3)",
              boxShadow: quarter === q ? "0 0 14px rgba(255,215,0,0.18)" : "none",
            }}>
              {q > 4 ? "OT" : `Q${q}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Overlay Preview ───────────────────────────────────────────────────────
function OverlayPreview({ state }) {
  const { teamA, teamB, quarter, clockTenths, isRunning, shotClockTenths, possession, jumpBall } = state;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;
  const shotSec = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5;
  const shotWarn = shotSec <= 10;
  const shotColor = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "rgba(255,255,255,0.45)";

  const TeamSide = ({ team, teamKey, flip }) => {
    const isBonus = team.teamFouls >= 5;
    const dotColor = team.teamFouls >= 5 ? "#FF4040" : team.color;
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, flexDirection: flip ? "row-reverse" : "row", padding: flip ? "0 20px 0 8px" : "0 8px 0 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${flip ? "270deg" : "90deg"}, ${team.color}15, transparent 65%)` }} />
        <div style={{ width: 2, height: 60, borderRadius: 1, background: team.color, flexShrink: 0, position: "relative" }} />
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{ color: team.color, fontSize: 9, letterSpacing: "0.4em", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
            {possession === teamKey ? (flip ? "BALL ▶" : "◀ BALL") : isBonus ? "● BONUS" : ""}
          </div>
          <div style={{ color: "white", fontSize: 23, letterSpacing: "0.14em", lineHeight: 1.1, fontFamily: "'Bebas Neue', Impact, sans-serif" }}>{team.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexDirection: flip ? "row-reverse" : "row" }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: "'Bebas Neue', Impact, sans-serif" }}>PF {team.fouls}  TO {team.timeouts}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < Math.min(team.teamFouls, 5) ? dotColor : "rgba(255,255,255,0.07)" }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ color: team.color, fontSize: 58, lineHeight: 1, fontWeight: 900, fontFamily: "'Bebas Neue', Impact, sans-serif", position: "relative" }}>{team.score}</div>
      </div>
    );
  };

  return (
    <div style={{ height: 96, borderRadius: 12, overflow: "hidden", background: "#060610", border: "1px solid rgba(255,255,255,0.07)", display: "flex", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
      <TeamSide team={teamA} teamKey="teamA" flip={false} />

      {/* Center */}
      <div style={{ width: 158, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, background: "rgba(0,0,0,0.55)", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: "0.5em" }}>{qLabel}</div>
        <div style={{ color: isRunning ? "#FFD700" : "white", fontSize: 30, letterSpacing: "0.04em", lineHeight: 1 }}>{formatGameClock(clockTenths)}</div>
        <div style={{ color: shotColor, fontSize: 22, fontWeight: 900, textShadow: shotUrgent ? "0 0 12px #FF3333" : "none" }}>⏱ {formatShotClock(shotClockTenths)}</div>
        {jumpBall && <div style={{ color: "#FFD700", fontSize: 9, letterSpacing: "0.15em", animation: "pulse 0.8s infinite" }}>⊕ JUMP BALL</div>}
      </div>

      <TeamSide team={teamB} teamKey="teamB" flip={true} />
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#00D4FF" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("stateUpdate", (s) => {

      const n = {
        ...s,
        shotClockTenths: s.shotClockTenths ?? (s.shotClock != null ? s.shotClock * 10 : 240),
        clockTenths:     s.clockTenths     ?? (s.clockSeconds != null ? s.clockSeconds * 10 : 6000),
        possession: s.possession ?? null,
        jumpBall:   s.jumpBall ?? false,
        teamA: { teamFouls: 0, ...s.teamA },
        teamB: { teamFouls: 0, ...s.teamB },
      };
      setState(n);
    });
    return () => { socket.off("stateUpdate"); socket.off("connect"); socket.off("disconnect"); };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 30% 0%, #12101f 0%, #080810 60%)", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes urgentPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.97)} }
        button:active { transform: scale(0.93) !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 34, letterSpacing: "0.25em", background: "linear-gradient(90deg, #FF6B35, #FFD700 45%, #00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
            BASKETBALL SCOREBOARD
          </div>
          <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, letterSpacing: "0.45em", marginTop: 2, fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
            LIVE BROADCAST CONTROL • OBS READY
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 100, background: connected ? "rgba(0,232,122,0.07)" : "rgba(255,60,60,0.07)", border: `1px solid ${connected ? "rgba(0,232,122,0.25)" : "rgba(255,60,60,0.25)"}`, color: connected ? "#00E87A" : "#FF5555", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 13, letterSpacing: "0.18em" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#00E87A" : "#FF5555", animation: connected ? "pulse 1.5s infinite" : "none" }} />
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </div>
          {state.isRunning && (
            <div style={{ padding: "7px 14px", borderRadius: 100, background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.35)", color: "#FF5555", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 13, letterSpacing: "0.18em", animation: "pulse 1s infinite" }}>● LIVE</div>
          )}
          <button onClick={() => send("resetGame")} style={{ padding: "7px 18px", borderRadius: 100, background: "rgba(255,60,60,0.07)", border: "1px solid rgba(255,60,60,0.22)", color: "#FF7070", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 13, letterSpacing: "0.15em", cursor: "pointer" }}>
            ↺ RESET GAME
          </button>
        </div>
      </div>

      {/* Overlay Preview */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: "rgba(255,255,255,0.17)", fontSize: 10, letterSpacing: "0.4em", fontFamily: "'Bebas Neue', Impact, sans-serif", marginBottom: 6 }}>▼ OBS OVERLAY PREVIEW</div>
        <OverlayPreview state={state} />
        <div style={{ color: "rgba(255,255,255,0.1)", fontSize: 10, textAlign: "center", marginTop: 5, letterSpacing: "0.15em" }}>
          OBS Browser Source → http://localhost:3001/overlay &nbsp;|&nbsp; 1920 × 100px
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", marginBottom: 14 }} />

      {/* 3-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px 1fr", gap: 14 }}>
        <TeamCard team={state.teamA} teamKey="teamA" />
        <CenterCol state={state} />
        <TeamCard team={state.teamB} teamKey="teamB" />
      </div>
    </div>
  );
}