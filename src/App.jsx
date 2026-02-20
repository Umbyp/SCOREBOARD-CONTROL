import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

// ─── Sounds (Preloaded) ──────────────────────────────────────────────────────
const hornAudio = typeof Audio !== "undefined" ? new Audio("https://actions.google.com/sounds/v1/alarms/air_horn.ogg") : null;
const buzzerAudio = typeof Audio !== "undefined" ? new Audio("https://actions.google.com/sounds/v1/alarms/buzzer_alarm.ogg") : null;

if (hornAudio) hornAudio.preload = "auto";
if (buzzerAudio) buzzerAudio.preload = "auto";

const playHorn = () => {
  if (!hornAudio) return;
  hornAudio.currentTime = 0;
  hornAudio.volume = 0.8;
  hornAudio.play().catch(e => console.log("คลิกที่หน้าจอ 1 ครั้งก่อนเพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง", e));
};

const playBuzzer = () => {
  if (!buzzerAudio) return;
  buzzerAudio.currentTime = 0;
  buzzerAudio.volume = 1.0;
  buzzerAudio.play().catch(e => console.log("คลิกที่หน้าจอ 1 ครั้งก่อนเพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง", e));
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

// ─── Components ──────────────────────────────────────────────────────────────
function BonusBadge({ teamFouls }) {
  if (teamFouls >= 10) return (
    <div style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,40,40,0.2)", border: "1px solid rgba(255,40,40,0.5)", color: "#FF3333", fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 11, letterSpacing: "0.12em", animation: "pulse 0.8s ease-in-out infinite" }}>
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
  
  // 🏀 ปรับไม่ให้มีการเตือนหรือเปลี่ยนสีเมื่อ Shot Clock เป็น 0
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
        // 🏀 เอาสีแดงและการกระพริบตอนหมดเวลาออก
        background: shotUrgent ? "linear-gradient(160deg,#1c0505,#0a0a14)" : "rgba(0,0,0,0.35)",
        border: `2px solid ${shotUrgent ? "rgba(255,40,40,0.55)" : shotWarn ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20, padding: "16px 16px 12px",
        boxShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.2)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ ...S({ fontSize: 11, letterSpacing: "0.5em" }), color: "rgba(255,255,255,0.35)", textAlign: "center", marginBottom: 2 }}>SHOT CLOCK</div>
        <div style={{ textAlign: "center", ...S({ fontSize: 140, fontWeight: 900, lineHeight: 0.85 }), color: shotColor,
          textShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.9)" : shotWarn ? "0 0 30px rgba(255,165,0,0.5)" : `0 0 30px ${shotColor}44`,
          animation: shotUrgent && shotRunning ? "urgentPulse 0.45s ease-in-out infinite" : "none" }}>
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
        animation: gameTimeUp ? "flashRed 0.5s infinite" : "none",
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
function OverlayPreview({ state }) {
  const { teamA, teamB, quarter, clockTenths, isRunning, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;
  const shotSec = shotClockTenths / 10;
  
  // 🏀 ปรับการแสดงผลใน Overlay ให้เหมือนกัน: ไม่มีสีแดง/กระพริบตอน 0
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn = shotSec <= 10 && shotClockTenths > 0;
  const shotCol = shotUrgent ? "#FF3333" : shotWarn ? "#FF9900" : "#FFFFFF";
  
  const gameTimeUp = clockTenths === 0;
  const F = "'Bebas Neue',Impact,sans-serif";

  const bonusInfo = (tf) => tf >= 10 ? { text: "DBL BONUS", color: "#FF3333" } : tf >= 5 ? { text: "BONUS", color: "#FFB300" } : null;

  const TeamBlock = ({ team, tKey, flip }) => {
    const bonus = bonusInfo(team.teamFouls);
    const isPoss = possession === tKey;
    const dotColor = team.teamFouls >= 10 ? "#FF3333" : team.teamFouls >= 5 ? "#FFB300" : team.color;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: `linear-gradient(${flip?"270deg":"90deg"}, ${team.color}22 0%, #07070f 55%)`, overflow: "hidden" }}>
        <div style={{ height: 4, background: team.color, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", flexDirection: flip ? "row-reverse" : "row", padding: "6px 16px", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: flip ? "row-reverse" : "row", marginBottom: 2 }}>
              {isPoss && <div style={{ fontFamily: F, fontSize: 11, color: team.color, letterSpacing: "0.1em", background: `${team.color}22`, padding: "1px 6px", borderRadius: 3, border: `1px solid ${team.color}55` }}>{flip ? "BALL ▶" : "◀ BALL"}</div>}
              {bonus && <div style={{ fontFamily: F, fontSize: 11, color: bonus.color, letterSpacing: "0.12em", background: `${bonus.color}18`, padding: "1px 6px", borderRadius: 3, border: `1px solid ${bonus.color}44`, animation: team.teamFouls >= 10 ? "pulse 1s infinite" : "none" }}>{team.teamFouls >= 10 ? "●●" : "●"} {bonus.text}</div>}
            </div>
            <div style={{ fontFamily: F, fontSize: 28, letterSpacing: "0.15em", lineHeight: 1, color: "white", fontWeight: 900, textAlign: flip ? "right" : "left" }}>{team.name}</div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexDirection: flip ? "row-reverse" : "row" }}>
              <div style={{ display: "flex", gap: 3 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < Math.min(team.teamFouls, 5) ? dotColor : "rgba(255,255,255,0.1)", border: `1px solid ${i < Math.min(team.teamFouls, 5) ? dotColor : "rgba(255,255,255,0.15)"}`, boxShadow: i < Math.min(team.teamFouls, 5) ? `0 0 4px ${dotColor}88` : "none" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: i < team.timeouts ? team.color : "rgba(255,255,255,0.08)" }} />
                ))}
              </div>
            </div>

          </div>
          <div style={{ fontFamily: F, fontSize: 72, fontWeight: 900, lineHeight: 1, color: team.color, textShadow: `0 0 40px ${team.color}55`, letterSpacing: "-0.02em" }}>{team.score}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", background: "#07070f", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 40px rgba(0,0,0,0.6)" }}>
      
      <div style={{ display: "flex", height: 110 }}>
        <TeamBlock team={teamA} tKey="teamA" flip={false} />
        <div style={{ width: 180, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, background: gameTimeUp ? "rgba(200,0,0,0.5)" : "rgba(0,0,0,0.7)", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)", transition: "background 0.3s" }}>
          <div style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.5em", color: gameTimeUp ? "#FFF" : "rgba(255,215,0,0.7)" }}>{qLabel}</div>
          <div style={{ fontFamily: F, fontSize: 38, letterSpacing: "0.04em", lineHeight: 1, color: gameTimeUp ? "#FF0000" : isRunning ? "#FFD700" : "rgba(255,255,255,0.88)", textShadow: gameTimeUp ? "0 0 20px #FF0000" : isRunning ? "0 0 25px rgba(255,215,0,0.7)" : "none" }}>
            {formatGameClock(clockTenths)}
          </div>
          <div style={{ width: 80, height: 1, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>SHOT</div>
            <div style={{ fontFamily: F, fontSize: 30, fontWeight: 900, lineHeight: 1, color: shotCol, textShadow: shotUrgent ? `0 0 18px ${shotCol}` : "none", animation: shotUrgent && shotRunning ? "urgentPulse 0.45s ease-in-out infinite" : "none" }}>
              {formatShotClock(shotClockTenths)}
            </div>
          </div>
          {jumpBall && <div style={{ fontFamily: F, fontSize: 9, color: "#FFD700", letterSpacing: "0.2em", animation: "pulse 0.8s infinite", marginTop: 1 }}>⊕ JUMP BALL</div>}
        </div>
        <TeamBlock team={teamB} tKey="teamB" flip={true} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 16px", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", display: "flex", gap: 14 }}>
          <span><span style={{ color: teamA.color }}>■ </span>FOULS: <span style={{ color: "white" }}>{teamA.teamFouls}</span></span>
          <span>TIMEOUTS: <span style={{ color: "white" }}>{teamA.timeouts}</span></span>
        </div>
        <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: "0.3em" }}>LIVE SCOREBOARD</div>
        <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", display: "flex", gap: 14, flexDirection: "row-reverse" }}>
          <span><span style={{ color: teamB.color }}> ■</span> FOULS: <span style={{ color: "white" }}>{teamB.teamFouls}</span></span>
          <span>TIMEOUTS: <span style={{ color: "white" }}>{teamB.timeouts}</span></span>
        </div>
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

  // Keyboard Shortcuts (อัปเดตใหม่ แก้ปัญหาลืมเปลี่ยนภาษา)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ยกเว้นตอนกำลังพิมพ์ชื่อทีม
      if (e.target.tagName === "INPUT") return;
      
      // ใช้ e.code แทน e.key เพื่อให้กดติดแม้แป้นพิมพ์จะเป็นภาษาไทย
      switch(e.code) {
        case "Space": // Spacebar = Start/Stop Game Clock
          e.preventDefault(); 
          send("clockToggle");
          break;
        case "KeyC": // C (หรือ แ) = Start/Stop Shot Clock
          e.preventDefault();
          send("shotClockToggle");
          break;
        case "KeyZ": // Z (หรือ ผ) = Reset 24s
          e.preventDefault();
          send("shotClockSet", null, 24);
          break;
        case "KeyX": // X (หรือ ป) = Reset 14s
          e.preventDefault();
          send("shotClockSet", null, 14);
          break;
        case "KeyH": // H (หรือ ห) = Manual Horn
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

  const enableAudioContext = () => {
    if (hornAudio && hornAudio.volume === 0) hornAudio.volume = 0.8;
  };

  return (
    <div onClick={enableAudioContext} style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 25% 0%,#13101e,#080810 55%)", padding: 14, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes urgentPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.96)} }
        @keyframes flashRed { 0%,100%{background-color:rgba(255,0,0,0.3);} 50%{background-color:rgba(255,0,0,0.6);} }
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
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#00E87A" : "#FF5555", animation: connected ? "pulse 1.5s infinite" : "none" }} />
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </div>
          {state.isRunning && (
            <div style={{ padding: "6px 14px", borderRadius: 100, background: "rgba(255,55,55,0.1)", border: "1px solid rgba(255,55,55,0.35)", fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 12, letterSpacing: "0.18em", color: "#FF5555", animation: "pulse 1s infinite" }}>● LIVE</div>
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
          OBS Browser Source → http://localhost:3001/overlay | 1920 × 100px
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