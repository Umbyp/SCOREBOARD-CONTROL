// arena/Football7.jsx — the 7-a-side football venue face.
//
// Football's clock is the odd one out: it counts up and keeps counting past
// the end of the half, so "time up" is a milestone rather than an end. The
// board reflects that — the clock never turns red and stops, it grows a
// stoppage-time chip beside it, exactly as a real touchline board does.
//
// The half is also read cumulatively (the second half runs 25:00 → 50:00),
// which is what `periodStart` already encodes, so the raw clock is shown as-is.

import { font } from "../theme";
import {
  ArenaHeader, Cap, Num, Name, Crest, ScoreFlash,
  formatGameClock, formatAdded,
} from "./kit.jsx";

const BODY_H  = 984;
const CLOCK_H = 372;
const SCORE_H = 406;
const CARDS_H = BODY_H - CLOCK_H - SCORE_H; // 206

// Card colours are the cards themselves, not signal colours — a yellow card is
// yellow in a dark hall and in daylight alike, so these do not follow the theme.
const YELLOW = "#D9A400";
const CARD_RED = "#C8342F";

// ─── Card tally for one team ──────────────────────────────────
// Cards are drawn as cards, not as a number with a coloured label: the shape
// is recognised across a pitch long before any digit is.
function CardStack({ count, color, label, theme }) {
  const shown = Math.min(count, 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 7 }}>
        {shown === 0
          ? <div style={{ width: 30, height: 42, borderRadius: 5, background: theme.stripe, border: `1px solid ${theme.border}` }} />
          : Array.from({ length: shown }).map((_, i) => (
              <div key={i} style={{ width: 30, height: 42, borderRadius: 5, background: color }} />
            ))}
        {count > 5 && <Num size={30} color={color} style={{ marginLeft: 4 }}>×{count}</Num>}
      </div>
      <Cap size={19} color={theme.textDim} track="0.2em">{label} {count}</Cap>
    </div>
  );
}

// Both halves list yellow then red. Mirroring the two sides the way the score
// row mirrors would flip that order on the right, and a card colour read in a
// different order on each side is exactly the kind of thing that gets
// misreported from the stands.
function TeamCards({ team, align, theme }) {
  const isLeft = align === "left";
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", gap: 56,
      // Hug the centre line so a team's cards sit under that team's name,
      // which the score row above has also pulled inward.
      justifyContent: isLeft ? "flex-end" : "flex-start",
      padding: isLeft ? "0 70px 0 0" : "0 0 0 70px",
    }}>
      <CardStack count={team.yellowCards || 0} color={YELLOW} label="ใบเหลือง" theme={theme} />
      <CardStack count={team.redCards || 0} color={CARD_RED} label="ใบแดง" theme={theme} />
    </div>
  );
}

// ─── Face ─────────────────────────────────────────────────────
export default function Football7Arena({ state, sport, theme, league, live, teams, flashA, flashB }) {
  const { teamA, teamB, period, clockTenths, isRunning } = state;

  // How far into stoppage the half is. `periodLength` also travels inside the
  // state for the OBS overlay's benefit; the registry is used here because this
  // screen can import it and the registry is the authority.
  const target  = sport.periodStart(period) + sport.periodLength;
  const added   = clockTenths - target;
  const inAdded = added > 0;

  // Crest and name outside, score inside against the dash, and each half's
  // group pulled in towards the centre line — so the whole thing reads as one
  // scoreboard line rather than two islands with a stranded dash between them.
  const side = (team, logo, flash, align) => (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end",
      gap: 34, padding: "0 40px", flexDirection: align === "left" ? "row" : "row-reverse",
    }}>
      <Crest logo={logo} size={124} color={team.color} theme={theme} />
      <div style={{ minWidth: 0, maxWidth: 400 }}>
        <Name size={62} color={team.color} align={align}>{team.name}</Name>
        <Cap size={20} color={theme.textDim} track="0.34em" align={align} style={{ marginTop: 10 }}>
          {align === "left" ? "HOME" : "AWAY"}
        </Cap>
      </div>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <ScoreFlash value={flash} color={team.color} size={66} />
        <Num size={228} color={team.color} style={{ animation: flash ? "arena-pop .3s ease" : "none" }}>
          {team.score}
        </Num>
      </div>
    </div>
  );

  return (
    <>
      <ArenaHeader league={league} sportLabel={sport.labelEn} live={live} theme={theme} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: theme.panelC }}>
        {/* Clock */}
        <div style={{
          height: CLOCK_H, flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 4 }}>
            <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 46, letterSpacing: "0.05em", color: theme.accent }}>
              {sport.periodName(period)}
            </div>
            <Cap size={22} color={isRunning ? theme.ok : theme.textDim} track="0.18em" style={{
              background: isRunning ? theme.okTint : theme.stripe,
              border: `1px solid ${isRunning ? theme.okLine : theme.border}`,
              padding: "6px 18px", borderRadius: 8,
            }}>{isRunning ? "กำลังแข่ง" : "หยุดเวลา"}</Cap>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
            <Num size={188} color={inAdded ? theme.accent : theme.text}>
              {formatGameClock(clockTenths, sport.clockShowsTenths)}
            </Num>
            {/* Stoppage sits beside the clock, never replacing it */}
            {inAdded && (
              <div style={{ marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Num size={64} color={theme.alert}>{formatAdded(added)}</Num>
                <Cap size={19} color={theme.alert} track="0.2em">ทดเวลา</Cap>
              </div>
            )}
          </div>
        </div>

        {/* Teams and score */}
        <div style={{ height: SCORE_H, flexShrink: 0, display: "flex", alignItems: "center",
          borderBottom: `1px solid ${theme.border}` }}>
          {side(teamA, teams.a.logo, flashA, "left")}
          <Num size={110} color={theme.textDim} style={{ flexShrink: 0, opacity: 0.5 }}>–</Num>
          {side(teamB, teams.b.logo, flashB, "right")}
        </div>

        {/* Discipline */}
        <div style={{ height: CARDS_H, flexShrink: 0, display: "flex", alignItems: "center" }}>
          <TeamCards team={teamA} align="left" theme={theme} />
          <div style={{ width: 1, alignSelf: "stretch", background: theme.border, margin: "34px 0" }} />
          <TeamCards team={teamB} align="right" theme={theme} />
        </div>
      </div>
    </>
  );
}
