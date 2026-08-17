// App.jsx — Operator control panel · "Broadcast Console" design system
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db } from "./firebase";
import { ref, onValue, set, get, update } from "firebase/database";
import TournamentBridge from "./TournamentBridge";
import Home from "./Home";
import PlayerManager from "./PlayerManager";
import { useConfirm } from "./ConfirmDialog";
import { c, font, r, shadow, overline, panel, readout, btn, FONT_IMPORT } from "./theme";
import { SPORTS, getSport, isSport, initialState, DEFAULT_SPORT } from "../shared/sports/index.js";
import { LEAGUE_DEFAULT } from "./league";
import { unlockAudio, playHorn, playBuzzer } from "./sound";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const userPath = (uid, path) => `users/${uid}/${path}`;
const logoKey = (teamKey, uid) => `overlay_logo_${teamKey === "teamA" ? "a" : "b"}_${uid}`;

// The live socket connection is created once a signed-in user is known (see
// App's mount effect below) so its auth token can be attached — every nested
// component still calls the module-level send() below, unchanged.
let socket = null;

// ─── Helpers ─────────────────────────────────────────────────
function formatGameClock(tenths, showTenths = true) {
  const t = Math.max(0, tenths);
  if (t > 600 || !showTenths) {
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
function send(type, team, value) { socket?.emit("action", { type, team, value }); }

// Why the socket refused to connect, in words an operator can act on. Without
// this the panel only ever said "OFFLINE" — and since send() above is a silent
// no-op with no socket, every button looked individually broken instead.
function connectErrorReason(err) {
  const msg = err?.message || "";
  // The server rejects the handshake itself (server.js io.use) when the
  // Firebase ID token fails verification — wrong project id, or a signed-out tab.
  if (/invalid token/i.test(msg)) return "เซิร์ฟเวอร์ปฏิเสธ token — ลอง SIGN OUT แล้วเข้าใหม่";
  // A CORS rejection never reaches JS as "CORS"; the browser just fails the
  // poll. Same string covers a server that is asleep or down.
  if (/xhr poll error|websocket error|failed to fetch|timeout/i.test(msg))
    return `ต่อ ${SOCKET_URL} ไม่ได้ — ตรวจ ALLOWED_ORIGINS บนเซิร์ฟเวอร์ หรือเซิร์ฟเวอร์ยังไม่ตื่น`;
  return msg || "เชื่อมต่อไม่สำเร็จ";
}
function getNameFontSize(name = "") {
  const l = name.length;
  return l <= 8 ? 30 : l <= 12 ? 24 : l <= 16 ? 19 : 15;
}

// ─── Small inline icons ──────────────────────────────────────
const Pencil = ({ size = 13, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" />
  </svg>
);

// ─── Logo Picker (Upload + URL) ──────────────────────────────
function LogoPicker({ teamKey, logoUrl, color, onSave, uid }) {
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
    const lsKey = logoKey(teamKey, uid);
    if (v) localStorage.setItem(lsKey, v); else localStorage.removeItem(lsKey);
    setOpen(false);
  };
  const clear = () => { setUrl(""); onSave(teamKey, ""); localStorage.removeItem(logoKey(teamKey, uid)); setOpen(false); };

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

// ─── Games-won pips (badminton / volleyball) ──────────────────
function GamesWonPips({ count, max, color }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{ width: 22, height: 8, borderRadius: 3,
          background: i < count ? color : "rgba(255,255,255,0.05)",
          border: `1px solid ${i < count ? color : c.line}`, transition: "all .18s" }} />
      ))}
    </div>
  );
}

// ─── Card pips (football) ─────────────────────────────────────
const CARD_YELLOW = "#E3C038", CARD_RED = "#D2453C";
function CardPips({ count, color, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{ width: 11, height: 15, borderRadius: 2,
          background: i < count ? color : "rgba(255,255,255,0.05)",
          border: `1px solid ${i < count ? color : c.line}`, transition: "all .18s" }} />
      ))}
    </div>
  );
}

// ─── Editable name line ──────────────────────────────────────
// Used for the team/player name and, in doubles, the partner underneath it.
function NameLine({ value, color, size, action, teamKey }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  const save = () => { send(action, teamKey, draft.toUpperCase()); setEditing(false); };

  if (editing) {
    return <input autoFocus value={draft} maxLength={20}
      onChange={e => setDraft(e.target.value.toUpperCase())}
      onBlur={save} onKeyDown={e => e.key === "Enter" && save()} style={{
        background: "none", border: "none", borderBottom: `2px solid ${color}`, outline: "none",
        color, fontFamily: font.head, fontWeight: 600, fontSize: size, letterSpacing: "0.04em", width: 170 }} />;
  }
  return <span onClick={() => setEditing(true)} style={{ color, cursor: "pointer", flex: 1,
    wordBreak: "break-word", lineHeight: 1.05, fontFamily: font.head, fontWeight: 600,
    fontSize: size, letterSpacing: "0.03em" }}>{value}</span>;
}

