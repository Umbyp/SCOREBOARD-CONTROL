import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// ✅ FIX 1: ใช้ env variable แทน hardcode URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

// ✅ FIX 2: เพิ่ม reconnection options รองรับ Render free tier ที่ sleep
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

// ─── Sounds ──────────────────────────────────────────────────────────────────
const hornAudio   = typeof Audio !== "undefined" ? new Audio("https://actions.google.com/sounds/v1/alarms/air_horn.ogg") : null;
const buzzerAudio = typeof Audio !== "undefined" ? new Audio("https://actions.google.com/sounds/v1/alarms/buzzer_alarm.ogg") : null;
if (hornAudio)   { hornAudio.preload   = "auto"; hornAudio.volume   = 0.8; }
if (buzzerAudio) { buzzerAudio.preload = "auto"; buzzerAudio.volume = 1.0; }

// ✅ เปิดล็อค AudioContext ของ browser — ต้องเรียกจาก user interaction จริงๆ
let _audioUnlocked = false;
function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  [hornAudio, buzzerAudio].forEach(a => {
    if (!a) return;
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  });
}

const playHorn = () => {
  if (!hornAudio) return;
  unlockAudio();
  hornAudio.currentTime = 0;
  hornAudio.volume = 0.8;
  hornAudio.play().catch(() => {});
};

const playBuzzer = () => {
  if (!buzzerAudio) return;
  unlockAudio();
  buzzerAudio.currentTime = 0;
  buzzerAudio.volume = 1.0;
  buzzerAudio.play().catch(() => {});
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatGameClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 600) {
    const totalSec = Math.floor(t / 10);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const s = Math.floor(t / 10);
  const frac = Math.floor(t % 10);
  return `${String(s).padStart(2, "0")}.${frac}`;
}

function formatShotClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 100) return String(Math.ceil(t / 10));
  const s = Math.floor(t / 10);
  const frac = Math.floor(t % 10);
  return `${s}.${frac}`;
}

function send(type, team, value) {
  socket.emit("action", { type, team, value });
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '').split('');
  if (c.length === 3) c = [c[0],c[0],c[1],c[1],c[2],c[2]];
  const n = parseInt(c.join(''), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
}

// ─── Components ──────────────────────────────────────────────────────────────
function BonusBadge({ teamFouls }) {
  if (teamFouls >= 10) return (
    <div style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,40,40,0.2)", border: "1px solid rgba(255,40,40,0.5)", color: "#FF3333", fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 11, letterSpacing: "0.12em" }}>
      ●● DBL BONUS
    </div>
  );
  if (teamFouls >= 5) return (
    <div style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,140,0,0.18)", border: "1px solid rgba(255,140,0,0.45)", color: "#FFA500", fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 11, letterSpacing: "0.12em" }}>
      ● BONUS
    </div>
  );
  return null;
}

