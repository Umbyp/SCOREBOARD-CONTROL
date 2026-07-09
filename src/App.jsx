// App.jsx — Operator control panel · "Broadcast Console" design system
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import TournamentBridge from "./TournamentBridge";
import Home from "./Home";
import DisplayBoard from "./DisplayBoard";
import PlayerManager from "./PlayerManager";
import { c, font, r, shadow, overline, panel, readout, btn, FONT_IMPORT } from "./theme";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const LOGO_KEY_A = "overlay_logo_a";
const LOGO_KEY_B = "overlay_logo_b";
const DB_PATH    = "player_data";
const LEAGUE_PATH = "overlay_config/league";
const LEAGUE_DEFAULT = { logo: "", line1: "BASKETBALL", line2: "THAI LEAGUE", year: "2026" };

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
  return `${Math.floor(t / 10)}.${Math.floor(t % 10)}`;
}
function formatShotClock(tenths) {
  const t = Math.max(0, tenths);
  if (t > 100) return String(Math.ceil(t/10));
  return `${Math.floor(t/10)}.${Math.floor(t%10)}`;
}
function send(type, team, value) { socket.emit("action", { type, team, value }); }
function getNameFontSize(name = "") {
  const l = name.length;
  return l <= 8 ? 30 : l <= 12 ? 24 : l <= 16 ? 19 : 15;
}
function getTimeoutMax(q) { return q >= 5 ? 1 : 2; }

// ─── Small inline icons ──────────────────────────────────────
const Pencil = ({ size = 13, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" />
  </svg>
);

// ─── Logo Picker (Upload + URL) ──────────────────────────────
function LogoPicker({ teamKey, logoUrl, color, onSave }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(logoUrl || "");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 500) {
        alert("ไฟล์ใหญ่เกินไป — แนะนำไม่เกิน 500KB เพื่อไม่ให้ระบบหน่วง");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const apply = () => {
    const v = url.trim();
    onSave(teamKey, v);
    const lsKey = teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B;
    if (v) localStorage.setItem(lsKey, v); else localStorage.removeItem(lsKey);
    setOpen(false);
  };
  const clear = () => { setUrl(""); onSave(teamKey, ""); localStorage.removeItem(teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B); setOpen(false); };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="ตั้งค่าโลโก้ทีม" style={{
        width: 46, height: 46, borderRadius: r.md, background: c.surface2,
        border: `1px solid ${logoUrl ? color + "55" : c.line}`, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        transition: "border-color .15s" }}>
        {logoUrl
          ? <img src={logoUrl} alt="logo" style={{ width: 38, height: 38, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.mute} strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/></svg>}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 54, left: 0, zIndex: 200, width: 288,
          background: c.surface, border: `1px solid ${c.lineStrong}`, borderRadius: r.lg,
          padding: 14, boxShadow: shadow.lg }}>
          <div style={{ ...overline({ marginBottom: 8 }) }}>อัปโหลดโลโก้</div>
          <button onClick={() => fileInputRef.current.click()} style={{
            ...btn("neutral"), width: "100%", padding: "10px", marginBottom: 12,
            fontSize: 13, borderStyle: "dashed", borderColor: color + "45", color: c.dim }}>
            เลือกรูปจากเครื่อง · สูงสุด 500KB
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />

          <div style={{ ...overline({ marginBottom: 8 }) }}>หรือระบุ URL รูปภาพ</div>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && apply()} placeholder="https://…" style={{
            width: "100%", background: c.surface2, border: `1px solid ${c.line}`, borderRadius: r.sm,
            color: c.text, fontFamily: font.body, fontSize: 13, padding: "9px 11px", outline: "none", marginBottom: 10 }} />

          {url && <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, padding: 8, background: c.bgInset, borderRadius: r.sm }}><img src={url} alt="preview" style={{ maxHeight: 48, objectFit: "contain" }} onError={e => e.target.src = ""} /></div>}

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={apply} style={{ ...btn(color, { active: true }), flex: 1, padding: "9px 0", fontSize: 13, letterSpacing: "0.08em" }}>ตั้งค่า</button>
            {logoUrl && <button onClick={clear} style={{ ...btn("danger"), padding: "9px 14px", fontSize: 13 }}>ลบ</button>}
            <button onClick={() => setOpen(false)} style={{ ...btn("neutral"), padding: "9px 14px", fontSize: 13, color: c.mute }}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BonusBadge, FoulDots, TimeoutPips, ColorPicker ───────────
