import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, update } from "firebase/database";

// ── Match Schedule ────────────────────────────────────────────────────────────
const MATCH_SCHEDULE = {
  19:{matchNo:1,dateLabel:"เสาร์ 28 ก.พ.",time:"13:00-14:00"},
  12:{matchNo:2,dateLabel:"เสาร์ 28 ก.พ.",time:"14:10-15:10"},
  18:{matchNo:3,dateLabel:"เสาร์ 28 ก.พ.",time:"15:40-16:40"},
   3:{matchNo:4,dateLabel:"เสาร์ 28 ก.พ.",time:"16:50-17:50"},
   4:{matchNo:5,dateLabel:"อาทิตย์ 1 มี.ค.",time:"13:00-14:00"},
   7:{matchNo:6,dateLabel:"อาทิตย์ 1 มี.ค.",time:"14:10-15:10"},
  13:{matchNo:7,dateLabel:"อาทิตย์ 1 มี.ค.",time:"15:40-16:40"},
  24:{matchNo:8,dateLabel:"อาทิตย์ 1 มี.ค.",time:"16:50-17:50"},
  20:{matchNo:9,dateLabel:"อาทิตย์ 15 มี.ค.",time:"13:00-14:00"},
   2:{matchNo:10,dateLabel:"อาทิตย์ 15 มี.ค.",time:"14:10-15:10"},
  14:{matchNo:11,dateLabel:"อาทิตย์ 15 มี.ค.",time:"15:40-16:40"},
   8:{matchNo:12,dateLabel:"อาทิตย์ 15 มี.ค.",time:"16:50-17:50"},
  16:{matchNo:13,dateLabel:"เสาร์ 21 มี.ค.",time:"13:00-14:00"},
  23:{matchNo:14,dateLabel:"เสาร์ 21 มี.ค.",time:"14:10-15:10"},
   5:{matchNo:15,dateLabel:"เสาร์ 21 มี.ค.",time:"15:40-16:40"},
   9:{matchNo:16,dateLabel:"เสาร์ 21 มี.ค.",time:"16:50-17:50"},
  10:{matchNo:17,dateLabel:"อาทิตย์ 22 มี.ค.",time:"13:00-14:00"},
  21:{matchNo:18,dateLabel:"อาทิตย์ 22 มี.ค.",time:"14:10-15:10"},
   1:{matchNo:19,dateLabel:"อาทิตย์ 22 มี.ค.",time:"15:40-16:40"},
  17:{matchNo:20,dateLabel:"อาทิตย์ 22 มี.ค.",time:"16:50-17:50"},
  22:{matchNo:21,dateLabel:"เสาร์ 28 มี.ค.",time:"13:00-14:00"},
  11:{matchNo:22,dateLabel:"เสาร์ 28 มี.ค.",time:"14:10-15:10"},
   6:{matchNo:23,dateLabel:"เสาร์ 28 มี.ค.",time:"15:40-16:40"},
  15:{matchNo:24,dateLabel:"เสาร์ 28 มี.ค.",time:"16:50-17:50"},
  100:{matchNo:25,dateLabel:"อาทิตย์ 29 มี.ค.",time:"13:00-14:00"},
  101:{matchNo:26,dateLabel:"อาทิตย์ 29 มี.ค.",time:"14:10-15:10"},
  102:{matchNo:27,dateLabel:"อาทิตย์ 29 มี.ค.",time:"15:40-16:40"},
  103:{matchNo:28,dateLabel:"อาทิตย์ 29 มี.ค.",time:"16:50-17:50"},
  200:{matchNo:29,dateLabel:"เสาร์ 4 เม.ย.",time:"16:00-17:00"},
  201:{matchNo:30,dateLabel:"เสาร์ 4 เม.ย.",time:"17:00-18:00"},
  300:{matchNo:31,dateLabel:"อาทิตย์ 5 เม.ย.",time:"16:00-17:00"},
  301:{matchNo:32,dateLabel:"อาทิตย์ 5 เม.ย.",time:"17:00-18:00"},
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveTeamName(code, standings, resolvedSoFar) {
  if (!code) return code;
  if (/^[1-4][A-D]$/.test(code)) {
    const rank  = parseInt(code[0]) - 1;
    const group = code[1];
    return standings[group]?.[rank]?.team || code;
  }
  if (code.includes("-")) {
    const [outcome, label] = code.split("-");
    const m = resolvedSoFar.find(r => r.shortLabel === label);
    if (!m || !m.played) return code;
    const homeWon = m.homeScore > m.awayScore;
    if (outcome === "W") return homeWon ? m.resolvedHome : m.resolvedAway;
    if (outcome === "L") return homeWon ? m.resolvedAway : m.resolvedHome;
  }
  return code;
}

function computeStandings(teams, groupMatches) {
  const stats = {};
  Object.entries(teams).forEach(([g, ts]) =>
    ts.forEach(t => { stats[t] = { team: t, group: g, played: 0, wins: 0, losses: 0, pts: 0, pf: 0, pa: 0 }; })
  );
  groupMatches.forEach(m => {
    if (!m.played || m.round !== 1) return;
    const h = stats[m.home], a = stats[m.away];
    if (!h || !a) return;
    h.played++; a.played++;
    h.pf += m.homeScore; h.pa += m.awayScore;
    a.pf += m.awayScore; a.pa += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.wins++; h.pts += 3; a.losses++;
      a.pts += (m.awayScore === 0 && m.homeScore === 20) ? 0 : 1;
    } else if (m.awayScore > m.homeScore) {
      a.wins++; a.pts += 3; h.losses++;
      h.pts += (m.homeScore === 0 && m.awayScore === 20) ? 0 : 1;
    }
  });
  const grouped = {};
  Object.keys(teams).forEach(g => {
    grouped[g] = teams[g].map(t => stats[t]).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const h2h = groupMatches.find(m => m.round === 1 && m.played &&
        ((m.home === a.team && m.away === b.team) || (m.home === b.team && m.away === a.team)));
      if (h2h) {
        const aS = h2h.home === a.team ? h2h.homeScore : h2h.awayScore;
        const bS = h2h.home === b.team ? h2h.homeScore : h2h.awayScore;
        if (aS !== bS) return bS - aS;
      }
      return (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf;
    });
  });
  return grouped;
}

