// arena/Basketball.jsx — the basketball venue face.
//
// Three columns, the way a courtside board is arranged: each team's own
// business (identity, team fouls, who is in foul trouble) on its own wing, and
// everything the whole hall is watching at once — clock, scores, shot clock,
// possession — down the middle.
//
// Stage geometry is fixed at 1920×1080, so the numbers below are absolute and
// deliberately add up. Header 96 + body 984 = 1080; 480 + 960 + 480 = 1920.

import { font, overline } from "../theme";
import {
  ArenaHeader, Cap, Num, Name, Dots, Crest, ScoreFlash,
  formatGameClock, formatShotClock,
} from "./kit.jsx";

const BODY_H  = 984;
const WING_W  = 480;
const IDENT_H = 150;
const FOULS_H = 162;
const RHEAD_H = 46;
const ROSTER_H = BODY_H - IDENT_H - FOULS_H - RHEAD_H; // 626

/** Foul count drives colour long before it drives the DQ badge — an operator
 *  should see trouble coming, not just arriving. Signal colours come from the
 *  theme so the escalation still reads on the daylight board. */
const foulTone = (fouls, base, theme) =>
  fouls >= 5 ? theme.alert : fouls >= 4 ? theme.warn : fouls >= 3 ? theme.accent : base;

// Roster columns. Fixed, because they must line up down the whole panel and
// because tying them to the row height would starve the name column whenever
// a short bench made the rows tall.
const COL_NUM  = 74;
const COL_FOUL = 64;

