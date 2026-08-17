// league.js — what the branding badge shows before anyone has configured it.
//
// The badge is league/venue identity, not sport identity: the sport is already
// named in the middle of the arena header and on the overlay's own furniture.
// The old default said "BASKETBALL · THAI LEAGUE", which was fine when that was
// the only sport this system ran, but reads as wrong the moment a badminton or
// football match is on the board. So the fallback is deliberately neutral —
// it is a placeholder for the organiser's own name, not a claim about the game.
//
// One definition, imported by both the control panel and the arena screen, so
// the two can't disagree about what an unconfigured board looks like.
// public/overlay.html keeps its own copy of these strings because it is served
// as a static file and cannot import from here — keep the two in step.

export const LEAGUE_DEFAULT = {
  logo: "",
  line1: "SCOREBOARD",
  line2: "",
  // Computed, not written down: a hard-coded season would quietly be wrong
  // from the first of January and nobody would think to look at it.
  year: String(new Date().getFullYear()),
};
