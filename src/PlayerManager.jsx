// PlayerManager.jsx — roster & fouls · "Broadcast Console" design system
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { c, font, r, shadow, overline, panel, btn, FONT_IMPORT } from "./theme";

const MAX_PLAYERS = 16;
const userPath = (uid, path) => `users/${uid}/${path}`;
const logoKey = (teamKey, uid) => `overlay_logo_${teamKey === "teamA" ? "a" : "b"}_${uid}`;

const TEAM_DEFAULTS = {
  teamA: { name: "HOME", color: "#E86A3A", logo: "" },
  teamB: { name: "AWAY", color: "#2FA8DC", logo: "" },
};

const newPlayer = (n) => ({ num: "", name: n ? `PLAYER ${n}` : "", fouls: 0 });

const defaultTeamData = (key) => ({
  ...TEAM_DEFAULTS[key],
  players: Array.from({ length: 5 }, (_, i) => newPlayer(i + 1)),
});

// ─── Helpers ──────────────────────────────────────────────────
const foulColor = (f) => f >= 5 ? c.danger : f >= 4 ? c.warn : f >= 3 ? c.gold : null;
const foulLabel = (f) => f >= 5 ? "FOUL OUT" : f >= 4 ? "4th" : f >= 3 ? "3rd" : null;

// ─── Inline Foul Counter ──────────────────────────────────────
function FoulCounter({ value, color, onChange }) {
  const fc = foulColor(value) || c.dim;
  return (
    <div style={{ display: "flex", alignItems: "center",
      background: c.bgInset, borderRadius: r.sm,
      border: `1px solid ${value >= 3 ? fc + "55" : c.line}`,
      overflow: "hidden", transition: "border-color .2s" }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} style={{
        width: 34, height: 34, border: "none",
        background: value > 0 ? c.dangerDim : "transparent",
        color: value > 0 ? c.danger : c.faint,
        fontSize: 19, cursor: value > 0 ? "pointer" : "default", fontFamily: font.body,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>

      <div style={{ width: 34, textAlign: "center", fontFamily: font.num, fontSize: 19,
        fontWeight: 700, color: fc, transition: "color .2s", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>

      <button onClick={() => onChange(Math.min(5, value + 1))} disabled={value >= 5} style={{
        width: 34, height: 34, border: "none",
        background: value < 5 ? color + "1A" : "transparent",
        color: value < 5 ? color : c.faint,
        fontSize: 19, cursor: value < 5 ? "pointer" : "default", fontFamily: font.body,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
    </div>
  );
}

// ─── Foul Pips (5 dots) ───────────────────────────────────────
function FoulPips({ count, color }) {
  const fc = foulColor(count) || color;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%",
          background: i <= count ? fc : "rgba(255,255,255,0.06)",
          border: `1px solid ${i <= count ? fc : c.line}`, transition: "all .2s", flexShrink: 0 }} />
      ))}
    </div>
  );
}

