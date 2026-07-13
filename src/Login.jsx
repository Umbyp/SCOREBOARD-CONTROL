// Login.jsx — email/password sign-in / sign-up, "Broadcast Console" design system
import { useState } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { c, font, r, shadow, overline, panel, btn, FONT_IMPORT } from "./theme";

function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email": return "อีเมลไม่ถูกต้อง";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "auth/email-already-in-use": return "อีเมลนี้มีบัญชีอยู่แล้ว — ลองเข้าสู่ระบบแทน";
    case "auth/weak-password": return "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)";
    case "auth/operation-not-allowed": return "ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Console";
    case "auth/configuration-not-found": return "ยังไม่ได้เปิดใช้งาน Authentication ใน Firebase Console (Authentication → Sign-in method → Email/Password)";
    case "auth/network-request-failed": return "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง";
    default: return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
  }
}

export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const inp = {
    width: "100%", background: c.surface2, border: `1px solid ${c.line}`,
    borderRadius: r.sm, color: c.text, fontFamily: font.body, fontSize: 15,
    padding: "12px 14px", outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", background: c.bg, color: c.text, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20, fontFamily: font.body,
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        ${FONT_IMPORT}
        *{box-sizing:border-box;margin:0;padding:0;}
        input::placeholder{color:${c.faint};}
        input:focus{border-color:${c.lineStrong} !important;}
      `}</style>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.035), transparent 55%)" }} />

      <div style={panel({ position: "relative", width: "100%", maxWidth: 380, padding: 32, boxShadow: shadow.lg })}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ width: 46, height: 46, borderRadius: r.md, background: c.surface2, border: `1px solid ${c.lineStrong}`,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth="1.4">
              <circle cx="12" cy="12" r="9.2" />
              <path d="M12 2.8v18.4M2.8 12h18.4M5.2 5.2c3.4 2.4 3.4 11.2 0 13.6M18.8 5.2c-3.4 2.4-3.4 11.2 0 13.6" strokeOpacity="0.55" />
            </svg>
          </div>
          <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 22, letterSpacing: "0.04em" }}>
            BASKETBALL <span style={{ color: c.dim, fontWeight: 300 }}>SCOREBOARD</span>
          </div>
          <div style={{ ...overline({ fontSize: 9.5, marginTop: 6, letterSpacing: "0.32em" }) }}>
            {mode === "signup" ? "สร้างบัญชีใหม่" : "เข้าสู่ระบบ"}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ ...overline({ fontSize: 9, marginBottom: 5 }) }}>อีเมล</div>
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" style={inp} />
          </div>
          <div>
            <div style={{ ...overline({ fontSize: 9, marginBottom: 5 }) }}>รหัสผ่าน</div>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร" style={inp} />
          </div>

          {error && (
            <div style={{ background: c.dangerDim, border: `1px solid rgba(222,91,87,0.32)`, borderRadius: r.sm,
              padding: "9px 12px", color: c.danger, fontSize: 13, fontFamily: font.body }}>{error}</div>
          )}

          <button type="submit" disabled={busy} style={{ ...btn("gold", { active: true }), padding: "13px 0", fontSize: 15,
            letterSpacing: "0.08em", marginTop: 6, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
            {busy ? "กำลังดำเนินการ…" : mode === "signup" ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: c.mute }}>
          {mode === "signup" ? (
            <>มีบัญชีอยู่แล้ว?{" "}
              <button onClick={() => { setMode("signin"); setError(""); }} style={{ background: "none", border: "none", color: c.gold, cursor: "pointer", fontSize: 13, fontFamily: font.body, textDecoration: "underline" }}>เข้าสู่ระบบ</button>
            </>
          ) : (
            <>ยังไม่มีบัญชี?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: c.gold, cursor: "pointer", fontSize: 13, fontFamily: font.body, textDecoration: "underline" }}>สร้างบัญชีใหม่</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
