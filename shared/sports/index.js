// sports/index.js — the sport registry.
//
// Lives outside src/ on purpose: server.js (plain Node ESM) and the Vite app
// both import from here, so there is exactly one definition of each sport's
// rules instead of one on each side that can drift apart.
//
// Adding a sport = add a module here. Nothing else in the registry changes.

import basketball from "./basketball.js";
import badminton from "./badminton.js";

export const SPORTS = { basketball, badminton };

export const DEFAULT_SPORT = "basketball";

/**
 * True only for ids that are real registered sports.
 * Uses Object.hasOwn so a crafted id like "__proto__" or "constructor" can
 * never pass as a sport — this guards the same untrusted socket payload path
 * that TEAM_KEYS guards in server.js.
 */
export function isSport(id) {
  return typeof id === "string" && Object.hasOwn(SPORTS, id);
}

/** Never throws — an unknown id falls back to the default sport. */
export function getSport(id) {
  return isSport(id) ? SPORTS[id] : SPORTS[DEFAULT_SPORT];
}

/**
 * A fresh game for `id`. The `sport` field travels inside the state itself so
 * every viewer (overlay, arena display) learns which sport it is rendering
 * from the same broadcast that carries the score — no extra round-trip.
 */
export function initialState(id) {
  const sport = getSport(id);
  return { sport: sport.id, ...sport.initialState() };
}

/** Whether `type` is an action the given sport accepts at all. */
export function allowsAction(id, type) {
  return getSport(id).actions.has(type);
}

/** Label for the current period, e.g. "Q3" / "OT1". */
export function periodName(id, period) {
  return getSport(id).periodName(period);
}
