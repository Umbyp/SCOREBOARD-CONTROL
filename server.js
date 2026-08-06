import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { getSport, isSport, initialState, DEFAULT_SPORT } from "./shared/sports/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ✅ FIX 1: ใช้ env var แทน hardcode URL
//
// A browser's Origin header is always bare — no trailing slash, no spaces —
// but this env var is typed by hand into a hosting dashboard, where pasting
// "https://app.example.com/" or "a, b" is the natural thing to do. Either one
// used to fail the exact-match below and silently reject every connection from
// the real site, with nothing in the logs to say so. Normalise instead.
const normaliseOrigin = (o) => o.trim().replace(/\/+$/, "");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",").map(normaliseOrigin).filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ── Multi-tenant game state ────────────────────────────────────────────────
// Each signed-in user gets their own independent game (own clock, own score,
// own interval timers) keyed by their verified Firebase uid. There is no
// longer a single shared gameState — everything below is per-uid.
const gameStates = new Map();

function createEntry(uid, sport = DEFAULT_SPORT) {
  return {
    uid,
    data: initialState(sport),
    clockInterval: null,
    shotInterval: null,
    lastClockTick: Date.now(),
    lastShotTick: Date.now(),
    lastActivityAt: Date.now(),
  };
}
function getEntry(uid) {
  if (!gameStates.has(uid)) gameStates.set(uid, createEntry(uid));
  return gameStates.get(uid);
}

function startClock(entry) {
  if (entry.clockInterval) return;
  // Football's clock runs up and carries on into stoppage time — there is no
  // zero to hit, so it never self-stops; the operator stops it on the whistle.
  const countsUp = getSport(entry.data.sport).clockDirection === "up";
  entry.lastClockTick = Date.now();
  entry.clockInterval = setInterval(() => {
    const now = Date.now();
    const tenths = (now - entry.lastClockTick) / 100;
    entry.lastClockTick = now;

    if (countsUp) {
      entry.data.clockTenths = Math.min(CLOCK_MAX_TENTHS, entry.data.clockTenths + tenths);
      broadcast(entry);
      return;
    }

    entry.data.clockTenths = Math.max(0, entry.data.clockTenths - tenths);
    if (entry.data.clockTenths <= 0) {
      stopClock(entry);
      entry.data.isRunning = false;
      stopShot(entry);
      entry.data.shotRunning = false;
    }
    broadcast(entry);
  }, 100);
}
function stopClock(entry) { clearInterval(entry.clockInterval); entry.clockInterval = null; }

function startShot(entry) {
  if (entry.shotInterval) return;
  entry.lastShotTick = Date.now();
  entry.shotInterval = setInterval(() => {
    const now = Date.now();
    const tenths = (now - entry.lastShotTick) / 100;
    entry.lastShotTick = now;
    entry.data.shotClockTenths = Math.max(0, entry.data.shotClockTenths - tenths);
    if (entry.data.shotClockTenths <= 0) { stopShot(entry); entry.data.shotRunning = false; }
    broadcast(entry);
  }, 100);
}
function stopShot(entry) { clearInterval(entry.shotInterval); entry.shotInterval = null; }

function broadcast(entry) { io.to(entry.uid).emit("stateUpdate", entry.data); }

// ── Input validation for socket actions ────────────────────────────────────
// `team` arrives from the client and is used as an object key, so it must be
// whitelisted: an unknown key (missing/misspelled) crashes the handler on the
// following property read, and "__proto__" would write straight onto
// Object.prototype — either one takes down every tenant at once, since all
// games share this one process and live only in memory.
const TEAM_KEYS = new Set(["teamA", "teamB"]);
const TEAM_ACTIONS = new Set([
  "score", "foul", "techFoul", "teamFoul", "teamFoulReset",
  "timeout", "teamName", "partnerName", "teamColor",
  "yellowCard", "redCard",
]);

// Actions that exist outside any one sport's rulebook, so they are checked
// against the registry rather than against the active sport's action list.
const GLOBAL_ACTIONS = new Set(["setSport"]);

/**
 * A brand-new game of `sport`, carrying over only who is playing. The operator
 * typed those names and picked those colours; wiping them on every reset (or
 * on a sport switch) is pure annoyance, and neither is tied to the rules.
 */
function freshGame(sport, previous) {
  const data = initialState(sport);
  for (const key of TEAM_KEYS) {
    data[key].name = previous?.[key]?.name ?? data[key].name;
    data[key].color = previous?.[key]?.color ?? data[key].color;
  }
  return data;
}

const CLOCK_MAX_TENTHS = 59990; // 99:59.9
const SHOT_MAX_TENTHS = 990; // 99.0s

/** Coerce to a whole number inside [min,max]; non-numeric input yields `fallback`. */
function int(value, min, max, fallback = 0) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Team names are broadcast to every viewer — keep them short and printable. */
function cleanName(value, fallback) {
  if (typeof value !== "string") return fallback;
  const s = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 32);
  return s || fallback;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