function BonusBadge({ teamFouls }) {
  if (teamFouls < 5) return null;
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px",
    borderRadius: r.pill, background: c.dangerDim, border: `1px solid ${c.danger}55`,
    ...overline({ fontSize: 9.5, color: c.danger, letterSpacing: "0.16em" }) }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.danger }} />BONUS
  </div>;
}

function FoulDots({ count, color }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= count;
        const col = active && count >= 5 ? c.danger : color;
        return <div key={i} style={{ width: 16, height: 16, borderRadius: "50%",
          background: active ? col : "rgba(255,255,255,0.05)",
          border: `1px solid ${active ? col : c.line}`, transition: "all .18s" }} />;
      })}
    </div>
  );
}

function TimeoutPips({ count, max = 2, color }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: "50%",
          background: i < count ? color : "rgba(255,255,255,0.05)",
          border: `1px solid ${i < count ? color : c.line}`, transition: "all .18s" }} />
      ))}
    </div>
  );
}

const COLOR_PRESETS = ["#E86A3A","#DE5B57","#D8578E","#9B6BC0","#3E86C9","#2FA8DC","#3FB98B","#D8B65C","#EDEFF3","#E08A2E","#C94A3F","#4CAE6A"];
function ColorPicker({ teamKey, currentColor }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title="สีทีม" style={{ width: 22, height: 22,
        borderRadius: "50%", background: currentColor, border: `2px solid ${c.raised}`, cursor: "pointer", flexShrink: 0 }} />
      {open && (
        <div style={{ position: "absolute", top: 30, left: 0, zIndex: 100, background: c.surface,
          border: `1px solid ${c.lineStrong}`, borderRadius: r.md, padding: 9, display: "grid",
          gridTemplateColumns: "repeat(4,1fr)", gap: 6, boxShadow: shadow.md }}>
          {COLOR_PRESETS.map(col => (
            <button key={col} onClick={() => { send("teamColor", teamKey, col); setOpen(false); }} style={{
              width: 24, height: 24, borderRadius: "50%", background: col,
              border: currentColor === col ? `2px solid ${c.text}` : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-panel wrapper (fouls / timeouts) ─────────────────────
function StatBlock({ children, danger, warn }) {
  const bd = danger ? "rgba(222,91,87,0.28)" : warn ? "rgba(221,161,63,0.24)" : c.line;
  return <div style={{ background: c.bgInset, borderRadius: r.md, padding: "11px 13px", border: `1px solid ${bd}` }}>{children}</div>;
}

// ─── Team Card ────────────────────────────────────────────────
function TeamCard({ team, teamKey, quarter, logoUrl, onLogoSave }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const color = team.color;
  const timeoutMax = getTimeoutMax(quarter);
  // Keep the edit box in sync with externally-applied renames (e.g. from
  // TournamentBridge match selection) whenever the operator isn't actively typing.
  useEffect(() => { if (!editing) setNameInput(team.name); }, [team.name, editing]);
  const startEditing = () => { setNameInput(team.name); setEditing(true); };
  const saveName = () => { send("teamName", teamKey, nameInput.toUpperCase()); setEditing(false); };

  return (
    <div style={panel({ overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: shadow.sm })}>
      <div style={{ height: 3, background: color }} />

      {/* header */}
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 10, minHeight: 54 }}>
        <LogoPicker teamKey={teamKey} logoUrl={logoUrl} color={color} onSave={onLogoSave} />
        <ColorPicker teamKey={teamKey} currentColor={color} />
        {editing ? (
          <input autoFocus value={nameInput} maxLength={20} onChange={e => setNameInput(e.target.value.toUpperCase())} onBlur={saveName} onKeyDown={e => e.key === "Enter" && saveName()} style={{
            background: "none", border: "none", borderBottom: `2px solid ${color}`, outline: "none",
            color, fontFamily: font.head, fontWeight: 600, fontSize: getNameFontSize(nameInput), letterSpacing: "0.04em", width: 170 }} />
        ) : (
          <span onClick={startEditing} style={{ color, cursor: "pointer", flex: 1,
            wordBreak: "break-word", lineHeight: 1.05, fontFamily: font.head, fontWeight: 600,
            fontSize: getNameFontSize(team.name), letterSpacing: "0.03em" }}>{team.name}</span>
        )}
        <button onClick={startEditing} title="แก้ไขชื่อ" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.5, flexShrink: 0 }}><Pencil color={c.mute} /></button>
        <div style={{ marginLeft: "auto", flexShrink: 0 }}><BonusBadge teamFouls={team.teamFouls} /></div>
      </div>

      {/* score */}
      <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
        <div style={readout(132, color, { fontWeight: 700, lineHeight: 0.9 })}>{team.score}</div>
      </div>

      {/* score buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, padding: "0 14px 14px" }}>
        {[1, 2, 3].map(v => <button key={v} onClick={() => send("score", teamKey, v)} className="press" style={{ ...btn(color, { active: true }), fontFamily: font.num, fontWeight: 600, fontSize: 22, padding: "13px 0" }}>+{v}</button>)}
        <button onClick={() => send("score", teamKey, -1)} className="press" style={{ ...btn("danger"), fontFamily: font.num, fontWeight: 600, fontSize: 22, padding: "13px 0" }}>−1</button>
      </div>

      <div style={{ height: 1, background: c.line, margin: "0 14px" }} />

      {/* stat blocks */}
      <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <StatBlock danger={team.teamFouls >= 10} warn={team.teamFouls >= 5 && team.teamFouls < 10}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <div style={overline()}>TEAM FOULS</div>
            <div style={readout(28, team.teamFouls >= 10 ? c.danger : team.teamFouls >= 5 ? c.warn : c.dim, { fontWeight: 700 })}>{team.teamFouls}</div>
          </div>
          <FoulDots count={team.teamFouls} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={() => send("teamFoul", teamKey, 1)} className="press" style={{ ...btn("danger"), flex: 1, fontSize: 13, padding: "8px 0" }}>+ FOUL</button>
            <button onClick={() => send("teamFoul", teamKey, -1)} disabled={team.teamFouls <= 0} className="press" style={{ ...btn("neutral"), fontSize: 13, padding: "8px 13px", opacity: team.teamFouls <= 0 ? 0.3 : 1 }}>−1</button>
            <button onClick={() => send("teamFoulReset", teamKey)} className="press" style={{ ...btn("neutral"), fontSize: 13, padding: "8px 13px", color: c.mute }}>CLR</button>
          </div>
        </StatBlock>

        <StatBlock>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={overline()}>TIMEOUTS</div>
              <div style={{ fontFamily: font.body, fontSize: 11, color: c.faint, marginTop: 2 }}>{quarter <= 2 ? "Q1–Q2" : quarter <= 4 ? "Q3–Q4" : `OT${quarter - 4}`}</div>
            </div>
            <div style={readout(28, c.dim, { fontWeight: 700 })}>{team.timeouts}</div>
          </div>
          <TimeoutPips count={team.timeouts} max={timeoutMax} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={() => { send("timeout", teamKey, -1); playHorn(); }} disabled={team.timeouts <= 0} className="press" style={{ ...btn(color, { active: true }), flex: 1, fontSize: 13, padding: "8px 0", opacity: team.timeouts <= 0 ? 0.3 : 1 }}>USE T.O.</button>
            <button onClick={() => send("timeout", teamKey, 1)} disabled={team.timeouts >= timeoutMax} className="press" style={{ ...btn("neutral"), fontSize: 13, padding: "8px 16px", opacity: team.timeouts >= timeoutMax ? 0.3 : 1 }}>+1</button>
          </div>
        </StatBlock>
      </div>
    </div>
  );
}

// ─── Keyboard hint chip ──────────────────────────────────────
const Hint = ({ children }) => <span style={{ position: "absolute", right: 7, top: 7, fontFamily: font.body,
  fontSize: 10, fontWeight: 600, color: c.faint, background: "rgba(0,0,0,0.35)", padding: "1px 5px",
  borderRadius: 4, letterSpacing: "0.04em" }}>{children}</span>;

// ─── Center Column (Game Clock, Shot Clock, Presets) ──────────
function CenterCol({ state }) {
  const { clockTenths, isRunning, quarter, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const shotSec = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn = shotSec <= 10 && shotClockTenths > 0;
  const shotColor = shotUrgent ? c.danger : shotWarn ? c.warn : c.live;

  const gameTimeUp = clockTenths === 0;
  const qLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;

  const mini = (tone) => ({ ...btn(tone), fontSize: 11, padding: "7px 0", position: "relative" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Shot Clock */}
      <div style={panel({ padding: "16px 16px 14px", border: `1px solid ${shotUrgent ? "rgba(222,91,87,0.4)" : c.line}` })}>
        <div style={{ ...overline({ textAlign: "center", marginBottom: 2 }) }}>SHOT CLOCK</div>
        <div style={{ textAlign: "center", ...readout(128, shotColor, { fontWeight: 700, lineHeight: 0.9 }) }}>
          {formatShotClock(shotClockTenths)}
        </div>
        <div style={{ height: 12 }} />
        <button className="press" onClick={() => send("shotClockToggle")} style={{ ...btn(shotRunning ? "danger" : "live", { active: true }), width: "100%", padding: "12px 0", fontSize: 17, letterSpacing: "0.1em", marginBottom: 7, position: "relative" }}>
          {shotRunning ? "STOP" : "START"}<Hint>C</Hint>
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <button className="press" onClick={() => send("shotClockSet", null, 24)} style={{ ...btn("gold", { active: true }), fontFamily: font.num, fontWeight: 700, fontSize: 34, padding: "12px 0", position: "relative" }}>24<Hint>Z</Hint></button>
          <button className="press" onClick={() => send("shotClockSet", null, 14)} style={{ ...btn("warn", { active: true }), fontFamily: font.num, fontWeight: 700, fontSize: 34, padding: "12px 0", position: "relative" }}>14<Hint>X</Hint></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
          <button onClick={() => send("shotClockAdjust", null, 10)} style={{ ...btn("neutral"), fontSize: 12, padding: "6px 0", color: c.mute }}>+1.0s</button>
          <button onClick={() => send("shotClockAdjust", null, -10)} style={{ ...btn("neutral"), fontSize: 12, padding: "6px 0", color: c.mute }}>−1.0s</button>
        </div>
      </div>

      {/* Game Clock */}
      <div style={panel({ padding: 14, border: `1px solid ${gameTimeUp ? c.danger : c.line}`, background: gameTimeUp ? "rgba(222,91,87,0.10)" : c.surface })}>
        <div style={{ ...overline({ textAlign: "center", marginBottom: 6, color: gameTimeUp ? c.danger : c.gold }) }}>GAME CLOCK</div>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={readout(clockTenths <= 600 ? 62 : 54, gameTimeUp ? c.danger : isRunning ? c.gold : c.text, { fontWeight: 700 })}>{formatGameClock(clockTenths)}</div>
          <div style={{ ...overline({ fontSize: 11, marginTop: 4, letterSpacing: "0.28em", color: gameTimeUp ? c.danger : isRunning ? c.live : c.mute }) }}>{qLabel} · {gameTimeUp ? "END" : isRunning ? "LIVE" : "PAUSED"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
          <button className="press" onClick={() => send("clockToggle")} style={{ ...btn(isRunning ? "danger" : "live", { active: true }), padding: "11px 0", fontSize: 16, position: "relative" }}>{isRunning ? "STOP" : "START"}<Hint>SPC</Hint></button>
          <button className="press" onClick={() => send("clockReset")} style={{ ...btn("neutral"), padding: "11px 0", fontSize: 16, color: c.dim }}>RESET</button>
        </div>

        {/* TIME PRESETS */}
        <div style={{ background: c.bgInset, border: `1px solid ${c.line}`, borderRadius: r.md, padding: 8, marginTop: 5, marginBottom: 10 }}>
          <div style={{ ...overline({ fontSize: 9.5, marginBottom: 7, textAlign: "center" }) }}>TIME PRESETS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
            <button onClick={() => { send("clockSet", null, 6000); send("clockStop"); }} style={mini("gold")}>START 10:00</button>
            <button onClick={() => { send("clockSet", null, 7200); send("clockStop"); }} style={mini("gold")}>START 12:00</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
            <button onClick={() => { send("clockSet", null, 1200); send("clockStop"); }} style={mini("#2FA8DC")}>REST 02:00</button>
            <button onClick={() => { send("clockSet", null, 9000); send("clockStop"); }} style={mini("#2FA8DC")}>HALF 15:00</button>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => { send("clockSet", null, 600); send("clockStop"); }} style={{ ...mini("warn"), flex: 1 }}>T.O. 60s</button>
            <button onClick={() => { send("clockSet", null, 300); send("clockStop"); }} style={{ ...mini("warn"), flex: 1 }}>T.O. 30s</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 9 }}>
          {[{l:"+1m",v:600},{l:"+10s",v:100},{l:"+1s",v:10},{l:"+0.1",v:1},{l:"−1m",v:-600},{l:"−10s",v:-100},{l:"−1s",v:-10},{l:"−0.1",v:-1}].map(p=><button key={p.l} onClick={()=>send("clockAdjust",null,p.v)} style={{ ...btn("neutral"), fontSize: 11, padding: "6px 0", color: c.mute }}>{p.l}</button>)}
        </div>

        <div style={{ ...overline({ fontSize: 9.5, marginBottom: 6 }) }}>PERIOD</div>
        <div style={{ display: "flex", gap: 5 }}>
          {[1,2,3,4,5].map(q=><button key={q} onClick={()=>send("quarter",null,q)} style={{ ...btn("gold", { active: quarter === q }), flex: 1, padding: "9px 0", fontSize: 14, color: quarter === q ? c.gold : c.mute }}>{q>4?"OT":`Q${q}`}</button>)}
        </div>
      </div>

      <button className="press" onClick={playHorn} style={{ ...btn("warn", { active: true }), width: "100%", padding: "13px 0", fontSize: 17, letterSpacing: "0.12em", position: "relative" }}>SOUND HORN<Hint>H</Hint></button>

      {/* Possession */}
      <div style={panel({ padding: "12px 14px" })}>
        <div style={{ ...overline({ fontSize: 9.5, textAlign: "center", marginBottom: 9 }) }}>POSSESSION · กดทีมที่ได้บอล ลูกศรชี้ไปอีกฝั่ง</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, alignItems: "stretch" }}>
          <button onClick={() => send("possession", null, possession === "teamB" ? null : "teamB")} style={{ ...btn(state.teamA.color, { active: possession === "teamB" }), padding: "9px 0", fontSize: 12, lineHeight: 1.25 }}>
            A ได้บอล<br/><span style={{ fontSize: 10, opacity: 0.7 }}>ศรชี้ B →</span>
          </button>
          <button onClick={() => send("jumpBall")} style={{ ...btn("gold", { active: jumpBall }), padding: "9px 0", fontSize: 13 }}>JUMP</button>
          <button onClick={() => send("possession", null, possession === "teamA" ? null : "teamA")} style={{ ...btn(state.teamB.color, { active: possession === "teamA" }), padding: "9px 0", fontSize: 12, lineHeight: 1.25 }}>
            B ได้บอล<br/><span style={{ fontSize: 10, opacity: 0.7 }}>← A ศรชี้</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Thai League overlay bits (shared look with public/overlay.html) ──
const GOLD = "#E4BF55";
function ordinal(q) { return q > 4 ? `OT${q - 4}` : (["1ST", "2ND", "3RD", "4TH"][q - 1] || `Q${q}`); }

function PvDashes({ count, bonus, variant }) {
  const away = variant === "away";
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 5, flexDirection: away ? "row-reverse" : "row" }}>
      {[0, 1, 2, 3, 4].map(i => {
        const on = i < count;
        const bg = !on ? (away ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.16)")
          : bonus ? (away ? GOLD : "#C9483F") : (away ? "#fff" : "#17181d");
        return <div key={i} style={{ width: 13, height: 2.5, borderRadius: 2, background: bg }} />;
      })}
    </div>
  );
}

