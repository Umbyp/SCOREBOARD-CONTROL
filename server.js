import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ─── Game State ────────────────────────────────────────────────────────────
// เวลาเก็บเป็น "tenths" (1 = 0.1 วินาที)
// shotClockTenths: 0–240 (24.0 วินาที)
// clockTenths: เช่น 6000 = 10:00

let gameState = {
  teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#FF6B35" },
  teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#00D4FF" },
  quarter: 1,
  clockTenths: 6000,   // 10:00 = 6000 tenths
  isRunning: false,
  shotClockTenths: 240, // 24.0s = 240 tenths
  shotRunning: false,
  possession: null,    // "teamA" | "teamB" | null
  jumpBall: false,
};

let clockInterval = null;
let shotInterval = null;

// ── Game Clock (tick ทุก 100ms) ───────────────────────────────────────────
function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    if (gameState.clockTenths <= 0) {
      stopClock();
      gameState.isRunning = false;
      broadcast();
      return;
    }
    gameState.clockTenths = Math.max(0, gameState.clockTenths - 2);
    broadcast();
  }, 200);
}

function stopClock() {
  clearInterval(clockInterval);
  clockInterval = null;
}

// ── Shot Clock (tick ทุก 100ms) ───────────────────────────────────────────
function startShot() {
  if (shotInterval) return;
  shotInterval = setInterval(() => {
    if (gameState.shotClockTenths <= 0) {
      stopShot();
      gameState.shotRunning = false;
      broadcast();
      return;
    }
    gameState.shotClockTenths = Math.max(0, gameState.shotClockTenths - 2);
    broadcast();
  }, 200);
}

function stopShot() {
  clearInterval(shotInterval);
  shotInterval = null;
}

function broadcast() {
  io.emit("stateUpdate", gameState);
}

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/overlay", (req, res) => res.sendFile(path.join(__dirname, "public", "overlay.html")));
app.get("/api/state", (req, res) => res.json(gameState));

// ─── Socket Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("stateUpdate", gameState);

  socket.on("action", (data) => {
    const { type, team, value } = data;

    switch (type) {

      // ── คะแนน ──
      case "score":
        gameState[team].score = Math.max(0, gameState[team].score + value);
        break;

      // ── Personal Foul ──
      case "foul":
        gameState[team].fouls = Math.max(0, Math.min(6, gameState[team].fouls + value));
        break;

      // ── Team Foul ──
      case "teamFoul":
        gameState[team].teamFouls = Math.max(0, Math.min(10, gameState[team].teamFouls + value));
        break;
      case "teamFoulReset":
        gameState[team].teamFouls = 0;
        break;

      // ── Timeout ──
      case "timeout":
        gameState[team].timeouts = Math.max(0, Math.min(7, gameState[team].timeouts + value));
        break;

      // ── ชื่อทีม ──
      case "teamName":
        gameState[team].name = value;
        break;

      // ── Possession / Jump Ball ──
      case "possession":
        gameState.possession = value; // "teamA" | "teamB" | null
        gameState.jumpBall = false;
        break;
      case "jumpBall":
        gameState.jumpBall = !gameState.jumpBall;
        if (gameState.jumpBall) gameState.possession = null;
        break;

      // ── Game Clock ──
      case "clockToggle":
        if (gameState.isRunning) {
          stopClock();
          gameState.isRunning = false;
        } else {
          startClock();
          gameState.isRunning = true;
        }
        break;
      case "clockReset":
        stopClock();
        gameState.isRunning = false;
        gameState.clockTenths = value; // value ส่งมาเป็น tenths
        break;
      case "clockSet":
        stopClock();
        gameState.isRunning = false;
        gameState.clockTenths = value;
        break;
      case "clockAdjust":
        // ปรับ +/- tenths (เช่น +10 = +1 วินาที)
        gameState.clockTenths = Math.max(0, gameState.clockTenths + value);
        break;

      // ── Shot Clock ──
      case "shotClockToggle":
        if (gameState.shotRunning) {
          stopShot();
          gameState.shotRunning = false;
        } else {
          startShot();
          gameState.shotRunning = true;
        }
        break;
      case "shotClockSet":
        stopShot();
        gameState.shotClockTenths = value * 10; // value = 24 or 14 → tenths
        gameState.shotRunning = true;
        startShot();
        break;
      case "shotClockStop":
        stopShot();
        gameState.shotRunning = false;
        break;

      // ── Quarter ──
      case "quarter":
        gameState.quarter = value;
        break;

      // ── Reset ──
      case "resetGame":
        stopClock();
        stopShot();
        gameState = {
          teamA: { name: gameState.teamA.name, score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#FF6B35" },
          teamB: { name: gameState.teamB.name, score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#00D4FF" },
          quarter: 1,
          clockTenths: 6000,
          isRunning: false,
          shotClockTenths: 240,
          shotRunning: false,
          possession: null,
          jumpBall: false,
        };
        break;
    }

    broadcast();
  });

  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, () => {
  console.log("\n🏀 Basketball Scoreboard Server");
  console.log("================================");
  console.log(`🖥️  Control Panel : http://localhost:5173`);
  console.log(`📺 OBS Overlay   : http://localhost:${PORT}/overlay`);
  console.log(`🔌 Socket Server : http://localhost:${PORT}\n`);
});