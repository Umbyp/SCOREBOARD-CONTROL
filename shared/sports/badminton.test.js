// Rules of badminton scoring, checked without a server or a socket.
// Run with:  node --test shared/sports/
import test from "node:test";
import assert from "node:assert/strict";
import badminton from "./badminton.js";

/** Play `points` for `team` one rally at a time, exactly as the server does. */
function rally(state, team, points = 1) {
  for (let i = 0; i < points; i++) {
    state[team].score += 1;
    badminton.onScore(state, team);
  }
  return state;
}

const fresh = () => badminton.initialState();

test("first to 21 with a two-point lead wins the game", () => {
  const s = fresh();
  rally(s, "teamA", 20);
  rally(s, "teamB", 19);
  assert.equal(s.teamA.gamesWon, 0, "20-19 is not a win");

  rally(s, "teamA", 1); // 21-19
  assert.equal(s.teamA.gamesWon, 1);
  assert.equal(s.period, 2, "a new game starts");
  assert.equal(s.teamA.score, 0);
  assert.equal(s.teamB.score, 0);
  assert.equal(s.serve, "teamA", "winner of the game serves first in the next");
});

test("at 20-20 the game continues until someone leads by two", () => {
  const s = fresh();
  rally(s, "teamA", 20);
  rally(s, "teamB", 20);
  rally(s, "teamA", 1); // 21-20
  assert.equal(s.teamA.gamesWon, 0, "21-20 is only one clear point");
  assert.equal(s.teamA.score, 21, "score keeps climbing past 21");

  rally(s, "teamA", 1); // 22-20
  assert.equal(s.teamA.gamesWon, 1);
});

test("29-29 is decided by the next point — the 30 cap", () => {
  const s = fresh();
  rally(s, "teamA", 20);
  rally(s, "teamB", 20);
  // Trade points one for one so neither side ever leads by two.
  for (let p = 21; p <= 29; p++) {
    rally(s, "teamA", 1);
    rally(s, "teamB", 1);
  }
  assert.deepEqual([s.teamA.score, s.teamB.score], [29, 29]);
  assert.equal(s.teamA.gamesWon, 0);
  assert.equal(s.teamB.gamesWon, 0);

  rally(s, "teamB", 1); // 29-30, only one point clear
  assert.equal(s.teamB.gamesWon, 1, "the cap ends it without a two-point lead");
});

test("winning two games ends the match and keeps the final score on screen", () => {
  const s = fresh();
  rally(s, "teamA", 21); // game 1
  assert.equal(s.matchOver, false);

  rally(s, "teamA", 21); // game 2
  assert.equal(s.teamA.gamesWon, 2);
  assert.equal(s.matchOver, true);
  assert.equal(s.teamA.score, 21, "final game's score is not wiped");
  assert.equal(s.period, 2, "no game 3 is started");
});

test("a match can go the full three games", () => {
  const s = fresh();
  rally(s, "teamA", 21);
  rally(s, "teamB", 21);
  assert.equal(s.period, 3);
  assert.equal(s.matchOver, false);

  rally(s, "teamB", 21);
  assert.equal(s.matchOver, true);
  assert.equal(s.teamB.gamesWon, 2);
});

test("scoring takes the serve (rally scoring)", () => {
  const s = fresh();
  rally(s, "teamB", 1);
  assert.equal(s.serve, "teamB");
  rally(s, "teamA", 1);
  assert.equal(s.serve, "teamA");
});

test("points after the match is decided are ignored", () => {
  const s = fresh();
  rally(s, "teamA", 21);
  rally(s, "teamA", 21);
  const gamesBefore = s.teamA.gamesWon;

  rally(s, "teamA", 5);
  assert.equal(s.teamA.gamesWon, gamesBefore, "no extra games are awarded");
});

test("service court follows the serving side's score parity", () => {
  assert.equal(badminton.serveCourt(0), "ขวา");
  assert.equal(badminton.serveCourt(1), "ซ้าย");
  assert.equal(badminton.serveCourt(20), "ขวา");
});