function FoulDots({ count, color }) {
  const dotColor = count >= 10 ? "#FF3333" : count >= 5 ? "#FFA500" : color;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          width: 20, height: 20, borderRadius: "50%",
          background: i < Math.min(count, 5) ? dotColor : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${i < Math.min(count, 5) ? dotColor : "rgba(255,255,255,0.1)"}`,
          boxShadow: i < Math.min(count, 5) ? `0 0 7px ${dotColor}88` : "none",
          transition: "all 0.2s", transform: i < Math.min(count, 5) ? "scale(1)" : "scale(0.82)",
        }} />
      ))}
    </div>
  );
}

function TimeoutPips({ count, color }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} style={{
          width: 11, height: 11, borderRadius: "50%",
          background: i < count ? color : "rgba(255,255,255,0.06)",
          border: `1px solid ${i < count ? color : "rgba(255,255,255,0.1)"}`,
          boxShadow: i < count ? `0 0 5px ${color}77` : "none",
          transition: "all 0.18s",
        }} />
      ))}
    </div>
  );
}

const COLOR_PRESETS = ["#FF6B35","#FF3333","#FF1493","#9B59B6","#3498DB","#00D4FF","#00E87A","#FFD700","#FFFFFF","#FF8C00","#E74C3C","#2ECC71"];

function ColorPicker({ teamKey, currentColor }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: 22, height: 22, borderRadius: "50%", background: currentColor,
        border: "2px solid rgba(255,255,255,0.3)", cursor: "pointer",
        boxShadow: `0 0 8px ${currentColor}88`, flexShrink: 0,
      }} />
      {open && (
        <div style={{ position: "absolute", top: 28, left: 0, zIndex: 100, background: "#0e0e1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: 8, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
          {COLOR_PRESETS.map(c => (
            <button key={c} onClick={() => { send("teamColor", teamKey, c); setOpen(false); }} style={{
              width: 24, height: 24, borderRadius: "50%", background: c,
              border: currentColor === c ? "2px solid white" : "2px solid transparent", cursor: "pointer",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────
function TeamCard({ team, teamKey }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const color = team.color;
  const saveName = () => { send("teamName", teamKey, nameInput.toUpperCase()); setEditing(false); };
  const S = (style) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...style });

  return (
    <div style={{ background: "linear-gradient(160deg,#0d0d1b,#080810)", border: `1px solid ${color}22`, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <ColorPicker teamKey={teamKey} currentColor={color} />
        {editing ? (
          <input autoFocus value={nameInput} maxLength={8}
            onChange={e => setNameInput(e.target.value.toUpperCase())}
            onBlur={saveName} onKeyDown={e => e.key === "Enter" && saveName()}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${color}`, outline: "none", color, ...S({ fontSize: 30, letterSpacing: "0.18em", width: 150 }) }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{ color, cursor: "pointer", ...S({ fontSize: 30, letterSpacing: "0.18em", fontWeight: 900 }) }}>
            {team.name}
          </span>
        )}
        <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color, opacity: 0.3, fontSize: 13 }}>✏️</button>
        <div style={{ marginLeft: "auto" }}><BonusBadge teamFouls={team.teamFouls} /></div>
      </div>
      <div style={{ textAlign: "center", padding: "4px 0 2px" }}>
        <div style={{ ...S({ fontSize: 140, fontWeight: 900, lineHeight: 0.88 }), color, textShadow: `0 0 70px ${color}44` }}>{team.score}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, padding: "0 14px 14px" }}>
        {[1, 2, 3].map(v => (
          <button key={v} onClick={() => send("score", teamKey, v)} className="btn-scale"
            style={{ ...S({ fontSize: 24, fontWeight: 900 }), background: `${color}14`, border: `1px solid ${color}33`, color, padding: "13px 0", borderRadius: 11, cursor: "pointer" }}>
            +{v}
          </button>
        ))}
        <button onClick={() => send("score", teamKey, -1)} className="btn-scale"
          style={{ ...S({ fontSize: 24 }), background: "rgba(255,50,50,0.12)", border: "1px solid rgba(255,50,50,0.3)", color: "#FF5555", padding: "13px 0", borderRadius: 11, cursor: "pointer" }}>
          -1
        </button>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 14px" }} />
      <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "10px 12px", border: `1px solid ${team.teamFouls >= 10 ? "rgba(255,40,40,0.3)" : team.teamFouls >= 5 ? "rgba(255,140,0,0.25)" : "rgba(255,255,255,0.05)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)" }}>TEAM FOULS</div>
            <div style={{ ...S({ fontSize: 30, fontWeight: 900, lineHeight: 1 }), color: team.teamFouls >= 10 ? "#FF3333" : team.teamFouls >= 5 ? "#FFA500" : "rgba(255,255,255,0.7)" }}>{team.teamFouls}</div>
          </div>
          <FoulDots count={team.teamFouls} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
            <button onClick={() => send("teamFoul", teamKey, 1)} style={{ flex: 1, ...S({ fontSize: 13 }), background: "rgba(255,50,50,0.08)", border: "1px solid rgba(255,50,50,0.2)", color: "#FF9090", padding: "7px 0", borderRadius: 8, cursor: "pointer" }}>+ FOUL</button>
            <button onClick={() => send("teamFoul", teamKey, -1)} disabled={team.teamFouls <= 0} style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", opacity: team.teamFouls <= 0 ? 0.25 : 1 }}>-1</button>
            <button onClick={() => send("teamFoulReset", teamKey)} style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>CLR</button>
          </div>
        </div>
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)" }}>TIMEOUTS</div>
            <div style={{ ...S({ fontSize: 30, fontWeight: 900, lineHeight: 1 }), color: "rgba(255,255,255,0.75)" }}>{team.timeouts}</div>
          </div>
          <TimeoutPips count={team.timeouts} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
            <button onClick={() => { send("timeout", teamKey, -1); playHorn(); }} disabled={team.timeouts <= 0} style={{ flex: 1, ...S({ fontSize: 13 }), background: `${color}10`, border: `1px solid ${color}30`, color, padding: "7px 0", borderRadius: 8, cursor: "pointer", opacity: team.timeouts <= 0 ? 0.25 : 1 }}>USE T.O.</button>
            <button onClick={() => send("timeout", teamKey, 1)} disabled={team.timeouts >= 2} style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", padding: "7px 16px", borderRadius: 8, cursor: "pointer", opacity: team.timeouts >= 2 ? 0.25 : 1 }}>+1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Center Column ────────────────────────────────────────────────────────────
function CenterCol({ state }) {
  const { clockTenths, isRunning, quarter, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const shotSec = shotClockTenths / 10;

  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn = shotSec <= 10 && shotClockTenths > 0;
  const shotColor = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "#00E87A";

  const gameTimeUp = clockTenths === 0;
  const clockDecimal = clockTenths <= 600;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;

  const S = (style) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...style });
  const btn = (extra) => ({ ...S({}), border: "none", cursor: "pointer", borderRadius: 10, transition: "all 0.12s", position: "relative", ...extra });
  const Hint = ({ children }) => <span style={{ position: "absolute", right: 6, top: 6, fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 4, letterSpacing: "0.05em" }}>{children}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ══ SHOT CLOCK ══ */}
      <div style={{
        background: shotUrgent ? "linear-gradient(160deg,#1c0505,#0a0a14)" : "rgba(0,0,0,0.35)",
        border: `2px solid ${shotUrgent ? "rgba(255,40,40,0.55)" : shotWarn ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20, padding: "16px 16px 12px",
        boxShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.2)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ ...S({ fontSize: 11, letterSpacing: "0.5em" }), color: "rgba(255,255,255,0.35)", textAlign: "center", marginBottom: 2 }}>SHOT CLOCK</div>
        <div style={{ textAlign: "center", ...S({ fontSize: 140, fontWeight: 900, lineHeight: 0.85 }), color: shotColor,
          textShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.9)" : shotWarn ? "0 0 30px rgba(255,165,0,0.5)" : `0 0 30px ${shotColor}44` }}>
          {formatShotClock(shotClockTenths)}
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", margin: "8px 0" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (shotClockTenths / 240) * 100)}%`, background: shotColor, borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>
        <button className="btn-scale" onClick={() => send("shotClockToggle")} style={{
          ...btn({ width: "100%", padding: "13px 0", fontSize: 19, letterSpacing: "0.15em", marginBottom: 7 }),
          background: shotRunning ? "rgba(255,55,55,0.15)" : "rgba(0,232,122,0.1)",
          border: shotRunning ? "1.5px solid rgba(255,55,55,0.45)" : "1.5px solid rgba(0,232,122,0.35)",
          color: shotRunning ? "#FF5555" : "#00E87A",
        }}>
          {shotRunning ? "⏹ STOP" : "▶ START"}
          <Hint>[ C ]</Hint>
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {[{ s: 24, c: "#FFD700", bg: "rgba(255,215,0,0.1)", bc: "rgba(255,215,0,0.4)", key: "Z" },
            { s: 14, c: "#FFA500", bg: "rgba(255,165,0,0.1)", bc: "rgba(255,165,0,0.4)", key: "X" }].map(p => (
            <button key={p.s} className="btn-scale" onClick={() => send("shotClockSet", null, p.s)} style={{
              ...btn({ padding: "14px 0", fontSize: 38, color: p.c, background: p.bg, border: `1.5px solid ${p.bc}` }),
            }}>
              {p.s}
              <Hint>[ {p.key} ]</Hint>
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <button onClick={() => send("shotClockAdjust", null, 10)} style={{ ...btn({ padding: "6px 0", fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }) }}>+1.0s</button>
          <button onClick={() => send("shotClockAdjust", null, -10)} style={{ ...btn({ padding: "6px 0", fontSize: 13, background: "rgba(255,60,60,0.05)", border: "1px solid rgba(255,60,60,0.15)", color: "rgba(255,100,100,0.55)" }) }}>-1.0s</button>
        </div>
      </div>

      {/* ══ GAME CLOCK ══ */}
      <div style={{
        background: gameTimeUp ? "rgba(255,0,0,0.35)" : "rgba(0,0,0,0.3)",
        border: gameTimeUp ? "2px solid #FF0000" : "1px solid rgba(255,215,0,0.15)",
        borderRadius: 18, padding: "14px 14px",
        boxShadow: gameTimeUp ? "0 0 50px rgba(255,0,0,0.5)" : "none",
        transition: "all 0.3s"
      }}>
        <div style={{ ...S({ fontSize: 10, letterSpacing: "0.5em" }), color: gameTimeUp ? "#FF9999" : "rgba(255,215,0,0.55)", textAlign: "center", marginBottom: 6 }}>GAME CLOCK</div>

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ ...S({ fontSize: clockDecimal ? 66 : 56, fontWeight: 900, lineHeight: 1 }), color: gameTimeUp ? "#FF0000" : isRunning ? "#FFD700" : "rgba(255,255,255,0.88)", textShadow: gameTimeUp ? "0 0 40px #FF0000" : isRunning ? "0 0 35px rgba(255,215,0,0.7)" : "none", transition: "all 0.2s" }}>
            {formatGameClock(clockTenths)}
          </div>
          <div style={{ ...S({ fontSize: 13, letterSpacing: "0.4em" }), color: gameTimeUp ? "#FF6666" : isRunning ? "rgba(255,215,0,0.65)" : "rgba(255,255,255,0.2)", marginTop: 2 }}>
            {qLabel} {gameTimeUp ? "■ END" : isRunning ? "▶ LIVE" : "■ PAUSED"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
          <button className="btn-scale" onClick={() => send("clockToggle")} style={{ ...btn({ padding: "12px 0", fontSize: 17, letterSpacing: "0.08em", background: isRunning ? "rgba(255,55,55,0.15)" : "rgba(0,232,122,0.1)", border: isRunning ? "1.5px solid rgba(255,55,55,0.45)" : "1.5px solid rgba(0,232,122,0.35)", color: isRunning ? "#FF5555" : "#00E87A" }) }}>
            {isRunning ? "⏹ STOP" : "▶ START"}
            <Hint>[ SPACE ]</Hint>
          </button>
          <button className="btn-scale" onClick={() => send("clockReset")} style={{ ...btn({ padding: "12px 0", fontSize: 17, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }) }}>
            ↺ RESET
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 8 }}>
          {[{ l: "+1m", v: 600 }, { l: "+10s", v: 100 }, { l: "+1s", v: 10 }, { l: "+0.1", v: 1 }].map(p => (
            <button key={p.l} onClick={() => send("clockAdjust", null, p.v)} style={{ ...btn({ padding: "6px 0", fontSize: 11, background: "rgba(0,232,122,0.06)", border: "1px solid rgba(0,232,122,0.15)", color: "rgba(0,232,122,0.6)" }) }}>{p.l}</button>
          ))}
          {[{ l: "-1m", v: -600 }, { l: "-10s", v: -100 }, { l: "-1s", v: -10 }, { l: "-0.1", v: -1 }].map(p => (
            <button key={p.l} onClick={() => send("clockAdjust", null, p.v)} style={{ ...btn({ padding: "6px 0", fontSize: 11, background: "rgba(255,55,55,0.06)", border: "1px solid rgba(255,55,55,0.15)", color: "rgba(255,100,100,0.55)" }) }}>{p.l}</button>
          ))}
        </div>

        <div style={{ ...S({ fontSize: 10, letterSpacing: "0.35em" }), color: "rgba(255,255,255,0.22)", marginBottom: 5 }}>PERIOD</div>
        <div style={{ display: "flex", gap: 5 }}>
          {[1, 2, 3, 4, 5].map(q => (
            <button key={q} onClick={() => send("quarter", null, q)} style={{ ...btn({ flex: 1, padding: "9px 0", fontSize: 14, background: quarter === q ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)", border: quarter === q ? "1px solid rgba(255,215,0,0.45)" : "1px solid rgba(255,255,255,0.07)", color: quarter === q ? "#FFD700" : "rgba(255,255,255,0.28)", boxShadow: quarter === q ? "0 0 12px rgba(255,215,0,0.15)" : "none" }) }}>
              {q > 4 ? "OT" : `Q${q}`}
            </button>
          ))}
        </div>
      </div>

      {/* ══ MANUAL HORN ══ */}
      <button className="btn-scale" onClick={playHorn} style={{ ...btn({ width: "100%", padding: "14px 0", fontSize: 22, letterSpacing: "0.15em", background: "rgba(255,165,0,0.15)", border: "2px solid rgba(255,165,0,0.5)", color: "#FFA500", boxShadow: "0 4px 15px rgba(255,165,0,0.2)" }) }}>
        📢 SOUND HORN
        <Hint style={{ top: 9 }}>[ H ]</Hint>
      </button>

      {/* ══ POSSESSION ══ */}
      <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "◀ BALL", action: () => send("possession", null, possession === "teamA" ? null : "teamA"), active: possession === "teamA", color: "#FF6B35" },
            { label: "JUMP ⊕", action: () => send("jumpBall"), active: jumpBall, color: "#FFD700" },
            { label: "BALL ▶", action: () => send("possession", null, possession === "teamB" ? null : "teamB"), active: possession === "teamB", color: "#00D4FF" },
          ].map((b, i) => (
            <button key={i} onClick={b.action} style={{ ...btn({ padding: "9px 0", fontSize: 11, letterSpacing: "0.06em", background: b.active ? `${b.color}18` : "rgba(255,255,255,0.04)", border: b.active ? `1.5px solid ${b.color}55` : "1px solid rgba(255,255,255,0.08)", color: b.active ? b.color : "rgba(255,255,255,0.3)" }) }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Overlay Preview ─────────────────────────────────────────────────────────
// 📍 วางไว้ TOP ของจอ — เหมาะกับ Facebook Live (comment ลอยจากด้านล่าง)
function OverlayPreview({ state }) {
  const { teamA, teamB, quarter, clockTenths, isRunning, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn   = shotSec <= 10 && shotClockTenths > 0;
  
  // สีตัวอักษรเปลี่ยนตามเวลา
  const shotCol    = shotUrgent ? "#FF2222" : shotWarn ? "#FFA500" : "#fff";
  const gameTimeUp = clockTenths === 0;
  
  const O  = "'Oswald', sans-serif";
  const BC = "'Barlow Condensed',sans-serif";
  const getQLabel = (q) => q <= 4 ? `Q${q}` : `OT${q-4}`;

  const TeamSide = ({ team, tKey, flip }) => {
    const isPoss   = possession === tKey;
    const dc       = team.teamFouls >= 5 ? "#FF3333" : team.color;
    const hasBonus = team.teamFouls >= 5;
    const hasDbl   = team.teamFouls >= 7;
    const dir      = flip ? "row-reverse" : "row";
    const flood    = flip
      ? `linear-gradient(270deg, ${hexToRgba(team.color,0.22)} 0%, rgba(0,0,0,0) 45%)`
      : `linear-gradient(90deg, ${hexToRgba(team.color,0.22)} 0%, rgba(0,0,0,0) 45%)`;
    return (
      <div style={{ flex:1, display:"flex", flexDirection:dir, alignItems:"center",
        position:"relative", overflow:"hidden",
        padding: flip?"0 22px 0 14px":"0 14px 0 22px",
        background:"linear-gradient(180deg,#111219 0%,#080910 100%)" }}>
        {/* Color strip top */}
        <div style={{ position:"absolute",top:0,left:0,right:0,height:4,
          background:team.color, zIndex:3 }} />
        {/* Color flood from edge */}
        <div style={{ position:"absolute",inset:0,background:flood,pointerEvents:"none" }} />
        {/* Grid texture */}
        <div style={{ position:"absolute",inset:0,pointerEvents:"none",
          backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize:"36px 36px" }} />
        {/* Score */}
        <div style={{ position:"relative",zIndex:2,fontFamily:O,fontSize:68,fontWeight:700,lineHeight:1,
          color:team.color,minWidth:95,textAlign:"center",flexShrink:0,letterSpacing:"-0.02em",
          textShadow:`0 0 28px ${team.color},0 3px 6px rgba(0,0,0,0.8)` }}>
          {team.score}
        </div>
        {/* Info */}
        <div style={{ position:"relative",zIndex:2,flex:1,padding:"0 12px",
          display:"flex",flexDirection:"column",alignItems:flip?"flex-end":"flex-start" }}>
          <div style={{ display:"flex",alignItems:"center",gap:9,flexDirection:dir }}>
            {isPoss && <span style={{ fontFamily:O,fontSize:18,color:team.color,textShadow:`0 0 12px ${team.color}` }}>{flip?"▶":"◀"}</span>}
            <div style={{ fontFamily:O,fontSize:32,fontWeight:700,color:"#fff",letterSpacing:"0.06em",lineHeight:1,textShadow:"0 2px 6px rgba(0,0,0,0.7)" }}>{team.name}</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:7,marginTop:4,flexDirection:dir }}>
            <span style={{ fontFamily:BC,fontSize:12,fontWeight:800,letterSpacing:"0.1em",color:"rgba(255,255,255,0.4)" }}>FOULS</span>
            <span style={{ fontFamily:BC,fontSize:12,fontWeight:800,color:"#fff" }}>{team.teamFouls}</span>
            <div style={{ display:"flex",gap:4 }}>
              {Array.from({length:5}).map((_,i)=>(
                <div key={i} style={{ width:8,height:8,borderRadius:"50%",
                  background:i<Math.min(team.teamFouls,5)?dc:"rgba(255,255,255,0.1)",
                  boxShadow:i<Math.min(team.teamFouls,5)?`0 0 5px ${dc}`:"none" }} />
              ))}
            </div>
            {hasBonus && <div style={{ fontFamily:BC,fontSize:10,fontWeight:800,letterSpacing:"0.12em",padding:"1px 6px",borderRadius:3,background:hasDbl?"rgba(255,40,40,0.15)":"rgba(255,165,0,0.15)",border:`1px solid ${hasDbl?"rgba(255,40,40,0.5)":"rgba(255,165,0,0.5)"}`,color:hasDbl?"#FF3333":"#FFA500" }}>{hasDbl?"PENALTY":"BONUS"}</div>}
          </div>
          <div style={{ display:"flex",gap:5,marginTop:5,flexDirection:dir }}>
            {Array.from({length:3}).map((_,i)=>(
              <div key={i} style={{ width:22,height:4,borderRadius:2,
                background:i<team.timeouts?team.color:"rgba(255,255,255,0.1)",
                boxShadow:i<team.timeouts?`0 0 7px ${team.color}`:"none" }} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 6px 30px rgba(0,0,0,0.8)" }}>
      <div style={{ display:"flex", height:110, background:"linear-gradient(180deg,#0d0e15 0%,#06070d 100%)" }}>
        <TeamSide team={teamA} tKey="teamA" flip={false} />
        
        {/* Center Column */}
        <div style={{ width:210,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",
          background:"linear-gradient(180deg,#0d0e15 0%,#06070d 100%)",
          borderLeft:"1px solid rgba(255,255,255,0.07)",borderRight:"1px solid rgba(255,255,255,0.07)",
          padding:"10px 0",position:"relative" }}>
          
          {jumpBall && <div style={{ position:"absolute",top:10,right:8,fontFamily:BC,fontSize:10,fontWeight:800,letterSpacing:"0.15em",color:"#FFD700" }}>⊕ JUMP</div>}

          {/* Q1 */}
          <div style={{ fontFamily:O,fontSize:14,fontWeight:700,
            color:"#FFD700",letterSpacing:"0.25em",lineHeight:1 }}>
            {getQLabel(quarter)}
          </div>

          {/* Game Clock */}
          <div style={{ fontFamily:O,fontSize:48,fontWeight:700,lineHeight:1,
            color:gameTimeUp?"#FF2222":"#fff",fontVariantNumeric:"tabular-nums",letterSpacing:"0.01em",
            textShadow:gameTimeUp?"0 0 24px rgba(255,20,20,0.9)":isRunning?"0 0 14px rgba(255,255,255,0.2)":"none" }}>
            {formatGameClock(clockTenths)}
          </div>
          
          {/* Shot Clock Container */}
          <div style={{ display:"flex",alignItems:"center",gap:7,
            marginBottom: 6, 
            background:shotUrgent?"rgba(255,20,20,0.15)":"rgba(0,0,0,0.3)",
            border:"none", 
            borderRadius:7,padding:"2px 12px 2px" }}>
            <span style={{ fontFamily:BC,fontSize:11,fontWeight:800,letterSpacing:"0.2em",color:"rgba(255,255,255,0.3)" }}>SHOT</span>
            <span style={{ fontFamily:O,fontSize:26,fontWeight:700,lineHeight:1,color:shotCol,
              fontVariantNumeric:"tabular-nums" }}>
              {formatShotClock(shotClockTenths)}
            </span>
          </div>
        </div>
        
        <TeamSide team={teamB} tKey="teamB" flip={true} />
      </div>
    </div>
  );
}
// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#00D4FF" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });
  const [connected, setConnected] = useState(false);

  const prevGameClock = useRef(state.clockTenths);
  const prevShotClock = useRef(state.shotClockTenths);

  useEffect(() => {
    if (prevGameClock.current > 0 && state.clockTenths === 0) {
      playBuzzer();
    }
    if (prevShotClock.current > 0 && state.shotClockTenths === 0) {
      playHorn();
    }
    prevGameClock.current = state.clockTenths;
    prevShotClock.current = state.shotClockTenths;
  }, [state.clockTenths, state.shotClockTenths]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT") return;
      switch(e.code) {
        case "Space":
          e.preventDefault();
          send("clockToggle");
          break;
        case "KeyC":
          e.preventDefault();
          send("shotClockToggle");
          break;
        case "KeyZ":
          e.preventDefault();
          send("shotClockSet", null, 24);
          break;
        case "KeyX":
          e.preventDefault();
          send("shotClockSet", null, 14);
          break;
        case "KeyH":
          e.preventDefault();
          playHorn();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("stateUpdate", (s) => {
      if (!s || !s.teamA) return;
      setState({
        ...s,
        teamA: { techFouls: 0, ...s.teamA },
        teamB: { techFouls: 0, ...s.teamB },
      });
    });
    return () => { socket.off("stateUpdate"); socket.off("connect"); socket.off("disconnect"); };
  }, []);

  const enableAudioContext = () => unlockAudio();

  return (
    <div onClick={enableAudioContext} style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 25% 0%,#13101e,#080810 55%)", padding: 14, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        button { font-family:'Bebas Neue',Impact,sans-serif; outline:none; }
        *{box-sizing:border-box;margin:0;padding:0;}
        .btn-scale:active { transform: scale(0.93) !important; }
        .btn-scale:hover { filter: brightness(1.2); }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 32, letterSpacing: "0.25em", background: "linear-gradient(90deg,#FF6B35,#FFD700 40%,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
            BASKETBALL SCOREBOARD
          </div>
          <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: "0.45em", marginTop: 2 }}>
            LIVE BROADCAST CONTROL · OBS READY
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 100, background: connected ? "rgba(0,232,122,0.07)" : "rgba(255,55,55,0.07)", border: `1px solid ${connected ? "rgba(0,232,122,0.25)" : "rgba(255,55,55,0.25)"}`, fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 12, letterSpacing: "0.18em", color: connected ? "#00E87A" : "#FF5555" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#00E87A" : "#FF5555" }} />
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </div>
          {state.isRunning && (
            <div style={{ padding: "6px 14px", borderRadius: 100, background: "rgba(255,55,55,0.1)", border: "1px solid rgba(255,55,55,0.35)", fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 12, letterSpacing: "0.18em", color: "#FF5555" }}>● LIVE</div>
          )}
          <button className="btn-scale" onClick={() => { if (window.confirm("RESET GAME ทั้งหมด?")) send("resetGame"); }}
            style={{ padding: "6px 16px", borderRadius: 100, background: "rgba(255,55,55,0.07)", border: "1px solid rgba(255,55,55,0.22)", color: "#FF7070", fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 12, letterSpacing: "0.15em", cursor: "pointer" }}>
            ↺ RESET ALL
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", color: "rgba(255,255,255,0.17)", fontSize: 10, letterSpacing: "0.4em", marginBottom: 5 }}>▼ OBS OVERLAY PREVIEW</div>
        <OverlayPreview state={state} />
        <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", color: "rgba(255,255,255,0.09)", fontSize: 10, textAlign: "center", marginTop: 4, letterSpacing: "0.12em" }}>
          OBS Browser Source → {SOCKET_URL}/overlay | Width: 1920 · Height: 1080 · ✅ Allow Transparency
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", marginBottom: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 304px 1fr", gap: 12, maxWidth: 1400, margin: "0 auto" }}>
        <TeamCard team={state.teamA} teamKey="teamA" />
        <CenterCol state={state} />
        <TeamCard team={state.teamB} teamKey="teamB" />
      </div>
    </div>
  );
}