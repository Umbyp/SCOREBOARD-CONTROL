// badminton.js — rules and shape of a badminton match.
//
// Unlike basketball, nothing here is driven by a clock: the score itself ends
// a game and the match. `onScore` below is the whole rulebook, and it is a
// pure function so it can be reasoned about (and tested) without a socket.

const POINTS_TO_WIN = 21; // first to 21…
const WIN_BY = 2;         // …but you must lead by two…
const HARD_CAP = 30;      // …unless it reaches 30, where the next point ends it
const GAMES_TO_WIN = 2;   // best of three

const otherTeam = (team) => (team === "teamA" ? "teamB" : "teamA");

/** Has `score` won a game against `against`? */
function gameWon(score, against) {
  if (score >= HARD_CAP) return true;
  return score >= POINTS_TO_WIN && score - against >= WIN_BY;
}

export default {
  id: "badminton",
  label: "แบดมินตัน",
  labelEn: "BADMINTON",

  periodLabel: "GAME",
  maxPeriods: 3,

  caps: {
    clock: false,
    shotClock: false,
    fouls: false,
    // Badminton has fixed intervals (at 11 points, and between games), not
    // timeouts a side can call — so there is nothing for an operator to track.
    timeouts: false,
    possession: false,
    serve: true,
    periodWins: true,
    doubles: true,
    tournament: false,
  },

  scoreSteps: [1],

  actions: new Set([
    // No newPeriod: games advance themselves when someone wins one. `period`
    // stays available so an operator can correct a mis-scored game.
    "score", "serve", "teamName", "partnerName", "teamColor",
    "setDoubles", "period", "resetGame",
  ]),

  periodName: (period) => `GAME ${period}`,

  /**
   * Which service court the serving side is in. Same rule for singles and
   * doubles: even score serves from the right, odd from the left. (Which of
   * the two partners serves is history-dependent and deliberately left to the
   * operator — see the plan's explicit non-goals.)
   */
  serveCourt: (score) => (score % 2 === 0 ? "ขวา" : "ซ้าย"),

  initialState: () => ({
    teamA: { name: "PLAYER A", partner: "PARTNER A", score: 0, gamesWon: 0, color: "#FF6B35" },
    teamB: { name: "PLAYER B", partner: "PARTNER B", score: 0, gamesWon: 0, color: "#00D4FF" },
    period: 1,
    serve: null,      // who is serving right now
    doubles: false,   // singles until the operator says otherwise
    matchOver: false,
  }),

  /**
   * Rally scoring: the side that wins the rally scores AND takes the serve.
   * Returns the state to broadcast — mutating `s` in place is fine here, the
   * caller owns it.
   */
  onScore: (s, team) => {
    // Once the match is decided, further points would be meaningless. The
    // operator can still correct a mistake with −1, which is why this guards
    // on matchOver rather than refusing every write.
    if (s.matchOver) return s;

    s.serve = team;

    const me = s[team];
    const them = s[otherTeam(team)];
    if (!gameWon(me.score, them.score)) return s;

    me.gamesWon += 1;

    if (me.gamesWon >= GAMES_TO_WIN) {
      // Match decided — freeze the final game's score on screen rather than
      // resetting it to 0-0, which would erase how it ended.
      s.matchOver = true;
      return s;
    }

    // Next game: scores back to nil, winner of the game serves first.
    s.period += 1;
    me.score = 0;
    them.score = 0;
    s.serve = team;
    return s;
  },
};
