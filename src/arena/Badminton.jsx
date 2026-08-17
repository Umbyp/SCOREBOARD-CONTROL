// arena/Badminton.jsx — the badminton venue face.
//
// Badminton has no clock and no roster, so the score is free to be enormous —
// which is what the hall actually wants. What the layout has to carry instead
// is the state a rally sport turns on: who is serving and from which court,
// how many games each side has taken, and whether the next rally decides
// something. Those three answers get the three bands below.

import { font } from "../theme";
import {
  ArenaHeader, Cap, Num, Name, Bars, Crest, ScoreFlash,
} from "./kit.jsx";

const BODY_H   = 984;
const STATUS_H = 112;
const FOOT_H   = 128;
const MAIN_H   = BODY_H - STATUS_H - FOOT_H; // 744

// ─── One player / pair ────────────────────────────────────────
function Side({ team, serving, doubles, logo, flash, gamesToWin, theme, atPoint }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, height: MAIN_H, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "0 40px",
      // The serving side is tinted rather than badged alone: from the back of a
      // hall a whole warm column reads faster than a small pill does.
      background: serving ? theme.accentWash : "transparent",
      transition: "background .3s",
    }}>
      {/* Serve — fixed-height slot so the score never shifts when serve turns over */}
      <div style={{ height: 58, display: "flex", alignItems: "center" }}>
        {serving && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "8px 24px", borderRadius: 999,
            background: theme.accentTint, border: `2px solid ${theme.accentLine}`,
          }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: theme.accent,
              animation: "arena-pulse 2s ease-in-out infinite" }} />
            <Cap size={24} color={theme.accent} track="0.14em">เสิร์ฟ · ฝั่ง{team.court}</Cap>
          </div>
        )}
      </div>

      {/* Crest slot is reserved on both sides so one team's logo cannot make
          the two halves asymmetric. */}
      <div style={{ height: 108, display: "flex", alignItems: "center" }}>
        <Crest logo={logo} size={96} color={team.color} theme={theme} />
      </div>

      {/* Name — doubles gets two lines rather than one long clipped one */}
      <div style={{ height: 104, width: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Name size={doubles ? 44 : 58} color={team.color}>{team.name}</Name>
        {doubles && <Name size={44} color={team.color}>{team.partner}</Name>}
      </div>

      <div style={{ position: "relative", marginTop: 4 }}>
        <ScoreFlash value={flash} color={team.color} size={72} />
        <Num size={272} color={team.color} style={{ animation: flash ? "arena-pop .3s ease" : "none" }}>
          {team.score}
        </Num>
      </div>

      {/* Games won */}
      <div style={{ marginTop: 26 }}>
        <Bars count={team.gamesWon} total={gamesToWin} color={theme.accent} theme={theme} w={66} h={16} />
        <Cap size={20} color={atPoint ? theme.accent : theme.textDim} track="0.24em" align="center" style={{ marginTop: 12 }}>
          เกมที่ชนะ {team.gamesWon}
        </Cap>
      </div>
    </div>
  );
}

// ─── Face ─────────────────────────────────────────────────────
export default function BadmintonArena({ state, sport, theme, league, live, teams, flashA, flashB }) {
  const { teamA, teamB, serve, doubles, period, matchOver } = state;
  const gamesToWin = sport.gamesToWin ?? Math.ceil(sport.maxPeriods / 2);

  // Rule questions are asked of the rulebook, never re-derived here.
  const gamePoint = (me, them) =>
    !matchOver && !!sport.atGamePoint?.(me.score, them.score);
  const aPoint = gamePoint(teamA, teamB);
  const bPoint = gamePoint(teamB, teamA);

  // A game point held by someone already one game up is a match point.
  const label = (team, isPoint) =>
    !isPoint ? null : team.gamesWon >= gamesToWin - 1 ? "MATCH POINT" : "GAME POINT";
  const alertA = label(teamA, aPoint);
  const alertB = label(teamB, bPoint);

  const winner = teamA.gamesWon > teamB.gamesWon ? teamA : teamB;

  // Footer: the biggest live fact, or the format of the match when nothing is
  // hanging in the balance.
  let foot = { text: `ชนะ ${gamesToWin} ใน ${sport.maxPeriods} เกม · เกมละ 21 แต้ม`, tone: theme.textDim, strong: false };
  if (matchOver) {
    foot = { text: `${winner.name} ชนะ ${teamA.gamesWon} – ${teamB.gamesWon}`, tone: theme.accent, strong: true };
  } else if (alertA || alertB) {
    // Both sides can be a point away at 29-29; say so rather than picking one.
    const isMatch = alertA === "MATCH POINT" || alertB === "MATCH POINT";
    foot = alertA && alertB
      ? { text: "MATCH POINT · ทั้งสองฝ่าย", tone: theme.alert, strong: true }
      : { text: `${alertA || alertB} · ${(alertA ? teamA : teamB).name}`, tone: isMatch ? theme.alert : theme.accent, strong: true };
  }

  // Which service court that side would serve from at its current score.
  const withCourt = (team) => ({ ...team, court: sport.serveCourt(team.score) });

  return (
    <>
      <ArenaHeader league={league} sportLabel={sport.labelEn} live={live} theme={theme} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: theme.panelC }}>
        {/* Which game, and what kind of match */}
        <div style={{
          height: STATUS_H, flexShrink: 0, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 26, borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 52, letterSpacing: "0.06em", color: theme.accent }}>
            {matchOver ? "จบแมตช์" : sport.periodName(period)}
          </div>
          <Cap size={24} color={theme.textDim} track="0.2em" style={{
            background: theme.stripe, border: `1px solid ${theme.border}`, padding: "8px 22px", borderRadius: 8,
          }}>{doubles ? "ประเภทคู่" : "ประเภทเดี่ยว"}</Cap>
        </div>

        {/* The two sides */}
        <div style={{ height: MAIN_H, flexShrink: 0, display: "flex", alignItems: "stretch" }}>
          {/* Nobody is serving once the match is decided — leaving the marker
              up would have the board claiming a rally is about to start. */}
          <Side team={withCourt(teamA)} serving={!matchOver && serve === "teamA"} doubles={doubles} logo={teams.a.logo}
            flash={flashA} gamesToWin={gamesToWin} theme={theme} atPoint={aPoint} />
          <div style={{ width: 1, background: theme.border, margin: "70px 0" }} />
          <Side team={withCourt(teamB)} serving={!matchOver && serve === "teamB"} doubles={doubles} logo={teams.b.logo}
            flash={flashB} gamesToWin={gamesToWin} theme={theme} atPoint={bPoint} />
        </div>

        {/* Game point / match point / result */}
        <div style={{
          height: FOOT_H, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          borderTop: `1px solid ${theme.border}`,
          background: foot.strong ? `${foot.tone}14` : "transparent",
          transition: "background .3s",
        }}>
          <Cap size={foot.strong ? 46 : 26} color={foot.tone} track="0.22em"
            style={{ animation: foot.strong && !matchOver ? "arena-breathe 1.8s ease-in-out infinite" : "none" }}>
            {foot.text}
          </Cap>
        </div>
      </div>
    </>
  );
}
