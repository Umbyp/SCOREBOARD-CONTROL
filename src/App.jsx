import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function send(type, team, value) {
  socket.emit("action", { type, team, value });
}

// ─── Shot Clock ────────────────────────────────────────────────────────────
function ShotClock({ shotClock, shotRunning }) {
  const urgent = shotClock <= 5;
  const warning = shotClock <= 10;
  const color = urgent ? "#FF4444" : warning ? "#FFA000" : "#00FF88";

  // กด 24 หรือ 14 → reset แล้ว auto-start
  const handleReset = (seconds) => {
    send("shotClockSet", null, seconds);      // set ค่า + auto-start ใน server
  };

  return (
    <div className="rounded-2xl p-5 flex flex-col items-center gap-4"
      style={{
        background: urgent ? "rgba(255,40,40,0.1)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${urgent ? "rgba(255,40,40,0.5)" : warning ? "rgba(255,160,0,0.3)" : "rgba(255,255,255,0.1)"}`,
        transition: "all 0.3s",
        boxShadow: urgent ? "0 0 40px rgba(255,40,40,0.25)" : "none",
      }}>

      <div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, letterSpacing: "0.5em" }}>
        SHOT CLOCK
      </div>

      {/* Big number */}
      <div style={{
        fontFamily: "'Bebas Neue', Impact, sans-serif",
        fontSize: 160,
        color,
        textShadow: urgent ? "0 0 60px rgba(255,40,40,0.9)" : warning ? "0 0 40px rgba(255,160,0,0.5)" : "none",
        transition: "all 0.3s",
        animation: urgent && shotRunning ? "urgentPulse 0.5s ease-in-out infinite" : "none",
        lineHeight: 0.85,
        fontWeight: 900,
      }}>
        {shotClock}
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(shotClock / 24) * 100}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>

      {/* START / STOP */}
      <button
        onClick={() => send("shotClockToggle")}
        className="w-full py-4 rounded-xl font-black tracking-widest transition-all active:scale-95"
        style={{
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: 22,
          background: shotRunning ? "rgba(255,68,68,0.15)" : "rgba(0,255,136,0.12)",
          border: shotRunning ? "2px solid rgba(255,68,68,0.5)" : "2px solid rgba(0,255,136,0.4)",
          color: shotRunning ? "#FF4444" : "#00FF88",
          boxShadow: shotRunning ? "0 0 20px rgba(255,68,68,0.15)" : "0 0 20px rgba(0,255,136,0.1)",
        }}>
        {shotRunning ? "⏹  STOP" : "▶  START"}
      </button>

      {/* 24s / 14s — กดแล้ว auto-start */}
      <div className="grid grid-cols-2 gap-3 w-full">
        <button
          onClick={() => handleReset(24)}
          className="py-5 rounded-xl font-black tracking-widest transition-all active:scale-95"
          style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif",
            fontSize: 36,
            background: "rgba(255,215,0,0.12)",
            border: "2px solid rgba(255,215,0,0.45)",
            color: "#FFD700",
            boxShadow: "0 0 15px rgba(255,215,0,0.1)",
          }}>
          24s
        </button>
        <button
          onClick={() => handleReset(14)}
          className="py-5 rounded-xl font-black tracking-widest transition-all active:scale-95"
          style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif",
            fontSize: 36,
            background: "rgba(255,160,0,0.12)",
            border: "2px solid rgba(255,160,0,0.45)",
            color: "#FFA000",
            boxShadow: "0 0 15px rgba(255,160,0,0.08)",
          }}>
          14s
        </button>
      </div>

      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.15em", textAlign: "center" }}>
        24s / 14s → RESET + เริ่มนับอัตโนมัติ
      </div>
    </div>
  );
}

function DotRow({ count, max, activeColor, warnAt }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
          style={{
            background: i < count ? (count >= warnAt ? "#FF4444" : activeColor) : "rgba(255,255,255,0.1)",
            boxShadow: i < count && count >= warnAt ? "0 0 4px #FF4444" : "none",
          }} />
      ))}
    </div>
  );
}