// ─── Logo Input ───────────────────────────────────────────────
function LogoInput({ value, color, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [inputVal, setInputVal] = useState(value || "");
  const hasLogo = !!value;

  const apply = () => { onChange(inputVal.trim()); setExpanded(false); };
  const clear = () => { setInputVal(""); onChange(""); setExpanded(false); };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setExpanded(e => !e)} title={hasLogo ? "เปลี่ยนโลโก้" : "เพิ่มโลโก้"} style={{
        width: 44, height: 44, borderRadius: r.md,
        background: hasLogo ? c.surface2 : color + "12",
        border: `1px solid ${hasLogo ? color + "55" : c.line}`,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flexShrink: 0, transition: "border-color .2s" }}>
        {hasLogo
          ? <img src={value} alt="logo" style={{ width: 38, height: 38, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.mute} strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/></svg>}
      </button>

      {expanded && (
        <div style={{ position: "absolute", top: 52, left: 0, zIndex: 200, background: c.surface,
          border: `1px solid ${c.lineStrong}`, borderRadius: r.md, padding: 12, width: 288, boxShadow: shadow.lg }}>
          <div style={{ ...overline({ marginBottom: 8 }) }}>URL รูปภาพโลโก้</div>
          <input autoFocus value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === "Enter" && apply()} placeholder="https://…" style={{
            width: "100%", background: c.surface2, border: `1px solid ${c.line}`, borderRadius: r.sm,
            color: c.text, fontFamily: font.body, fontSize: 13, padding: "9px 11px", outline: "none", marginBottom: 10 }} />
          {inputVal && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, padding: 8, background: c.bgInset, borderRadius: r.sm }}>
              <img src={inputVal} alt="preview" style={{ height: 42, objectFit: "contain" }} onError={e => e.target.src = ""} />
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={apply} style={{ ...btn(color, { active: true }), flex: 1, padding: "9px 0", fontSize: 13 }}>ตั้งค่า</button>
            {hasLogo && <button onClick={clear} style={{ ...btn("danger"), padding: "9px 13px", fontSize: 13 }}>ลบ</button>}
            <button onClick={() => setExpanded(false)} style={{ ...btn("neutral"), padding: "9px 13px", fontSize: 13, color: c.mute }}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Player Row ───────────────────────────────────────────────
function PlayerRow({ player, index, color, onChange, onRemove, canRemove }) {
  const isDQ = player.fouls >= 5;
  const fc   = foulColor(player.fouls);
  const fl   = foulLabel(player.fouls);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 108px 16px", alignItems: "center",
      gap: 8, padding: "9px 14px", borderBottom: `1px solid ${c.lineSoft}`,
      background: isDQ ? "rgba(222,91,87,0.07)" : index % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
      transition: "background .3s" }}>

      <input value={player.num} maxLength={3} onChange={e => onChange({ ...player, num: e.target.value })} placeholder="#" style={{
        background: "transparent", border: "none", borderBottom: `1.5px solid ${color}35`, outline: "none",
        color, fontFamily: font.num, fontSize: 19, fontWeight: 700, textAlign: "center", width: "100%",
        padding: "2px 0", fontVariantNumeric: "tabular-nums" }}
        onFocus={e => e.target.style.borderBottomColor = color}
        onBlur={e => e.target.style.borderBottomColor = `${color}35`} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <input value={player.name} maxLength={20} onChange={e => onChange({ ...player, name: e.target.value.toUpperCase() })} placeholder={`PLAYER ${index + 1}`} style={{
          background: "transparent", border: "none", borderBottom: `1.5px solid ${c.line}`, outline: "none",
          color: isDQ ? "rgba(222,91,87,0.75)" : c.text, fontFamily: font.body, fontSize: 15, fontWeight: 600,
          letterSpacing: "0.01em", width: "100%", padding: "2px 0",
          textDecoration: isDQ ? "line-through" : "none", transition: "border-color .15s" }}
          onFocus={e => e.target.style.borderBottomColor = c.lineStrong}
          onBlur={e => e.target.style.borderBottomColor = c.line} />
        <FoulPips count={player.fouls} color={color} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <FoulCounter value={player.fouls} color={color} onChange={v => onChange({ ...player, fouls: v })} />
        {fl && <span style={{ ...overline({ fontSize: 9, color: fc, letterSpacing: "0.12em" }),
          background: `${fc}18`, border: `1px solid ${fc}3A`, padding: "1px 6px", borderRadius: 3 }}>{fl}</span>}
      </div>

      <button onClick={onRemove} disabled={!canRemove} title="ลบผู้เล่น" style={{
        width: 20, height: 20, border: "none", background: "none", color: "rgba(222,91,87,0.3)",
        cursor: canRemove ? "pointer" : "default", fontSize: 15, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: canRemove ? 1 : 0.2, transition: "color .15s", flexShrink: 0 }}
        onMouseEnter={e => canRemove && (e.currentTarget.style.color = c.danger)}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(222,91,87,0.3)"}>✕</button>
    </div>
  );
}

