import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ─── Game State ────────────────────────────────────────────────────────────
let gameState = {
  teamA: { name: "HOME", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#FF6B35" },
  teamB: { name: "AWAY", score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#00D4FF" },
  quarter: 1,
  clockSeconds: 600,
  isRunning: false,
  shotClock: 24,
  shotRunning: false,
};

let shotInterval = null;

function startShot() {
  if (shotInterval) return;
  shotInterval = setInterval(() => {
    if (gameState.shotClock <= 0) {
      stopShot();
      gameState.shotRunning = false;
      broadcast();
      return;
    }
    gameState.shotClock -= 1;
    broadcast();
  }, 1000);
}

function stopShot() {
  clearInterval(shotInterval);
  shotInterval = null;
}

let clockInterval = null;

// ─── Clock Logic (Server-Side) ─────────────────────────────────────────────
function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    if (gameState.clockSeconds <= 0) {
      stopClock();
      gameState.isRunning = false;
      broadcast();
      return;
    }
    gameState.clockSeconds -= 1;
    broadcast();
  }, 1000);
}

function stopClock() {
  clearInterval(clockInterval);
  clockInterval = null;
}

function broadcast() {
  io.emit("stateUpdate", gameState);
}

// ─── CORS (สำคัญสำหรับ OBS browser) ─────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

// ─── Serve Overlay HTML ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

app.get("/overlay", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "overlay.html"));
});

// ─── REST API: Polling fallback สำหรับ OBS ────────────────────────────────
app.get("/api/state", (req, res) => {
  res.json(gameState);
});

// ─── Socket.io Events ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // ส่ง state ปัจจุบันให้ client ที่เพิ่ง connect
  socket.emit("stateUpdate", gameState);

  // รับ action จาก Control Panel
  socket.on("action", (data) => {
    const { type, team, value } = data;

    switch (type) {
      // ── คะแนน ──
      case "score":
        gameState[team].score = Math.max(0, gameState[team].score + value);
        break;

      // ── ฟาวล์ ──
      case "foul":
        gameState[team].fouls = Math.max(
          0,
          Math.min(10, gameState[team].fouls + value)
        );
        break;

      // ── ไทม์เอาต์ ──
      case "timeout":
        gameState[team].timeouts = Math.max(
          0,
          Math.min(5, gameState[team].timeouts + value)
        );
        break;

      // ── ชื่อทีม ──
      case "teamName":
        gameState[team].name = value;
        break;

      // ── นาฬิกา start/stop ──
      case "clockToggle":
        if (gameState.isRunning) {
          stopClock();
          gameState.isRunning = false;
        } else {
          startClock();
          gameState.isRunning = true;
        }
        break;

      // ── reset นาฬิกา ──
      case "clockReset":
        stopClock();
        gameState.isRunning = false;
        gameState.clockSeconds = value || 600;
        break;

      // ── ตั้งเวลา ──
      case "clockSet":
        stopClock();
        gameState.isRunning = false;
        gameState.clockSeconds = value;
        break;

      // ── เปลี่ยน Quarter ──
      case "quarter":
        gameState.quarter = value;
        break;

      // ── Shot Clock toggle ──
      case "shotClockToggle":
        if (gameState.shotRunning) {
          stopShot();
          gameState.shotRunning = false;
        } else {
          startShot();
          gameState.shotRunning = true;
        }
        break;

      // ── Shot Clock set (24 or 14) → reset + auto-start ──
      case "shotClockSet":
        stopShot();
        gameState.shotClock = value;
        gameState.shotRunning = true;
        startShot();
        break;

      // ── Team Fouls ──
      case "teamFoul":
        gameState[team].teamFouls = Math.max(0, Math.min(10, gameState[team].teamFouls + value));
        break;

      case "teamFoulReset":
        gameState[team].teamFouls = 0;
        break;

      // ── Reset ทั้งเกม ──
      case "resetGame":
        stopClock();
        stopShot();
        gameState = {
          teamA: { name: gameState.teamA.name, score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#FF6B35" },
          teamB: { name: gameState.teamB.name, score: 0, fouls: 0, teamFouls: 0, timeouts: 7, color: "#00D4FF" },
          quarter: 1,
          clockSeconds: 600,
          isRunning: false,
          shotClock: 24,
          shotRunning: false,
        };
        break;
    }

    broadcast();
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("");
  console.log("🏀 Basketball Scoreboard Server");
  console.log("================================");
  console.log(`🖥️  Control Panel : http://localhost:5173`);
  console.log(`📺 OBS Overlay   : http://localhost:${PORT}/overlay`);
  console.log(`🔌 Socket Server : http://localhost:${PORT}`);
  console.log("");
});