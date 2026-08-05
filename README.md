# 🏀 Basketball Scoreboard — OBS Live Stream System

ระบบ Scoreboard สำหรับ Live Stream บาสเก็ตบอล ผ่าน OBS
สร้างด้วย React + Tailwind + Node.js + Socket.io

---

## 📁 โครงสร้างไฟล์

```
basketball-scoreboard/
├── server.js              ← Backend (Socket.io + Express)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── public/
│   └── overlay.html       ← หน้า OBS Browser Source
└── src/
    ├── main.jsx
    ├── index.css
    └── App.jsx            ← Control Panel หลัก
```

---

## 🛠️ ขั้นตอนการติดตั้ง

### ขั้นตอนที่ 1 — ติดตั้ง Node.js

ดาวน์โหลดและติดตั้งจาก: https://nodejs.org (แนะนำ LTS version)

ตรวจสอบว่าติดตั้งสำเร็จ:
```bash
node -v
npm -v
```

---

### ขั้นตอนที่ 2 — สร้าง Project

```bash
# 1. สร้างโฟลเดอร์ project
mkdir basketball-scoreboard
cd basketball-scoreboard

# 2. วางไฟล์ทั้งหมดตามโครงสร้างข้างบน

# 3. ติดตั้ง dependencies
npm install
```

---

### ขั้นตอนที่ 3 — รัน Server และ Control Panel

เปิด Terminal 2 หน้าต่าง:

**Terminal 1 — รัน Backend Server:**
```bash
node server.js
```

ถ้าสำเร็จจะเห็น:
```
🏀 Basketball Scoreboard Server
================================
🖥️  Control Panel : http://localhost:5173
📺 OBS Overlay   : http://localhost:3001/overlay
🔌 Socket Server : http://localhost:3001
```

**Terminal 2 — รัน React Control Panel:**
```bash
npm run client
```

หรือรัน 2 อย่างพร้อมกันด้วยคำสั่งเดียว:
```bash
npm run dev
```

---

### ขั้นตอนที่ 4 — เปิด Control Panel

เปิด Browser แล้วไปที่:
```
http://localhost:5173
```

คุณจะเห็นหน้า Control Panel พร้อม Overlay Preview

---

### ขั้นตอนที่ 5 — ตั้งค่า OBS

1. เปิด OBS Studio
2. ใน **Sources panel** กด **+** → เลือก **Browser**
3. ตั้งค่าดังนี้:
   - **URL:** `http://localhost:3001/overlay`
   - **Width:** `1920`
   - **Height:** `90`  *(ปรับตามต้องการ)*
   - ✅ เช็ค **"Shutdown source when not visible"** ถ้าอยากประหยัด CPU
4. กด OK
5. จัดตำแหน่ง Overlay ในหน้าต่าง Preview ของ OBS (ลากไปวางด้านล่างของจอ)

---

### ขั้นตอนที่ 6 — เริ่ม Live Stream

1. OBS: กด **"Start Streaming"** หรือ **"Start Recording"**
2. Browser: เปิด `http://localhost:5173` ไว้บนหน้าจออีกจอ
3. ✅ Overlay จะอัปเดต Real-time ทุกครั้งที่กดปุ่มใน Control Panel

---

## 🔥 ตั้งค่า Firebase (จำเป็นสำหรับระบบ Login / หลายผู้ใช้)

ระบบใช้ Firebase Authentication + Realtime Database เพื่อให้แต่ละบัญชีมีการแข่งของตัวเองแยกกัน
(ข้อมูลทุกอย่างอยู่ใต้ `users/{uid}/...`)

**โปรเจกต์ปัจจุบันตั้งค่าครบแล้ว** — ส่วนนี้จำเป็นเฉพาะตอนย้ายไป Firebase project ใหม่

### 1. เปิด Email/Password sign-in

Firebase Console → **Authentication** → **Sign-in method** → **Email/Password** → Enable → Save

> ถ้าข้ามขั้นนี้ ตอนสมัครสมาชิกจะขึ้น error `auth/configuration-not-found`

### 2. Publish Database Rules

Rules อยู่ในไฟล์ [`database.rules.json`](database.rules.json) — อ่านได้ทุกคน (สำหรับหน้า Arena Display
และ OBS overlay ที่ไม่ต้องล็อกอิน) แต่เขียนได้เฉพาะเจ้าของ uid นั้น

