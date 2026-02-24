import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import TournamentBridge from "./TournamentBridge";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

// ─── Sounds ──────────────────────────────────────────────────────────────────
const hornAudio   = typeof Audio !== "undefined" ? new Audio("/horn.mp3") : null;
const buzzerAudio = typeof Audio !== "undefined" ? new Audio("/horn.mp3") : null;
if (hornAudio)   { hornAudio.preload   = "auto"; hornAudio.volume   = 0.8; }
if (buzzerAudio) { buzzerAudio.preload = "auto"; buzzerAudio.volume = 1.0; }

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
  hornAudio.currentTime = 0; hornAudio.volume = 0.8;
  hornAudio.play().catch(() => {});
};
const playBuzzer = () => {
  if (!buzzerAudio) return;
  unlockAudio();
  buzzerAudio.currentTime = 0; buzzerAudio.volume = 1.0;
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

function getNameFontSize(name = "") {
  const len = name.length;
  if (len <= 8)  return 30;
  if (len <= 12) return 22;
  if (len <= 16) return 17;
  return 13;
}

// ─── FIX: Timeout per half ────────────────────────────────────────────────────
// ตาม FIBA: 2 timeouts ต่อครึ่ง, 1 timeout ต่อ OT period
function getTimeoutMax(quarter) {
  if (quarter >= 5) return 1;  // OT แต่ละ period = 1 timeout
  return 2;                    // Q1-Q4 (นับ per half) = 2 ต่อครึ่ง
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

// ─── FIX: FoulDots แสดง 10 จุด (2 แถว × 5) ───────────────────────────────────
// เดิมแสดงแค่ 5 จุด ทำให้ไม่เห็น double bonus (foul > 5) บน UI
function FoulDots({ count, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[0, 1].map(row => (
        <div key={row} style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 5 }).map((_, col) => {
            const idx    = row * 5 + col;
            const active = idx < count;
            // จุดที่ 6-10 = double bonus → แดง, จุดที่ 1-5 = bonus → ส้ม/สีทีม
            const dotC   = active && idx >= 5 ? "#FF3333"
                         : active && count >= 5 ? "#FFA500"
                         : color;
            return (
              <div key={col} style={{
                width: 18, height: 18, borderRadius: "50%",
                background:  active ? dotC : "rgba(255,255,255,0.06)",
                border: `1.5px solid ${active ? dotC : "rgba(255,255,255,0.1)"}`,
                boxShadow:   active ? `0 0 7px ${dotC}88` : "none",
                transition: "all 0.2s",
                transform:   active ? "scale(1)" : "scale(0.82)",
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TimeoutPips({ count, max = 2, color }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: max }).map((_, i) => (
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
function TeamCard({ team, teamKey, quarter }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const color      = team.color;
  const timeoutMax = getTimeoutMax(quarter);
  const saveName   = () => { send("teamName", teamKey, nameInput.toUpperCase()); setEditing(false); };
  const S = (style) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...style });
  const nameFontSize = getNameFontSize(team.name);

  return (
    <div style={{ background: "linear-gradient(160deg,#0d0d1b,#080810)", border: `1px solid ${color}22`, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 10, minHeight: 56 }}>
        <ColorPicker teamKey={teamKey} currentColor={color} />
        {editing ? (
          <input autoFocus value={nameInput} maxLength={20}
            onChange={e => setNameInput(e.target.value.toUpperCase())}
            onBlur={saveName} onKeyDown={e => e.key === "Enter" && saveName()}
            style={{
              background: "none", border: "none",
              borderBottom: `2px solid ${color}`, outline: "none", color,
              ...S({ fontSize: getNameFontSize(nameInput), letterSpacing: "0.1em", width: 180 }),
              transition: "font-size 0.15s",
            }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{
            color, cursor: "pointer", flex: 1, wordBreak: "break-word", lineHeight: 1.1,
            ...S({ fontSize: nameFontSize, letterSpacing: nameFontSize < 20 ? "0.05em" : "0.12em", fontWeight: 900 }),
            transition: "font-size 0.15s",
          }}>
            {team.name}
          </span>
        )}
        <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color, opacity: 0.3, fontSize: 13, flexShrink: 0 }}>✏️</button>
        <div style={{ marginLeft: "auto", flexShrink: 0 }}><BonusBadge teamFouls={team.teamFouls} /></div>
      </div>

      <div style={{ textAlign: "center", padding: "4px 0 2px" }}>
        <div style={{ ...S({ fontSize: 140, fontWeight: 900, lineHeight: 0.88 }), color, textShadow: `0 0 70px ${color}44` }}>
          {team.score}
        </div>
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
        {/* Team Fouls */}
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "10px 12px", border: `1px solid ${team.teamFouls >= 10 ? "rgba(255,40,40,0.3)" : team.teamFouls >= 5 ? "rgba(255,140,0,0.25)" : "rgba(255,255,255,0.05)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)" }}>TEAM FOULS</div>
            <div style={{ ...S({ fontSize: 30, fontWeight: 900, lineHeight: 1 }), color: team.teamFouls >= 10 ? "#FF3333" : team.teamFouls >= 5 ? "#FFA500" : "rgba(255,255,255,0.7)" }}>
              {team.teamFouls}
            </div>
          </div>
          {/* FIX: ใช้ FoulDots ที่แสดง 10 จุด แทนของเดิม 5 จุด */}
          <FoulDots count={team.teamFouls} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
            <button onClick={() => send("teamFoul", teamKey, 1)} style={{ flex: 1, ...S({ fontSize: 13 }), background: "rgba(255,50,50,0.08)", border: "1px solid rgba(255,50,50,0.2)", color: "#FF9090", padding: "7px 0", borderRadius: 8, cursor: "pointer" }}>+ FOUL</button>
            <button onClick={() => send("teamFoul", teamKey, -1)} disabled={team.teamFouls <= 0} style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", opacity: team.teamFouls <= 0 ? 0.25 : 1 }}>-1</button>
            <button onClick={() => send("teamFoulReset", teamKey)} style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>CLR</button>
          </div>
        </div>

        {/* Timeouts */}
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)" }}>TIMEOUTS</div>
              {/* FIX: แสดง per-half label */}
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "system-ui", marginTop: 1 }}>
                {quarter <= 2 ? "Q1–Q2 (Half 1)" : quarter <= 4 ? "Q3–Q4 (Half 2)" : `OT${quarter - 4}`}
              </div>
            </div>
            <div style={{ ...S({ fontSize: 30, fontWeight: 900, lineHeight: 1 }), color: "rgba(255,255,255,0.75)" }}>
              {team.timeouts}
            </div>
          </div>
          {/* FIX: pass max ให้ TimeoutPips รู้จำนวนจุดที่ต้องแสดง */}
          <TimeoutPips count={team.timeouts} max={timeoutMax} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
            <button
              onClick={() => { send("timeout", teamKey, -1); playHorn(); }}
              disabled={team.timeouts <= 0}
              style={{ flex: 1, ...S({ fontSize: 13 }), background: `${color}10`, border: `1px solid ${color}30`, color, padding: "7px 0", borderRadius: 8, cursor: "pointer", opacity: team.timeouts <= 0 ? 0.25 : 1 }}
            >
              USE T.O.
            </button>
            {/* FIX: cap disabled ตาม timeoutMax ของ period นั้นๆ */}
            <button
              onClick={() => send("timeout", teamKey, 1)}
              disabled={team.timeouts >= timeoutMax}
              style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", padding: "7px 16px", borderRadius: 8, cursor: "pointer", opacity: team.timeouts >= timeoutMax ? 0.25 : 1 }}
            >
              +1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Center Column ────────────────────────────────────────────────────────────
function CenterCol({ state }) {
  const { clockTenths, isRunning, quarter, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn   = shotSec <= 10 && shotClockTenths > 0;
  const shotColor  = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "#00E87A";
  const gameTimeUp = clockTenths === 0;
  const clockDecimal = clockTenths <= 600;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;

  const S = (style) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...style });
  const btn = (extra) => ({ ...S({}), border: "none", cursor: "pointer", borderRadius: 10, transition: "all 0.12s", position: "relative", overflow: "hidden", ...extra });
  const Hint = ({ children }) => <span style={{ position: "absolute", right: 6, top: 6, fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 4, letterSpacing: "0.05em" }}>{children}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Shot Clock */}
      <div style={{
        background: shotUrgent ? "linear-gradient(160deg,#1c0505,#0a0a14)" : "rgba(0,0,0,0.35)",
        border: `2px solid ${shotUrgent ? "rgba(255,40,40,0.55)" : shotWarn ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20, padding: "16px 16px 12px",
        boxShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.2)" : "none", transition: "all 0.3s",
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

      {/* Game Clock */}
      <div style={{
        background: gameTimeUp ? "rgba(255,0,0,0.35)" : "rgba(0,0,0,0.3)",
        border: gameTimeUp ? "2px solid #FF0000" : "1px solid rgba(255,215,0,0.15)",
        borderRadius: 18, padding: "14px 14px",
        boxShadow: gameTimeUp ? "0 0 50px rgba(255,0,0,0.5)" : "none", transition: "all 0.3s",
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

      {/* Horn */}
      <button className="btn-scale" onClick={playHorn} style={{ ...btn({ width: "100%", padding: "14px 0", fontSize: 22, letterSpacing: "0.15em", background: "rgba(255,165,0,0.15)", border: "2px solid rgba(255,165,0,0.5)", color: "#FFA500", boxShadow: "0 4px 15px rgba(255,165,0,0.2)" }) }}>
        📢 SOUND HORN
        <Hint style={{ top: 9 }}>[ H ]</Hint>
      </button>

      {/* Possession */}
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

// ─── Overlay Preview ──────────────────────────────────────────────────────────
function OverlayPreview({ state }) {
  const { teamA, teamB, quarter, clockTenths, shotClockTenths, possession, jumpBall } = state;
  const shotSec    = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const gameTimeUp = clockTenths === 0;
  const O  = "'Oswald', sans-serif";
  const BC = "'Barlow Condensed',sans-serif";
  const getQLabel = (q) => q <= 4 ? `Q${q}` : `OT${q - 4}`;

  const TeamBox = ({ team, tKey, flip }) => {
    const isPoss = possession === tKey;
    const hasBonus = team.teamFouls >= 5;
    const overlayNameSize = team.name.length <= 8 ? 28 : team.name.length <= 14 ? 20 : 15;
    return (
      <div style={{ display: "flex", flexDirection: flip ? "row-reverse" : "row", alignItems: "stretch", height: "100%" }}>
        <div style={{ width: 6, background: team.color }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 16px", minWidth: 160, alignItems: flip ? "flex-end" : "flex-start", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: flip ? "row-reverse" : "row" }}>
            {isPoss && <span style={{ fontFamily: O, fontSize: 16, color: team.color, textShadow: `0 0 8px ${team.color}` }}>{flip ? "▶" : "◀"}</span>}
            <span style={{ fontFamily: O, fontSize: overlayNameSize, fontWeight: 700, color: "#FFF", letterSpacing: "0.02em", lineHeight: 1.1 }}>{team.name}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 2, flexDirection: flip ? "row-reverse" : "row" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ width: 14, height: 4, borderRadius: 2, background: i < team.timeouts ? "#FFF" : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexDirection: flip ? "row-reverse" : "row" }}>
              <span style={{ fontFamily: BC, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>FOULS</span>
              <span style={{ fontFamily: O, fontSize: 14, fontWeight: 700, color: team.teamFouls >= 5 ? "#FF3333" : "#FFF" }}>{team.teamFouls}</span>
            </div>
            {hasBonus && <div style={{ fontFamily: BC, fontSize: 11, fontWeight: 800, color: "#FFD700", letterSpacing: "0.05em" }}>BONUS</div>}
          </div>
        </div>
        <div style={{ width: 85, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", borderLeft: flip ? "none" : "1px solid rgba(255,255,255,0.05)", borderRight: flip ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
          <span style={{ fontFamily: O, fontSize: 52, fontWeight: 700, color: team.color, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{team.score}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", height: 70, background: "rgba(18, 20, 28, 0.95)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.6)", overflow: "hidden" }}>
          <TeamBox team={teamA} tKey="teamA" flip={false} />
          <div style={{ width: 140, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", position: "relative" }}>
            {jumpBall && <div style={{ position: "absolute", top: 2, fontFamily: BC, fontSize: 10, fontWeight: 800, color: "#FFD700" }}>⊕ JUMP</div>}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: O, fontSize: 16, fontWeight: 700, color: "#FFD700", letterSpacing: "0.1em" }}>{getQLabel(quarter)}</span>
              <span style={{ fontFamily: O, fontSize: 38, fontWeight: 700, color: gameTimeUp ? "#FF2222" : "#FFF", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{formatGameClock(clockTenths)}</span>
            </div>
          </div>
          <TeamBox team={teamB} tKey="teamB" flip={true} />
        </div>
        <div style={{ marginTop: -2, padding: "4px 18px", background: shotUrgent ? "#FF2222" : "rgba(30, 32, 40, 0.95)", borderBottomLeftRadius: 8, borderBottomRightRadius: 8, border: "1px solid rgba(255,255,255,0.1)", borderTop: "none", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }}>
          <span style={{ fontFamily: BC, fontSize: 12, fontWeight: 800, color: shotUrgent ? "#FFF" : "rgba(255,255,255,0.4)" }}>SHOT</span>
          <span style={{ fontFamily: O, fontSize: 24, fontWeight: 700, color: shotUrgent ? "#FFF" : "#FFD700", lineHeight: 1 }}>{formatShotClock(shotClockTenths)}</span>
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

  const prevGameClock  = useRef(state.clockTenths);
  const prevShotClock  = useRef(state.shotClockTenths);
  // ─── FIX: track quarter changes for timeout reset ─────────────────────────
  const prevQuarterRef = useRef(state.quarter);

  // ─── Audio on clock expiry ────────────────────────────────────────────────
  useEffect(() => {
    if (prevGameClock.current > 0 && state.clockTenths === 0) playBuzzer();
    if (prevShotClock.current > 0 && state.shotClockTenths === 0) playHorn();
    prevGameClock.current = state.clockTenths;
    prevShotClock.current = state.shotClockTenths;
  }, [state.clockTenths, state.shotClockTenths]);

  // ─── FIX: Auto-reset timeouts when quarter changes ─────────────────────────
  // FIBA: 2 timeouts ต่อครึ่ง (Q1-Q2 = 2, Q3-Q4 = 2 ใหม่), OT = 1 ต่อ period
  useEffect(() => {
    if (prevQuarterRef.current === state.quarter) return;
    prevQuarterRef.current = state.quarter;

    const targetTimeouts = getTimeoutMax(state.quarter);

    ["teamA", "teamB"].forEach(key => {
      const current = key === "teamA" ? state.teamA.timeouts : state.teamB.timeouts;
      const diff    = targetTimeouts - current;
      // ส่ง action เพิ่ม/ลด timeout จนกว่าจะถึงเป้าหมาย
      // หมายเหตุ: server ต้องรองรับ timeout +1/-1 จาก logic นี้
      if (diff > 0) {
        for (let i = 0; i < diff; i++) send("timeout", key, 1);
      } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) send("timeout", key, -1);
      }
    });
  }, [state.quarter]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT") return;
      switch (e.code) {
        case "Space": e.preventDefault(); send("clockToggle");    break;
        case "KeyC":  e.preventDefault(); send("shotClockToggle"); break;
        case "KeyZ":  e.preventDefault(); send("shotClockSet", null, 24); break;
        case "KeyX":  e.preventDefault(); send("shotClockSet", null, 14); break;
        case "KeyH":  e.preventDefault(); playHorn();             break;
        default: break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on("connect",     () => setConnected(true));
    socket.on("disconnect",  () => setConnected(false));
    socket.on("stateUpdate", (s) => {
      if (!s || !s.teamA) return;
      setState({ ...s, teamA: { techFouls: 0, ...s.teamA }, teamB: { techFouls: 0, ...s.teamB } });
    });
    return () => { socket.off("stateUpdate"); socket.off("connect"); socket.off("disconnect"); };
  }, []);

  return (
    <div onClick={unlockAudio} style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 25% 0%,#13101e,#080810 55%)", padding: 14, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        button { font-family:'Bebas Neue',Impact,sans-serif; outline:none; }
        *{box-sizing:border-box;margin:0;padding:0;}
        .btn-scale:active { transform: scale(0.93) !important; }
        .btn-scale:hover { filter: brightness(1.2); }
      `}</style>

      {/* Header */}
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

      {/* Overlay Preview */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", color: "rgba(255,255,255,0.17)", fontSize: 10, letterSpacing: "0.4em", marginBottom: 5 }}>▼ OBS OVERLAY PREVIEW</div>
        <OverlayPreview state={state} />
        <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", color: "rgba(255,255,255,0.09)", fontSize: 10, textAlign: "center", marginTop: 4, letterSpacing: "0.12em" }}>
          OBS Browser Source → {SOCKET_URL}/overlay | Width: 1920 · Height: 1080 · ✅ Allow Transparency
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", marginBottom: 12 }} />

      {/* Tournament Bridge */}
      <TournamentBridge state={state} send={send} />

      {/* Main Grid — pass quarter ไปให้ TeamCard */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 304px 1fr", gap: 12, maxWidth: 1400, margin: "0 auto" }}>
        <TeamCard team={state.teamA} teamKey="teamA" quarter={state.quarter} />
        <CenterCol state={state} />
        <TeamCard team={state.teamB} teamKey="teamB" quarter={state.quarter} />
      </div>
    </div>
  );
}