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

let gameState = {
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
};
  broadcast(); 

let clockInterval = null;
let shotInterval = null;
let lastClockTick = Date.now();
let lastShotTick = Date.now();

function startClock() {
  if (clockInterval) return;
  lastClockTick = Date.now();
  clockInterval = setInterval(() => {
    const now = Date.now();
    const tenths = (now - lastClockTick) / 100;
    lastClockTick = now;
    gameState.clockTenths = Math.max(0, gameState.clockTenths - tenths);
    
    if (gameState.clockTenths <= 0) { 
      stopClock(); 
      gameState.isRunning = false; 
      // 🏀 เมื่อหมดเวลาหลัก บังคับหยุด Shot Clock ด้วย
      stopShot();
      gameState.shotRunning = false;
    }
    broadcast();
  }, 100);
}
function stopClock() { clearInterval(clockInterval); clockInterval = null; }

function startShot() {
  if (shotInterval) return;
  lastShotTick = Date.now();
  shotInterval = setInterval(() => {
    const now = Date.now();
    const tenths = (now - lastShotTick) / 100;
    lastShotTick = now;
    gameState.shotClockTenths = Math.max(0, gameState.shotClockTenths - tenths);
    if (gameState.shotClockTenths <= 0) { stopShot(); gameState.shotRunning = false; }
    broadcast();
  }, 100);
}
function stopShot() { clearInterval(shotInterval); shotInterval = null; }

function broadcast() { io.emit("stateUpdate", gameState); }

app.use((req, res, next) => { res.header("Access-Control-Allow-Origin", "*"); next(); });
app.use(express.static(path.join(__dirname, "public")));
app.get("/overlay", (req, res) => res.sendFile(path.join(__dirname, "public", "overlay.html")));
app.get("/api/state", (req, res) => res.json(gameState));

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);
  socket.emit("stateUpdate", gameState);

  socket.on("action", ({ type, team, value }) => {
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

      // 🏀 --- Time Management Logic --- 🏀
      case "clockToggle":
        if (gameState.isRunning) { 
          stopClock(); 
          gameState.isRunning = false; 
          // เมื่อหยุดเวลาหลัก ต้องบังคับหยุด Shot Clock ด้วยเสมอ
          if (gameState.shotRunning) {
            stopShot();
            gameState.shotRunning = false;
          }
        } else { 
          startClock(); 
          gameState.isRunning = true; 
          // เมื่อเริ่มเวลาหลัก ถ้า Shot Clock ยังมีเวลาเหลือ ให้มันเริ่มเดินตามอัตโนมัติ
          if (gameState.shotClockTenths > 0) {
            startShot();
            gameState.shotRunning = true;
          }
        }
        break;
      case "clockSet":
        stopClock();
        gameState.isRunning = false;
        // ถ้าไปตั้งเวลาหลักใหม่ ให้หยุด Shot clock ด้วยเผื่อความชัวร์ (สถานะลูกตาย)
        stopShot();
        gameState.shotRunning = false;
        
        gameState.clockTenths = value;
        gameState.lastClockSet = value;
        break;
      case "clockReset":
        stopClock();
        gameState.isRunning = false;
        // รีเซ็ตเวลาหลัก = ลูกตาย หยุด Shot Clock ด้วย
        stopShot();
        gameState.shotRunning = false;

        gameState.clockTenths = gameState.lastClockSet;
        break;
      case "clockAdjust":
        gameState.clockTenths = Math.max(0, gameState.clockTenths + value);
        break;
      case "shotClockToggle":
        if (gameState.shotRunning) { 
          stopShot(); 
          gameState.shotRunning = false; 
        } else { 
          // ป้องกันไม่ให้กดเริ่ม Shot Clock แบบแมนนวล ถ้า Game Clock ยังไม่เดิน (ตามกฎบาส)
          if (gameState.isRunning) {
            startShot(); 
            gameState.shotRunning = true; 
          }
        }
        break;
      case "shotClockSet":
        stopShot();
        gameState.shotClockTenths = value * 10;
        // จะให้ Shot Clock เริ่มเดินอัตโนมัติ ก็ต่อเมื่อเวลาหลักกำลังเดินอยู่เท่านั้น (เช่น รีบาวด์ได้ตอนเวลาเดินอยู่)
        if (gameState.isRunning) {
          gameState.shotRunning = true;
          startShot();
        } else {
          gameState.shotRunning = false;
        }
        break;
      case "shotClockAdjust":
        gameState.shotClockTenths = Math.max(0, gameState.shotClockTenths + value);
        break;
      // ---------------------------------

      case "quarter":
        gameState.quarter = value;
        break;
      case "newQuarter":
        // value = quarter number ใหม่
        stopClock();
        stopShot();
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
        stopClock();
        stopShot();
        gameState = {
          teamA: { name: gameState.teamA.name, score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 7, color: gameState.teamA.color },
          teamB: { name: gameState.teamB.name, score: 0, fouls: 0, teamFouls: 0, techFouls: 0, timeouts: 7, color: gameState.teamB.color },
          quarter: 1, clockTenths: 6000, lastClockSet: 6000, isRunning: false,
          shotClockTenths: 240, shotRunning: false, possession: null, jumpBall: false,
        };
        break;
    }
  });
  broadcast();
  socket.on("disconnect", () => console.log("❌ Disconnected:", socket.id));
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🏀 Basketball Scoreboard`);
  console.log(`========================`);
  console.log(`🖥️  Control : http://localhost:5173`);
  console.log(`📺 Overlay  : http://localhost:${PORT}/overlay\n`);
});