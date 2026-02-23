import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { ref, onValue, update } from "firebase/database";

// ── ดึง schedule เดิมจาก tournament เพื่อแสดงวัน/เวลา ──────────────────────
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

// ── resolve KO team names ─────────────────────────────────────────────────
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
    const home = m.resolvedHome;
    const away = m.resolvedAway;
    if (outcome === "W") return homeWon ? home : away;
    if (outcome === "L") return homeWon ? away : home;
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function TournamentBridge({ state, send }) {
  const [appData,      setAppData]      = useState(null);
  const [selectedId,   setSelectedId]   = useState(null);
  const [saveStatus,   setSaveStatus]   = useState(null); // "saving" | "saved" | "error" | "live"
  const [isOpen,       setIsOpen]       = useState(false);
  const [teamMismatch, setTeamMismatch] = useState(false);

  // ── Subscribe to Firebase ──────────────────────────────────────────────────
  useEffect(() => {
    const r = ref(db, "tournament_data");
    return onValue(r, snap => {
      const d = snap.val();
      if (d) setAppData(d);
    });
  }, []);

  // ── Compute resolved matches ───────────────────────────────────────────────
  const { allMatches, standings } = useMemo(() => {
    if (!appData) return { allMatches: [], standings: {} };
    const { teams, groupMatches, koMatches } = appData;
    const st = computeStandings(teams, groupMatches);

    const resolved = [];
    for (const m of koMatches) {
      let rHome = m.home, rAway = m.away;
      if (/^[1-4][A-D]$/.test(m.home)) rHome = resolveTeamName(m.home, st, resolved);
      if (/^[1-4][A-D]$/.test(m.away)) rAway = resolveTeamName(m.away, st, resolved);
      if (m.home.includes("-")) rHome = resolveTeamName(m.home, st, resolved);
      if (m.away.includes("-")) rAway = resolveTeamName(m.away, st, resolved);
      resolved.push({ ...m, resolvedHome: rHome, resolvedAway: rAway });
    }

    return {
      allMatches: [...groupMatches.map(m => ({ ...m, resolvedHome: m.home, resolvedAway: m.away })), ...resolved],
      standings: st,
    };
  }, [appData]);

  const selectedMatch = useMemo(
    () => allMatches.find(m => m.id === selectedId) || null,
    [allMatches, selectedId]
  );

  // ── Check name mismatch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMatch) { setTeamMismatch(false); return; }
    const sbHome = state.teamA.name.trim().toUpperCase();
    const sbAway = state.teamB.name.trim().toUpperCase();
    const tHome  = (selectedMatch.resolvedHome || "").trim().toUpperCase();
    const tAway  = (selectedMatch.resolvedAway || "").trim().toUpperCase();
    setTeamMismatch(sbHome !== tHome || sbAway !== tAway);
  }, [selectedMatch, state.teamA.name, state.teamB.name]);

  // ── Push to Firebase ──────────────────────────────────────────────────────
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

      const updates = {
        [`tournament_data/${path}/${idx}/homeScore`]: homeScore,
        [`tournament_data/${path}/${idx}/awayScore`]: awayScore,
        [`tournament_data/${path}/${idx}/played`]:    isFinished, 
      };
      await update(ref(db), updates);
      
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

  // ✅ AUTO SYNC LOGIC (อัตโนมัติตลอดเวลา)
  useEffect(() => {
    if (selectedMatch) {
      // ตั้งเวลาหน่วง 0.5 วิ เพื่อไม่ให้ยิงขึ้น Database รัวเกินไปตอนกดคะแนนเร็วๆ
      const timeout = setTimeout(() => {
        // ใช้สถานะ selectedMatch.played เดิม เพื่อไม่ให้แมทช์ที่จบแล้วเด้งกลับมาเป็นกำลังแข่งโดยบังเอิญ
        pushToFirebase(selectedMatch.played || false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [state.teamA.score, state.teamB.score, selectedMatch?.id]);

  // ── Select Match ─────────────────────────────────────────────────────────
  const handleSelectMatch = (matchId) => {
    const m = allMatches.find(x => x.id === matchId);
    if (!m) return;
    setSelectedId(matchId);
    setSaveStatus(null);

    const home = m.resolvedHome || m.home;
    const away = m.resolvedAway || m.away;
    send("teamName", "teamA", home.toUpperCase());
    send("teamName", "teamB", away.toUpperCase());
  };

  const extractScores = () => ({
    homeScore: typeof state.teamA.score === "number" ? state.teamA.score : null,
    awayScore: typeof state.teamB.score === "number" ? state.teamB.score : null,
  });

  const matchGroups = useMemo(() => {
    const groups = { "รอบกลุ่ม (ยังไม่เล่น)": [], "รอบกลุ่ม (เล่นแล้ว)": [], "Knockout (ยังไม่เล่น)": [], "Knockout (เล่นแล้ว)": [] };
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

  const { homeScore, awayScore } = extractScores();
  const sched = selectedId ? MATCH_SCHEDULE[selectedId] || {} : {};

  // ── UI ────────────────────────────────────────────────────────────────────
  const S = (s) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...s });

  return (
    <div style={{
      background: "linear-gradient(160deg,#0d0d20,#08080f)",
      border: "1px solid rgba(255,215,0,0.18)",
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      {/* Header */}
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
          {saveStatus === "live"  && <span style={{ ...S({ fontSize: 11 }), color: "#FFA500" }}>📡 อัปเดตสดล่าสุดแล้ว</span>}
          {saveStatus === "error" && <span style={{ ...S({ fontSize: 11 }), color: "#FF5555" }}>❌ ผิดพลาด</span>}
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {isOpen && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* เลือกคู่ */}
          <div>
            <div style={{ ...S({ fontSize: 10, letterSpacing: "0.4em" }), color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
              เลือกนัดแข่งขัน
            </div>
            <select
              value={selectedId || ""}
              onChange={e => handleSelectMatch(Number(e.target.value))}
              style={{
                width: "100%", background: "#0a0a15", border: "1px solid rgba(255,215,0,0.25)",
                borderRadius: 10, color: selectedId ? "#FFD700" : "rgba(255,255,255,0.4)",
                padding: "10px 12px", ...S({ fontSize: 13, letterSpacing: "0.05em" }), outline: "none", cursor: "pointer",
              }}
            >
              <option value="">— เลือกนัดที่กำลังแข่ง —</option>
              {Object.entries(matchGroups).map(([groupLabel, matches]) =>
                matches.length > 0 && (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label} {m.sched.dateLabel ? ` · ${m.sched.dateLabel} ${m.sched.time}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )
              )}
            </select>
          </div>

          {selectedMatch && (
            <>
              {/* เช็คความตรงกันของทีม */}
              <div style={{
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${teamMismatch ? "rgba(255,85,85,0.4)" : "rgba(0,232,122,0.25)"}`,
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ ...S({ fontSize: 10, letterSpacing: "0.35em" }), color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                  ตรวจสอบทีม
                </div>
                {[
                  { label: "HOME (A)", tournament: selectedMatch.resolvedHome || selectedMatch.home, scoreboard: state.teamA.name, color: state.teamA.color },
                  { label: "AWAY (B)", tournament: selectedMatch.resolvedAway || selectedMatch.away, scoreboard: state.teamB.name, color: state.teamB.color },
                ].map(({ label, tournament, scoreboard, color }) => {
                  const match = tournament.trim().toUpperCase() === scoreboard.trim().toUpperCase();
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ ...S({ fontSize: 9, letterSpacing: "0.2em" }), color: "rgba(255,255,255,0.25)", width: 55 }}>{label}</span>
                      <span style={{ ...S({ fontSize: 12 }), color, flex: 1 }}>{tournament}</span>
                      <span style={{ fontSize: 14 }}>{match ? "✅" : "⚠️"}</span>
                      <span style={{ ...S({ fontSize: 12 }), color: match ? "#00E87A" : "#FF5555", flex: 1, textAlign: "right" }}>{scoreboard}</span>
                    </div>
                  );
                })}

                {teamMismatch && (
                  <button
                    onClick={() => handleSelectMatch(selectedId)}
                    style={{
                      marginTop: 8, width: "100%", padding: "8px 0",
                      background: "rgba(255,165,0,0.12)", border: "1px solid rgba(255,165,0,0.35)", borderRadius: 8, color: "#FFA500", cursor: "pointer",
                      ...S({ fontSize: 12, letterSpacing: "0.15em" }),
                    }}
                  >
                    🔄 บังคับเปลี่ยนชื่อทีมตาม TOURNAMENT
                  </button>
                )}
              </div>

              {/* ส่วนควบคุม: ตอนนี้เป็น Auto-Sync แล้ว แสดงแค่ไฟสถานะกับปุ่มจบเกม */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                
                {/* Status Card */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px", borderRadius: 12,
                  background: "rgba(0,232,122,0.15)", border: "1px solid #00E87A"
                }}>
                  <div style={{ width:16, height:16, borderRadius:"50%", background: "#00E87A", boxShadow: "0 0 10px #00E87A" }} className="animate-pulse" />
                  <div style={{flex:1}}>
                    <div style={{...S({fontSize:15, letterSpacing:"0.1em"}), color: "#00E87A"}}>
                      🟢 AUTO-SYNC ACTIVE
                    </div>
                    <div style={{fontSize:11, color:"rgba(255,255,255,0.6)"}}>ระบบจะอัปเดตคะแนนไปที่ Tournament ให้โดยอัตโนมัติเมื่อกดเปลี่ยนคะแนน</div>
                  </div>
                </div>

                {/* ปุ่มจบเกม */}
                <button
                  onClick={() => {
                    if(window.confirm("ยืนยันจบการแข่งขัน? สถานะในตารางจะเปลี่ยนเป็น 'จบแล้ว' และนำไปคำนวณตารางคะแนนทันที")) {
                      pushToFirebase(true);
                    }
                  }}
                  disabled={homeScore === null || saveStatus === "saving" || selectedMatch.played}
                  style={{
                    padding: "16px 0", borderRadius: 12, border: "2px solid rgba(255, 55, 55, 0.4)",
                    background: selectedMatch.played ? "rgba(255,255,255,0.05)" : "rgba(255, 55, 55, 0.15)", 
                    color: selectedMatch.played ? "#555" : "#FF5555", 
                    cursor: selectedMatch.played ? "not-allowed" : "pointer",
                    ...S({ fontSize: 18, letterSpacing: "0.1em" }),
                  }}
                >
                  {selectedMatch.played ? "✅ แมทช์นี้จบการแข่งขันไปแล้ว" : "🏁 กดยืนยันจบการแข่งขัน (FINAL)"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}