// ─── Team Panel ────────────────────────────────────────────────────────────
function TeamPanel({ team, teamKey }) {
  const color = team.color;
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);

  const saveName = () => { send("teamName", teamKey, nameInput.toUpperCase()); setEditing(false); };

  const isBonus = team.teamFouls >= 5;
  const isDoubleBonus = team.teamFouls >= 10;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${color}30`, boxShadow: `0 0 40px ${color}08` }}>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-1.5 h-8 rounded-full" style={{ background: color }} />
        {editing ? (
          <input autoFocus value={nameInput} maxLength={8}
            onChange={(e) => setNameInput(e.target.value.toUpperCase())}
            onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="bg-transparent border-b outline-none w-32"
            style={{ color, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, letterSpacing: "0.15em", borderColor: `${color}66` }} />
        ) : (
          <span className="cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, letterSpacing: "0.15em", fontWeight: 900 }}
            onClick={() => setEditing(true)}>
            {team.name}
          </span>
        )}
        <button onClick={() => setEditing(true)} className="opacity-30 hover:opacity-70" style={{ color, fontSize: 16 }}>✏️</button>
        {isDoubleBonus && (
          <span className="ml-auto px-3 py-1 rounded-full font-bold"
            style={{ background: "rgba(255,40,40,0.2)", color: "#FF4444", border: "1px solid rgba(255,40,40,0.4)", animation: "pulse 1s infinite", fontSize: 13, letterSpacing: "0.1em" }}>
            ●● DOUBLE BONUS
          </span>
        )}
        {isBonus && !isDoubleBonus && (
          <span className="ml-auto px-3 py-1 rounded-full font-bold"
            style={{ background: "rgba(255,160,0,0.15)", color: "#FFA000", border: "1px solid rgba(255,160,0,0.35)", fontSize: 13, letterSpacing: "0.1em" }}>
            ● BONUS
          </span>
        )}
      </div>

      {/* Score */}
      <div className="text-center py-2">
        <div style={{ color, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 120, textShadow: `0 0 60px ${color}44`, lineHeight: 1, fontWeight: 900 }}>
          {team.score}
        </div>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, letterSpacing: "0.4em" }}>POINTS</div>
      </div>

      {/* Score Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {["+1", "+2", "+3"].map((label, i) => (
          <button key={label} onClick={() => send("score", teamKey, i + 1)}
            className="rounded-xl font-black py-4 transition-all active:scale-90"
            style={{ background: `${color}22`, border: `1px solid ${color}55`, color, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22 }}>
            {label}
          </button>
        ))}
        <button onClick={() => send("score", teamKey, -1)}
          className="rounded-xl font-black py-4 transition-all active:scale-90"
          style={{ background: "rgba(255,68,68,0.18)", border: "1px solid rgba(255,68,68,0.5)", color: "#FF4444", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22 }}>
          -1
        </button>
      </div>

      {/* Personal Fouls */}
      <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex justify-between items-center">
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, letterSpacing: "0.3em", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>PERSONAL FOULS</span>
          <span style={{ color: team.fouls >= 5 ? "#FF4444" : "white", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, fontWeight: 900 }}>{team.fouls}</span>
        </div>
        <DotRow count={team.fouls} max={6} activeColor={color} warnAt={5} />
        <div className="flex gap-2 mt-1">
          <button onClick={() => send("foul", teamKey, 1)} disabled={team.fouls >= 6}
            className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "rgba(255,68,68,0.12)", color: "#FF4444", border: "1px solid rgba(255,68,68,0.3)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16, letterSpacing: "0.1em" }}>
            + FOUL
          </button>
          <button onClick={() => send("foul", teamKey, -1)} disabled={team.fouls <= 0}
            className="py-3 px-6 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16 }}>
            UNDO
          </button>
        </div>
      </div>

      {/* Team Fouls */}
      <div className="rounded-xl p-4 flex flex-col gap-2"
        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isDoubleBonus ? "rgba(255,40,40,0.3)" : isBonus ? "rgba(255,160,0,0.25)" : "rgba(255,255,255,0.06)"}` }}>
        <div className="flex justify-between items-center">
          <div>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, letterSpacing: "0.3em", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>TEAM FOULS</span>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: 6 }}>/ quarter</span>
          </div>
          <span style={{ color: isDoubleBonus ? "#FF4444" : isBonus ? "#FFA000" : "white", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, fontWeight: 900 }}>
            {team.teamFouls}
          </span>
        </div>
        <DotRow count={team.teamFouls} max={10} activeColor={color} warnAt={5} />
        <div className="flex gap-2 mt-1">
          <button onClick={() => send("teamFoul", teamKey, 1)}
            className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95"
            style={{ background: "rgba(255,80,80,0.1)", color: "#FF8888", border: "1px solid rgba(255,80,80,0.2)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 15, letterSpacing: "0.08em" }}>
            + TEAM FOUL
          </button>
          <button onClick={() => send("teamFoul", teamKey, -1)} disabled={team.teamFouls <= 0}
            className="py-3 px-4 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 15 }}>
            -1
          </button>
          <button onClick={() => send("teamFoulReset", teamKey)}
            className="py-3 px-4 rounded-xl font-bold transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 15 }}>
            CLR
          </button>
        </div>
      </div>

      {/* Timeouts */}
      <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex justify-between items-center">
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, letterSpacing: "0.3em", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>TIMEOUTS</span>
          <span style={{ color: "white", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, fontWeight: 900 }}>{team.timeouts}</span>
        </div>
        <DotRow count={team.timeouts} max={7} activeColor={color} warnAt={999} />
        <div className="flex gap-2 mt-1">
          <button onClick={() => send("timeout", teamKey, -1)} disabled={team.timeouts <= 0}
            className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-30"
            style={{ background: `${color}15`, color, border: `1px solid ${color}40`, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16, letterSpacing: "0.1em" }}>
            USE T.O.
          </button>
          <button onClick={() => send("timeout", teamKey, 1)} disabled={team.timeouts >= 7}
            className="py-3 px-6 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16 }}>
            +1
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clock Panel ───────────────────────────────────────────────────────────
function ClockPanel({ state }) {
  const { clockSeconds, isRunning, quarter, shotClock, shotRunning } = state;
  const quarterLabel = quarter > 4 ? `OT${quarter - 4}` : `Q${quarter}`;
  const presets = [{ label: "12 MIN", s: 720 }, { label: "10 MIN", s: 600 }, { label: "5 MIN", s: 300 }, { label: "2 MIN", s: 120 }];

  return (
    <div className="flex flex-col gap-3">
      <ShotClock shotClock={shotClock} shotRunning={shotRunning} />

      {/* Game Clock */}
      <div className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,215,0,0.2)" }}>

        <div style={{ color: "rgba(255,215,0,0.7)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, letterSpacing: "0.5em" }}>
          GAME CLOCK
        </div>

        <div className="text-center py-1">
          <div style={{ color: isRunning ? "#FFD700" : "white", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 68, textShadow: isRunning ? "0 0 40px rgba(255,215,0,0.7)" : "none", fontWeight: 900, letterSpacing: "0.05em", transition: "all 0.3s" }}>
            {formatClock(clockSeconds)}
          </div>
          <div style={{ color: isRunning ? "#FFD700" : "rgba(255,255,255,0.3)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16, letterSpacing: "0.4em", marginTop: 4 }}>
            {quarterLabel} • {isRunning ? "▶ LIVE" : "■ STOPPED"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => send("clockToggle")}
            className="py-4 rounded-xl font-black tracking-widest transition-all active:scale-95"
            style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, background: isRunning ? "rgba(255,68,68,0.15)" : "rgba(0,255,136,0.12)", border: isRunning ? "1px solid rgba(255,68,68,0.4)" : "1px solid rgba(0,255,136,0.35)", color: isRunning ? "#FF4444" : "#00FF88" }}>
            {isRunning ? "⏹ STOP" : "▶ START"}
          </button>
          <button onClick={() => send("clockReset", null, clockSeconds)}
            className="py-4 rounded-xl font-black tracking-widest transition-all active:scale-95"
            style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
            ↺ RESET
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <button key={p.label} onClick={() => send("clockSet", null, p.s)}
              className="py-2.5 rounded-xl font-bold transition-all active:scale-95"
              style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 15, background: clockSeconds === p.s ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)", border: clockSeconds === p.s ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.07)", color: clockSeconds === p.s ? "#FFD700" : "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Quarter */}
        <div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 13, letterSpacing: "0.3em", marginBottom: 8 }}>PERIOD</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((q) => (
              <button key={q} onClick={() => send("quarter", null, q)}
                className="flex-1 py-3 rounded-xl font-black tracking-widest transition-all active:scale-95"
                style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 16, background: quarter === q ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.04)", border: quarter === q ? "1px solid rgba(255,215,0,0.5)" : "1px solid rgba(255,255,255,0.07)", color: quarter === q ? "#FFD700" : "rgba(255,255,255,0.35)", boxShadow: quarter === q ? "0 0 12px rgba(255,215,0,0.2)" : "none" }}>
                {q > 4 ? "OT" : `Q${q}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Overlay Preview ───────────────────────────────────────────────────────
function OverlayPreview({ state }) {
  const { teamA, teamB, quarter, clockSeconds, isRunning, shotClock } = state;
  const q = quarter;
  const quarterLabel = q > 4 ? `OT${q - 4}` : `Q${q}`;
  const shotUrgent = shotClock <= 5;
  const shotWarn = shotClock <= 10;

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "#0a0a14", border: "1px solid rgba(255,255,255,0.07)", height: 90, fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-0.5 h-12 rounded-full" style={{ background: teamA.color }} />
          <div>
            <div style={{ color: teamA.color, fontSize: 9, letterSpacing: "0.35em" }}>TEAM</div>
            <div className="text-white tracking-widest leading-none" style={{ fontSize: 22 }}>{teamA.name}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>
              PF:{teamA.fouls} · TF:{teamA.teamFouls} · TO:{teamA.timeouts}
              {teamA.teamFouls >= 10 ? "  ●● DBONUS" : teamA.teamFouls >= 5 ? "  ● BONUS" : ""}
            </div>
          </div>
          <div className="ml-3" style={{ color: teamA.color, fontSize: 52, lineHeight: 1, fontWeight: 900 }}>{teamA.score}</div>
        </div>

        <div className="text-center px-4 flex flex-col items-center">
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, letterSpacing: "0.45em" }}>{quarterLabel}</div>
          <div style={{ color: isRunning ? "#FFD700" : "white", fontSize: 28, letterSpacing: "0.05em" }}>{formatClock(clockSeconds)}</div>
          <div style={{ color: shotUrgent ? "#FF4444" : shotWarn ? "#FFA000" : "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: 900, textShadow: shotUrgent ? "0 0 10px #FF4444" : "none" }}>
            ⏱ {shotClock}s
          </div>
        </div>

        <div className="flex items-center gap-4 flex-1 justify-end">
          <div className="mr-3" style={{ color: teamB.color, fontSize: 52, lineHeight: 1, fontWeight: 900 }}>{teamB.score}</div>
          <div className="text-right">
            <div style={{ color: teamB.color, fontSize: 9, letterSpacing: "0.35em" }}>TEAM</div>
            <div className="text-white tracking-widest leading-none" style={{ fontSize: 22 }}>{teamB.name}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>
              PF:{teamB.fouls} · TF:{teamB.teamFouls} · TO:{teamB.timeouts}
              {teamB.teamFouls >= 10 ? "  ●● DBONUS" : teamB.teamFouls >= 5 ? "  ● BONUS" : ""}
            </div>
          </div>
          <div className="w-0.5 h-12 rounded-full" style={{ background: teamB.color }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState({
    teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#00D4FF" },
    quarter: 1,
    clockSeconds: 600,
    isRunning: false,
    shotClock: 24,
    shotRunning: false,
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("stateUpdate", (s) => setState(s));
    return () => { socket.off("stateUpdate"); socket.off("connect"); socket.off("disconnect"); };
  }, []);

  return (
    <div className="min-h-screen p-4" style={{ background: "#070710" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes urgentPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 40, letterSpacing: "0.3em", background: "linear-gradient(90deg,#FF6B35,#FFD700,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 }}>
            SCOREBOARD CONTROL
          </h1>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, letterSpacing: "0.35em", marginTop: 2 }}>LIVE BROADCAST • OBS READY</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: connected ? "rgba(0,255,136,0.08)" : "rgba(255,68,68,0.08)", border: connected ? "1px solid rgba(0,255,136,0.25)" : "1px solid rgba(255,68,68,0.25)", color: connected ? "#00FF88" : "#FF4444", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, letterSpacing: "0.2em" }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: connected ? "#00FF88" : "#FF4444", animation: connected ? "pulse 1.5s infinite" : "none" }} />
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </div>
          {state.isRunning && (
            <div className="px-4 py-2 rounded-full"
              style={{ background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.35)", color: "#FF4444", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, letterSpacing: "0.2em", animation: "pulse 1s infinite" }}>
              ● LIVE ON AIR
            </div>
          )}
          <button onClick={() => send("resetGame")}
            className="px-5 py-2 rounded-full transition-all active:scale-95"
            style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", color: "#FF4444", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 14, letterSpacing: "0.15em" }}>
            ↺ RESET GAME
          </button>
        </div>
      </div>

      {/* Overlay Preview */}
      <div className="mb-4">
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.35em", marginBottom: 8 }}>▼ OBS OVERLAY PREVIEW</div>
        <OverlayPreview state={state} />
        <div style={{ color: "rgba(255,255,255,0.12)", fontSize: 11, textAlign: "center", marginTop: 6 }}>
          OBS Browser Source → http://localhost:3001/overlay | 1920×90px
        </div>
      </div>

      <div className="w-full h-px mb-4" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)" }} />

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 300px 1fr" }}>
        <TeamPanel team={state.teamA} teamKey="teamA" />
        <ClockPanel state={state} />
        <TeamPanel team={state.teamB} teamKey="teamB" />
      </div>
    </div>
  );
}