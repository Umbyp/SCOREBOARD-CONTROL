import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { jwtVerify, createRemoteJWKSet } from "jose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ✅ FIX 1: ใช้ env var แทน hardcode URL
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173"];

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

function createEntry(uid) {
  return {
    uid,
    data: {
      teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#FF6B35" },
      teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: "#00D4FF" },
      quarter: 1,
      clockTenths: 6000,
      lastClockSet: 6000,
      isRunning: false,
      shotClockTenths: 240,
      shotRunning: false,
      possession: null,
      jumpBall: false,
    },
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
  entry.lastClockTick = Date.now();
  entry.clockInterval = setInterval(() => {
    const now = Date.now();
    const tenths = (now - entry.lastClockTick) / 100;
    entry.lastClockTick = now;
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

  socket.on("action", ({ type, team, value }) => {
    // Invariant: every mutation is scoped to the verified token's own uid —
    // never to a client-supplied uid, never to whatever room this socket
    // happens to have joined. This must stay the first line of this handler.
    if (!socket.data.uid) return;

    const entry = getEntry(socket.data.uid);
    const gameState = entry.data;
    entry.lastActivityAt = Date.now();

    switch (type) {
      case "score":
        gameState[team].score = Math.max(0, gameState[team].score + value);
        break;
      case "foul":
        gameState[team].fouls = Math.max(0, Math.min(6, gameState[team].fouls + value));
        break;
      case "techFoul":
        gameState[team].techFouls = Math.max(0, (gameState[team].techFouls || 0) + value);
        break;
      case "teamFoul":
        gameState[team].teamFouls = Math.max(0, Math.min(10, gameState[team].teamFouls + value));
        break;
      case "teamFoulReset":
        gameState[team].teamFouls = 0;
        break;
      case "timeout":
        gameState[team].timeouts = Math.max(0, Math.min(7, gameState[team].timeouts + value));
        break;
      case "teamName":
        gameState[team].name = value;
        break;
      case "teamColor":
        gameState[team].color = value;
        break;
      case "possession":
        gameState.possession = value;
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
      case "clockSet":
        stopClock(entry);
        gameState.isRunning = false;
        stopShot(entry);
        gameState.shotRunning = false;
        gameState.clockTenths = value;
        gameState.lastClockSet = value;
        break;
      case "clockReset":
        stopClock(entry);
        gameState.isRunning = false;
        stopShot(entry);
        gameState.shotRunning = false;
        gameState.clockTenths = gameState.lastClockSet;
        break;
      case "clockAdjust":
        gameState.clockTenths = Math.max(0, gameState.clockTenths + value);
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
        gameState.shotClockTenths = value * 10;
        if (gameState.isRunning) {
          gameState.shotRunning = true;
          startShot(entry);
        } else {
          gameState.shotRunning = false;
        }
        break;
      case "shotClockAdjust":
        gameState.shotClockTenths = Math.max(0, gameState.shotClockTenths + value);
        break;

      case "quarter":
        gameState.quarter = value;
        break;
      case "newQuarter":
        stopClock(entry);
        stopShot(entry);
        gameState.quarter = value;
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
        entry.data = {
          teamA: { name: gameState.teamA.name, score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: gameState.teamA.color },
          teamB: { name: gameState.teamB.name, score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 2, color: gameState.teamB.color },
          quarter: 1, clockTenths: 6000, lastClockSet: 6000, isRunning: false,
          shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
        };
        break;
    }
    broadcast(entry);
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
  console.log(`🖥️  Control : http://localhost:5173`);
  console.log(`📺 Overlay  : http://localhost:${PORT}/overlay\n`);
});
