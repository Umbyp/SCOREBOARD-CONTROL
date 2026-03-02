import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import TournamentBridge from "./TournamentBridge";
import Home from "./Home";
import DisplayBoard from "./DisplayBoard";
import PlayerManager from "./PlayerManager";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const LOGO_KEY_A = "overlay_logo_a";
const LOGO_KEY_B = "overlay_logo_b";
const DB_PATH    = "player_data";

const socket = io(SOCKET_URL, {
  reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: Infinity,
});

// ─── Sounds ───────────────────────────────────────────────────
const hornAudio   = typeof Audio !== "undefined" ? new Audio("/horn.mp3") : null;
const buzzerAudio = typeof Audio !== "undefined" ? new Audio("/horn.mp3") : null;
if (hornAudio)   { hornAudio.preload   = "auto"; hornAudio.volume   = 0.8; }
if (buzzerAudio) { buzzerAudio.preload = "auto"; buzzerAudio.volume = 1.0; }

let _audioUnlocked = false;
function unlockAudio() {
  if (_audioUnlocked) return; _audioUnlocked = true;
  [hornAudio, buzzerAudio].forEach(a => {
    if (!a) return;
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  });
}
const playHorn = () => {
  if (!hornAudio) return; unlockAudio();
  hornAudio.currentTime = 0; hornAudio.volume = 0.8;
  hornAudio.play().catch(() => {});
};
const playBuzzer = () => {
  if (!buzzerAudio) return; unlockAudio();
  buzzerAudio.currentTime = 0; buzzerAudio.volume = 1.0;
  buzzerAudio.play().catch(() => {});
};

// ─── Helpers ─────────────────────────────────────────────────
function formatGameClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 600) {
    const s = Math.floor(t / 10);
    return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  }
  return `${String(Math.floor(t/10)).padStart(2,"0")}.${Math.floor(t%10)}`;
}
function formatShotClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 100) return String(Math.ceil(t/10));
  return `${Math.floor(t/10)}.${Math.floor(t%10)}`;
}
function send(type, team, value) { socket.emit("action", { type, team, value }); }
function getNameFontSize(name = "") {
  const l = name.length;
  return l <= 8 ? 30 : l <= 12 ? 22 : l <= 16 ? 17 : 13;
}
function getTimeoutMax(q) { return q >= 5 ? 1 : 2; }

