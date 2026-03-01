// PlayerManager.jsx — จัดการผู้เล่น · UX redesign · Firebase sync
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";

const DB_PATH     = "player_data";
const LOGO_KEY_A  = "overlay_logo_a";
const LOGO_KEY_B  = "overlay_logo_b";
const MAX_PLAYERS = 16;

const TEAM_DEFAULTS = {
  teamA: { name: "HOME", color: "#FF6B35", logo: "" },
  teamB: { name: "AWAY", color: "#00D4FF", logo: "" },
};

const newPlayer = (n) => ({ num: "", name: n ? `PLAYER ${n}` : "", fouls: 0 });

const defaultTeamData = (key) => ({
  ...TEAM_DEFAULTS[key],
  players: Array.from({ length: 5 }, (_, i) => newPlayer(i + 1)),
});

// ─── Helpers ──────────────────────────────────────────────────
const foulColor = (f) =>
  f >= 5 ? "#FF3333" : f >= 4 ? "#FF8C00" : f >= 3 ? "#FFD700" : null;

const foulLabel = (f) =>
  f >= 5 ? "FOUL OUT" : f >= 4 ? "4th" : f >= 3 ? "3rd" : null;

// ─── Inline Foul Counter (big touch-friendly) ─────────────────
function FoulCounter({ value, color, onChange }) {
  const fc = foulColor(value) || "rgba(255,255,255,0.55)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      background: "rgba(0,0,0,0.25)", borderRadius: 8,
      border: `1px solid ${value >= 3 ? fc + "55" : "rgba(255,255,255,0.08)"}`,
      overflow: "hidden", transition: "border-color 0.2s",
    }}>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        style={{
          width: 36, height: 36, border: "none",
          background: value > 0 ? "rgba(255,60,60,0.1)" : "transparent",
          color: value > 0 ? "#FF8080" : "rgba(255,255,255,0.12)",
          fontSize: 20, cursor: value > 0 ? "pointer" : "default",
          fontFamily: "system-ui", fontWeight: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", flexShrink: 0,
        }}
      >−</button>

      <div style={{
        width: 36, textAlign: "center",
        fontFamily: "'Oswald', sans-serif",
        fontSize: 20, fontWeight: 700,
        color: fc,
        transition: "color 0.2s",
        lineHeight: 1,
      }}>{value}</div>

      <button
        onClick={() => onChange(Math.min(5, value + 1))}
        disabled={value >= 5}
        style={{
          width: 36, height: 36, border: "none",
          background: value < 5 ? `${color}18` : "transparent",
          color: value < 5 ? color : "rgba(255,255,255,0.12)",
          fontSize: 20, cursor: value < 5 ? "pointer" : "default",
          fontFamily: "system-ui", fontWeight: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", flexShrink: 0,
        }}
      >+</button>
    </div>
  );
}