// ─── Team Card ────────────────────────────────────────────────
// Renders off the sport's capability flags rather than per-sport branches, so
// a sport without fouls or timeouts simply doesn't get those blocks.
function TeamCard({ team, teamKey, period, sport, state, logoUrl, onLogoSave, uid }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const color = team.color;
  const caps = sport.caps;
  const timeoutMax = sport.timeoutsForPeriod?.(period) ?? team.timeouts;
  const serving = caps.serve && state.serve === teamKey;
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
        <LogoPicker teamKey={teamKey} logoUrl={logoUrl} color={color} onSave={onLogoSave} uid={uid} />
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
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          {caps.fouls && <BonusBadge teamFouls={team.teamFouls} />}
          {serving && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px",
              borderRadius: r.pill, background: c.goldDim, border: `1px solid ${c.gold}55`,
              ...overline({ fontSize: 9.5, color: c.gold, letterSpacing: "0.14em" }) }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.gold }} />
              เสิร์ฟ · {sport.serveCourt?.(team.score)}
            </div>
          )}
        </div>
      </div>

      {/* partner (doubles only) */}
      {caps.doubles && state.doubles && (
        <div style={{ padding: "4px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: c.faint, fontSize: 15, fontFamily: font.head }}>/</span>
          <NameLine value={team.partner || ""} color={color} size={17} action="partnerName" teamKey={teamKey} />
          <Pencil color={c.faint} size={11} />
        </div>
      )}

      {/* score */}
      <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
        <div style={readout(132, color, { fontWeight: 700, lineHeight: 0.9 })}>{team.score}</div>
      </div>

      {/* score buttons */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${sport.scoreSteps.length + 1},1fr)`, gap: 7, padding: "0 14px 14px" }}>
        {sport.scoreSteps.map(v => <button key={v} onClick={() => send("score", teamKey, v)} className="press" style={{ ...btn(color, { active: true }), fontFamily: font.num, fontWeight: 600, fontSize: 22, padding: "13px 0" }}>+{v}</button>)}
        <button onClick={() => send("score", teamKey, -1)} className="press" style={{ ...btn("danger"), fontFamily: font.num, fontWeight: 600, fontSize: 22, padding: "13px 0" }}>−1</button>
      </div>

      <div style={{ height: 1, background: c.line, margin: "0 14px" }} />

      {/* stat blocks */}
      <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {caps.periodWins && (
          <StatBlock>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <div style={overline()}>เกมที่ชนะ</div>
              <div style={readout(28, team.gamesWon > 0 ? c.gold : c.dim, { fontWeight: 700 })}>{team.gamesWon}</div>
            </div>
            <GamesWonPips count={team.gamesWon} max={Math.ceil(sport.maxPeriods / 2)} color={color} />
          </StatBlock>
        )}

        {caps.cards && (
          <StatBlock danger={team.redCards > 0} warn={team.yellowCards >= 3}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <div style={overline()}>ใบเหลือง</div>
              <div style={readout(28, team.yellowCards > 0 ? CARD_YELLOW : c.dim, { fontWeight: 700 })}>{team.yellowCards || 0}</div>
            </div>
            <CardPips count={team.yellowCards || 0} color={CARD_YELLOW} />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => send("yellowCard", teamKey, 1)} className="press" style={{ ...btn(CARD_YELLOW, { active: true }), flex: 1, fontSize: 13, padding: "8px 0" }}>+ ใบเหลือง</button>
              <button onClick={() => send("yellowCard", teamKey, -1)} disabled={(team.yellowCards || 0) <= 0} className="press" style={{ ...btn("neutral"), fontSize: 13, padding: "8px 13px", opacity: (team.yellowCards || 0) <= 0 ? 0.3 : 1 }}>−1</button>
            </div>

            <div style={{ height: 1, background: c.line, margin: "12px 0" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <div style={overline()}>ใบแดง</div>
              <div style={readout(28, team.redCards > 0 ? CARD_RED : c.dim, { fontWeight: 700 })}>{team.redCards || 0}</div>
            </div>
            <CardPips count={team.redCards || 0} color={CARD_RED} max={3} />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => send("redCard", teamKey, 1)} className="press" style={{ ...btn("danger"), flex: 1, fontSize: 13, padding: "8px 0" }}>+ ใบแดง</button>
              <button onClick={() => send("redCard", teamKey, -1)} disabled={(team.redCards || 0) <= 0} className="press" style={{ ...btn("neutral"), fontSize: 13, padding: "8px 13px", opacity: (team.redCards || 0) <= 0 ? 0.3 : 1 }}>−1</button>
            </div>
          </StatBlock>
        )}

        {caps.serve && (
          <StatBlock>
            <div style={{ ...overline({ marginBottom: 9 }) }}>สิทธิ์เสิร์ฟ</div>
            <button onClick={() => send("serve", null, teamKey)} className="press" disabled={serving} style={{
              ...btn(serving ? "gold" : "neutral", { active: serving }), width: "100%", fontSize: 13,
              padding: "9px 0", color: serving ? c.gold : c.mute, cursor: serving ? "default" : "pointer" }}>
              {serving ? `กำลังเสิร์ฟ · ฝั่ง${sport.serveCourt?.(team.score)}` : "ให้ฝั่งนี้เสิร์ฟ"}
            </button>
          </StatBlock>
        )}

        {caps.fouls && (
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
        )}

        {caps.timeouts && (
        <StatBlock>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={overline()}>TIMEOUTS</div>
              <div style={{ fontFamily: font.body, fontSize: 11, color: c.faint, marginTop: 2 }}>{sport.timeoutGroupLabel?.(period)}</div>
            </div>
            <div style={readout(28, c.dim, { fontWeight: 700 })}>{team.timeouts}</div>
          </div>
          <TimeoutPips count={team.timeouts} max={timeoutMax} color={color} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={() => { send("timeout", teamKey, -1); playHorn(); }} disabled={team.timeouts <= 0} className="press" style={{ ...btn(color, { active: true }), flex: 1, fontSize: 13, padding: "8px 0", opacity: team.timeouts <= 0 ? 0.3 : 1 }}>USE T.O.</button>
            <button onClick={() => send("timeout", teamKey, 1)} disabled={team.timeouts >= timeoutMax} className="press" style={{ ...btn("neutral"), fontSize: 13, padding: "8px 16px", opacity: team.timeouts >= timeoutMax ? 0.3 : 1 }}>+1</button>
          </div>
        </StatBlock>
        )}
      </div>
    </div>
  );
}

// ─── Sport switcher ──────────────────────────────────────────
// Reads straight off the registry, so registering a new sport is the only
// thing needed to make it selectable here.
function SportSwitcher({ current, onSwitch }) {
  return (
    <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: r.pill,
      background: c.bgInset, border: `1px solid ${c.line}` }}>
      {Object.values(SPORTS).map(s => {
        const active = s.id === current;
        return (
          <button key={s.id} onClick={() => onSwitch(s.id)} title={`คุมสกอร์${s.label}`} style={{
            ...btn("gold", { active }), padding: "6px 14px", borderRadius: r.pill,
            fontSize: 12, letterSpacing: "0.06em", border: "none",
            background: active ? c.goldDim : "transparent",
            color: active ? c.gold : c.mute, cursor: active ? "default" : "pointer" }}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Keyboard hint chip ──────────────────────────────────────
const Hint = ({ children }) => <span style={{ position: "absolute", right: 7, top: 7, fontFamily: font.body,
  fontSize: 10, fontWeight: 600, color: c.faint, background: "rgba(0,0,0,0.35)", padding: "1px 5px",
  borderRadius: 4, letterSpacing: "0.04em" }}>{children}</span>;

// ─── Center Column (Game Clock, Shot Clock, Presets) ──────────
function CenterCol({ state }) {
  const { clockTenths, isRunning, period, shotClockTenths, shotRunning, possession, jumpBall } = state;
  const shotSec = shotClockTenths / 10;
  const shotUrgent = shotSec <= 5 && shotClockTenths > 0;
  const shotWarn = shotSec <= 10 && shotClockTenths > 0;
  const shotColor = shotUrgent ? c.danger : shotWarn ? c.warn : c.live;

  const gameTimeUp = clockTenths === 0;
  const qLabel = period > 4 ? `OT${period - 4}` : `Q${period}`;

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
            <button onClick={() => { send("clockSet", null, 6000); }} style={mini("gold")}>START 10:00</button>
            <button onClick={() => { send("clockSet", null, 7200); }} style={mini("gold")}>START 12:00</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
            <button onClick={() => { send("clockSet", null, 1200); }} style={mini("#2FA8DC")}>REST 02:00</button>
            <button onClick={() => { send("clockSet", null, 9000); }} style={mini("#2FA8DC")}>HALF 15:00</button>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => { send("clockSet", null, 600); }} style={{ ...mini("warn"), flex: 1 }}>T.O. 60s</button>
            <button onClick={() => { send("clockSet", null, 300); }} style={{ ...mini("warn"), flex: 1 }}>T.O. 30s</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 9 }}>
          {[{l:"+1m",v:600},{l:"+10s",v:100},{l:"+1s",v:10},{l:"+0.1",v:1},{l:"−1m",v:-600},{l:"−10s",v:-100},{l:"−1s",v:-10},{l:"−0.1",v:-1}].map(p=><button key={p.l} onClick={()=>send("clockAdjust",null,p.v)} style={{ ...btn("neutral"), fontSize: 11, padding: "6px 0", color: c.mute }}>{p.l}</button>)}
        </div>

        <div style={{ ...overline({ fontSize: 9.5, marginBottom: 6 }) }}>PERIOD</div>
        <div style={{ display: "flex", gap: 5 }}>
          {[1,2,3,4,5].map(q=><button key={q} onClick={()=>send("period",null,q)} style={{ ...btn("gold", { active: period === q }), flex: 1, padding: "9px 0", fontSize: 14, color: period === q ? c.gold : c.mute }}>{q>4?"OT":`Q${q}`}</button>)}
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

// ─── Center Column · football ─────────────────────────────────
// The clock runs up and keeps going past the end of the half, so "over time"
// is shown as a state rather than as an expiry the way basketball treats 0:00.
function CenterColFootball({ state, sport }) {
  const { clockTenths, isRunning, period } = state;
  const target = sport.periodStart(period) + sport.periodLength;
  const overTime = clockTenths >= target;
  const stoppage = Math.max(0, Math.floor((clockTenths - target) / 600));

  const mini = (tone) => ({ ...btn(tone), fontSize: 11, padding: "7px 0", position: "relative" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={panel({ padding: 16, border: `1px solid ${overTime ? c.gold + "66" : c.line}` })}>
        <div style={{ ...overline({ textAlign: "center", marginBottom: 6, color: overTime ? c.gold : c.mute }) }}>
          เวลาการแข่งขัน
        </div>
        <div style={{ textAlign: "center", ...readout(72, overTime ? c.gold : isRunning ? c.text : c.dim, { fontWeight: 700, lineHeight: 1 }) }}>
          {formatGameClock(clockTenths, false)}
        </div>
        <div style={{ ...overline({ fontSize: 11, marginTop: 6, textAlign: "center", letterSpacing: "0.22em", color: isRunning ? c.live : c.mute }) }}>
          {sport.periodName(period)} · {isRunning ? "กำลังแข่ง" : "หยุด"}
          {overTime && ` · +${stoppage}′`}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 14 }}>
          <button className="press" onClick={() => send("clockToggle")} style={{ ...btn(isRunning ? "danger" : "live", { active: true }), padding: "13px 0", fontSize: 17, position: "relative" }}>
            {isRunning ? "STOP" : "START"}<Hint>SPC</Hint>
          </button>
          <button className="press" onClick={() => send("clockSet", null, sport.periodStart(period))} style={{ ...btn("neutral"), padding: "13px 0", fontSize: 15, color: c.dim }}>
            ตั้งต้นครึ่งนี้
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginTop: 9 }}>
          {[{l:"+1m",v:600},{l:"+10s",v:100},{l:"−10s",v:-100},{l:"−1m",v:-600}].map(p => (
            <button key={p.l} onClick={() => send("clockAdjust", null, p.v)} style={{ ...btn("neutral"), fontSize: 11, padding: "6px 0", color: c.mute }}>{p.l}</button>
          ))}
        </div>
      </div>

      <div style={panel({ padding: "12px 14px" })}>
        <div style={{ ...overline({ fontSize: 9.5, marginBottom: 8 }) }}>ช่วงการแข่งขัน</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {Array.from({ length: sport.maxPeriods }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => send("period", null, p)} style={{
              ...btn("gold", { active: period === p }), padding: "10px 0", fontSize: 13,
              color: period === p ? c.gold : c.mute }}>{sport.periodName(p)}</button>
          ))}
        </div>
        <button onClick={() => { send("period", null, Math.min(period + 1, sport.maxPeriods)); send("clockSet", null, sport.periodStart(Math.min(period + 1, sport.maxPeriods))); }}
          className="press" disabled={period >= sport.maxPeriods}
          style={{ ...mini("gold"), width: "100%", marginTop: 8, padding: "10px 0", fontSize: 12,
            opacity: period >= sport.maxPeriods ? 0.35 : 1 }}>
          จบครึ่งนี้ → เริ่ม{period < sport.maxPeriods ? sport.periodName(period + 1) : "—"}
        </button>
      </div>

      <button className="press" onClick={playHorn} style={{ ...btn("warn", { active: true }), width: "100%", padding: "13px 0", fontSize: 17, letterSpacing: "0.12em", position: "relative" }}>SOUND HORN<Hint>H</Hint></button>
    </div>
  );
}

// ─── Center Column · rally sports (badminton) ─────────────────
// No clock at all here: the score is what advances the match, so the centre
// column is about serve, game number and match status instead.
function CenterColRally({ state, sport }) {
  const { teamA, teamB, period, serve, doubles, matchOver } = state;
  const leader = teamA.gamesWon > teamB.gamesWon ? teamA : teamB.gamesWon > teamA.gamesWon ? teamB : null;
  const gamesNeeded = Math.ceil(sport.maxPeriods / 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Match status */}
      <div style={panel({ padding: "18px 16px", border: `1px solid ${matchOver ? c.gold + "66" : c.line}`,
        background: matchOver ? c.goldDim : c.surface })}>
        <div style={{ ...overline({ textAlign: "center", marginBottom: 4, color: matchOver ? c.gold : c.mute }) }}>
          {matchOver ? "จบแมตช์" : "กำลังแข่ง"}
        </div>
        <div style={{ textAlign: "center", ...readout(matchOver ? 30 : 54, matchOver ? c.gold : c.text, { fontWeight: 700, lineHeight: 1.05 }) }}>
          {matchOver ? `${leader?.name || ""} ชนะ` : sport.periodName(period)}
        </div>
        <div style={{ ...overline({ fontSize: 11, marginTop: 6, textAlign: "center", letterSpacing: "0.2em", color: c.faint }) }}>
          {teamA.gamesWon} – {teamB.gamesWon} · ชนะ {gamesNeeded} เกมจบ
        </div>
      </div>

      {/* Serve */}
      <div style={panel({ padding: "12px 14px" })}>
        <div style={{ ...overline({ fontSize: 9.5, textAlign: "center", marginBottom: 9 }) }}>
          สิทธิ์เสิร์ฟ · แต้มคู่เสิร์ฟฝั่งขวา แต้มคี่เสิร์ฟฝั่งซ้าย
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[["teamA", teamA], ["teamB", teamB]].map(([key, t]) => (
            <button key={key} onClick={() => send("serve", null, serve === key ? null : key)} className="press" style={{
              ...btn(t.color, { active: serve === key }), padding: "10px 0", fontSize: 12, lineHeight: 1.3 }}>
              {t.name}<br />
              <span style={{ fontSize: 10, opacity: 0.75 }}>
                {serve === key ? `ฝั่ง${sport.serveCourt(t.score)}` : "ให้เสิร์ฟ"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Singles / doubles */}
      {sport.caps.doubles && (
        <div style={panel({ padding: "12px 14px" })}>
          <div style={{ ...overline({ fontSize: 9.5, textAlign: "center", marginBottom: 9 }) }}>ประเภท</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={() => doubles && send("setDoubles")} className="press" style={{
              ...btn("gold", { active: !doubles }), padding: "10px 0", fontSize: 13,
              color: !doubles ? c.gold : c.mute }}>เดี่ยว</button>
            <button onClick={() => !doubles && send("setDoubles")} className="press" style={{
              ...btn("gold", { active: doubles }), padding: "10px 0", fontSize: 13,
              color: doubles ? c.gold : c.mute }}>คู่</button>
          </div>
        </div>
      )}

      {/* Game selector — manual correction only; games advance on their own */}
      <div style={panel({ padding: "12px 14px" })}>
        <div style={{ ...overline({ fontSize: 9.5, marginBottom: 8 }) }}>เกมที่ · แก้ไขเมื่อจำเป็น</div>
        <div style={{ display: "flex", gap: 5 }}>
          {Array.from({ length: sport.maxPeriods }, (_, i) => i + 1).map(g => (
            <button key={g} onClick={() => send("period", null, g)} style={{
              ...btn("gold", { active: period === g }), flex: 1, padding: "9px 0", fontSize: 14,
              color: period === g ? c.gold : c.mute }}>{g}</button>
          ))}
        </div>
      </div>

      <button className="press" onClick={playHorn} style={{ ...btn("warn", { active: true }), width: "100%", padding: "13px 0", fontSize: 17, letterSpacing: "0.12em", position: "relative" }}>SOUND HORN<Hint>H</Hint></button>
    </div>
  );
}

// ─── Overlay preview bits (shared look with public/overlay.html) ──
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

// Cards on the overlay sit where basketball's foul dashes go — a yellow bar
// per booking, red ones after them, so a glance reads discipline the same way.
function PvCards({ team, variant }) {
  const away = variant === "away";
  const y = Math.min(team.yellowCards || 0, 4);
  const rd = Math.min(team.redCards || 0, 2);
  if (!y && !rd) return <div style={{ height: 7, marginTop: 5 }} />;
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 5, flexDirection: away ? "row-reverse" : "row" }}>
      {Array.from({ length: y }).map((_, i) => <div key={`y${i}`} style={{ width: 5, height: 7, borderRadius: 1, background: "#E3C038" }} />)}
      {Array.from({ length: rd }).map((_, i) => <div key={`r${i}`} style={{ width: 5, height: 7, borderRadius: 1, background: "#D2453C" }} />)}
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

// ─── Score-pop tracker: fires a {pts, key} pulse whenever `score` increases ──
function useScorePop(score) {
  const prev = useRef(score);
  const [pop, setPop] = useState(null);
  useEffect(() => {
    if (score > prev.current) setPop({ pts: score - prev.current, key: Date.now() });
    prev.current = score;
  }, [score]);
  return pop;
}

// ─── Overlay Preview (mirrors public/overlay.html) ────────────
function OverlayPreview({ state, sport, logoA, logoB, league }) {
  const { teamA, teamB, period, clockTenths, shotClockTenths, possession, jumpBall } = state;
  const caps = sport.caps;
  const shotSec = shotClockTenths / 10;
  const shotUrgent = caps.shotClock && shotSec <= 5 && shotClockTenths > 0;
  // Counting up, zero is the kick-off, not an expiry.
  const gameTimeUp = caps.clock && sport.clockDirection !== "up" && clockTenths === 0;
  const nameSize = (n) => n.length <= 6 ? 18 : n.length <= 10 ? 15 : n.length <= 14 ? 12 : 10;
  const foulsA = Math.min(teamA.teamFouls, 5), bonusA = teamA.teamFouls >= 5;
  const foulsB = Math.min(teamB.teamFouls, 5), bonusB = teamB.teamFouls >= 5;
  const SK = "skewX(-13deg)", SKr = "skewX(13deg)";
  const H = 62;

  const popA = useScorePop(teamA.score);
  const popB = useScorePop(teamB.score);

  // Pop badges live outside the overflow:hidden bar so they can rise freely;
  // position is measured against the actual score number each time it pops.
  const containerRef = useRef(null);
  const scoreARef = useRef(null);
  const scoreBRef = useRef(null);
  const plusARef = useRef(null);
  const plusBRef = useRef(null);

  const firePop = (pop, numRef, plusRef) => {
    if (!pop || !numRef.current || !plusRef.current || !containerRef.current) return;
    const n = numRef.current.getBoundingClientRect();
    const cont = containerRef.current.getBoundingClientRect();
    const el = plusRef.current;
    el.style.left = (n.left - cont.left + n.width / 2) + "px";
    el.style.top = (n.top - cont.top - 2) + "px";
    el.textContent = `+${pop.pts}`;
    el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
  };
  useEffect(() => { firePop(popA, scoreARef, plusARef); }, [popA]);
  useEffect(() => { firePop(popB, scoreBRef, plusBRef); }, [popB]);

  const infoCell = (label, value, color, w, urgent) => (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", borderLeft: `1px solid ${c.line}` }}>
      <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.14em", color: urgent ? c.danger : c.mute, marginBottom: 1 }}>{label}</div>
      <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 19, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
    </div>
  );

  return (
    <div ref={containerRef} style={{ display: "flex", justifyContent: "center", padding: "6px 0", position: "relative" }}>
      <style>{`
        @keyframes ov-plusrise {
          0%   { opacity: 0; transform: translate(-50%, 10px) scale(0.6); }
          18%  { opacity: 1; transform: translate(-50%, -4px) scale(1.2); }
          55%  { opacity: 1; transform: translate(-50%, -22px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -42px) scale(0.95); }
        }
        .ov-plus {
          position: absolute; top: 0; left: 0; z-index: 20; pointer-events: none; opacity: 0;
          font-family: ${font.num}; font-weight: 700; font-size: 17px;
          color: ${GOLD}; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6);
        }
        .ov-plus.go { animation: ov-plusrise 1.1s cubic-bezier(.2,.7,.3,1) forwards; }
        @keyframes ov-bump { 0%{transform:scale(1)} 45%{transform:scale(1.22)} 100%{transform:scale(1)} }
        .ov-bump { animation: ov-bump .34s cubic-bezier(.34,1.56,.64,1); }
      `}</style>

      <div ref={plusARef} className="ov-plus">+0</div>
      <div ref={plusBRef} className="ov-plus">+0</div>

      <div style={{ display: "flex", height: H, background: "#0C0D11", borderRadius: 5,
        border: `1px solid ${c.lineStrong}`, boxShadow: shadow.md, overflow: "hidden" }}>

        <LeagueBlock league={league} />
        <PvLogo logo={logoA} color={teamA.color} letter={teamA.name[0]} />

        {/* home panel */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "0 20px 0 10px", minWidth: 104 }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(165deg,#ffffff 0%,#f2f2ef 55%,#e2e2dd 100%)", transform: SK, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: -1.5, width: 3, background: GOLD, boxShadow: "0 0 6px rgba(228,191,85,0.5)", transform: SK, zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: nameSize(teamA.name), color: "#17181d", lineHeight: 1, whiteSpace: "nowrap" }}>{teamA.name}</div>
            {caps.fouls && <PvDashes count={foulsA} bonus={bonusA} variant="home" />}
            {caps.cards && <PvCards team={teamA} variant="home" />}
            {caps.possession && possession === "teamA" && <div style={{ height: 2, marginTop: 4, width: 28, borderRadius: 2, background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />}
          </div>
        </div>

        <div style={{ width: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0D11" }}>
          <div ref={scoreARef} key={teamA.score} className="ov-bump" style={{ fontFamily: font.num, fontWeight: 700, fontSize: 30, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{teamA.score}</div>
        </div>
        <div style={{ width: 2.5, background: GOLD, transform: SK }} />
        <div style={{ width: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0D11" }}>
          <div ref={scoreBRef} key={teamB.score} className="ov-bump" style={{ fontFamily: font.num, fontWeight: 700, fontSize: 30, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{teamB.score}</div>
        </div>

        {/* away panel */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 10px 0 20px", minWidth: 104 }}>
          <div style={{ position: "absolute", inset: 0, background:
            `radial-gradient(120% 160% at 25% -20%, rgba(255,255,255,0.22), transparent 55%), linear-gradient(165deg, ${teamB.color} 0%, color-mix(in srgb, ${teamB.color} 68%, #000) 65%, color-mix(in srgb, ${teamB.color} 45%, #000) 100%)`,
            transform: SKr, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: -1.5, width: 3, background: GOLD, boxShadow: "0 0 6px rgba(228,191,85,0.5)", transform: SKr, zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: nameSize(teamB.name), color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.35)", lineHeight: 1, whiteSpace: "nowrap" }}>{teamB.name}</div>
            {caps.fouls && <PvDashes count={foulsB} bonus={bonusB} variant="away" />}
            {caps.cards && <PvCards team={teamB} variant="away" />}
            {caps.possession && possession === "teamB" && <div style={{ height: 2, marginTop: 4, width: 28, borderRadius: 2, background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />}
          </div>
        </div>

        <PvLogo logo={logoB} color={teamB.color} letter={teamB.name[0]} />

        {/* info */}
        <div style={{ display: "flex", alignItems: "stretch", background: "linear-gradient(180deg,#15161c,#0a0b0f)" }}>
          <div style={{ width: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {jumpBall && <div style={{ position: "absolute", top: 2, fontFamily: font.label, fontWeight: 800, fontSize: 7, letterSpacing: "0.16em", color: GOLD }}>JUMP</div>}
            <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.14em", color: c.mute, marginBottom: 1 }}>PERIOD</div>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 16, color: GOLD, lineHeight: 1 }}>{sport.periodShort ? sport.periodShort(period) : ordinal(period)}</div>
          </div>
          {caps.clock && infoCell("GAME", formatGameClock(clockTenths, sport.clockShowsTenths), gameTimeUp ? c.danger : "#fff", 66, gameTimeUp)}
          {caps.shotClock && infoCell("SHOT", formatShotClock(shotClockTenths), shotUrgent ? c.danger : GOLD, 48, shotUrgent)}
        </div>
      </div>
    </div>
  );
}

// ─── Overlay Preview · rally sports (mirrors public/overlay.html) ──
// Same bar shell as the basketball preview, minus the clocks: what a rally
// sport needs on screen is games won and who is serving.
function OverlayPreviewRally({ state, sport, logoA, logoB, league }) {
  const { teamA, teamB, period, serve, doubles, matchOver } = state;
  const nameSize = (n) => (n.length <= 6 ? 18 : n.length <= 10 ? 15 : n.length <= 14 ? 12 : 10);
  const SK = "skewX(-13deg)", SKr = "skewX(13deg)";
  const H = 62;
  const gamesNeeded = Math.ceil(sport.maxPeriods / 2);

  const gamePips = (won, variant) => (
    <div style={{ display: "flex", gap: 4, marginTop: 5, flexDirection: variant === "away" ? "row-reverse" : "row" }}>
      {Array.from({ length: gamesNeeded }).map((_, i) => (
        <div key={i} style={{ width: 13, height: 3.5, borderRadius: 2,
          background: i < won ? GOLD : (variant === "away" ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.16)") }} />
      ))}
    </div>
  );

  const nameOf = (t) => (doubles && t.partner ? `${t.name} / ${t.partner}` : t.name);

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "6px 0", position: "relative" }}>
      <div style={{ display: "flex", height: H, background: "#0C0D11", borderRadius: 5,
        border: `1px solid ${c.lineStrong}`, boxShadow: shadow.md, overflow: "hidden" }}>

        <LeagueBlock league={league} />
        <PvLogo logo={logoA} color={teamA.color} letter={teamA.name[0]} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "0 20px 0 10px", minWidth: 104 }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(165deg,#ffffff 0%,#f2f2ef 55%,#e2e2dd 100%)", transform: SK, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: -1.5, width: 3, background: GOLD, boxShadow: "0 0 6px rgba(228,191,85,0.5)", transform: SK, zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: nameSize(nameOf(teamA)), color: "#17181d", lineHeight: 1, whiteSpace: "nowrap" }}>{nameOf(teamA)}</div>
            {gamePips(teamA.gamesWon, "home")}
            {serve === "teamA" && <div style={{ height: 2, marginTop: 4, width: 28, borderRadius: 2, background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />}
          </div>
        </div>

        <div style={{ width: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0D11" }}>
          <div key={teamA.score} className="ov-bump" style={{ fontFamily: font.num, fontWeight: 700, fontSize: 30, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{teamA.score}</div>
        </div>
        <div style={{ width: 2.5, background: GOLD, transform: SK }} />
        <div style={{ width: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0D11" }}>
          <div key={teamB.score} className="ov-bump" style={{ fontFamily: font.num, fontWeight: 700, fontSize: 30, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{teamB.score}</div>
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 10px 0 20px", minWidth: 104 }}>
          <div style={{ position: "absolute", inset: 0, background:
            `radial-gradient(120% 160% at 25% -20%, rgba(255,255,255,0.22), transparent 55%), linear-gradient(165deg, ${teamB.color} 0%, color-mix(in srgb, ${teamB.color} 68%, #000) 65%, color-mix(in srgb, ${teamB.color} 45%, #000) 100%)`,
            transform: SKr, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: -1.5, width: 3, background: GOLD, boxShadow: "0 0 6px rgba(228,191,85,0.5)", transform: SKr, zIndex: 2 }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: nameSize(nameOf(teamB)), color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.35)", lineHeight: 1, whiteSpace: "nowrap" }}>{nameOf(teamB)}</div>
            {gamePips(teamB.gamesWon, "away")}
            {serve === "teamB" && <div style={{ height: 2, marginTop: 4, width: 28, borderRadius: 2, background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />}
          </div>
        </div>

        <PvLogo logo={logoB} color={teamB.color} letter={teamB.name[0]} />

        <div style={{ display: "flex", alignItems: "stretch", background: "linear-gradient(180deg,#15161c,#0a0b0f)" }}>
          <div style={{ width: 74, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ fontFamily: font.label, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.14em", color: c.mute, marginBottom: 1 }}>
              {matchOver ? "RESULT" : sport.periodLabel}
            </div>
            <div style={{ fontFamily: font.num, fontWeight: 700, fontSize: 16, color: GOLD, lineHeight: 1 }}>
              {matchOver ? `${teamA.gamesWon}–${teamB.gamesWon}` : period}
            </div>
          </div>
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
          <input value={line1} maxLength={18} onChange={e => setLine1(e.target.value.toUpperCase())} placeholder="เช่น BANGMOD OPEN" style={inp} />
        </div>
        <div>
          <div style={{ ...overline({ fontSize: 9, marginBottom: 4 }) }}>บรรทัด 2</div>
          <input value={line2} maxLength={18} onChange={e => setLine2(e.target.value.toUpperCase())} placeholder="เช่น รอบชิงชนะเลิศ" style={inp} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...overline({ fontSize: 9, marginBottom: 4 }) }}>ปี / รุ่น</div>
        <input value={year} maxLength={10} onChange={e => setYear(e.target.value)} placeholder={LEAGUE_DEFAULT.year} style={inp} />
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
export default function App({ user, uid, onSignOut }) {
  const DB_PATH     = userPath(uid, "player_data");
  const LEAGUE_PATH = userPath(uid, "overlay_config/league");
  const SPORT_PATH  = userPath(uid, "sport");
  const LOGO_KEY_A  = logoKey("teamA", uid);
  const LOGO_KEY_B  = logoKey("teamB", uid);

  const [view, setView] = useState("home");
  // Placeholder until the server's first stateUpdate lands (milliseconds) —
  // built from the same registry the server uses, so the two can't drift.
  const [state, setState] = useState(() => initialState(DEFAULT_SPORT));
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState("");
  const [logoA, setLogoA] = useState(() => localStorage.getItem(LOGO_KEY_A) || "");
  const [logoB, setLogoB] = useState(() => localStorage.getItem(LOGO_KEY_B) || "");
  const [league, setLeague] = useState(LEAGUE_DEFAULT);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copiedWhich, setCopiedWhich] = useState(null);
  const [savedSport, setSavedSport] = useState(null);
  const [askConfirm, confirmDialog] = useConfirm();

  const sport = getSport(state.sport);

  const prevGameClock  = useRef(state.clockTenths);
  const prevShotClock  = useRef(state.shotClockTenths);
  const prevPeriodRef = useRef(state.period);
  const sportSyncedRef = useRef(false);

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
  }, [uid]);

  // Offer a one-time, manual import of the old shared/global data into this
  // account's own namespace — only if this account hasn't got any data yet.
  useEffect(() => {
    get(ref(db, DB_PATH)).then(snap => { if (!snap.exists()) setShowImport(true); }).catch(() => {});
  }, [uid]);

  // Which sport this account last chose. Game state lives only in the server's
  // memory, so a restart (or a Render cold start) brings the room back as the
  // default sport — this is the durable copy used to put it back.
  useEffect(() => {
    let cancelled = false;
    get(ref(db, SPORT_PATH))
      .then(snap => { const v = snap.val(); if (!cancelled && isSport(v)) setSavedSport(v); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [uid]);

  // Reconcile once per session: if the live room isn't on this account's saved
  // sport, switch it. Deliberately one-shot — re-running on every reconnect
  // could wipe a game the operator switched deliberately in another tab.
  useEffect(() => {
    if (!connected || !savedSport || sportSyncedRef.current) return;
    sportSyncedRef.current = true;
    if (savedSport !== state.sport) send("setSport", null, savedSport);
  }, [connected, savedSport, state.sport]);

  // Every mutation happens on the server, so with no socket send() drops the
  // action on the floor. Asking "are you sure?" first would be a lie — the
  // operator confirms, the dialog closes, and nothing has happened. Say why.
  const requireConnection = () => {
    if (connected) return true;
    askConfirm({
      notice: true,
      tone: "danger",
      title: "ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์",
      body: `${connError || "socket ยังไม่ได้ต่อ"}\n\nระหว่างนี้คำสั่งทุกอย่าง (เปลี่ยนกีฬา คะแนน นาฬิกา) จะยังไม่มีผล จนกว่าป้ายจะกลับเป็น CONNECTED`,
    });
    return false;
  };

  const switchSport = (id) => {
    if (id === state.sport) return;
    if (!requireConnection()) return;
    askConfirm({
      title: `เปลี่ยนเป็น${getSport(id).label}?`,
      body: "เกมปัจจุบันจะถูกล้างทั้งหมด\nชื่อทีมและสีจะเก็บไว้ให้",
      confirmLabel: `เปลี่ยนเป็น${getSport(id).label}`,
      tone: "gold",
      onConfirm: () => {
        setSavedSport(id);
        send("setSport", null, id);
        set(ref(db, SPORT_PATH), id).catch(console.error);
      },
    });
  };

  const importLegacyData = async () => {
    setImporting(true);
    try {
      const [pd, lg, td] = await Promise.all([
        get(ref(db, "player_data")),
        get(ref(db, "overlay_config/league")),
        get(ref(db, "tournament_data")),
      ]);
      const updates = {};
      if (pd.exists()) updates[DB_PATH] = pd.val();
      if (lg.exists()) updates[LEAGUE_PATH] = lg.val();
      if (td.exists()) updates[userPath(uid, "tournament_data")] = td.val();
      if (Object.keys(updates).length) await update(ref(db), updates);
      setShowImport(false);
    } catch (e) {
      console.error(e);
      alert("นำเข้าข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setImporting(false);
    }
  };

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

  const copyLink = async (which, url) => {
    try { await navigator.clipboard.writeText(url); setCopiedWhich(which); setTimeout(() => setCopiedWhich(null), 1800); }
    catch { window.prompt("คัดลอกลิงก์นี้:", url); }
  };

  // Buzzer on expiry — only meaningful for a sport that has clocks at all.
  useEffect(() => {
    if (!sport.caps.clock) return;
    if (prevGameClock.current > 0 && state.clockTenths === 0) playBuzzer();
    if (prevShotClock.current > 0 && state.shotClockTenths === 0) playHorn();
    prevGameClock.current = state.clockTenths;
    prevShotClock.current = state.shotClockTenths;
  }, [state.clockTenths, state.shotClockTenths, sport]);

  // Top the teams back up to the timeout allowance for the new period. How many
  // that is belongs to the sport's rulebook, not here — a sport that doesn't
  // define it (no per-period allowance) simply opts out.
  useEffect(() => {
    if (prevPeriodRef.current === state.period) return;
    prevPeriodRef.current = state.period;
    if (!sport.timeoutsForPeriod) return;
    const t = sport.timeoutsForPeriod(state.period);
    ["teamA", "teamB"].forEach(key => {
      const cnt = key === "teamA" ? state.teamA.timeouts : state.teamB.timeouts;
      const d = t - cnt;
      if (d > 0) for (let i = 0; i < d; i++) send("timeout", key, 1);
      else if (d < 0) for (let i = 0; i < Math.abs(d); i++) send("timeout", key, -1);
    });
  }, [state.period]);

  useEffect(() => {
    const kd = (e) => {
      if (e.target.tagName === "INPUT" || view !== "control") return;
      // A keypress is a user gesture as much as a click is; without this an
      // operator who only ever uses the keyboard would reach 0:00 with the
      // buzzer still unprimed, and the browser would refuse to sound it.
      unlockAudio();
      // Don't fire shortcuts for controls this sport doesn't have — the server
      // would reject the action anyway, and a dead keypress is confusing.
      switch (e.code) {
        case "Space": if (!sport.caps.clock) return; e.preventDefault(); send("clockToggle"); break;
        case "KeyC":  if (!sport.caps.shotClock) return; e.preventDefault(); send("shotClockToggle"); break;
        case "KeyZ":  if (!sport.caps.shotClock) return; e.preventDefault(); send("shotClockSet", null, 24); break;
        case "KeyX":  if (!sport.caps.shotClock) return; e.preventDefault(); send("shotClockSet", null, 14); break;
        case "KeyH":  e.preventDefault(); playHorn(); break;
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [view, sport]);

  // The control socket carries the signed-in user's Firebase ID token so the
  // server can verify it and scope every "action" to this account's own room.
  // Passed as a callback (not a static value) so a refreshed/expired token is
  // picked up automatically on reconnect.
  useEffect(() => {
    socket = io(SOCKET_URL, {
      reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: Infinity,
      auth: async (cb) => {
        try { cb({ token: await user.getIdToken() }); }
        catch { cb({ token: null }); }
      },
    });
    socket.on("connect", () => { setConnected(true); setConnError(""); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => { setConnected(false); setConnError(connectErrorReason(err)); });
    socket.on("stateUpdate", (s) => {
      if (!s?.teamA) return;
      setState({ ...s, teamA: { techFouls: 0, ...s.teamA }, teamB: { techFouls: 0, ...s.teamB } });
    });
    return () => { socket.disconnect(); socket = null; };
  }, [user]);

  const overlayUrl = `${SOCKET_URL}/overlay?u=${uid}`;
  const arenaUrl = `${window.location.origin}${window.location.pathname}?view=display&u=${uid}`;

  const handleNavigate = (dest) => {
    // The overlay and the arena board are both *second screens* — an OBS
    // browser source and the venue TV. Neither belongs inside the operator's
    // window, so both open standalone rather than replacing this view.
    if (dest === "overlay") { window.open(overlayUrl, "_blank"); return; }
    if (dest === "display") { window.open(arenaUrl, "_blank"); return; }
    setView(dest);
  };

  if (view === "home") return <Home onNavigate={handleNavigate} />;
  if (view === "players") return <PlayerManager onBack={() => setView("home")} uid={uid} />;

  const navBtn = (extra = {}) => ({ ...btn("neutral"), padding: "7px 15px", borderRadius: r.pill, fontSize: 12, letterSpacing: "0.1em", ...extra });

  return (
    <div onClick={unlockAudio} style={{ minHeight: "100vh", background: c.bg, color: c.text, padding: 16, fontFamily: font.body, position: "relative" }}>
      {confirmDialog}
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
              {sport.labelEn} <span style={{ color: c.dim, fontWeight: 300 }}>SCOREBOARD</span>
            </div>
            <div style={{ ...overline({ fontSize: 9.5, marginTop: 3, letterSpacing: "0.36em" }) }}>LIVE BROADCAST CONTROL</div>
          </div>
          <SportSwitcher current={state.sport} onSwitch={switchSport} />
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setLeagueOpen(o => !o)} style={navBtn({ color: c.gold, borderColor: "rgba(216,182,92,0.3)", background: c.goldDim })}>LEAGUE</button>
          {leagueOpen && <LeagueEditor league={league} onSave={saveLeague} onClose={() => setLeagueOpen(false)} />}
          <button onClick={() => setView("players")} style={navBtn({ color: c.live, borderColor: "rgba(63,185,139,0.3)", background: c.liveDim })}>PLAYERS</button>
          <button onClick={() => window.open(arenaUrl, "_blank")} style={navBtn({ color: "#2FA8DC", borderColor: "rgba(47,168,220,0.3)", background: "rgba(47,168,220,0.12)" })}>ARENA</button>
          <button className="press" onClick={() => copyLink("overlay", overlayUrl)} style={navBtn({ color: c.mute })}>
            {copiedWhich === "overlay" ? "คัดลอกแล้ว ✓" : "COPY OVERLAY LINK"}
          </button>
          <button className="press" onClick={() => copyLink("arena", arenaUrl)} style={navBtn({ color: c.mute })}>
            {copiedWhich === "arena" ? "คัดลอกแล้ว ✓" : "COPY ARENA LINK"}
          </button>
          <div title={connected ? "" : connError} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: r.pill, background: connected ? c.liveDim : c.dangerDim, border: `1px solid ${connected ? "rgba(63,185,139,0.3)" : "rgba(222,91,87,0.3)"}`, ...overline({ fontSize: 10.5, color: connected ? c.live : c.danger, letterSpacing: "0.16em" }) }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? c.live : c.danger }} />
            {connected ? "CONNECTED" : "OFFLINE"}
          </div>
          <button className="press" onClick={() => requireConnection() && askConfirm({
            title: "รีเซ็ตเกมทั้งหมด?",
            body: "คะแนน นาฬิกา และสถิติทุกอย่างจะกลับไปเริ่มใหม่\nชื่อทีมและสีจะเก็บไว้ให้",
            confirmLabel: "รีเซ็ตเกม",
            onConfirm: () => send("resetGame"),
          })} style={navBtn({ color: c.danger, borderColor: "rgba(222,91,87,0.28)", background: c.dangerDim })}>↺ RESET</button>
          <div style={{ width: 1, height: 20, background: c.line, margin: "0 2px" }} />
          <div style={{ ...overline({ fontSize: 10, color: c.faint, letterSpacing: "0.04em", textTransform: "none" }) }}>{user?.email}</div>
          <button className="press" onClick={onSignOut} style={navBtn({ color: c.mute })}>SIGN OUT</button>
        </div>
      </div>

      {/* Why the panel is OFFLINE. The pill alone sent operators hunting for a
          broken button, when in fact no button can work without the socket. */}
      {!connected && connError && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
          padding: "10px 14px", borderRadius: r.md, background: c.dangerDim, border: `1px solid rgba(222,91,87,0.3)` }}>
          <div style={{ ...overline({ fontSize: 10, color: c.danger, letterSpacing: "0.16em" }) }}>OFFLINE</div>
          <div style={{ flex: 1, fontSize: 13, color: c.dim, fontFamily: font.body }}>{connError}</div>
        </div>
      )}

      {/* Import legacy shared data (one-time, manual, opt-in) */}
      {showImport && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
          padding: "10px 14px", borderRadius: r.md, background: c.goldDim, border: `1px solid rgba(228,191,85,0.3)` }}>
          <div style={{ flex: 1, fontSize: 13, color: c.dim, fontFamily: font.body }}>
            พบข้อมูลทีม/โลโก้/รายการที่เคยตั้งค่าไว้ก่อนหน้านี้ — นำเข้ามาใช้กับบัญชีนี้ไหม?
          </div>
          <button className="press" disabled={importing} onClick={importLegacyData} style={{ ...btn("gold", { active: true }), padding: "7px 16px", fontSize: 12 }}>
            {importing ? "กำลังนำเข้า…" : "นำเข้าข้อมูล"}
          </button>
          <button onClick={() => setShowImport(false)} style={{ ...btn("neutral"), padding: "7px 12px", fontSize: 12, color: c.mute }}>ข้าม</button>
        </div>
      )}

      {/* Overlay Preview */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ ...overline({ fontSize: 9.5, marginBottom: 4 }) }}>OBS OVERLAY PREVIEW</div>
        {sport.caps.clock
          ? <OverlayPreview state={state} sport={sport} logoA={logoA} logoB={logoB} league={league} />
          : <OverlayPreviewRally state={state} sport={sport} logoA={logoA} logoB={logoB} league={league} />}
      </div>

      <div style={{ height: 1, background: c.line, marginBottom: 12, position: "relative" }} />

      {sport.caps.tournament && (
        <div style={{ position: "relative" }}>
          <TournamentBridge state={state} send={send} uid={uid} />
        </div>
      )}

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 312px 1fr", gap: 12, maxWidth: 1440, margin: "0 auto" }}>
        <TeamCard team={state.teamA} teamKey="teamA" period={state.period} sport={sport} state={state} logoUrl={logoA} onLogoSave={handleLogoSave} uid={uid} />
        {sport.caps.shotClock ? <CenterCol state={state} />
          : sport.caps.clock ? <CenterColFootball state={state} sport={sport} />
          : <CenterColRally state={state} sport={sport} />}
        <TeamCard team={state.teamB} teamKey="teamB" period={state.period} sport={sport} state={state} logoUrl={logoB} onLogoSave={handleLogoSave} uid={uid} />
      </div>
    </div>
  );
}