// ─── Team Panel ───────────────────────────────────────────────
function TeamPanel({ teamKey, data, saveStatus, onUpdate }) {
  const color   = data.color || TEAM_DEFAULTS[teamKey].color;
  const players = data.players || [];

  const updatePlayer = (idx, newP) => onUpdate(teamKey, { ...data, players: players.map((p, i) => i === idx ? newP : p) });
  const addPlayer = () => { if (players.length >= MAX_PLAYERS) return; onUpdate(teamKey, { ...data, players: [...players, newPlayer(players.length + 1)] }); };
  const removePlayer = (idx) => { if (players.length <= 1) return; onUpdate(teamKey, { ...data, players: players.filter((_, i) => i !== idx) }); };
  const resetFouls = () => { if (!confirm(`Reset ฟาวล์ผู้เล่นทั้งหมดในทีม ${data.name}?`)) return; onUpdate(teamKey, { ...data, players: players.map(p => ({ ...p, fouls: 0 })) }); };

  const totalFouls  = players.reduce((s, p) => s + (p.fouls || 0), 0);
  const fouledOut   = players.filter(p => (p.fouls || 0) >= 5).length;
  const atRisk      = players.filter(p => (p.fouls || 0) >= 3 && (p.fouls || 0) < 5).length;

  const statusColor = { saving: c.mute, saved: c.live, error: c.danger };
  const statusTxt   = { saving: "กำลังบันทึก…", saved: "บันทึกแล้ว", error: "Error" };

  return (
    <div style={panel({ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%", boxShadow: shadow.sm })}>
      <div style={{ height: 3, background: color }} />

      {/* HEADER */}
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${c.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <LogoInput value={data.logo || ""} color={color} onChange={logoUrl => onUpdate(teamKey, { ...data, logo: logoUrl })} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={data.name} maxLength={24} onChange={e => onUpdate(teamKey, { ...data, name: e.target.value.toUpperCase() })} placeholder="TEAM NAME" style={{
              background: "transparent", border: "none", borderBottom: `2px solid ${color}45`, outline: "none",
              color, fontFamily: font.head, fontWeight: 600, fontSize: 24, letterSpacing: "0.03em", width: "100%", padding: "2px 0" }} />
            <div style={{ ...overline({ fontSize: 9, marginTop: 4, letterSpacing: "0.32em" }) }}>
              {teamKey === "teamA" ? "HOME TEAM" : "AWAY TEAM"}
            </div>
          </div>
          {saveStatus && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, ...overline({ fontSize: 10.5, color: statusColor[saveStatus], letterSpacing: "0.08em" }), flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor[saveStatus],
                animation: saveStatus === "saving" ? "pm-pulse 1s ease-in-out infinite" : "none" }} />
              {statusTxt[saveStatus]}
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
          {[
            { label: "PLAYERS", value: players.length, color: c.dim },
            { label: "AT RISK", value: atRisk, color: atRisk > 0 ? c.gold : c.mute },
            { label: "FOUL OUT", value: fouledOut, color: fouledOut > 0 ? c.danger : c.mute },
          ].map(s => (
            <div key={s.label} style={{ background: c.bgInset, borderRadius: r.sm, padding: "8px 10px", textAlign: "center", border: `1px solid ${c.line}` }}>
              <div style={{ fontFamily: font.num, fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              <div style={{ ...overline({ fontSize: 8.5, marginTop: 3, letterSpacing: "0.18em" }) }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMN HEADERS */}
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 108px 16px", gap: 8, padding: "7px 14px",
        background: c.bgInset, borderBottom: `1px solid ${c.line}` }}>
        {["#", "ชื่อผู้เล่น / FOULS", "ฟาวล์", ""].map((h, i) => (
          <div key={i} style={{ ...overline({ fontSize: 8.5, letterSpacing: "0.16em", textAlign: i === 2 ? "center" : "left" }) }}>{h}</div>
        ))}
      </div>

      {/* PLAYER LIST */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {players.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", ...overline({ fontSize: 12, color: c.faint, letterSpacing: "0.08em" }) }}>กด “เพิ่มผู้เล่น” เพื่อเริ่มต้น</div>
        ) : (
          players.map((p, i) => (
            <PlayerRow key={i} player={p} index={i} color={color}
              onChange={np => updatePlayer(i, np)} onRemove={() => removePlayer(i)} canRemove={players.length > 1} />
          ))
        )}
      </div>

      {/* FOOTER */}
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${c.line}`, background: c.bgInset, display: "flex", gap: 8 }}>
        <button onClick={addPlayer} disabled={players.length >= MAX_PLAYERS} className="press" style={{
          ...btn(color, { active: true }), flex: 1, padding: "10px 0", fontSize: 13, letterSpacing: "0.06em",
          cursor: players.length >= MAX_PLAYERS ? "not-allowed" : "pointer", opacity: players.length >= MAX_PLAYERS ? 0.35 : 1 }}>
          + เพิ่มผู้เล่น ({players.length}/{MAX_PLAYERS})
        </button>
        <button onClick={resetFouls} className="press" style={{ ...btn("danger"), padding: "10px 14px", fontSize: 13 }}>↺ RESET</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PlayerManager({ onBack, uid }) {
  const DB_PATH = userPath(uid, "player_data");

  const [dataA, setDataA] = useState(defaultTeamData("teamA"));
  const [dataB, setDataB] = useState(defaultTeamData("teamB"));
  const [saveStatusA, setSaveStatusA] = useState(null);
  const [saveStatusB, setSaveStatusB] = useState(null);
  const [connected,   setConnected]   = useState(false);
  const [lastSync,    setLastSync]    = useState(null);

  const editingA = useRef(false);
  const editingB = useRef(false);
  const pendingA = useRef(null);
  const pendingB = useRef(null);

  useEffect(() => {
    const parse = (d, key) => ({
      name:    d?.name    || TEAM_DEFAULTS[key].name,
      color:   d?.color   || TEAM_DEFAULTS[key].color,
      logo:    d?.logo    || "",
      players: Array.isArray(d?.players) ? d.players : defaultTeamData(key).players,
    });
    // Skip applying a remote snapshot while this client has an unsaved local edit
    // in flight (debounced save pending) so it doesn't get stomped mid-typing —
    // but always accept remote updates otherwise, so multi-client edits stay live.
    const uA = onValue(ref(db, `${DB_PATH}/teamA`), (snap) => {
      if (!editingA.current) setDataA(parse(snap.val(), "teamA"));
      setLastSync(new Date());
    });
    const uB = onValue(ref(db, `${DB_PATH}/teamB`), (snap) => {
      if (!editingB.current) setDataB(parse(snap.val(), "teamB"));
      setLastSync(new Date());
    });
    const uConn = onValue(ref(db, ".info/connected"), (snap) => setConnected(!!snap.val()));
    return () => { uA(); uB(); uConn(); };
  }, [uid]);

  const saveTeam = useCallback(async (teamKey, data, setStatus) => {
    setStatus("saving");
    try {
      const lsKey = logoKey(teamKey, uid);
      if (data.logo) localStorage.setItem(lsKey, data.logo);
      else localStorage.removeItem(lsKey);

      await set(ref(db, `${DB_PATH}/${teamKey}`), {
        name:      data.name,
        color:     data.color,
        logo:      data.logo || "",
        players:   data.players.map(p => ({ num: p.num || "", name: p.name || "", fouls: p.fouls || 0 })),
        updatedAt: Date.now(),
      });
      setStatus("saved");
      setLastSync(new Date());
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
    }
  }, [uid, DB_PATH]);

  const handleUpdate = useCallback((teamKey, newData) => {
    if (teamKey === "teamA") {
      setDataA(newData);
      editingA.current = true;
      clearTimeout(pendingA.current);
      pendingA.current = setTimeout(() => { saveTeam("teamA", newData, setSaveStatusA); editingA.current = false; }, 700);
    } else {
      setDataB(newData);
      editingB.current = true;
      clearTimeout(pendingB.current);
      pendingB.current = setTimeout(() => { saveTeam("teamB", newData, setSaveStatusB); editingB.current = false; }, 700);
    }
  }, [saveTeam]);

  const saveAll = () => {
    saveTeam("teamA", dataA, setSaveStatusA);
    saveTeam("teamB", dataB, setSaveStatusB);
  };

  const navBtn = (extra = {}) => ({ ...btn("neutral"), padding: "7px 14px", borderRadius: r.pill, fontSize: 12, letterSpacing: "0.1em", ...extra });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: c.bg, color: c.text, fontFamily: font.body, overflow: "hidden" }}>
      <style>{`
        ${FONT_IMPORT}
        *{box-sizing:border-box;margin:0;padding:0;}
        input::placeholder{color:${c.faint} !important;}
        input:focus{outline:none !important;}
        .press:active{transform:scale(0.96);}
        ::-webkit-scrollbar{width:6px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
        @keyframes pm-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", height: 56,
        background: c.surface, borderBottom: `1px solid ${c.line}`, flexShrink: 0, gap: 12 }}>
        <button onClick={onBack} style={navBtn({ color: c.dim })}>← HOME</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 19, letterSpacing: "0.05em", lineHeight: 1 }}>
            PLAYER <span style={{ color: c.dim, fontWeight: 300 }}>MANAGER</span>
          </div>
          <div style={{ ...overline({ fontSize: 8.5, marginTop: 2, letterSpacing: "0.32em" }) }}>ROSTER · FIREBASE SYNC</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: r.pill,
          background: connected ? c.liveDim : c.dangerDim, border: `1px solid ${connected ? "rgba(63,185,139,0.28)" : "rgba(222,91,87,0.28)"}`,
          ...overline({ fontSize: 10, color: connected ? c.live : c.danger, letterSpacing: "0.14em" }), flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? c.live : c.danger }} />
          {connected ? "LIVE" : "OFF"}
        </div>

        {lastSync && <div style={{ fontFamily: font.num, fontSize: 12, color: c.faint, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{lastSync.toLocaleTimeString("th-TH")}</div>}

        <button onClick={saveAll} className="press" style={{ ...btn("gold", { active: true }), padding: "7px 16px", borderRadius: r.pill, fontSize: 12, letterSpacing: "0.1em", flexShrink: 0 }}>SAVE ALL</button>
      </div>

      {/* MAIN 2-PANEL */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 12, overflow: "hidden", minHeight: 0 }}>
        <TeamPanel teamKey="teamA" data={dataA} saveStatus={saveStatusA} onUpdate={handleUpdate} />
        <TeamPanel teamKey="teamB" data={dataB} saveStatus={saveStatusB} onUpdate={handleUpdate} />
      </div>

      {/* FOOTER */}
      <div style={{ padding: "7px 16px", textAlign: "center", ...overline({ fontSize: 9, color: c.faint, letterSpacing: "0.14em" }),
        flexShrink: 0, borderTop: `1px solid ${c.lineSoft}` }}>
        FIREBASE · {DB_PATH}/teamA · {DB_PATH}/teamB · logo sync → overlay
      </div>
    </div>
  );
}