function cleanColor(value, fallback) {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

// ── Firebase ID token verification (no firebase-admin / no service account) ─
// Firebase ID tokens are plain RS256 JWTs — verified here against Google's
// public JWKS. The verified `sub` claim is the ONLY uid ever trusted for
// writes; a client can never claim a uid for itself.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "basketball-tournament-62372";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
async function verifyFirebaseToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ["RS256"],
    clockTolerance: "5s",
  });
  return payload.sub;
}

// ✅ FIX 3: รวม CORS middleware เป็นอันเดียว ลบของซ้ำออก
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Private-Network", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/overlay", (req, res) => res.sendFile(path.join(__dirname, "public", "overlay.html")));
app.get("/api/state", (req, res) => {
  const uid = req.query.u;
  if (!uid) return res.status(400).json({ error: "missing ?u=<uid>" });
  const entry = gameStates.get(uid);
  res.json(entry ? entry.data : null);
});

// Verify a token if one was offered; connections without a token are still
// allowed through (read-only viewers — overlay/arena links carry no auth).
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.data.uid = await verifyFirebaseToken(token);
    } catch (e) {
      return next(new Error("invalid token"));
    }
  }
  next();
});

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id, socket.data.uid ? `(operator ${socket.data.uid})` : "(viewer)");

  // Authenticated operator — join their own room and get their current state.
  if (socket.data.uid) {
    socket.join(socket.data.uid);
    socket.emit("stateUpdate", getEntry(socket.data.uid).data);
  }

  // Read-only viewer (overlay.html / Arena Display) asking to watch a
  // specific account's game via ?u=<uid> — join-only, never trusted to write.
  const viewUid = socket.handshake.query?.uid;
  if (viewUid && viewUid !== socket.data.uid) {
    socket.join(viewUid);
    const entry = gameStates.get(viewUid);
    if (entry) socket.emit("stateUpdate", entry.data);
  }

  const onAction = ({ type, team, value }) => {
    // Invariant: every mutation is scoped to the verified token's own uid —
    // never to a client-supplied uid, never to whatever room this socket
    // happens to have joined. This must stay the first line of this handler.
    if (!socket.data.uid) return;

    // `team` indexes into gameState below — reject anything that isn't one of
    // the two real teams before it can crash the process or reach Object.prototype.
    if (TEAM_ACTIONS.has(type) && !TEAM_KEYS.has(team)) return;

    const entry = getEntry(socket.data.uid);
    const gameState = entry.data;

    // Second gate: the action must exist in the *active sport's* rulebook.
    // Hiding a button in the UI is not enough — a stale tab or a hand-crafted
    // socket frame could still send "shotClockSet" during a badminton match,
    // which would write a field that sport's state doesn't have.
    const sport = getSport(gameState.sport);
    if (!GLOBAL_ACTIONS.has(type) && !sport.actions.has(type)) return;

    entry.lastActivityAt = Date.now();

    switch (type) {
      case "score": {
        const delta = int(value, -99, 99);
        gameState[team].score = clamp(gameState[team].score + delta, 0, 999);
        // Rally sports end a game (and hand over serve) on the point itself.
        // Only a point *scored* triggers that — a −1 correction must not flip
        // the serve or hand out a game.
        if (delta > 0) sport.onScore?.(gameState, team);
        break;
      }
      case "foul":
        gameState[team].fouls = clamp(gameState[team].fouls + int(value, -6, 6), 0, 6);
        break;
      case "techFoul":
        gameState[team].techFouls = clamp((gameState[team].techFouls || 0) + int(value, -99, 99), 0, 99);
        break;
      case "teamFoul":
        gameState[team].teamFouls = clamp(gameState[team].teamFouls + int(value, -10, 10), 0, 10);
        break;
      case "teamFoulReset":
        gameState[team].teamFouls = 0;
        break;
      case "timeout":
        gameState[team].timeouts = clamp(gameState[team].timeouts + int(value, -7, 7), 0, 7);
        break;
      case "teamName":
        gameState[team].name = cleanName(value, gameState[team].name);
        break;
      case "partnerName":
        gameState[team].partner = cleanName(value, gameState[team].partner);
        break;
      case "yellowCard":
        gameState[team].yellowCards = clamp((gameState[team].yellowCards || 0) + int(value, -20, 20), 0, 20);
        break;
      case "redCard":
        gameState[team].redCards = clamp((gameState[team].redCards || 0) + int(value, -20, 20), 0, 20);
        break;
      case "serve":
        gameState.serve = TEAM_KEYS.has(value) ? value : null;
        break;
      case "setDoubles":
        gameState.doubles = !gameState.doubles;
        break;
      case "teamColor":
        gameState[team].color = cleanColor(value, gameState[team].color);
        break;
      case "possession":
        gameState.possession = TEAM_KEYS.has(value) ? value : null;
        gameState.jumpBall = false;
        break;
      case "jumpBall":
        gameState.jumpBall = !gameState.jumpBall;
        if (gameState.jumpBall) gameState.possession = null;
        break;

      case "clockToggle":
        if (gameState.isRunning) {
          stopClock(entry);
          gameState.isRunning = false;
          if (gameState.shotRunning) {
            stopShot(entry);
            gameState.shotRunning = false;
          }
        } else {
          startClock(entry);
          gameState.isRunning = true;
          if (gameState.shotClockTenths > 0) {
            startShot(entry);
            gameState.shotRunning = true;
          }
        }
        break;
      case "clockSet": {
        const tenths = int(value, 0, CLOCK_MAX_TENTHS, gameState.clockTenths);
        stopClock(entry);
        gameState.isRunning = false;
        stopShot(entry);
        gameState.shotRunning = false;
        gameState.clockTenths = tenths;
        gameState.lastClockSet = tenths;
        break;
      }
      case "clockReset":
        stopClock(entry);
        gameState.isRunning = false;
        stopShot(entry);
        gameState.shotRunning = false;
        gameState.clockTenths = gameState.lastClockSet;
        break;
      case "clockAdjust":
        gameState.clockTenths = clamp(
          gameState.clockTenths + int(value, -CLOCK_MAX_TENTHS, CLOCK_MAX_TENTHS),
          0, CLOCK_MAX_TENTHS
        );
        break;
      case "shotClockToggle":
        if (gameState.shotRunning) {
          stopShot(entry);
          gameState.shotRunning = false;
        } else {
          if (gameState.isRunning) {
            startShot(entry);
            gameState.shotRunning = true;
          }
        }
        break;
      case "shotClockSet":
        stopShot(entry);
        gameState.shotClockTenths = int(value, 0, SHOT_MAX_TENTHS / 10, 24) * 10;
        if (gameState.isRunning) {
          gameState.shotRunning = true;
          startShot(entry);
        } else {
          gameState.shotRunning = false;
        }
        break;
      case "shotClockAdjust":
        gameState.shotClockTenths = clamp(
          gameState.shotClockTenths + int(value, -SHOT_MAX_TENTHS, SHOT_MAX_TENTHS),
          0, SHOT_MAX_TENTHS
        );
        break;

      case "period":
        gameState.period = int(value, 1, 20, gameState.period);
        break;
      case "newPeriod":
        stopClock(entry);
        stopShot(entry);
        gameState.period = int(value, 1, 20, gameState.period);
        gameState.clockTenths = gameState.lastClockSet;
        gameState.isRunning = false;
        gameState.shotClockTenths = 240;
        gameState.shotRunning = false;
        gameState.teamA.fouls = 0;
        gameState.teamB.fouls = 0;
        gameState.teamA.teamFouls = 0;
        gameState.teamB.teamFouls = 0;
        gameState.possession = null;
        gameState.jumpBall = true;
        break;
      case "resetGame":
        stopClock(entry);
        stopShot(entry);
        entry.data = freshGame(gameState.sport, gameState);
        break;

      // Switching sport is a full game reset by design — the two rulebooks
      // don't share a state shape, so there is nothing meaningful to carry
      // over except who is playing. The client confirms with the operator
      // before sending this.
      case "setSport": {
        if (!isSport(value) || value === gameState.sport) break;
        stopClock(entry);
        stopShot(entry);
        entry.data = freshGame(value, gameState);
        break;
      }
    }
    broadcast(entry);
  };

  // Last line of defence. Validation above should stop every known bad input,
  // but an uncaught throw in here would kill the whole process — and with it
  // every other tenant's live game, since all state is in-memory. Log and
  // survive instead. `?? {}` covers an action emitted with no payload at all.
  socket.on("action", (payload) => {
    try {
      onAction(payload ?? {});
    } catch (err) {
      console.error("⚠️  action failed", { uid: socket.data.uid, type: payload?.type }, err);
    }
  });

  socket.on("disconnect", () => console.log("❌ Disconnected:", socket.id));
});

// Sweep abandoned rooms (nobody watching + idle a while) so memory doesn't
// grow forever. Deliberately simple — not a full eviction system.
const IDLE_SWEEP_MS = 10 * 60 * 1000;
const IDLE_LIMIT_MS = 45 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of gameStates) {
    const room = io.sockets.adapter.rooms.get(uid);
    const empty = !room || room.size === 0;
    if (empty && now - entry.lastActivityAt > IDLE_LIMIT_MS) {
      stopClock(entry);
      stopShot(entry);
      gameStates.delete(uid);
      console.log("🧹 Evicted idle room:", uid);
    }
  }
}, IDLE_SWEEP_MS);

// ✅ FIX 4: ใช้ process.env.PORT สำหรับ Render
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🏀 Basketball Scoreboard`);
  console.log(`========================`);
  // Printed so a CORS rejection is diagnosable from the host's logs alone —
  // an origin missing from this list is why a control panel sits on OFFLINE.
  console.log(`🔓 Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`🖥️  Control : http://localhost:5173`);
  console.log(`📺 Overlay  : http://localhost:${PORT}/overlay\n`);
});
