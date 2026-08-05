// basketball.js — rules and shape of a basketball game.
//
// This file is the single source of truth for what a basketball game *is*:
// its starting state, which operator actions make sense, and how the UI should
// label things. Both server.js and the React app import it, so the server can
// never accept an action the sport doesn't have, and the UI never renders a
// control the server would reject.

export default {
  id: "basketball",
  label: "บาสเกตบอล",
  labelEn: "BASKETBALL",

  // Shown wherever a period is displayed: Q1, Q2, … (OT handled by periodName)
  periodLabel: "PERIOD",
  maxPeriods: 5, // Q1–Q4 + OT

  // What this sport has. The UI renders controls off these flags rather than
  // checking `sport.id === "basketball"` in a dozen places.
  caps: {
    clock: true,
    shotClock: true,
    fouls: true,
    timeouts: true,
    possession: true,
    serve: false,
    periodWins: false,
    // The tournament bracket panel is written around a basketball group stage
    // (fixed match schedule, quarter-based auto foul reset) — it is a feature
    // of this sport, not of the scoreboard.
    tournament: true,
  },

  clockDirection: "down",
  // Under a minute the game clock switches to tenths, as it does courtside.
  clockShowsTenths: true,

  scoreSteps: [1, 2, 3],

  // Every action the server will accept while this sport is active. Anything
  // not listed is dropped before it can touch game state — see server.js.
  actions: new Set([
    "score", "foul", "techFoul", "teamFoul", "teamFoulReset",
    "timeout", "teamName", "teamColor",
    "possession", "jumpBall",
    "clockToggle", "clockSet", "clockReset", "clockAdjust",
    "shotClockToggle", "shotClockSet", "shotClockAdjust",
    "period", "newPeriod", "resetGame",
  ]),

  /** Q1–Q4 then OT1, OT2, … — used by every screen so the wording stays in sync. */
  periodName: (period) => (period > 4 ? `OT${period - 4}` : `Q${period}`),

  /** FIBA-style allowance: 2 timeouts in regulation halves, 1 per overtime. */
  timeoutsForPeriod: (period) => (period >= 5 ? 1 : 2),

  /** Which stretch of the game the current allowance belongs to. */
  timeoutGroupLabel: (period) =>
    (period <= 2 ? "Q1–Q2" : period <= 4 ? "Q3–Q4" : `OT${period - 4}`),

  initialState: () => ({
    teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#00D4FF" },
    period: 1,
    clockTenths: 6000,
    lastClockSet: 6000,
    isRunning: false,
    shotClockTenths: 240,
    shotRunning: false,
    possession: null,
    jumpBall: false,
  }),

  // Basketball has no automatic period/match end driven by score — the clock
  // decides. Rally sports (badminton, volleyball) will supply a function here.
  onScore: null,
};