deploy ผ่าน CLI:
```bash
npx firebase login
```
```bash
npx firebase deploy --only database
```

หรือทำมือ: Console → **Realtime Database** → **Rules** → วางเนื้อหาจาก `database.rules.json` → **Publish**

> ⚠️ ถ้ายังไม่ publish rules ฐานข้อมูลจะเปิดให้ใครก็เขียนทับข้อมูลการแข่งได้

### 3. ใส่ค่า config ของโปรเจกต์ใหม่

แก้ `firebaseConfig` ใน [`src/firebase.js`](src/firebase.js) และ project id ใน `.firebaserc`

### ตรวจสอบว่าตั้งค่าครบหรือยัง (ไม่แตะข้อมูลจริง)

```bash
curl -s "https://identitytoolkit.googleapis.com/v1/projects?key=<WEB_API_KEY>"
```
ได้ `CONFIGURATION_NOT_FOUND` = ยังไม่ได้เปิด Authentication · ได้ JSON ที่มี `authorizedDomains` = เปิดแล้ว

```bash
curl -s -X PUT -d 'null' "<DATABASE_URL>/users/__probe__/x.json"
```
ได้ `Permission denied` = rules ถูกต้องแล้ว · ได้ `null` = rules ยังเปิดโล่ง (ค่า `null` ไม่สร้างข้อมูลใหม่)

---

## 🎮 วิธีใช้ Control Panel

| ส่วน | การใช้งาน |
|------|----------|
| **ชื่อทีม** | คลิกชื่อทีมเพื่อแก้ไข แล้วกด Enter |
| **+1 / +2 / +3** | เพิ่มคะแนนตามแต้มที่ทำได้ |
| **-1** | ลบคะแนน (กรณีกดผิด) |
| **FOUL** | เพิ่มฟาวล์ · เปลี่ยนสีแดงอัตโนมัติเมื่อถึง 5 ฟาวล์ |
| **USE T.O.** | ใช้ Timeout |
| **START / STOP** | เริ่ม/หยุดนาฬิกา |
| **↺ RESET** | รีเซ็ตนาฬิกาเป็นเวลาที่ตั้งไว้ |
| **QUICK SET** | ตั้งเวลา 12/10/5/2 นาทีทันที |
| **Q1–Q4 / OT** | เปลี่ยน Quarter/Period |
| **↺ RESET GAME** | รีเซ็ตคะแนนและข้อมูลทั้งหมด |

---

## 🌐 ใช้หลายเครื่อง (Control Panel บนมือถือ)

แก้ไข `src/App.jsx` บรรทัดนี้:
```js
// เปลี่ยนจาก:
const socket = io("http://localhost:3001");
// เป็น IP เครื่อง server เช่น:
const socket = io("http://192.168.1.100:3001");
```

แล้วเปิด Control Panel บน tablet หรือมือถือที่:
```
http://192.168.1.100:5173
```

---

## ✅ Features ทั้งหมด

- [x] คะแนนแต่ละทีม (+1, +2, +3, -1)
- [x] นับฟาวล์ + Warning เมื่อ ≥5
- [x] Timeout tracker
- [x] Clock server-side (นับเวลาแม่นยำ)
- [x] เปลี่ยน Quarter / OT
- [x] Overlay พื้นหลังโปร่งใส (OBS ready)
- [x] Real-time sync ทุก client
- [x] Score bump animation
- [x] แก้ชื่อทีมได้ real-time
- [x] Status LIVE / STOPPED บน Overlay

---

## 🔧 Troubleshooting

**Overlay ไม่แสดงใน OBS:**
- ตรวจสอบว่า server.js รันอยู่
- ลอง refresh Browser Source (คลิกขวา → Refresh)
- ตรวจสอบ Firewall ว่าไม่บล็อก port 3001

**Control Panel ขึ้น "DISCONNECTED":**
- ตรวจสอบว่า `node server.js` รันอยู่
- ตรวจว่า port 3001 ไม่ถูกใช้โดยโปรแกรมอื่น

**นาฬิกาไม่นับ:**
- ต้องกด START บน Control Panel
- Server ต้องรันอยู่ (clock อยู่ที่ server ไม่ใช่ browser)