// ─── One roster line ──────────────────────────────────────────
// Deliberately no five-dot foul pips here, unlike the team-fouls block above.
// A wing is 480px wide and a name needs most of it; from the back of a hall
// five 15px dots are gone anyway, while a 40px digit is not. Foul trouble is
// carried by colour (gold at 3, amber at 4, red at 5) and the OUT badge, which
// survive the distance the dots would not.
function PlayerRow({ player, i, rowH, color, align, theme }) {
  const isLeft = align === "left";
  const fouls  = player.fouls || 0;
  const isDQ   = fouls >= 5;
  const tone   = foulTone(fouls, theme.text, theme);

  // Type follows the row height, but within bounds: a 16-player roster must
  // stay legible, and a 3-player one must not turn into billboard lettering.
  const clamp = (lo, hi, v) => Math.round(Math.max(lo, Math.min(hi, v)));
  const numSize  = clamp(23, 46, rowH * 0.46);
  const nameSize = clamp(21, 42, rowH * 0.40);

  return (
    <div style={{
      height: rowH, flexShrink: 0, display: "flex", alignItems: "center", gap: 14,
      flexDirection: isLeft ? "row" : "row-reverse", padding: "0 22px",
      borderBottom: `1px solid ${theme.border}`,
      background: isDQ ? theme.alertTint : i % 2 === 0 ? theme.stripe : "transparent",
      transition: "background .3s",
    }}>
      <Num size={numSize} color={isDQ ? theme.alert : color} style={{ width: COL_NUM, textAlign: "center", flexShrink: 0 }}>
        {player.num || "—"}
      </Num>
      <div style={{
        flex: 1, minWidth: 0, fontFamily: font.body, fontWeight: 600, fontSize: nameSize,
        color: isDQ ? theme.alert : theme.text, textAlign: isLeft ? "left" : "right",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {player.name || `PLAYER ${i + 1}`}
      </div>
      {isDQ && (
        <div style={{ ...overline({ fontSize: clamp(14, 22, rowH * 0.2), color: "#fff", letterSpacing: "0.08em" }),
          background: theme.alert, padding: "3px 10px", borderRadius: 5, flexShrink: 0 }}>OUT</div>
      )}
      <Num size={numSize} color={tone} style={{ width: COL_FOUL, textAlign: "center", flexShrink: 0 }}>
        {fouls}
      </Num>
    </div>
  );
}

// ─── A team's wing ────────────────────────────────────────────
function Wing({ team, players, teamName, logo, align, theme }) {
  const isLeft = align === "left";
  const color  = team.color;
  const inBonus = team.teamFouls >= 5;

  // Every roster from 1 to PlayerManager's 16 has to fit the same box, so the
  // row height is derived from the count rather than fixed and clipped. A
  // short bench spreads out (bigger type, easier to read from the stands)
  // instead of huddling at the top of an empty panel, but stops short of one
  // absurdly tall row when a team has only listed two players.
  const n = Math.max(players.length, 1);
  const rowH = Math.max(34, Math.min(112, ROSTER_H / n));

  return (
    <div style={{
      width: WING_W, height: BODY_H, display: "flex", flexDirection: "column",
      background: theme.panelLR, overflow: "hidden",
      [isLeft ? "borderRight" : "borderLeft"]: `1px solid ${color}45`,
    }}>
      {/* Identity */}
      <div style={{
        height: IDENT_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 18,
        flexDirection: isLeft ? "row" : "row-reverse", padding: "0 26px",
        background: `linear-gradient(${isLeft ? 135 : 225}deg, ${color}2E, ${theme.panelC})`,
        borderBottom: `1px solid ${color}45`,
      }}>
        <div style={{ width: 7, height: 74, background: color, borderRadius: 4, flexShrink: 0 }} />
        <Crest logo={logo} size={82} color={color} theme={theme} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Name size={52} color={color} align={isLeft ? "left" : "right"}>{teamName}</Name>
          <Cap size={20} color={theme.textDim} track="0.34em" align={isLeft ? "left" : "right"} style={{ marginTop: 8 }}>
            {isLeft ? "HOME" : "AWAY"}
          </Cap>
        </div>
      </div>

      {/* Team fouls + bonus */}
      <div style={{
        height: FOULS_H, flexShrink: 0, padding: "0 26px", display: "flex",
        flexDirection: "column", justifyContent: "center", gap: 14,
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexDirection: isLeft ? "row" : "row-reverse" }}>
          <Cap size={20} color={theme.textDim} track="0.18em">TEAM FOULS</Cap>
          <Num size={58} color={inBonus ? theme.alert : theme.text}>{Math.min(team.teamFouls, 5)}</Num>
        </div>
        <Dots count={team.teamFouls} total={5} size={24} gap={12} theme={theme}
          color={inBonus ? theme.alert : color} justify={isLeft ? "flex-start" : "flex-end"} />
        <div style={{ height: 30 }}>
          {inBonus && (
            <div style={{ display: "flex", justifyContent: isLeft ? "flex-start" : "flex-end" }}>
              <Cap size={21} color={theme.alert} track="0.24em" style={{
                background: theme.alertTint, border: `1px solid ${theme.alertLine}`,
                padding: "4px 16px", borderRadius: 7,
              }}>● BONUS</Cap>
            </div>
          )}
        </div>
      </div>

      {/* Roster */}
      <div style={{
        height: RHEAD_H, flexShrink: 0, display: "flex", alignItems: "center",
        flexDirection: isLeft ? "row" : "row-reverse", padding: "0 22px", gap: 14,
        background: theme.stripe, borderBottom: `1px solid ${theme.border}`,
      }}>
        <Cap size={18} color={theme.textDim} track="0.16em" style={{ width: COL_NUM, textAlign: "center" }}>#</Cap>
        <Cap size={18} color={theme.textDim} track="0.16em" style={{ flex: 1, textAlign: isLeft ? "left" : "right" }}>PLAYER</Cap>
        <Cap size={18} color={theme.textDim} track="0.16em" style={{ width: COL_FOUL, textAlign: "center" }}>F</Cap>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {players.map((p, i) => (
          <PlayerRow key={i} player={p} i={i} rowH={rowH} color={color} align={align} theme={theme} />
        ))}
      </div>
    </div>
  );
}

// ─── Centre column ────────────────────────────────────────────
function Centre({ state, sport, theme, flashA, flashB }) {
  const { teamA, teamB, period, clockTenths, isRunning, shotClockTenths, possession, jumpBall } = state;

  const clockUp    = clockTenths === 0;
  const shotUrgent = shotClockTenths <= 50 && shotClockTenths > 0;

  const scoreSide = (team, flash) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Name size={44} color={team.color}>{team.name}</Name>
      <div style={{ width: 64, height: 4, background: theme.accent, transform: "skewX(-16deg)", opacity: 0.8, margin: "12px 0 6px" }} />
      <div style={{ position: "relative" }}>
        <ScoreFlash value={flash} color={team.color} size={64} />
        <Num size={168} color={team.color} style={{ animation: flash ? "arena-pop .3s ease" : "none" }}>
          {team.score}
        </Num>
      </div>
    </div>
  );

  const possSide = (team, key, side) => {
    const has = possession === key;
    const arrow = side === "left" ? "◀" : "▶";
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12,
        justifyContent: side === "left" ? "flex-start" : "flex-end",
        flexDirection: side === "left" ? "row" : "row-reverse" }}>
        <Num size={34} color={has ? team.color : "transparent"} style={{ transition: "color .3s" }}>{arrow}</Num>
        <div style={{ width: 18, height: 18, borderRadius: "50%", transition: "background .3s",
          background: has ? team.color : theme.border }} />
        <Cap size={26} color={has ? team.color : theme.textDim} track="0.08em" style={{ transition: "color .3s" }}>
          {has ? "POSS" : team.name}
        </Cap>
      </div>
    );
  };

  return (
    <div style={{
      width: 960, height: BODY_H, flexShrink: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between", padding: "24px 0 26px",
      background: theme.panelC, borderLeft: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}`,
    }}>
      {/* Period + running state */}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 44, letterSpacing: "0.06em", color: theme.accent }}>
          {sport.periodName(period)}
        </div>
        <Cap size={22} color={isRunning ? theme.ok : theme.textDim} track="0.18em" style={{
          background: isRunning ? theme.okTint : theme.stripe,
          border: `1px solid ${isRunning ? theme.okLine : theme.border}`,
          padding: "6px 18px", borderRadius: 8,
        }}>{isRunning ? "LIVE" : "PAUSED"}</Cap>
      </div>

      {/* Game clock — the largest thing on the board after the scores */}
      <Num size={196} color={clockUp ? theme.alert : theme.text}>{formatGameClock(clockTenths)}</Num>

      <div style={{ width: 760, height: 1, background: theme.border }} />

      {/* Scores */}
      <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 28px" }}>
        {scoreSide(teamA, flashA)}
        <div style={{ width: 74, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 1, height: 54, background: theme.border }} />
          <Cap size={26} color={theme.textDim} track="0.1em">VS</Cap>
          <div style={{ width: 1, height: 54, background: theme.border }} />
        </div>
        {scoreSide(teamB, flashB)}
      </div>

      {/* Possession arrow */}
      <div style={{
        width: 820, display: "flex", alignItems: "center", padding: "12px 26px",
        background: theme.stripe, border: `1px solid ${theme.border}`, borderRadius: 12,
      }}>
        {possSide(teamA, "teamA", "left")}
        <div style={{ width: 90, flexShrink: 0, textAlign: "center" }}>
          {jumpBall
            ? (<div><Num size={30} color={theme.accent}>◆</Num><Cap size={18} color={theme.accent} track="0.16em" style={{ marginTop: 3 }}>JUMP</Cap></div>)
            : <Cap size={19} color={theme.border} track="0.16em">BALL</Cap>}
        </div>
        {possSide(teamB, "teamB", "right")}
      </div>

      {/* Shot clock */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Cap size={22} color={theme.textDim} track="0.34em">SHOT CLOCK</Cap>
        <Num size={132} color={shotUrgent ? theme.alert : theme.accent} style={{ marginTop: 6 }}>
          {formatShotClock(shotClockTenths)}
        </Num>
      </div>

      {/* Timeouts left, both sides */}
      <div style={{
        width: 820, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 30px", background: theme.stripe, border: `1px solid ${theme.border}`, borderRadius: 10,
      }}>
        <Dots count={teamA.timeouts} total={sport.timeoutsForPeriod(period)} color={teamA.color} theme={theme} size={22} />
        <Cap size={21} color={theme.textDim} track="0.2em">TIMEOUTS</Cap>
        <Dots count={teamB.timeouts} total={sport.timeoutsForPeriod(period)} color={teamB.color} theme={theme} size={22} />
      </div>
    </div>
  );
}

// ─── Face ─────────────────────────────────────────────────────
export default function BasketballArena({ state, sport, theme, league, live, teams, flashA, flashB }) {
  return (
    <>
      <ArenaHeader league={league} sportLabel={sport.labelEn} live={live} theme={theme} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Wing team={state.teamA} players={teams.a.players} teamName={state.teamA.name || teams.a.name}
          logo={teams.a.logo} align="left" theme={theme} />
        <Centre state={state} sport={sport} theme={theme} flashA={flashA} flashB={flashB} />
        <Wing team={state.teamB} players={teams.b.players} teamName={state.teamB.name || teams.b.name}
          logo={teams.b.logo} align="right" theme={theme} />
      </div>
    </>
  );
}