function LeagueSeal({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.4">
      <circle cx="12" cy="12" r="9.4" />
      <path d="M12 2.6v18.8M2.6 12h18.8M5 5c3.5 2.5 3.5 11.5 0 14M19 5c-3.5 2.5-3.5 11.5 0 14" strokeOpacity="0.75" />
    </svg>
  );
}

function LeagueBlock({ league }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 12px 0 10px",
      background: "linear-gradient(180deg,#15161c,#0a0b0f)", borderRight: `1px solid ${c.line}` }}>
      {league.logo
        ? <img src={league.logo} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
        : <div style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${GOLD}`, background: "rgba(228,191,85,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><LeagueSeal /></div>}
      <div style={{ lineHeight: 1 }}>
        {league.line1 && <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", color: c.text }}>{league.line1}</div>}
        {league.line2 && <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", color: c.dim, marginTop: 1 }}>{league.line2}</div>}
        {league.year && <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 15, color: GOLD, marginTop: 1 }}>{league.year}</div>}
      </div>
    </div>
  );
}

function PvLogo({ logo, color, letter }) {
  return (
    <div style={{ width: 42, display: "flex", alignItems: "center", justifyContent: "center", background: "#05060a", flexShrink: 0 }}>
      {logo ? <img src={logo} alt="" style={{ width: 33, height: 33, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.head, fontSize: 14, fontWeight: 700, color }}>{letter}</div>}
    </div>
  );
}

// ─── Overlay Preview (mirrors public/overlay.html) ────────────
function OverlayPreview({ state, logoA, logoB, league }) {
  const { teamA, teamB, quarter, clockTenths, shotClockTenths, possession, jumpBall } = state;
  const shotSec = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const gameTimeUp = clockTenths === 0;
  const nameSize = (n) => n.length <= 6 ? 18 : n.length <= 10 ? 15 : n.length <= 14 ? 12 : 10;
  const foulsA = Math.min(teamA.teamFouls, 5), bonusA = teamA.teamFouls >= 5;
  const foulsB = Math.min(teamB.teamFouls, 5), bonusB = teamB.teamFouls >= 5;
  const SK = "skewX(-13deg)", SKr = "skewX(13deg)";
  const H = 62;

  const scoreCell = (val, color) => (
    <div style={{ width: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0D11" }}>
      <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 30, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{val}</div>
    </div>
  );
  const infoCell = (label, value, color, w, urgent) => (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", borderLeft: `1px solid ${c.line}` }}>
      <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.14em", color: urgent ? c.danger : c.mute, marginBottom: 1 }}>{label}</div>
      <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 19, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
      <div style={{ display: "flex", height: H, background: "#0C0D11", borderRadius: 5,
        border: `1px solid ${c.lineStrong}`, boxShadow: shadow.md, overflow: "hidden" }}>

        <LeagueBlock league={league} />
        <PvLogo logo={logoA} color={teamA.color} letter={teamA.name[0]} />

        {/* home panel */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "0 20px 0 10px", minWidth: 104 }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#f4f4f2,#e4e4e0)", transform: SK, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: -2, width: 3, background: GOLD, transform: SK, zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: nameSize(teamA.name), color: "#17181d", lineHeight: 1, whiteSpace: "nowrap" }}>{teamA.name}</div>
            <PvDashes count={foulsA} bonus={bonusA} variant="home" />
            {possession === "teamA" && <div style={{ height: 2, marginTop: 4, width: 28, borderRadius: 2, background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />}
          </div>
        </div>

        {scoreCell(teamA.score, teamA.color)}
        <div style={{ width: 2.5, background: GOLD, transform: SK }} />
        {scoreCell(teamB.score, teamB.color)}

        {/* away panel */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 10px 0 20px", minWidth: 104 }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${teamB.color}, color-mix(in srgb, ${teamB.color} 70%, #000))`, transform: SKr, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: -2, width: 3, background: GOLD, transform: SKr, zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: nameSize(teamB.name), color: GOLD, lineHeight: 1, whiteSpace: "nowrap" }}>{teamB.name}</div>
            <PvDashes count={foulsB} bonus={bonusB} variant="away" />
            {possession === "teamB" && <div style={{ height: 2, marginTop: 4, width: 28, borderRadius: 2, background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />}
          </div>
        </div>

        <PvLogo logo={logoB} color={teamB.color} letter={teamB.name[0]} />

        {/* info */}
        <div style={{ display: "flex", alignItems: "stretch", background: "linear-gradient(180deg,#15161c,#0a0b0f)" }}>
          <div style={{ width: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {jumpBall && <div style={{ position: "absolute", top: 2, fontFamily: font.label, fontWeight: 800, fontSize: 7, letterSpacing: "0.16em", color: GOLD }}>JUMP</div>}
            <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.14em", color: c.mute, marginBottom: 1 }}>PERIOD</div>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 16, color: GOLD, lineHeight: 1 }}>{ordinal(quarter)}</div>
          </div>
          {infoCell("GAME", formatGameClock(clockTenths), gameTimeUp ? c.danger : "#fff", 66, gameTimeUp)}
          {infoCell("SHOT", formatShotClock(shotClockTenths), shotUrgent ? c.danger : GOLD, 48, shotUrgent)}
        </div>
      </div>
    </div>
  );
}

// ─── League / Event branding editor (popover) ─────────────────
function LeagueEditor({ league, onSave, onClose }) {
  const [logo, setLogo]   = useState(league.logo || "");
  const [line1, setLine1] = useState(league.line1 || "");
  const [line2, setLine2] = useState(league.line2 || "");
  const [year, setYear]   = useState(league.year || "");
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 1024 * 500) { alert("ไฟล์ใหญ่เกินไป — แนะนำไม่เกิน 500KB"); return; }
    const rd = new FileReader();
    rd.onloadend = () => setLogo(rd.result);
    rd.readAsDataURL(f);
  };
  const apply = () => { onSave({ logo: (logo || "").trim(), line1, line2, year }); onClose(); };

  const inp = { width: "100%", background: c.surface2, border: `1px solid ${c.line}`, borderRadius: r.sm, color: c.text, fontFamily: font.body, fontSize: 13, padding: "8px 10px", outline: "none" };

  return (
    <div style={{ position: "absolute", top: 44, right: 0, zIndex: 300, width: 306, background: c.surface,
      border: `1px solid ${c.lineStrong}`, borderRadius: r.lg, padding: 14, boxShadow: shadow.lg, cursor: "default" }}>
      <div style={{ ...overline({ marginBottom: 11 }) }}>LEAGUE / EVENT BRANDING</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 11 }}>
        <div style={{ width: 54, height: 54, borderRadius: r.md, background: c.surface2, border: `1px solid ${c.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {logo ? <img src={logo} alt="" style={{ width: 46, height: 46, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                : <div style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center" }}><LeagueSeal size={22} /></div>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => fileRef.current.click()} style={{ ...btn("neutral"), padding: "8px 0", fontSize: 12, borderStyle: "dashed", color: c.dim }}>เลือกโลโก้จากเครื่อง · ≤500KB</button>
          <input value={logo.startsWith("data:") ? "" : logo} onChange={e => setLogo(e.target.value)} placeholder="หรือวาง URL รูป…" style={{ ...inp, fontSize: 12, padding: "7px 9px" }} />
        </div>
        <input type="file" ref={fileRef} onChange={handleFile} accept="image/*" style={{ display: "none" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
        <div>
          <div style={{ ...overline({ fontSize: 9, marginBottom: 4 }) }}>บรรทัด 1</div>
          <input value={line1} maxLength={18} onChange={e => setLine1(e.target.value.toUpperCase())} placeholder="BASKETBALL" style={inp} />
        </div>
        <div>
          <div style={{ ...overline({ fontSize: 9, marginBottom: 4 }) }}>บรรทัด 2</div>
          <input value={line2} maxLength={18} onChange={e => setLine2(e.target.value.toUpperCase())} placeholder="THAI LEAGUE" style={inp} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...overline({ fontSize: 9, marginBottom: 4 }) }}>ปี / รุ่น</div>
        <input value={year} maxLength={10} onChange={e => setYear(e.target.value)} placeholder="2026" style={inp} />
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={apply} style={{ ...btn("gold", { active: true }), flex: 1, padding: "9px 0", fontSize: 13, letterSpacing: "0.08em" }}>บันทึก</button>
        {logo && <button onClick={() => setLogo("")} style={{ ...btn("danger"), padding: "9px 13px", fontSize: 13 }}>ลบโลโก้</button>}
        <button onClick={onClose} style={{ ...btn("neutral"), padding: "9px 13px", fontSize: 13, color: c.mute }}>ปิด</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    return v === "display" ? "display" : "home";
  });
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#E86A3A" },
    teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#2FA8DC" },
    quarter: 1, clockTenths: 6000, isRunning: false,
    shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
  });
  const [connected, setConnected] = useState(false);
  const [logoA, setLogoA] = useState(() => localStorage.getItem(LOGO_KEY_A) || "");
  const [logoB, setLogoB] = useState(() => localStorage.getItem(LOGO_KEY_B) || "");
  const [league, setLeague] = useState(LEAGUE_DEFAULT);
  const [leagueOpen, setLeagueOpen] = useState(false);

  const prevGameClock  = useRef(state.clockTenths);
  const prevShotClock  = useRef(state.shotClockTenths);
  const prevQuarterRef = useRef(state.quarter);

  useEffect(() => {
    const uA = onValue(ref(db, `${DB_PATH}/teamA/logo`), (snap) => {
      const url = snap.val() || "";
      setLogoA(url);
      if (url) localStorage.setItem(LOGO_KEY_A, url); else localStorage.removeItem(LOGO_KEY_A);
    });
    const uB = onValue(ref(db, `${DB_PATH}/teamB/logo`), (snap) => {
      const url = snap.val() || "";
      setLogoB(url);
      if (url) localStorage.setItem(LOGO_KEY_B, url); else localStorage.removeItem(LOGO_KEY_B);
    });
    const uL = onValue(ref(db, LEAGUE_PATH), (snap) => {
      const v = snap.val();
      if (v) setLeague({ ...LEAGUE_DEFAULT, ...v });
    });
    return () => { uA(); uB(); uL(); };
  }, []);

  const saveLeague = (cfg) => {
    setLeague(cfg);
    set(ref(db, LEAGUE_PATH), cfg).catch(console.error);
  };

  const handleLogoSave = (teamKey, url) => {
    if (teamKey === "teamA") setLogoA(url); else setLogoB(url);
    set(ref(db, `${DB_PATH}/${teamKey}/logo`), url || "").catch(console.error);
    const lsKey = teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B;
    if (url) localStorage.setItem(lsKey, url); else localStorage.removeItem(lsKey);
  };

  useEffect(() => {
    if (prevGameClock.current > 0 && state.clockTenths === 0) playBuzzer();
    if (prevShotClock.current > 0 && state.shotClockTenths === 0) playHorn();
    prevGameClock.current = state.clockTenths;
    prevShotClock.current = state.shotClockTenths;
  }, [state.clockTenths, state.shotClockTenths]);

  useEffect(() => {
    if (prevQuarterRef.current === state.quarter) return;
    prevQuarterRef.current = state.quarter;
    const t = getTimeoutMax(state.quarter);
    ["teamA", "teamB"].forEach(key => {
      const cnt = key === "teamA" ? state.teamA.timeouts : state.teamB.timeouts;
      const d = t - cnt;
      if (d > 0) for (let i = 0; i < d; i++) send("timeout", key, 1);
      else if (d < 0) for (let i = 0; i < Math.abs(d); i++) send("timeout", key, -1);
    });
  }, [state.quarter]);

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

  if (view === "home") return <Home onNavigate={handleNavigate} />;
  if (view === "display") return <DisplayBoard onBack={() => setView("home")} />;
  if (view === "players") return <PlayerManager onBack={() => setView("home")} />;

  const navBtn = (extra = {}) => ({ ...btn("neutral"), padding: "7px 15px", borderRadius: r.pill, fontSize: 12, letterSpacing: "0.1em", ...extra });

  return (
    <div onClick={unlockAudio} style={{ minHeight: "100vh", background: c.bg, color: c.text, padding: 16, fontFamily: font.body, position: "relative" }}>
      <style>{`
        ${FONT_IMPORT}
        *{box-sizing:border-box;margin:0;padding:0;}
        button{outline:none;}
        .press:active{transform:scale(0.96);}
        .press:hover{filter:brightness(1.14);}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;}
      `}</style>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(120% 60% at 50% -10%, rgba(255,255,255,0.03), transparent 55%)" }} />

      {/* Header */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("home")} style={navBtn({ color: c.dim })}>← HOME</button>
          <div>
            <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 26, letterSpacing: "0.05em", lineHeight: 1 }}>
              BASKETBALL <span style={{ color: c.dim, fontWeight: 300 }}>SCOREBOARD</span>
            </div>
            <div style={{ ...overline({ fontSize: 9.5, marginTop: 3, letterSpacing: "0.36em" }) }}>LIVE BROADCAST CONTROL</div>
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setLeagueOpen(o => !o)} style={navBtn({ color: c.gold, borderColor: "rgba(216,182,92,0.3)", background: c.goldDim })}>LEAGUE</button>
          {leagueOpen && <LeagueEditor league={league} onSave={saveLeague} onClose={() => setLeagueOpen(false)} />}
          <button onClick={() => setView("players")} style={navBtn({ color: c.live, borderColor: "rgba(63,185,139,0.3)", background: c.liveDim })}>PLAYERS</button>
          <button onClick={() => window.open(window.location.pathname + "?view=display", "_blank")} style={navBtn({ color: "#2FA8DC", borderColor: "rgba(47,168,220,0.3)", background: "rgba(47,168,220,0.12)" })}>ARENA</button>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: r.pill, background: connected ? c.liveDim : c.dangerDim, border: `1px solid ${connected ? "rgba(63,185,139,0.3)" : "rgba(222,91,87,0.3)"}`, ...overline({ fontSize: 10.5, color: connected ? c.live : c.danger, letterSpacing: "0.16em" }) }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? c.live : c.danger }} />
            {connected ? "CONNECTED" : "OFFLINE"}
          </div>
          <button className="press" onClick={() => { if (window.confirm("รีเซ็ตเกมทั้งหมด?")) send("resetGame"); }} style={navBtn({ color: c.danger, borderColor: "rgba(222,91,87,0.28)", background: c.dangerDim })}>↺ RESET</button>
        </div>
      </div>

      {/* Overlay Preview */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ ...overline({ fontSize: 9.5, marginBottom: 4 }) }}>OBS OVERLAY PREVIEW</div>
        <OverlayPreview state={state} logoA={logoA} logoB={logoB} league={league} />
      </div>

      <div style={{ height: 1, background: c.line, marginBottom: 12, position: "relative" }} />

      <div style={{ position: "relative" }}>
        <TournamentBridge state={state} send={send} />
      </div>

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 312px 1fr", gap: 12, maxWidth: 1440, margin: "0 auto" }}>
        <TeamCard team={state.teamA} teamKey="teamA" quarter={state.quarter} logoUrl={logoA} onLogoSave={handleLogoSave} />
        <CenterCol state={state} />
        <TeamCard team={state.teamB} teamKey="teamB" quarter={state.quarter} logoUrl={logoB} onLogoSave={handleLogoSave} />
      </div>
    </div>
  );
}