// ─── Logo Picker (Upload + URL) ──────────────────────────────
function LogoPicker({ teamKey, logoUrl, color, onSave }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(logoUrl || "");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 500) {
        alert("ไฟล์ใหญ่เกินไปครับพี่ภณ! แนะนำไม่เกิน 500KB เพื่อไม่ให้ระบบหน่วง");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const apply = () => {
    const v = url.trim();
    onSave(teamKey, v);
    const lsKey = teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B;
    if (v) localStorage.setItem(lsKey, v);
    else localStorage.removeItem(lsKey);
    setOpen(false);
  };
  const clear = () => { setUrl(""); onSave(teamKey, ""); localStorage.removeItem(teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B); setOpen(false); };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="ตั้งค่า Logo ทีม" style={{ width: 48, height: 48, borderRadius: 10, background: logoUrl ? "rgba(0,0,0,0.4)" : `${color}10`, border: `1.5px solid ${logoUrl ? color + "55" : color + "25"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", transition: "all 0.2s" }}>
        {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: 40, height: 40, objectFit: "contain" }} onError={e => e.target.style.display = "none"} /> : <span style={{ fontSize: 20, opacity: 0.4 }}>🖼</span>}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 56, left: 0, zIndex: 200, width: 280, background: "#0e0e1c", border: `1px solid ${color}40`, borderRadius: 12, padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.8)" }}>
          <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 8 }}>UPLOAD LOGO</div>
          
          <button onClick={() => fileInputRef.current.click()} style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "rgba(255,255,255,0.05)", border: `1px dashed ${color}50`, borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12 }}>📁 เลือกรูปจากเครื่อง (Max 500KB)</button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />

          <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 8 }}>หรือระบุ URL รูปภาพ</div>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && apply()} placeholder="https://…" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${color}35`, borderRadius: 6, color: "#fff", fontFamily: "system-ui", fontSize: 12, padding: "8px 10px", outline: "none", marginBottom: 8 }} />
          
          {url && <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 8 }}><img src={url} alt="preview" style={{ maxHeight: 48, objectFit: "contain" }} onError={e => e.target.src = ""} /></div>}
          
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={apply} style={{ flex: 1, padding: "8px 0", background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 7, color, cursor: "pointer", fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.2em" }}>✓ ตั้งค่า</button>
            {logoUrl && <button onClick={clear} style={{ padding: "8px 12px", background: "rgba(255,50,50,0.08)", border: "1px solid rgba(255,50,50,0.2)", borderRadius: 7, color: "#FF8080", cursor: "pointer", fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.12em" }}>ลบ</button>}
            <button onClick={() => setOpen(false)} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.12em" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BonusBadge, FoulDots, TimeoutPips, ColorPicker ───────────
function BonusBadge({ teamFouls }) {
  if (teamFouls >= 10) return <div style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,40,40,0.2)", border: "1px solid rgba(255,40,40,0.5)", color: "#FF3333", fontFamily: "'Bebas Neue'", fontSize: 11, letterSpacing: "0.12em" }}>●● DBL BONUS</div>;
  if (teamFouls >= 5) return <div style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,140,0,0.18)", border: "1px solid rgba(255,140,0,0.45)", color: "#FFA500", fontFamily: "'Bebas Neue'", fontSize: 11, letterSpacing: "0.12em" }}>● BONUS</div>;
  return null;
}
function FoulDots({ count, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[0, 1].map(row => (
        <div key={row} style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 5 }).map((_, col) => {
            const idx = row * 5 + col, active = idx < count;
            const c = active && idx >= 5 ? "#FF3333" : active && count >= 5 ? "#FFA500" : color;
            return <div key={col} style={{ width: 18, height: 18, borderRadius: "50%", background: active ? c : "rgba(255,255,255,0.06)", border: `1.5px solid ${active ? c : "rgba(255,255,255,0.1)"}`, boxShadow: active ? `0 0 7px ${c}88` : "none", transition: "all 0.2s", transform: active ? "scale(1)" : "scale(0.82)" }} />;
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
        <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: i < count ? color : "rgba(255,255,255,0.06)", border: `1px solid ${i < count ? color : "rgba(255,255,255,0.1)"}`, boxShadow: i < count ? `0 0 5px ${color}77` : "none", transition: "all 0.18s" }} />
      ))}
    </div>
  );
}
const COLOR_PRESETS = ["#FF6B35","#FF3333","#FF1493","#9B59B6","#3498DB","#00D4FF","#00E87A","#FFD700","#FFFFFF","#FF8C00","#E74C3C","#2ECC71"];
function ColorPicker({ teamKey, currentColor }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: 22, height: 22, borderRadius: "50%", background: currentColor, border: "2px solid rgba(255,255,255,0.3)", cursor: "pointer", boxShadow: `0 0 8px ${currentColor}88`, flexShrink: 0 }} />
      {open && (
        <div style={{ position: "absolute", top: 28, left: 0, zIndex: 100, background: "#0e0e1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: 8, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
          {COLOR_PRESETS.map(c => (
            <button key={c} onClick={() => { send("teamColor", teamKey, c); setOpen(false); }} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: currentColor === c ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────
function TeamCard({ team, teamKey, quarter, logoUrl, onLogoSave }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const color = team.color;
  const timeoutMax = getTimeoutMax(quarter);
  const saveName = () => { send("teamName", teamKey, nameInput.toUpperCase()); setEditing(false); };
  const S = (s) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...s });

  return (
    <div style={{ background: "linear-gradient(160deg,#0d0d1b,#080810)", border: `1px solid ${color}22`, borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 10, minHeight: 56 }}>
        <LogoPicker teamKey={teamKey} logoUrl={logoUrl} color={color} onSave={onLogoSave} />
        <ColorPicker teamKey={teamKey} currentColor={color} />
        {editing ? (
          <input autoFocus value={nameInput} maxLength={20} onChange={e => setNameInput(e.target.value.toUpperCase())} onBlur={saveName} onKeyDown={e => e.key === "Enter" && saveName()} style={{ background: "none", border: "none", borderBottom: `2px solid ${color}`, outline: "none", color, ...S({ fontSize: getNameFontSize(nameInput), letterSpacing: "0.1em", width: 160 }) }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{ color, cursor: "pointer", flex: 1, wordBreak: "break-word", lineHeight: 1.1, ...S({ fontSize: getNameFontSize(team.name), letterSpacing: "0.1em", fontWeight: 900 }) }}>{team.name}</span>
        )}
        <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color, opacity: 0.3, fontSize: 13, flexShrink: 0 }}>✏️</button>
        <div style={{ marginLeft: "auto", flexShrink: 0 }}><BonusBadge teamFouls={team.teamFouls} /></div>
      </div>
      <div style={{ textAlign: "center", padding: "4px 0 2px" }}>
        <div style={{ ...S({ fontSize: 140, fontWeight: 900, lineHeight: 0.88 }), color, textShadow: `0 0 70px ${color}44` }}>{team.score}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, padding: "0 14px 14px" }}>
        {[1, 2, 3].map(v => <button key={v} onClick={() => send("score", teamKey, v)} className="btn-scale" style={{ ...S({ fontSize: 24, fontWeight: 900 }), background: `${color}14`, border: `1px solid ${color}33`, color, padding: "13px 0", borderRadius: 11, cursor: "pointer" }}>+{v}</button>)}
        <button onClick={() => send("score", teamKey, -1)} className="btn-scale" style={{ ...S({ fontSize: 24 }), background: "rgba(255,50,50,0.12)", border: "1px solid rgba(255,50,50,0.3)", color: "#FF5555", padding: "13px 0", borderRadius: 11, cursor: "pointer" }}>-1</button>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)" }}>TIMEOUTS</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "system-ui", marginTop: 1 }}>{quarter <= 2 ? "Q1–Q2" : quarter <= 4 ? "Q3–Q4" : `OT${quarter - 4}`}</div>
            </div>
            <div style={{ ...S({ fontSize: 30, fontWeight: 900, lineHeight: 1 }), color: "rgba(255,255,255,0.75)" }}>{team.timeouts}</div>
          </div>
          <TimeoutPips count={team.timeouts} max={timeoutMax} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
            <button onClick={() => { send("timeout", teamKey, -1); playHorn(); }} disabled={team.timeouts <= 0} style={{ flex: 1, ...S({ fontSize: 13 }), background: `${color}10`, border: `1px solid ${color}30`, color, padding: "7px 0", borderRadius: 8, cursor: "pointer", opacity: team.timeouts <= 0 ? 0.25 : 1 }}>USE T.O.</button>
            <button onClick={() => send("timeout", teamKey, 1)} disabled={team.timeouts >= timeoutMax} style={{ ...S({ fontSize: 13 }), background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", padding: "7px 16px", borderRadius: 8, cursor: "pointer", opacity: team.timeouts >= timeoutMax ? 0.25 : 1 }}>+1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Center Column (Game Clock, Shot Clock, Presets) ──────────
function CenterCol({ state }) {
  const { clockTenths, isRunning, quarter, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const shotSec = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn = shotSec <= 10 && shotClockTenths > 0;
  const shotColor = shotUrgent ? "#FF3333" : shotWarn ? "#FFA500" : "#00E87A";
  const gameTimeUp = clockTenths === 0;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;
  const S = (s) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...s });
  const btn = (e) => ({ ...S({}), border: "none", cursor: "pointer", borderRadius: 10, transition: "all 0.12s", position: "relative", overflow: "hidden", ...e });
  const Hint = ({ children }) => <span style={{ position: "absolute", right: 6, top: 6, fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 4, letterSpacing: "0.05em" }}>{children}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Shot Clock */}
      <div style={{ background: shotUrgent ? "linear-gradient(160deg,#1c0505,#0a0a14)" : "rgba(0,0,0,0.35)", border: `2px solid ${shotUrgent ? "rgba(255,40,40,0.55)" : shotWarn ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 20, padding: "16px 16px 12px", boxShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.2)" : "none", transition: "all 0.3s" }}>
        <div style={{ ...S({ fontSize: 11, letterSpacing: "0.5em" }), color: "rgba(255,255,255,0.35)", textAlign: "center", marginBottom: 2 }}>SHOT CLOCK</div>
        <div style={{ textAlign: "center", ...S({ fontSize: 140, fontWeight: 900, lineHeight: 0.85 }), color: shotColor, textShadow: shotUrgent ? "0 0 50px rgba(255,30,30,0.9)" : shotWarn ? "0 0 30px rgba(255,165,0,0.5)" : `0 0 30px ${shotColor}44` }}>{formatShotClock(shotClockTenths)}</div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", margin: "8px 0" }}>
          <div style={{ height: "100%", width: `${Math.min(100,(shotClockTenths/240)*100)}%`, background: shotColor, borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>
        <button className="btn-scale" onClick={() => send("shotClockToggle")} style={{ ...btn({ width: "100%", padding: "13px 0", fontSize: 19, letterSpacing: "0.15em", marginBottom: 7 }), background: shotRunning ? "rgba(255,55,55,0.15)" : "rgba(0,232,122,0.1)", border: shotRunning ? "1.5px solid rgba(255,55,55,0.45)" : "1.5px solid rgba(0,232,122,0.35)", color: shotRunning ? "#FF5555" : "#00E87A" }}>
          {shotRunning ? "⏹ STOP" : "▶ START"}<Hint>[ C ]</Hint>
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <button className="btn-scale" onClick={() => send("shotClockSet", null, 24)} style={{ ...btn({ padding: "14px 0", fontSize: 38, color: "#FFD700", background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }) }}>24<Hint>[Z]</Hint></button>
          <button className="btn-scale" onClick={() => send("shotClockSet", null, 14)} style={{ ...btn({ padding: "14px 0", fontSize: 38, color: "#FFA500", background: "rgba(255,165,0,0.1)", border: "1.5px solid rgba(255,165,0,0.4)" }) }}>14<Hint>[X]</Hint></button>
        </div>
        
        {/* ─── เพิ่มปุ่มปรับเวลา Shot Clock (+1s / -1s) ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
          <button onClick={() => send("shotClockAdjust", null, 10)} style={{ ...btn({ padding: "6px 0", fontSize: 13, background: "rgba(0,232,122,0.06)", border: "1px solid rgba(0,232,122,0.15)", color: "rgba(0,232,122,0.6)" }) }}>+1.0s</button>
          <button onClick={() => send("shotClockAdjust", null, -10)} style={{ ...btn({ padding: "6px 0", fontSize: 13, background: "rgba(255,55,55,0.06)", border: "1px solid rgba(255,55,55,0.15)", color: "rgba(255,100,100,0.55)" }) }}>-1.0s</button>
        </div>
      </div>

      {/* Game Clock */}
      <div style={{ background: gameTimeUp ? "rgba(255,0,0,0.35)" : "rgba(0,0,0,0.3)", border: gameTimeUp ? "2px solid #FF0000" : "1px solid rgba(255,215,0,0.15)", borderRadius: 18, padding: "14px", boxShadow: gameTimeUp ? "0 0 50px rgba(255,0,0,0.5)" : "none", transition: "all 0.3s" }}>
        <div style={{ ...S({ fontSize: 10, letterSpacing: "0.5em" }), color: gameTimeUp ? "#FF9999" : "rgba(255,215,0,0.55)", textAlign: "center", marginBottom: 6 }}>GAME CLOCK</div>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ ...S({ fontSize: clockTenths <= 600 ? 66 : 56, fontWeight: 900, lineHeight: 1 }), color: gameTimeUp ? "#FF0000" : isRunning ? "#FFD700" : "rgba(255,255,255,0.88)", textShadow: gameTimeUp ? "0 0 40px #FF0000" : isRunning ? "0 0 35px rgba(255,215,0,0.7)" : "none", transition: "all 0.2s" }}>{formatGameClock(clockTenths)}</div>
          <div style={{ ...S({ fontSize: 13, letterSpacing: "0.4em" }), color: gameTimeUp ? "#FF6666" : isRunning ? "rgba(255,215,0,0.65)" : "rgba(255,255,255,0.2)", marginTop: 2 }}>{qLabel} {gameTimeUp ? "■ END" : isRunning ? "▶ LIVE" : "■ PAUSED"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
          <button className="btn-scale" onClick={() => send("clockToggle")} style={{ ...btn({ padding: "12px 0", fontSize: 17, letterSpacing: "0.08em", background: isRunning ? "rgba(255,55,55,0.15)" : "rgba(0,232,122,0.1)", border: isRunning ? "1.5px solid rgba(255,55,55,0.45)" : "1.5px solid rgba(0,232,122,0.35)", color: isRunning ? "#FF5555" : "#00E87A" }) }}>{isRunning ? "⏹ STOP" : "▶ START"}<Hint>[SPC]</Hint></button>
          <button className="btn-scale" onClick={() => send("clockReset")} style={{ ...btn({ padding: "12px 0", fontSize: 17, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }) }}>↺ RESET</button>
        </div>

        {/* TIME PRESETS */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px", marginTop: 5, marginBottom: 10 }}>
          <div style={{ ...S({ fontSize: 10, letterSpacing: "0.2em" }), color: "rgba(255,255,255,0.3)", marginBottom: 6, textAlign: "center" }}>TIME PRESETS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
            <button onClick={() => { send("clockSet", null, 6000); send("clockStop"); }} style={{ ...btn({ padding: "6px 0", fontSize: 12, background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }) }}>START 10:00</button>
            <button onClick={() => { send("clockSet", null, 7200); send("clockStop"); }} style={{ ...btn({ padding: "6px 0", fontSize: 12, background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }) }}>START 12:00</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
            <button onClick={() => { send("clockSet", null, 1200); send("clockStop"); }} style={{ ...btn({ padding: "6px 0", fontSize: 12, background: "rgba(0,212,255,0.08)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.2)" }) }}>REST 02:00</button>
            <button onClick={() => { send("clockSet", null, 9000); send("clockStop"); }} style={{ ...btn({ padding: "6px 0", fontSize: 12, background: "rgba(0,212,255,0.08)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.2)" }) }}>HALF 15:00</button>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => { send("clockSet", null, 600); send("clockStop"); }} style={{ ...btn({ flex: 1, padding: "6px 0", fontSize: 12, background: "rgba(255,165,0,0.12)", color: "#FFA500", border: "1px solid rgba(255,165,0,0.3)" }) }}>T.O. 60s</button>
            <button onClick={() => { send("clockSet", null, 300); send("clockStop"); }} style={{ ...btn({ flex: 1, padding: "6px 0", fontSize: 12, background: "rgba(255,165,0,0.12)", color: "#FFA500", border: "1px solid rgba(255,165,0,0.3)" }) }}>T.O. 30s</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 8 }}>
          {[{l:"+1m",v:600},{l:"+10s",v:100},{l:"+1s",v:10},{l:"+0.1",v:1}].map(p=><button key={p.l} onClick={()=>send("clockAdjust",null,p.v)} style={{...btn({padding:"6px 0",fontSize:11,background:"rgba(0,232,122,0.06)",border:"1px solid rgba(0,232,122,0.15)",color:"rgba(0,232,122,0.6)"})}}>{p.l}</button>)}
          {[{l:"-1m",v:-600},{l:"-10s",v:-100},{l:"-1s",v:-10},{l:"-0.1",v:-1}].map(p=><button key={p.l} onClick={()=>send("clockAdjust",null,p.v)} style={{...btn({padding:"6px 0",fontSize:11,background:"rgba(255,55,55,0.06)",border:"1px solid rgba(255,55,55,0.15)",color:"rgba(255,100,100,0.55)"})}}>{p.l}</button>)}
        </div>
        <div style={{ ...S({ fontSize: 10, letterSpacing: "0.35em" }), color: "rgba(255,255,255,0.22)", marginBottom: 5 }}>PERIOD</div>
        <div style={{ display: "flex", gap: 5 }}>
          {[1,2,3,4,5].map(q=><button key={q} onClick={()=>send("quarter",null,q)} style={{...btn({flex:1,padding:"9px 0",fontSize:14,background:quarter===q?"rgba(255,215,0,0.12)":"rgba(255,255,255,0.04)",border:quarter===q?"1px solid rgba(255,215,0,0.45)":"1px solid rgba(255,255,255,0.07)",color:quarter===q?"#FFD700":"rgba(255,255,255,0.28)",boxShadow:quarter===q?"0 0 12px rgba(255,215,0,0.15)":"none"})}}>{q>4?"OT":`Q${q}`}</button>)}
        </div>
      </div>

      <button className="btn-scale" onClick={playHorn} style={{...btn({width:"100%",padding:"14px 0",fontSize:22,letterSpacing:"0.15em",background:"rgba(255,165,0,0.15)",border:"2px solid rgba(255,165,0,0.5)",color:"#FFA500",boxShadow:"0 4px 15px rgba(255,165,0,0.2)"})}}>📢 SOUND HORN<Hint style={{top:9}}>[H]</Hint></button>

      {/* Possession */}
      <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "◀ BALL", action: () => send("possession", null, possession === "teamA" ? null : "teamA"), active: possession === "teamA", color: "#FF6B35" },
            { label: "JUMP ⊕", action: () => send("jumpBall"), active: jumpBall, color: "#FFD700" },
            { label: "BALL ▶", action: () => send("possession", null, possession === "teamB" ? null : "teamB"), active: possession === "teamB", color: "#00D4FF" },
          ].map((b, i) => (
            <button key={i} onClick={b.action} style={{...btn({padding:"9px 0",fontSize:11,letterSpacing:"0.06em",background:b.active?`${b.color}18`:"rgba(255,255,255,0.04)",border:b.active?`1.5px solid ${b.color}55`:"1px solid rgba(255,255,255,0.08)",color:b.active?b.color:"rgba(255,255,255,0.3)"})}}>{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Overlay Preview ──────────────────────────────────────────
function OverlayPreview({ state, logoA, logoB }) {
  const { teamA, teamB, quarter, clockTenths, shotClockTenths, possession, jumpBall } = state;
  const shotUrgent = shotClockTenths / 10 <= 5 && shotClockTenths > 0;
  const gameTimeUp = clockTenths === 0;
  const O  = "'Oswald', sans-serif";
  const BC = "'Barlow Condensed',sans-serif";
  const getQL = (q) => q <= 4 ? `Q${q}` : `OT${q-4}`;

  const TeamBox = ({ team, tKey, flip, logo }) => {
    const isPoss = possession === tKey;
    const nameSize = team.name.length <= 8 ? 24 : team.name.length <= 14 ? 18 : 13;
    const infoBlock = (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 12px", minWidth: 130, alignItems: flip ? "flex-end" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: flip ? "row-reverse" : "row" }}>
          {isPoss && <span style={{ fontFamily: O, fontSize: 12, color: team.color }}>{flip ? "▶" : "◀"}</span>}
          <span style={{ fontFamily: O, fontSize: nameSize, fontWeight: 700, color: "#FFF", lineHeight: 1.1 }}>{team.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3, flexDirection: flip ? "row-reverse" : "row" }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[...Array(2)].map((_, i) => <div key={i} style={{ width: 11, height: 4, borderRadius: 2, background: i < team.timeouts ? "#FFF" : "rgba(255,255,255,0.15)" }} />)}
          </div>
          <span style={{ fontFamily: O, fontSize: 12, fontWeight: 700, color: team.teamFouls >= 5 ? "#FF3333" : "#FFF" }}>{team.teamFouls}</span>
          {team.teamFouls >= 5 && <span style={{ fontFamily: BC, fontSize: 9, fontWeight: 800, color: "#FFD700" }}>BONUS</span>}
        </div>
      </div>
    );
    const scoreBlock = (
      <div style={{ width: 76, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontFamily: O, fontSize: 46, fontWeight: 700, color: team.color, lineHeight: 1 }}>{team.score}</span>
      </div>
    );
    const logoSlot = (
      <div style={{ width: 52, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
        {logo ? (
          <img src={logo} alt="" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 3, opacity: 0.92 }} onError={e => e.target.style.display = "none"} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${team.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 16, color: team.color, opacity: 0.5 }}>{team.name[0]}</div>
        )}
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", height: "100%" }}>
        {!flip && <div style={{ width: 5, background: team.color }} />}
        {!flip && logoSlot}
        {!flip && infoBlock}
        {!flip && scoreBlock}
        {flip  && scoreBlock}
        {flip  && infoBlock}
        {flip  && logoSlot}
        {flip  && <div style={{ width: 5, background: team.color }} />}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", height: 66, background: "rgba(18,20,28,0.97)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.6)", overflow: "hidden" }}>
          <TeamBox team={teamA} tKey="teamA" flip={false} logo={logoA} />
          <div style={{ width: 132, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", position: "relative", flexShrink: 0 }}>
            {jumpBall && <div style={{ position: "absolute", top: 2, fontFamily: BC, fontSize: 9, fontWeight: 800, color: "#FFD700" }}>⊕ JUMP</div>}
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontFamily: O, fontSize: 14, fontWeight: 700, color: "#FFD700", letterSpacing: "0.1em" }}>{getQL(quarter)}</span>
              <span style={{ fontFamily: O, fontSize: 34, fontWeight: 700, color: gameTimeUp ? "#FF2222" : "#FFF", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{formatGameClock(clockTenths)}</span>
            </div>
          </div>
          <TeamBox team={teamB} tKey="teamB" flip={true} logo={logoB} />
        </div>
        <div style={{ marginTop: -2, padding: "4px 16px", background: shotUrgent ? "#FF2222" : "rgba(30,32,40,0.97)", borderBottomLeftRadius: 8, borderBottomRightRadius: 8, border: "1px solid rgba(255,255,255,0.1)", borderTop: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: BC, fontSize: 11, fontWeight: 800, color: shotUrgent ? "#FFF" : "rgba(255,255,255,0.4)" }}>SHOT</span>
          <span style={{ fontFamily: O, fontSize: 22, fontWeight: 700, color: shotUrgent ? "#FFF" : "#FFD700", lineHeight: 1 }}>{formatShotClock(shotClockTenths)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("home");
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#00D4FF" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });
  const [connected, setConnected] = useState(false);
  const [logoA, setLogoA] = useState(() => localStorage.getItem(LOGO_KEY_A) || "");
  const [logoB, setLogoB] = useState(() => localStorage.getItem(LOGO_KEY_B) || "");

  const prevGameClock  = useRef(state.clockTenths);
  const prevShotClock  = useRef(state.shotClockTenths);
  const prevQuarterRef = useRef(state.quarter);

  // Sync Logos with Firebase
  useEffect(() => {
    const uA = onValue(ref(db, `${DB_PATH}/teamA/logo`), (snap) => {
      const url = snap.val() || "";
      if (url) { setLogoA(url); localStorage.setItem(LOGO_KEY_A, url); }
    });
    const uB = onValue(ref(db, `${DB_PATH}/teamB/logo`), (snap) => {
      const url = snap.val() || "";
      if (url) { setLogoB(url); localStorage.setItem(LOGO_KEY_B, url); }
    });
    return () => { uA(); uB(); };
  }, []);

  const handleLogoSave = (teamKey, url) => {
    if (teamKey === "teamA") setLogoA(url);
    else setLogoB(url);
    set(ref(db, `${DB_PATH}/${teamKey}/logo`), url || "").catch(console.error);
    const lsKey = teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B;
    if (url) localStorage.setItem(lsKey, url);
    else localStorage.removeItem(lsKey);
  };

  // Audio Triggers
  useEffect(() => {
    if (prevGameClock.current > 0 && state.clockTenths === 0) playBuzzer();
    if (prevShotClock.current > 0 && state.shotClockTenths === 0) playHorn();
    prevGameClock.current = state.clockTenths;
    prevShotClock.current = state.shotClockTenths;
  }, [state.clockTenths, state.shotClockTenths]);

  // Quarter Changes -> Timeout Resets
  useEffect(() => {
    if (prevQuarterRef.current === state.quarter) return;
    prevQuarterRef.current = state.quarter;
    const t = getTimeoutMax(state.quarter);
    ["teamA", "teamB"].forEach(key => {
      const c = key === "teamA" ? state.teamA.timeouts : state.teamB.timeouts;
      const d = t - c;
      if (d > 0) for (let i = 0; i < d; i++) send("timeout", key, 1);
      else if (d < 0) for (let i = 0; i < Math.abs(d); i++) send("timeout", key, -1);
    });
  }, [state.quarter]);

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e) => {
      if (e.target.tagName === "INPUT" || view !== "control") return;
      switch (e.code) {
        case "Space": e.preventDefault(); send("clockToggle"); break;
        case "KeyC":  e.preventDefault(); send("shotClockToggle"); break;
        case "KeyZ":  e.preventDefault(); send("shotClockSet", null, 24); break;
        case "KeyX":  e.preventDefault(); send("shotClockSet", null, 14); break;
        case "KeyH":  e.preventDefault(); playHorn(); break;
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [view]);

  // Socket sync
  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("stateUpdate", (s) => {
      if (!s?.teamA) return;
      setState({ ...s, teamA: { techFouls: 0, ...s.teamA }, teamB: { techFouls: 0, ...s.teamB } });
    });
    return () => { socket.off("stateUpdate"); socket.off("connect"); socket.off("disconnect"); };
  }, []);

  const handleNavigate = (dest) => {
    if (dest === "overlay") { window.open(`${SOCKET_URL}/overlay`, "_blank"); return; }
    setView(dest);
  };

  // Routing
  if (view === "home") return <Home onNavigate={handleNavigate} />;
  if (view === "display") return <DisplayBoard onBack={() => setView("home")} />;
  if (view === "players") return <PlayerManager onBack={() => setView("home")} />;

  const S = (s) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...s });

  return (
    <div onClick={unlockAudio} style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 25% 0%,#13101e,#080810 55%)", padding: 14, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@700&family=Barlow+Condensed:wght@800&display=swap');
        button { font-family:'Bebas Neue',Impact,sans-serif; outline:none; }
        *{box-sizing:border-box;margin:0;padding:0;}
        .btn-scale:active { transform: scale(0.93) !important; }
        .btn-scale:hover  { filter: brightness(1.2); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setView("home")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.4)", ...S({ fontSize: 12, letterSpacing: "0.15em" }), padding: "6px 12px", cursor: "pointer" }}>← HOME</button>
          <div>
            <div style={{ ...S({ fontSize: 32, letterSpacing: "0.25em" }), background: "linear-gradient(90deg,#FF6B35,#FFD700 40%,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>BASKETBALL SCOREBOARD</div>
            <div style={{ ...S({ fontSize: 10, letterSpacing: "0.45em" }), color: "rgba(255,255,255,0.2)", marginTop: 2 }}>LIVE BROADCAST CONTROL</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setView("players")} style={{ padding: "6px 14px", borderRadius: 100, background: "rgba(0,232,122,0.07)", border: "1px solid rgba(0,232,122,0.25)", color: "#00E87A", ...S({ fontSize: 11, letterSpacing: "0.15em" }), cursor: "pointer" }}>👥 PLAYERS</button>
          <button onClick={() => window.open(window.location.pathname + "?view=display", "_blank")} style={{ padding: "6px 14px", borderRadius: 100, background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF", ...S({ fontSize: 11, letterSpacing: "0.15em" }), cursor: "pointer" }}>📺 ARENA</button>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 100, background: connected ? "rgba(0,232,122,0.07)" : "rgba(255,55,55,0.07)", border: `1px solid ${connected ? "rgba(0,232,122,0.25)" : "rgba(255,55,55,0.25)"}`, ...S({ fontSize: 12, letterSpacing: "0.18em" }), color: connected ? "#00E87A" : "#FF5555" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#00E87A" : "#FF5555" }} />
            {connected ? "CONNECTED" : "OFFLINE"}
          </div>
          <button className="btn-scale" onClick={() => { if (window.confirm("RESET GAME ทั้งหมด?")) send("resetGame"); }} style={{ padding: "6px 16px", borderRadius: 100, background: "rgba(255,55,55,0.07)", border: "1px solid rgba(255,55,55,0.22)", color: "#FF7070", ...S({ fontSize: 12, letterSpacing: "0.15em" }), cursor: "pointer" }}>↺ RESET</button>
        </div>
      </div>

      {/* Overlay Preview */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.17)", marginBottom: 4 }}>▼ OBS OVERLAY PREVIEW</div>
        <OverlayPreview state={state} logoA={logoA} logoB={logoB} />
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", marginBottom: 12 }} />

      <TournamentBridge state={state} send={send} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 304px 1fr", gap: 12, maxWidth: 1400, margin: "0 auto" }}>
        <TeamCard team={state.teamA} teamKey="teamA" quarter={state.quarter} logoUrl={logoA} onLogoSave={handleLogoSave} />
        <CenterCol state={state} />
        <TeamCard team={state.teamB} teamKey="teamB" quarter={state.quarter} logoUrl={logoB} onLogoSave={handleLogoSave} />
      </div>
    </div>
  );
}