import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, update } from "firebase/database";
import { c, font, r, overline, btn } from "./theme";

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
        background: value ? c.live : "rgba(255,255,255,0.14)",
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
export default function TournamentBridge({ state, send, uid }) {
  const TOURNAMENT_PATH = `users/${uid}/tournament_data`;

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
    const r = ref(db, TOURNAMENT_PATH);
    return onValue(r, snap => { const d = snap.val(); if (d) setAppData(d); });
  }, [uid]);

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
        [`${TOURNAMENT_PATH}/${path}/${idx}/homeScore`]: homeScore,
        [`${TOURNAMENT_PATH}/${path}/${idx}/awayScore`]: awayScore,
        [`${TOURNAMENT_PATH}/${path}/${idx}/played`]:    isFinished,
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

  const S = (s) => ({ fontFamily: font.label, fontWeight: 600, ...s });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: c.surface,
      border: `1px solid ${c.line}`,
      borderRadius: r.lg, overflow: "hidden", marginBottom: 12,
    }}>
      <style>{`@keyframes tb-pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* ── Header ── */}
      <div
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer",
          background: c.surface2,
          borderBottom: isOpen ? `1px solid ${c.line}` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v3a4 4 0 0 1-8 0V4M6 4H4v2a3 3 0 0 0 2 2.8M18 4h2v2a3 3 0 0 1-2 2.8M9 15h6M10 15v-3.2M14 15v-3.2M8 20h8"/></svg>
          <span style={{ ...overline({ fontSize: 12, color: c.gold, letterSpacing: "0.2em" }) }}>
            TOURNAMENT SYNC
          </span>
          {selectedMatch && (
            <span style={{
              padding: "2px 9px", borderRadius: r.pill,
              background: c.goldDim, border: `1px solid ${c.gold}3A`,
              ...S({ fontSize: 11, color: c.gold }),
            }}>
              #{sched.matchNo || selectedMatch.id}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveStatus === "saved" && <span style={{ ...S({ fontSize: 12, color: c.live }) }}>จบเกมเรียบร้อย</span>}
          {saveStatus === "live"  && <span style={{ ...S({ fontSize: 12, color: c.warn }) }}>อัปเดตสดแล้ว</span>}
          {saveStatus === "saving"&& <span style={{ ...S({ fontSize: 12, color: c.mute }) }}>กำลังบันทึก…</span>}
          {saveStatus === "error" && <span style={{ ...S({ fontSize: 12, color: c.danger }) }}>ผิดพลาด</span>}
          <span style={{ color: c.mute, fontSize: 11 }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {isOpen && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ════════════════════════════════════════════════
              SECTION 1: AUTO FEATURES (ปุ่ม toggle)
          ════════════════════════════════════════════════ */}
          <div style={{
            background: c.bgInset,
            border: `1px solid ${c.line}`,
            borderRadius: r.md, padding: "10px 14px",
          }}>
            <div style={{ ...overline({ fontSize: 9.5, marginBottom: 10 }) }}>
              AUTO FEATURES
            </div>
            {[
              {
                label:    "Reset shot clock 24s เมื่อมีแต้ม (Made Basket)",
                sublabel: "ป้องกัน operator ลืม reset ทุกครั้ง",
                val:      autoShotReset,
                set:      setAutoShotReset,
              },
              {
                label:    "Reset team fouls ทั้งสองทีม เมื่อขึ้น Q3",
                sublabel: "FIBA กฎ: ฟาวล์ทีม reset ที่ครึ่งหลัง",
                val:      autoFoulReset,
                set:      setAutoFoulReset,
              },
              {
                label:    "Auto-stop นาฬิกาเมื่อ Game Clock = 0",
                sublabel: "หยุดทั้ง game clock และ shot clock อัตโนมัติ",
                val:      autoStopClock,
                set:      setAutoStopClock,
              },
            ].map(({ label, sublabel, val, set }, i, arr) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${c.lineSoft}` : "none",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: font.body, fontSize: 13, color: val ? c.text : c.mute, marginBottom: 2, lineHeight: 1.3 }}>{label}</div>
                  <div style={{ fontFamily: font.body, fontSize: 11, color: c.faint }}>{sublabel}</div>
                </div>
                <Toggle value={val} onChange={set} />
              </div>
            ))}
          </div>

          {/* ════════════════════════════════════════════════
              SECTION 2: เลือกนัดแข่งขัน
          ════════════════════════════════════════════════ */}
          <div>
            <div style={{ ...overline({ fontSize: 10, marginBottom: 7 }) }}>
              เลือกนัดแข่งขัน
            </div>
            <select
              value={selectedId || ""}
              onChange={e => handleSelectMatch(Number(e.target.value))}
              style={{
                width: "100%", background: c.bgInset,
                border: `1px solid ${selectedId ? c.gold + "3A" : c.line}`,
                borderRadius: r.md,
                color: selectedId ? c.gold : c.dim,
                padding: "11px 12px",
                ...S({ fontSize: 14 }),
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
                background: c.bgInset,
                border: `1px solid ${teamMismatch ? "rgba(222,91,87,0.4)" : "rgba(63,185,139,0.28)"}`,
                borderRadius: r.md, padding: "12px 14px",
              }}>
                <div style={{ ...overline({ fontSize: 10, marginBottom: 9 }) }}>
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
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ ...overline({ fontSize: 9, width: 56 }) }}>
                        {label}
                      </span>
                      <span style={{ ...S({ fontSize: 13 }), color, flex: 1 }}>{tournament}</span>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: matched ? c.live : c.danger, flexShrink: 0 }} />
                      <span style={{ ...S({ fontSize: 13 }), color: matched ? c.live : c.danger, flex: 1, textAlign: "right" }}>
                        {scoreboard}
                      </span>
                    </div>
                  );
                })}

                {teamMismatch && (
                  <button
                    onClick={() => handleSelectMatch(selectedId)}
                    style={{ ...btn("warn", { active: true }), marginTop: 9, width: "100%", padding: "9px 0", fontSize: 13, letterSpacing: "0.08em" }}
                  >
                    บังคับเปลี่ยนชื่อทีมตาม TOURNAMENT
                  </button>
                )}
              </div>

              {/* ════════════════════════════════════════════════
                  SECTION 4: QUICK GAME CONTROLS (ของใหม่)
              ════════════════════════════════════════════════ */}
              <div style={{
                background: c.bgInset,
                border: `1px solid ${c.line}`,
                borderRadius: r.md, padding: "12px 14px",
              }}>
                <div style={{ ...overline({ fontSize: 9.5, marginBottom: 10 }) }}>
                  QUICK CONTROLS
                </div>

                {/* สถานะปัจจุบัน */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", marginBottom: 10,
                  background: c.surface, borderRadius: r.sm,
                  border: `1px solid ${c.line}`,
                }}>
                  <span style={{ fontFamily: font.num, fontWeight: 700, fontSize: 20, color: c.gold }}>{qLabel}</span>
                  <div style={{ width: 1, height: 18, background: c.line }} />
                  <span style={{
                    ...overline({ fontSize: 11, letterSpacing: "0.14em" }),
                    color: state.isRunning ? c.live : c.mute,
                  }}>
                    {state.isRunning ? "LIVE" : "PAUSED"}
                  </span>
                  <span style={{ fontFamily: font.num, fontWeight: 700, fontSize: 18, color: c.dim, marginLeft: "auto" }}>
                    {state.teamA.score}
                    <span style={{ color: c.faint, margin: "0 6px" }}>—</span>
                    {state.teamB.score}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>

                  {/* ── ปุ่มจบ Quarter ── */}
                  <button
                    onClick={handleEndQuarter}
                    disabled={state.quarter >= 5}
                    style={{
                      ...btn("gold", { active: state.quarter < 5 }),
                      padding: "12px 0",
                      color: state.quarter >= 5 ? c.faint : c.gold,
                      cursor: state.quarter >= 5 ? "not-allowed" : "pointer",
                      ...S({ fontSize: 14, letterSpacing: "0.06em" }),
                    }}
                  >
                    จบ {qLabel}
                    <div style={{ fontSize: 11, color: c.mute, marginTop: 3, fontFamily: font.body, letterSpacing: 0, fontWeight: 400 }}>
                      Stop + ขึ้น {state.quarter < 4 ? `Q${state.quarter + 1}` : state.quarter === 4 ? "OT" : "—"}
                    </div>
                  </button>

                  {/* ── ปุ่ม Undo คะแนน ── */}
                  <button
                    onClick={handleUndo}
                    disabled={scoreHistory.length === 0}
                    style={{
                      ...btn("warn", { active: scoreHistory.length > 0 }),
                      padding: "12px 0",
                      color: scoreHistory.length > 0 ? c.warn : c.faint,
                      cursor: scoreHistory.length > 0 ? "pointer" : "not-allowed",
                      ...S({ fontSize: 14, letterSpacing: "0.06em" }),
                    }}
                  >
                    UNDO {scoreHistory.length > 0 ? `(${scoreHistory.length})` : ""}
                    <div style={{ fontSize: 11, color: c.mute, marginTop: 3, fontFamily: font.body, letterSpacing: 0, fontWeight: 400 }}>
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
                        padding: "3px 9px",
                        background: i === arr.length - 1 ? c.warnDim : c.surface,
                        border: `1px solid ${i === arr.length - 1 ? "rgba(221,161,63,0.32)" : c.line}`,
                        borderRadius: r.sm,
                        fontSize: 11,
                        color: i === arr.length - 1 ? c.warn : c.mute,
                        fontFamily: font.num, fontVariantNumeric: "tabular-nums",
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
                  display: "flex", alignItems: "center", gap: 11, padding: "11px 14px",
                  borderRadius: r.md,
                  background: c.liveDim,
                  border: "1px solid rgba(63,185,139,0.28)",
                }}>
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: c.live, flexShrink: 0, animation: "tb-pulse 2s infinite",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...overline({ fontSize: 11, color: c.live, letterSpacing: "0.16em" }) }}>
                      AUTO-SYNC ACTIVE
                    </div>
                    <div style={{ fontFamily: font.body, fontSize: 12, color: c.dim, marginTop: 2 }}>
                      คะแนนปัจจุบัน:&nbsp;
                      <span style={{ color: state.teamA.color, fontWeight: 700 }}>{homeScore ?? "—"}</span>
                      <span style={{ color: c.faint, margin: "0 5px" }}>—</span>
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
                    ...btn(selectedMatch.played ? "neutral" : "danger", { active: !selectedMatch.played }),
                    padding: "15px 0",
                    color: selectedMatch.played ? c.faint : c.danger,
                    cursor: selectedMatch.played ? "not-allowed" : "pointer",
                    ...S({ fontSize: 16, letterSpacing: "0.08em" }),
                  }}
                >
                  {selectedMatch.played
                    ? "แมทช์นี้จบการแข่งขันไปแล้ว"
                    : "ยืนยันจบการแข่งขัน · FINAL"}
                </button>
              </div>

              {/* ════════════════════════════════════════════════
                  SECTION 6: AUTO EVENT LOG
              ════════════════════════════════════════════════ */}
              {autoEvents.length > 0 && (
                <div style={{
                  background: c.bgInset,
                  border: `1px solid ${c.line}`,
                  borderRadius: r.md, padding: "10px 12px",
                }}>
                  <div style={{ ...overline({ fontSize: 9, marginBottom: 7 }) }}>
                    AUTO LOG
                  </div>
                  {[...autoEvents].reverse().map((ev, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 9, marginBottom: 5,
                      opacity: Math.max(0.28, 1 - i * 0.16),
                    }}>
                      <span style={{
                        fontFamily: font.num, fontSize: 11, fontVariantNumeric: "tabular-nums",
                        color: c.faint, flexShrink: 0, paddingTop: 1,
                      }}>
                        {ev.time}
                      </span>
                      <span style={{ fontFamily: font.body, fontSize: 12.5, color: c.dim, lineHeight: 1.4 }}>
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