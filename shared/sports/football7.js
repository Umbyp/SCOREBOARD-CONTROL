// football7.js — rules and shape of a 7-a-side football match.
//
// The one structural thing football brings that the other sports don't: its
// clock runs *up*, and it keeps running past the end of the half into
// stoppage time rather than stopping at zero. `clockUp` travels inside the
// state so the OBS overlay — which is served statically and can't import this
// registry — knows which way to interpolate.

const HALF_TENTHS = 15000; // 25:00 — the usual 7-a-side half

export default {
  id: "football7",
  label: "ฟุตบอล 7 คน",
  labelEn: "FOOTBALL 7",

  periodLabel: "ครึ่ง",
  maxPeriods: 4, // two halves + two periods of extra time

  caps: {
    clock: true,
    shotClock: false,
    fouls: false,
    cards: true,
    // No called timeouts in football, and no possession arrow — the ball
    // speaks for itself.
    timeouts: false,
    possession: false,
    serve: false,
    periodWins: false,
    tournament: false,
  },

  // Counting up means "time up" is a milestone, not an end: the operator
  // stops the clock when the referee blows, which is why nothing here stops
  // it automatically.
  clockDirection: "up",
  periodLength: HALF_TENTHS,
  // Football is never read to a tenth of a second — always mm:ss, even in the
  // last minute, unlike basketball's final-minute countdown.
  clockShowsTenths: false,

  scoreSteps: [1],

  actions: new Set([
    "score", "yellowCard", "redCard", "teamName", "teamColor",
    "clockToggle", "clockSet", "clockReset", "clockAdjust",
    "period", "resetGame",
  ]),

  periodName: (period) =>
    (period === 1 ? "ครึ่งแรก" : period === 2 ? "ครึ่งหลัง" : `ต่อเวลา ${period - 2}`),

  /** Short form for the overlay's narrow period cell. */
  periodShort: (period) => (period <= 2 ? `H${period}` : `ET${period - 2}`),

  /** Where the clock starts for each period — the second half picks up at 25:00. */
  periodStart: (period) => (period === 1 ? 0 : period === 2 ? HALF_TENTHS : 2 * HALF_TENTHS),

  initialState: () => ({
    teamA: { name: "HOME", score: 0, yellowCards: 0, redCards: 0, color: "#FF6B35" },
    teamB: { name: "AWAY", score: 0, yellowCards: 0, redCards: 0, color: "#00D4FF" },
    period: 1,
    clockTenths: 0,
    lastClockSet: 0,
    isRunning: false,
    clockUp: true,
    periodLength: HALF_TENTHS,
  }),

  onScore: null,
};