// ─── Foul Pips (5 dots) ───────────────────────────────────────
function FoulPips({ count, color }) {
  const fc = foulColor(count) || color;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: i <= count ? fc : "rgba(255,255,255,0.08)",
          border: `1.5px solid ${i <= count ? fc : "rgba(255,255,255,0.1)"}`,
          boxShadow: i <= count && count >= 3 ? `0 0 5px ${fc}88` : "none",
          transition: "all 0.2s", flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

// ─── Logo Input ───────────────────────────────────────────────
function LogoInput({ value, color, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [inputVal, setInputVal] = useState(value || "");
  const hasLogo = !!value;

  const apply = () => {
    onChange(inputVal.trim());
    setExpanded(false);
  };
  const clear = () => {
    setInputVal("");
    onChange("");
    setExpanded(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setExpanded(e => !e)}
        title={hasLogo ? "เปลี่ยน logo" : "เพิ่ม logo"}
        style={{
          width: 44, height: 44,
          borderRadius: 8,
          background: hasLogo ? "transparent" : `${color}10`,
          border: `1.5px solid ${hasLogo ? color + "60" : color + "30"}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          transition: "all 0.2s",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {hasLogo ? (
          <img src={value} alt="logo"
            style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 4 }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div style={{ fontSize: 18, opacity: 0.5 }}>🖼️</div>
        )}
        {/* Edit overlay on hover */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0, transition: "opacity 0.15s",
          fontSize: 11,
          fontFamily: "'Barlow Condensed'", fontWeight: 800,
          color: "#fff", letterSpacing: "0.1em",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}
        >{hasLogo ? "EDIT" : "ADD"}</div>
      </button>

      {expanded && (
        <div style={{
          position: "absolute",
          top: 52, left: 0, zIndex: 200,
          background: "#0d0d1e",
          border: `1px solid ${color}40`,
          borderRadius: 10,
          padding: 12, width: 280,
          boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed'", fontSize: 10, fontWeight: 800,
            color: "rgba(255,255,255,0.3)", letterSpacing: "0.3em",
            marginBottom: 8,
          }}>URL รูปภาพ Logo</div>
          <input
            autoFocus
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && apply()}
            placeholder="https://..."
            style={{
              width: "100%", background: "rgba(255,255,255,0.06)",
              border: `1px solid ${color}40`,
              borderRadius: 6, color: "#fff",
              fontFamily: "system-ui", fontSize: 12,
              padding: "8px 10px", outline: "none",
              marginBottom: 8,
            }}
          />
          {/* Preview */}
          {inputVal && (
            <div style={{
              display: "flex", justifyContent: "center",
              marginBottom: 8, padding: 6,
              background: "rgba(0,0,0,0.3)", borderRadius: 6,
            }}>
              <img src={inputVal} alt="preview"
                style={{ height: 40, objectFit: "contain" }}
                onError={e => e.target.src = ""}
              />
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={apply} style={{
              flex: 1, padding: "8px 0",
              background: `${color}20`, border: `1px solid ${color}40`,
              borderRadius: 6, color, cursor: "pointer",
              fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.15em",
            }}>ตั้งค่า</button>
            {hasLogo && (
              <button onClick={clear} style={{
                padding: "8px 12px",
                background: "rgba(255,50,50,0.08)", border: "1px solid rgba(255,50,50,0.2)",
                borderRadius: 6, color: "#FF8080", cursor: "pointer",
                fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.15em",
              }}>ลบ</button>
            )}
            <button onClick={() => setExpanded(false)} style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6, color: "rgba(255,255,255,0.3)", cursor: "pointer",
              fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: "0.15em",
            }}>ยกเลิก</button>
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
    <div style={{
      display: "grid",
      gridTemplateColumns: "40px 1fr 110px 12px",
      alignItems: "center",
      gap: 8, padding: "8px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      background: isDQ
        ? "linear-gradient(90deg, rgba(255,30,30,0.07), transparent)"
        : index % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
      transition: "background 0.3s",
      position: "relative",
    }}>

      {/* Jersey # */}
      <input
        value={player.num}
        maxLength={3}
        onChange={e => onChange({ ...player, num: e.target.value })}
        placeholder="#"
        style={{
          background: "transparent",
          border: "none",
          borderBottom: `1.5px solid ${color}30`,
          outline: "none", color,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 20, fontWeight: 700,
          textAlign: "center", width: "100%",
          padding: "2px 0",
          transition: "border-color 0.15s",
        }}
        onFocus={e => e.target.style.borderBottomColor = color}
        onBlur={e => e.target.style.borderBottomColor = `${color}30`}
      />

      {/* Name + status */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <input
          value={player.name}
          maxLength={20}
          onChange={e => onChange({ ...player, name: e.target.value.toUpperCase() })}
          placeholder={`PLAYER ${index + 1}`}
          style={{
            background: "transparent", border: "none",
            borderBottom: `1.5px solid rgba(255,255,255,0.08)`,
            outline: "none",
            color: isDQ ? "rgba(255,100,100,0.7)" : "rgba(255,255,255,0.9)",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 15, fontWeight: 600,
            letterSpacing: "0.02em",
            width: "100%", padding: "2px 0",
            textDecoration: isDQ ? "line-through" : "none",
            transition: "all 0.15s",
          }}
          onFocus={e => e.target.style.borderBottomColor = "rgba(255,255,255,0.25)"}
          onBlur={e => e.target.style.borderBottomColor = "rgba(255,255,255,0.08)"}
        />
        {/* Pip dots under name */}
        <FoulPips count={player.fouls} color={color} />
      </div>

      {/* Foul counter */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <FoulCounter
          value={player.fouls}
          color={color}
          onChange={v => onChange({ ...player, fouls: v })}
        />
        {fl && (
          <span style={{
            fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800,
            color: fc, letterSpacing: "0.15em",
            background: `${fc}15`, border: `1px solid ${fc}30`,
            padding: "1px 5px", borderRadius: 3,
          }}>{fl}</span>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={!canRemove}
        title="ลบผู้เล่น"
        style={{
          width: 20, height: 20, border: "none",
          background: "none", color: "rgba(255,80,80,0.25)",
          cursor: canRemove ? "pointer" : "default",
          fontSize: 14, padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: canRemove ? 1 : 0.2,
          transition: "color 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={e => canRemove && (e.target.style.color = "#FF5555")}
        onMouseLeave={e => e.target.style.color = "rgba(255,80,80,0.25)"}
      >✕</button>
    </div>
  );
}

// ─── Team Panel ───────────────────────────────────────────────
function TeamPanel({ teamKey, data, saveStatus, onUpdate }) {
  const color   = data.color || TEAM_DEFAULTS[teamKey].color;
  const players = data.players || [];

  const updatePlayer = (idx, newP) => {
    const next = players.map((p, i) => i === idx ? newP : p);
    onUpdate(teamKey, { ...data, players: next });
  };

  const addPlayer = () => {
    if (players.length >= MAX_PLAYERS) return;
    onUpdate(teamKey, {
      ...data,
      players: [...players, newPlayer(players.length + 1)],
    });
  };

  const removePlayer = (idx) => {
    if (players.length <= 1) return;
    onUpdate(teamKey, {
      ...data,
      players: players.filter((_, i) => i !== idx),
    });
  };

  const resetFouls = () => {
    if (!confirm(`Reset ฟาวล์ผู้เล่นทั้งหมดในทีม ${data.name}?`)) return;
    onUpdate(teamKey, {
      ...data,
      players: players.map(p => ({ ...p, fouls: 0 })),
    });
  };

  // Stats
  const totalFouls  = players.reduce((s, p) => s + (p.fouls || 0), 0);
  const fouledOut   = players.filter(p => (p.fouls || 0) >= 5).length;
  const atRisk      = players.filter(p => (p.fouls || 0) >= 3 && (p.fouls || 0) < 5).length;

  const S = (s) => ({ fontFamily: "'Bebas Neue', sans-serif", ...s });
  const statusDot = { saving: "#888", saved: "#00E87A", error: "#FF5555" };
  const statusTxt = { saving: "กำลังบันทึก…", saved: "บันทึกแล้ว", error: "Error" };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg, #0a0a1a 0%, #07070e 100%)",
      border: `1px solid ${color}22`,
      borderRadius: 16, overflow: "hidden",
      height: "100%",
    }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{
        padding: "16px 16px 12px",
        background: `linear-gradient(135deg, ${color}14 0%, rgba(0,0,0,0.3) 100%)`,
        borderBottom: `1px solid ${color}20`,
      }}>
        {/* Top row: Logo + Name + Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <LogoInput
            value={data.logo || ""}
            color={color}
            onChange={logoUrl => onUpdate(teamKey, { ...data, logo: logoUrl })}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={data.name}
              maxLength={24}
              onChange={e => onUpdate(teamKey, { ...data, name: e.target.value.toUpperCase() })}
              style={{
                background: "transparent", border: "none",
                borderBottom: `2px solid ${color}40`,
                outline: "none", color,
                ...S({ fontSize: 26, letterSpacing: "0.12em" }),
                width: "100%", padding: "2px 0",
              }}
              placeholder="TEAM NAME"
            />
            <div style={{
              fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800,
              color: "rgba(255,255,255,0.2)", letterSpacing: "0.4em", marginTop: 3,
            }}>
              {teamKey === "teamA" ? "HOME TEAM" : "AWAY TEAM"}
            </div>
          </div>
          {/* Save status */}
          {saveStatus && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 700,
              color: statusDot[saveStatus], letterSpacing: "0.1em",
              flexShrink: 0,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: statusDot[saveStatus],
                boxShadow: saveStatus === "saved" ? `0 0 6px ${statusDot[saveStatus]}` : "none",
                animation: saveStatus === "saving" ? "pulse 1s ease-in-out infinite" : "none",
              }} />
              {statusTxt[saveStatus]}
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
        }}>
          {[
            { label: "PLAYERS", value: players.length, color: "rgba(255,255,255,0.5)" },
            { label: "AT RISK (3+)", value: atRisk, color: atRisk > 0 ? "#FFD700" : "rgba(255,255,255,0.3)" },
            { label: "FOUL OUT", value: fouledOut, color: fouledOut > 0 ? "#FF3333" : "rgba(255,255,255,0.3)" },
          ].map(s => (
            <div key={s.label} style={{
              background: "rgba(0,0,0,0.25)", borderRadius: 8,
              padding: "7px 10px", textAlign: "center",
            }}>
              <div style={{
                fontFamily: "'Oswald'", fontSize: 22, fontWeight: 700,
                color: s.color, lineHeight: 1,
              }}>{s.value}</div>
              <div style={{
                fontFamily: "'Barlow Condensed'", fontSize: 8, fontWeight: 800,
                color: "rgba(255,255,255,0.2)", letterSpacing: "0.3em", marginTop: 2,
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── COLUMN HEADERS ─────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 110px 12px",
        gap: 8, padding: "6px 14px 5px",
        background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {["#", "ชื่อผู้เล่น / FOULS", "จำนวนฟาวล์", ""].map((h, i) => (
          <div key={i} style={{
            fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800,
            color: "rgba(255,255,255,0.2)", letterSpacing: "0.3em",
            textAlign: i === 2 ? "center" : "left",
          }}>{h}</div>
        ))}
      </div>

      {/* ── PLAYER LIST ────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {players.length === 0 ? (
          <div style={{
            padding: "32px 20px", textAlign: "center",
            fontFamily: "'Barlow Condensed'", fontSize: 14,
            color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em",
          }}>กด "+ เพิ่มผู้เล่น" เพื่อเริ่มต้น</div>
        ) : (
          players.map((p, i) => (
            <PlayerRow
              key={i}
              player={p}
              index={i}
              color={color}
              onChange={np => updatePlayer(i, np)}
              onRemove={() => removePlayer(i)}
              canRemove={players.length > 1}
            />
          ))
        )}
      </div>

      {/* ── FOOTER ACTIONS ─────────────────────────────────── */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.3)",
        display: "flex", gap: 8,
      }}>
        <button
          onClick={addPlayer}
          disabled={players.length >= MAX_PLAYERS}
          style={{
            flex: 1, padding: "10px 0",
            background: `${color}14`,
            border: `1px solid ${color}35`,
            borderRadius: 8, color,
            ...S({ fontSize: 13, letterSpacing: "0.2em" }),
            cursor: players.length >= MAX_PLAYERS ? "not-allowed" : "pointer",
            opacity: players.length >= MAX_PLAYERS ? 0.35 : 1,
            transition: "all 0.15s",
          }}
        >+ เพิ่มผู้เล่น ({players.length}/{MAX_PLAYERS})</button>

        <button
          onClick={resetFouls}
          style={{
            padding: "10px 14px",
            background: "rgba(255,80,80,0.07)",
            border: "1px solid rgba(255,80,80,0.2)",
            borderRadius: 8, color: "#FF8080",
            ...S({ fontSize: 13, letterSpacing: "0.12em" }),
            cursor: "pointer", transition: "all 0.15s",
          }}
        >↺ RESET</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PlayerManager({ onBack }) {
  const [dataA, setDataA] = useState(defaultTeamData("teamA"));
  const [dataB, setDataB] = useState(defaultTeamData("teamB"));
  const [saveStatusA, setSaveStatusA] = useState(null);
  const [saveStatusB, setSaveStatusB] = useState(null);
  const [connected,   setConnected]   = useState(false);
  const [lastSync,    setLastSync]    = useState(null);
  const [activeTab,   setActiveTab]   = useState("teamA"); // mobile only

  const isFirstLoad = useRef(true);
  const pendingA    = useRef(null);
  const pendingB    = useRef(null);

  const S = (s) => ({ fontFamily: "'Bebas Neue', sans-serif", ...s });

  // ── Load from Firebase ────────────────────────────────────
  useEffect(() => {
    const parse = (d, key) => ({
      name:    d?.name    || TEAM_DEFAULTS[key].name,
      color:   d?.color   || TEAM_DEFAULTS[key].color,
      logo:    d?.logo    || "",
      players: Array.isArray(d?.players) ? d.players : defaultTeamData(key).players,
    });

    const uA = onValue(ref(db, `${DB_PATH}/teamA`), (snap) => {
      if (isFirstLoad.current) setDataA(parse(snap.val(), "teamA"));
      setConnected(true); setLastSync(new Date());
    });
    const uB = onValue(ref(db, `${DB_PATH}/teamB`), (snap) => {
      if (isFirstLoad.current) setDataB(parse(snap.val(), "teamB"));
      setConnected(true); setLastSync(new Date());
      isFirstLoad.current = false;
    });
    return () => { uA(); uB(); };
  }, []);

  // ── Save to Firebase + sync logos to localStorage ─────────
  const saveTeam = useCallback(async (teamKey, data, setStatus) => {
    setStatus("saving");
    try {
      // Sync logo to localStorage so overlay.html picks it up
      const lsKey = teamKey === "teamA" ? LOGO_KEY_A : LOGO_KEY_B;
      if (data.logo) localStorage.setItem(lsKey, data.logo);
      else localStorage.removeItem(lsKey);

      await set(ref(db, `${DB_PATH}/${teamKey}`), {
        name:      data.name,
        color:     data.color,
        logo:      data.logo || "",
        players:   data.players.map(p => ({
          num:   p.num   || "",
          name:  p.name  || "",
          fouls: p.fouls || 0,
        })),
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
  }, []);

  const handleUpdate = useCallback((teamKey, newData) => {
    if (teamKey === "teamA") {
      setDataA(newData);
      clearTimeout(pendingA.current);
      pendingA.current = setTimeout(() => saveTeam("teamA", newData, setSaveStatusA), 700);
    } else {
      setDataB(newData);
      clearTimeout(pendingB.current);
      pendingB.current = setTimeout(() => saveTeam("teamB", newData, setSaveStatusB), 700);
    }
  }, [saveTeam]);

  const saveAll = () => {
    saveTeam("teamA", dataA, setSaveStatusA);
    saveTeam("teamB", dataB, setSaveStatusB);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse at 30% 0%, #0f0a22 0%, #07070e 60%)",
      fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;700&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: rgba(255,255,255,0.18) !important; }
        input:focus { outline: none !important; }
        button:active { transform: scale(0.93); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* ─── TOP BAR ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 16px", height: 56,
        background: "rgba(0,0,0,0.5)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0, gap: 12,
        backdropFilter: "blur(12px)",
      }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 7, color: "rgba(255,255,255,0.4)",
          ...S({ fontSize: 11, letterSpacing: "0.15em" }),
          padding: "6px 12px", cursor: "pointer", flexShrink: 0,
        }}>← HOME</button>

        <div style={{ flex: 1 }}>
          <div style={{
            ...S({ fontSize: 20, letterSpacing: "0.2em" }),
            background: "linear-gradient(90deg, #FF6B35, #FFD700, #00D4FF)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            lineHeight: 1,
          }}>PLAYER MANAGER</div>
          <div style={{
            fontFamily: "'Barlow Condensed'", fontSize: 9, fontWeight: 800,
            color: "rgba(255,255,255,0.15)", letterSpacing: "0.4em", marginTop: 1,
          }}>จัดการผู้เล่น · FIREBASE SYNC</div>
        </div>

        {/* Firebase status */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 100,
          background: connected ? "rgba(0,232,122,0.07)" : "rgba(255,85,85,0.07)",
          border: `1px solid ${connected ? "rgba(0,232,122,0.2)" : "rgba(255,85,85,0.2)"}`,
          ...S({ fontSize: 10, letterSpacing: "0.2em" }),
          color: connected ? "#00E87A" : "#FF6666",
          flexShrink: 0,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "#00E87A" : "#FF6666",
          }} />
          {connected ? "LIVE" : "OFF"}
        </div>

        {lastSync && (
          <div style={{
            fontFamily: "'Barlow Condensed'", fontSize: 10,
            color: "rgba(255,255,255,0.2)", flexShrink: 0,
          }}>{lastSync.toLocaleTimeString("th-TH")}</div>
        )}

        <button onClick={saveAll} style={{
          padding: "7px 16px", borderRadius: 7,
          background: "rgba(255,215,0,0.1)",
          border: "1px solid rgba(255,215,0,0.3)",
          color: "#FFD700", cursor: "pointer",
          ...S({ fontSize: 12, letterSpacing: "0.15em" }),
          flexShrink: 0,
        }}>💾 SAVE ALL</button>
      </div>

      {/* ─── MOBILE TABS ──────────────────────────────────── */}
      <div style={{
        display: "none",
        "@media (maxWidth: 900px)": { display: "flex" },
      }}>
        {/* Tabs only show on small screens via JS check */}
      </div>

      {/* ─── MAIN 2-PANEL CONTENT ─────────────────────────── */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12, padding: "12px",
        overflow: "hidden",
        minHeight: 0,
      }}>
        <TeamPanel
          teamKey="teamA"
          data={dataA}
          saveStatus={saveStatusA}
          onUpdate={handleUpdate}
        />
        <TeamPanel
          teamKey="teamB"
          data={dataB}
          saveStatus={saveStatusB}
          onUpdate={handleUpdate}
        />
      </div>

      {/* ─── INFO FOOTER ──────────────────────────────────── */}
      <div style={{
        padding: "6px 16px",
        textAlign: "center",
        fontFamily: "'Barlow Condensed'", fontSize: 9,
        color: "rgba(255,255,255,0.1)", letterSpacing: "0.15em",
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        Firebase: <code style={{ color: "rgba(255,255,255,0.2)" }}>player_data/teamA</code>
        {" · "}
        <code style={{ color: "rgba(255,255,255,0.2)" }}>player_data/teamB</code>
        {" · Logo sync → localStorage overlay_logo_a/b"}
      </div>
    </div>
  );
}