// ── Toggle Switch Component ───────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 21, borderRadius: 11, border: "none",
        background: value ? "#00E87A" : "rgba(255,255,255,0.12)",
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div style={{
        width: 15, height: 15, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3,
        left: value ? 20 : 3,
        transition: "left 0.18s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TournamentBridge({ state, send }) {

  // ── Existing state ────────────────────────────────────────────────────────
  const [appData,      setAppData]      = useState(null);
  const [selectedId,   setSelectedId]   = useState(null);
  const [saveStatus,   setSaveStatus]   = useState(null); // "saving"|"saved"|"error"|"live"
  const [isOpen,       setIsOpen]       = useState(false);
  const [teamMismatch, setTeamMismatch] = useState(false);

  // ── NEW: Auto-feature toggles ─────────────────────────────────────────────
  const [autoShotReset, setAutoShotReset] = useState(true);  // reset 24s on made basket
  const [autoFoulReset, setAutoFoulReset] = useState(true);  // reset team fouls at Q3
  const [autoStopClock, setAutoStopClock] = useState(true);  // stop clock when reaches 0

  // ── NEW: Undo score history ───────────────────────────────────────────────
  const [scoreHistory, setScoreHistory] = useState([]); // [{teamA, teamB, label}]

  // ── NEW: Auto-event log ───────────────────────────────────────────────────
  const [autoEvents, setAutoEvents] = useState([]); // [{msg, time}]

  // ── Refs to track previous state values ──────────────────────────────────
  const prevQuarter    = useRef(state.quarter);
  const prevScoreA     = useRef(state.teamA.score);
  const prevScoreB     = useRef(state.teamB.score);
  const prevClock      = useRef(state.clockTenths);
  // Use refs for values needed inside effects without re-triggering them
  const shotRunningRef = useRef(state.shotRunning);
  const isRunningRef   = useRef(state.isRunning);

  useEffect(() => { shotRunningRef.current = state.shotRunning; }, [state.shotRunning]);
  useEffect(() => { isRunningRef.current   = state.isRunning;   }, [state.isRunning]);

  // ── Firebase subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const r = ref(db, "tournament_data");
    return onValue(r, snap => { const d = snap.val(); if (d) setAppData(d); });
  }, []);

  // ── Helper: add to event log ──────────────────────────────────────────────
  const addEvent = (msg) => {
    const time = new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    setAutoEvents(e => [...e.slice(-6), { msg, time }]);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FIX 1: Auto reset team fouls when entering Q3 (FIBA rule)
  // ── Half-time = end of Q2, Q3 starts → team fouls reset to 0 both teams
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (prevQuarter.current !== state.quarter) {
      if (state.quarter === 3 && autoFoulReset) {
        send("teamFoulReset", "teamA");
        send("teamFoulReset", "teamB");
        addEvent("🔄 Reset team fouls ทั้งสองทีม (Q3 เริ่ม — FIBA)");
      }
      prevQuarter.current = state.quarter;
    }
  }, [state.quarter, autoFoulReset]);

  // ══════════════════════════════════════════════════════════════════════════
  // FIX 2: Auto reset shot clock to 24s on made basket (score increases)
  // ── Detects a score going UP, saves to undo history, resets shot clock
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const aUp = state.teamA.score > prevScoreA.current;
    const bUp = state.teamB.score > prevScoreB.current;

    if (aUp || bUp) {
      const diff = aUp
        ? state.teamA.score - prevScoreA.current
        : state.teamB.score - prevScoreB.current;
      const who = aUp ? state.teamA.name : state.teamB.name;

      // Save snapshot for undo
      setScoreHistory(h => [...h.slice(-14), {
        teamA: prevScoreA.current,
        teamB: prevScoreB.current,
        label: `${who} +${diff}`,
      }]);

      // Reset shot clock
      if (autoShotReset) {
        send("shotClockSet", null, 24);
        if (shotRunningRef.current) send("shotClockToggle"); // stop if it was running
        addEvent(`⏱ Shot clock → 24s (${who} +${diff})`);
      }
    }

    prevScoreA.current = state.teamA.score;
    prevScoreB.current = state.teamB.score;
  }, [state.teamA.score, state.teamB.score]);

  // ══════════════════════════════════════════════════════════════════════════
  // FIX 3: Auto stop both clocks when game clock reaches 0
  // ── Prevents clock from going negative and makes buzzer moment clean
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (prevClock.current > 0 && state.clockTenths === 0 && autoStopClock) {
      if (isRunningRef.current)   send("clockToggle");
      if (shotRunningRef.current) send("shotClockToggle");
      addEvent(`⏹ Auto-stop: นาฬิกาหมด ${state.quarter > 4 ? `OT${state.quarter - 4}` : `Q${state.quarter}`}`);
    }
    prevClock.current = state.clockTenths;
  }, [state.clockTenths, autoStopClock]);

  // ══════════════════════════════════════════════════════════════════════════
  // NEW: End-of-Quarter sequence
  // ── Stops both clocks → advances quarter → resets game clock → shot clock 24s
  // ── Q3 team foul reset handled automatically by the useEffect above
  // ══════════════════════════════════════════════════════════════════════════
  const handleEndQuarter = () => {
    if (isRunningRef.current)   send("clockToggle");
    if (shotRunningRef.current) send("shotClockToggle");

    const nextQ = Math.min(state.quarter + 1, 5);
    send("quarter", null, nextQ);
    send("clockReset");
    send("shotClockSet", null, 24);

    const qStr = q => q > 4 ? `OT${q - 4}` : `Q${q}`;
    addEvent(`⏭ ${qStr(state.quarter)} จบ → ขึ้น ${qStr(nextQ)}`);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // NEW: Undo last score change
  // ── Reverts teamA and/or teamB score to their previous snapshot
  // ══════════════════════════════════════════════════════════════════════════
  const handleUndo = () => {
    if (!scoreHistory.length) return;
    const last = scoreHistory[scoreHistory.length - 1];
    const diffA = state.teamA.score - last.teamA;
    const diffB = state.teamB.score - last.teamB;
    if (diffA !== 0) send("score", "teamA", -diffA);
    if (diffB !== 0) send("score", "teamB", -diffB);
    setScoreHistory(h => h.slice(0, -1));
    addEvent(`↩ Undo — ${last.label}`);
  };

  // ── Compute all matches with resolved KO names ────────────────────────────
  const { allMatches, standings } = useMemo(() => {
    if (!appData) return { allMatches: [], standings: {} };
    const { teams, groupMatches, koMatches } = appData;
    const st = computeStandings(teams, groupMatches);
    const resolved = [];
    for (const m of koMatches) {
      let rHome = m.home, rAway = m.away;
      if (/^[1-4][A-D]$/.test(m.home))  rHome = resolveTeamName(m.home, st, resolved);
      if (/^[1-4][A-D]$/.test(m.away))  rAway = resolveTeamName(m.away, st, resolved);
      if (m.home.includes("-"))          rHome = resolveTeamName(m.home, st, resolved);
      if (m.away.includes("-"))          rAway = resolveTeamName(m.away, st, resolved);
      resolved.push({ ...m, resolvedHome: rHome, resolvedAway: rAway });
    }
    return {
      allMatches: [
        ...groupMatches.map(m => ({ ...m, resolvedHome: m.home, resolvedAway: m.away })),
        ...resolved,
      ],
      standings: st,
    };
  }, [appData]);

  const selectedMatch = useMemo(
    () => allMatches.find(m => m.id === selectedId) || null,
    [allMatches, selectedId]
  );

  // ── Team name mismatch check ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMatch) { setTeamMismatch(false); return; }
    const sbHome = state.teamA.name.trim().toUpperCase();
    const sbAway = state.teamB.name.trim().toUpperCase();
    const tHome  = (selectedMatch.resolvedHome || "").trim().toUpperCase();
    const tAway  = (selectedMatch.resolvedAway || "").trim().toUpperCase();
    setTeamMismatch(sbHome !== tHome || sbAway !== tAway);
  }, [selectedMatch, state.teamA.name, state.teamB.name]);

  // ── Push result to Firebase ───────────────────────────────────────────────
  const pushToFirebase = async (isFinished) => {
    if (!selectedMatch || !appData) return;
    const { homeScore, awayScore } = extractScores();
    if (homeScore === null || awayScore === null) return;
    setSaveStatus("saving");
    try {
      const isGroup = selectedMatch.id < 100;
      const path    = isGroup ? "groupMatches" : "koMatches";
      const arr     = isGroup ? appData.groupMatches : appData.koMatches;
      const idx     = arr.findIndex(m => m.id === selectedMatch.id);
      if (idx === -1) throw new Error("Match not found");

      await update(ref(db), {
        [`tournament_data/${path}/${idx}/homeScore`]: homeScore,
        [`tournament_data/${path}/${idx}/awayScore`]: awayScore,
        [`tournament_data/${path}/${idx}/played`]:    isFinished,
      });

      if (isFinished) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus("live");
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    }
  };

  // ── Auto-sync score to Firebase (debounced 500ms) ─────────────────────────
  useEffect(() => {
    if (!selectedMatch) return;
    const timeout = setTimeout(() => {
      pushToFirebase(selectedMatch.played || false);
    }, 500);
    return () => clearTimeout(timeout);
  }, [state.teamA.score, state.teamB.score, selectedMatch?.id]);

  // ── Select match: set team names on scoreboard ────────────────────────────
  const handleSelectMatch = (matchId) => {
    const m = allMatches.find(x => x.id === matchId);
    if (!m) return;
    setSelectedId(matchId);
    setSaveStatus(null);
    setScoreHistory([]); // clear undo history when switching match
    send("teamName", "teamA", (m.resolvedHome || m.home).toUpperCase());
    send("teamName", "teamB", (m.resolvedAway || m.away).toUpperCase());
    const sched = MATCH_SCHEDULE[matchId] || {};
    addEvent(`📋 เลือกนัด #${sched.matchNo || matchId}: ${m.resolvedHome || m.home} vs ${m.resolvedAway || m.away}`);
  };

  const extractScores = () => ({
    homeScore: typeof state.teamA.score === "number" ? state.teamA.score : null,
    awayScore: typeof state.teamB.score === "number" ? state.teamB.score : null,
  });

  // ── Group matches for select dropdown ────────────────────────────────────
  const matchGroups = useMemo(() => {
    const groups = {
      "รอบกลุ่ม (ยังไม่เล่น)": [],
      "รอบกลุ่ม (เล่นแล้ว)":   [],
      "Knockout (ยังไม่เล่น)":  [],
      "Knockout (เล่นแล้ว)":    [],
    };
    allMatches.forEach(m => {
      const sched = MATCH_SCHEDULE[m.id] || {};
      const label = `#${sched.matchNo || m.id} ${m.resolvedHome || m.home} vs ${m.resolvedAway || m.away}`;
      if (m.round === 1) {
        (m.played ? groups["รอบกลุ่ม (เล่นแล้ว)"] : groups["รอบกลุ่ม (ยังไม่เล่น)"]).push({ ...m, label, sched });
      } else {
        (m.played ? groups["Knockout (เล่นแล้ว)"] : groups["Knockout (ยังไม่เล่น)"]).push({ ...m, label, sched });
      }
    });
    return groups;
  }, [allMatches]);

  // ── Derived display values ────────────────────────────────────────────────
  const { homeScore, awayScore } = extractScores();
  const sched  = selectedId ? MATCH_SCHEDULE[selectedId] || {} : {};
  const qLabel = state.quarter > 4 ? `OT${state.quarter - 4}` : `Q${state.quarter}`;

  const S = (s) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...s });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "linear-gradient(160deg,#0d0d20,#08080f)",
      border: "1px solid rgba(255,215,0,0.18)",
      borderRadius: 16, overflow: "hidden", marginBottom: 12,
    }}>

      {/* ── Header ── */}
      <div
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", cursor: "pointer",
          background: "rgba(255,215,0,0.05)",
          borderBottom: isOpen ? "1px solid rgba(255,215,0,0.12)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <span style={{ ...S({ fontSize: 15, letterSpacing: "0.2em" }), color: "#FFD700" }}>
            TOURNAMENT SYNC
          </span>
          {selectedMatch && (
            <span style={{
              padding: "2px 8px", borderRadius: 20,
              background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
              ...S({ fontSize: 10, letterSpacing: "0.1em" }), color: "#FFD700",
            }}>
              #{sched.matchNo || selectedMatch.id}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saveStatus === "saved" && <span style={{ ...S({ fontSize: 11 }), color: "#00E87A" }}>✅ จบเกมเรียบร้อย</span>}
          {saveStatus === "live"  && <span style={{ ...S({ fontSize: 11 }), color: "#FFA500" }}>📡 อัปเดตสดแล้ว</span>}
          {saveStatus === "saving"&& <span style={{ ...S({ fontSize: 11 }), color: "#888" }}>⏳ กำลังบันทึก…</span>}
          {saveStatus === "error" && <span style={{ ...S({ fontSize: 11 }), color: "#FF5555" }}>❌ ผิดพลาด</span>}
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {isOpen && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ════════════════════════════════════════════════
              SECTION 1: AUTO FEATURES (ปุ่ม toggle)
          ════════════════════════════════════════════════ */}
          <div style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "10px 14px",
          }}>
            <div style={{ ...S({ fontSize: 9, letterSpacing: "0.45em" }), color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
              ⚙️ AUTO FEATURES
            </div>
            {[
              {
                label:    "Reset shot clock 24s เมื่อมีแต้ม (Made Basket)",
                sublabel: "ป้องกัน operator ลืม reset ทุกครั้ง",
                val:      autoShotReset,
                set:      setAutoShotReset,
                color:    "#00E87A",
              },
              {
                label:    "Reset team fouls ทั้งสองทีม เมื่อขึ้น Q3",
                sublabel: "FIBA กฎ: ฟาวล์ทีม reset ที่ครึ่งหลัง",
                val:      autoFoulReset,
                set:      setAutoFoulReset,
                color:    "#FFA500",
              },
              {
                label:    "Auto-stop นาฬิกาเมื่อ Game Clock = 0",
                sublabel: "หยุดทั้ง game clock และ shot clock อัตโนมัติ",
                val:      autoStopClock,
                set:      setAutoStopClock,
                color:    "#FF6B35",
              },
            ].map(({ label, sublabel, val, set, color }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: val ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)", marginBottom: 2, lineHeight: 1.3 }}>{label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{sublabel}</div>
                </div>
                <Toggle value={val} onChange={set} />
              </div>
            ))}
          </div>

          {/* ════════════════════════════════════════════════
              SECTION 2: เลือกนัดแข่งขัน
          ════════════════════════════════════════════════ */}
          <div>
            <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
              เลือกนัดแข่งขัน
            </div>
            <select
              value={selectedId || ""}
              onChange={e => handleSelectMatch(Number(e.target.value))}
              style={{
                width: "100%", background: "#0a0a15",
                border: "1px solid rgba(255,215,0,0.25)",
                borderRadius: 10,
                color: selectedId ? "#FFD700" : "rgba(255,255,255,0.4)",
                padding: "10px 12px",
                ...S({ fontSize: 13, letterSpacing: "0.05em" }),
                outline: "none", cursor: "pointer",
              }}
            >
              <option value="">— เลือกนัดที่กำลังแข่ง —</option>
              {Object.entries(matchGroups).map(([groupLabel, matches]) =>
                matches.length > 0 && (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label}{m.sched.dateLabel ? ` · ${m.sched.dateLabel} ${m.sched.time}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )
              )}
            </select>
          </div>

          {/* ── ส่วนที่แสดงเมื่อเลือกแมทช์แล้ว ── */}
          {selectedMatch && (
            <>
              {/* ════════════════════════════════════════════════
                  SECTION 3: ตรวจสอบชื่อทีม
              ════════════════════════════════════════════════ */}
              <div style={{
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${teamMismatch ? "rgba(255,85,85,0.4)" : "rgba(0,232,122,0.25)"}`,
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ ...S({ fontSize: 10, letterSpacing: "0.35em" }), color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                  ตรวจสอบทีม
                </div>
                {[
                  {
                    label:      "HOME (A)",
                    tournament: selectedMatch.resolvedHome || selectedMatch.home,
                    scoreboard: state.teamA.name,
                    color:      state.teamA.color,
                  },
                  {
                    label:      "AWAY (B)",
                    tournament: selectedMatch.resolvedAway || selectedMatch.away,
                    scoreboard: state.teamB.name,
                    color:      state.teamB.color,
                  },
                ].map(({ label, tournament, scoreboard, color }) => {
                  const matched = tournament.trim().toUpperCase() === scoreboard.trim().toUpperCase();
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ ...S({ fontSize: 9, letterSpacing: "0.2em" }), color: "rgba(255,255,255,0.25)", width: 55 }}>
                        {label}
                      </span>
                      <span style={{ ...S({ fontSize: 12 }), color, flex: 1 }}>{tournament}</span>
                      <span style={{ fontSize: 14 }}>{matched ? "✅" : "⚠️"}</span>
                      <span style={{ ...S({ fontSize: 12 }), color: matched ? "#00E87A" : "#FF5555", flex: 1, textAlign: "right" }}>
                        {scoreboard}
                      </span>
                    </div>
                  );
                })}

                {teamMismatch && (
                  <button
                    onClick={() => handleSelectMatch(selectedId)}
                    style={{
                      marginTop: 8, width: "100%", padding: "8px 0",
                      background: "rgba(255,165,0,0.12)",
                      border: "1px solid rgba(255,165,0,0.35)",
                      borderRadius: 8, color: "#FFA500", cursor: "pointer",
                      ...S({ fontSize: 12, letterSpacing: "0.15em" }),
                    }}
                  >
                    🔄 บังคับเปลี่ยนชื่อทีมตาม TOURNAMENT
                  </button>
                )}
              </div>

              {/* ════════════════════════════════════════════════
                  SECTION 4: QUICK GAME CONTROLS (ของใหม่)
              ════════════════════════════════════════════════ */}
              <div style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ ...S({ fontSize: 9, letterSpacing: "0.45em" }), color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                  🎮 QUICK CONTROLS
                </div>

                {/* สถานะปัจจุบัน */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", marginBottom: 10,
                  background: "rgba(0,0,0,0.35)", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{ ...S({ fontSize: 20 }), color: "#FFD700" }}>{qLabel}</span>
                  <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)" }} />
                  <span style={{
                    ...S({ fontSize: 13 }),
                    color: state.isRunning ? "#00E87A" : "rgba(255,255,255,0.35)",
                  }}>
                    {state.isRunning ? "▶ LIVE" : "⏸ PAUSED"}
                  </span>
                  <span style={{ ...S({ fontSize: 18 }), color: "rgba(255,255,255,0.6)", marginLeft: "auto" }}>
                    {state.teamA.score}
                    <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 5px" }}>—</span>
                    {state.teamB.score}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>

                  {/* ── ปุ่มจบ Quarter ── */}
                  <button
                    onClick={handleEndQuarter}
                    disabled={state.quarter >= 5}
                    style={{
                      padding: "13px 0", borderRadius: 10,
                      border: "1.5px solid rgba(255,215,0,0.4)",
                      background: state.quarter >= 5
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(255,215,0,0.1)",
                      color: state.quarter >= 5 ? "rgba(255,255,255,0.15)" : "#FFD700",
                      cursor: state.quarter >= 5 ? "not-allowed" : "pointer",
                      ...S({ fontSize: 13, letterSpacing: "0.1em" }),
                    }}
                  >
                    ⏭ จบ {qLabel}
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "system-ui", letterSpacing: 0 }}>
                      Stop + ขึ้น {state.quarter < 4 ? `Q${state.quarter + 1}` : state.quarter === 4 ? "OT" : "—"}
                    </div>
                  </button>

                  {/* ── ปุ่ม Undo คะแนน ── */}
                  <button
                    onClick={handleUndo}
                    disabled={scoreHistory.length === 0}
                    style={{
                      padding: "13px 0", borderRadius: 10,
                      border: `1.5px solid ${scoreHistory.length > 0 ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.07)"}`,
                      background: scoreHistory.length > 0
                        ? "rgba(255,165,0,0.1)"
                        : "rgba(255,255,255,0.03)",
                      color: scoreHistory.length > 0 ? "#FFA500" : "rgba(255,255,255,0.15)",
                      cursor: scoreHistory.length > 0 ? "pointer" : "not-allowed",
                      ...S({ fontSize: 13, letterSpacing: "0.1em" }),
                    }}
                  >
                    ↩ UNDO {scoreHistory.length > 0 ? `(${scoreHistory.length})` : ""}
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "system-ui", letterSpacing: 0 }}>
                      {scoreHistory.length > 0
                        ? scoreHistory[scoreHistory.length - 1].label
                        : "ไม่มีประวัติ"}
                    </div>
                  </button>
                </div>

                {/* Undo history chips */}
                {scoreHistory.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {scoreHistory.slice(-6).map((h, i, arr) => (
                      <span key={i} style={{
                        padding: "2px 8px",
                        background: i === arr.length - 1
                          ? "rgba(255,165,0,0.15)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${i === arr.length - 1 ? "rgba(255,165,0,0.35)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 6,
                        fontSize: 10,
                        color: i === arr.length - 1 ? "#FFA500" : "rgba(255,255,255,0.2)",
                        fontFamily: "monospace",
                      }}>
                        {h.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════
                  SECTION 5: Auto-Sync status + ปุ่มจบเกม
              ════════════════════════════════════════════════ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                {/* Auto-sync indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                  borderRadius: 12,
                  background: "rgba(0,232,122,0.07)",
                  border: "1px solid rgba(0,232,122,0.25)",
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: "#00E87A", boxShadow: "0 0 8px #00E87A",
                    flexShrink: 0, animation: "pulse 2s infinite",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...S({ fontSize: 13, letterSpacing: "0.1em" }), color: "#00E87A" }}>
                      AUTO-SYNC ACTIVE
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                      คะแนนปัจจุบัน:&nbsp;
                      <span style={{ color: state.teamA.color, fontWeight: 700 }}>{homeScore ?? "—"}</span>
                      <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 4px" }}>—</span>
                      <span style={{ color: state.teamB.color, fontWeight: 700 }}>{awayScore ?? "—"}</span>
                      &nbsp;· sync อัตโนมัติทุกครั้งที่มีแต้ม
                    </div>
                  </div>
                </div>

                {/* ปุ่มจบเกม FINAL */}
                <button
                  onClick={() => {
                    if (window.confirm(
                      "ยืนยันจบการแข่งขัน?\n\nสถานะในตารางจะเปลี่ยนเป็น 'จบแล้ว' ทันที\nและนำไปคำนวณ standings / สาย bracket ต่อไป"
                    )) {
                      pushToFirebase(true);
                    }
                  }}
                  disabled={homeScore === null || saveStatus === "saving" || selectedMatch.played}
                  style={{
                    padding: "16px 0", borderRadius: 12,
                    border: `2px solid ${selectedMatch.played ? "rgba(255,255,255,0.08)" : "rgba(255,55,55,0.45)"}`,
                    background: selectedMatch.played
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(255,55,55,0.13)",
                    color: selectedMatch.played ? "rgba(255,255,255,0.2)" : "#FF5555",
                    cursor: selectedMatch.played ? "not-allowed" : "pointer",
                    ...S({ fontSize: 17, letterSpacing: "0.1em" }),
                    transition: "all 0.2s",
                  }}
                >
                  {selectedMatch.played
                    ? "✅ แมทช์นี้จบการแข่งขันไปแล้ว"
                    : "🏁 ยืนยันจบการแข่งขัน (FINAL)"}
                </button>
              </div>

              {/* ════════════════════════════════════════════════
                  SECTION 6: AUTO EVENT LOG
              ════════════════════════════════════════════════ */}
              {autoEvents.length > 0 && (
                <div style={{
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ ...S({ fontSize: 9, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.18)", marginBottom: 6 }}>
                    📋 AUTO LOG
                  </div>
                  {[...autoEvents].reverse().map((ev, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 8, marginBottom: 4,
                      opacity: Math.max(0.2, 1 - i * 0.18),
                    }}>
                      <span style={{
                        fontFamily: "monospace", fontSize: 9,
                        color: "rgba(255,255,255,0.2)", flexShrink: 0, paddingTop: 1,
                      }}>
                        {ev.time}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                        {ev.msg}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
}