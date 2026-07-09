// Home.jsx — navigation hub, "Broadcast Console" design system
import { c, font, r, overline, shadow, FONT_IMPORT } from "./theme";

// ── Minimal line icons (no emoji) ─────────────────────────────
const Icon = ({ name, size = 22, color = "currentColor" }) => {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "control": // sliders
      return (<svg {...common}><line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.4" fill={c.surface}/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.4" fill={c.surface}/></svg>);
    case "display": // monitor
      return (<svg {...common}><rect x="3" y="4" width="18" height="12" rx="1.5"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/></svg>);
    case "players": // users
      return (<svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.6"/><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9"/></svg>);
    case "overlay": // broadcast
      return (<svg {...common}><circle cx="12" cy="12" r="2.2"/><path d="M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9"/><path d="M4.8 4.8a10 10 0 0 0 0 14.4M19.2 4.8a10 10 0 0 1 0 14.4"/></svg>);
    default: return null;
  }
};

const Ball = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={c.text} strokeWidth="1.4">
    <circle cx="12" cy="12" r="9.2" />
    <path d="M12 2.8v18.4M2.8 12h18.4M5.2 5.2c3.4 2.4 3.4 11.2 0 13.6M18.8 5.2c-3.4 2.4-3.4 11.2 0 13.6" strokeOpacity="0.55" />
  </svg>
);

export default function Home({ onNavigate }) {
  const cards = [
    { id: "control", index: "01", icon: "control", title: "SCOREBOARD CONTROL",
      desc: "แผงควบคุมหลักของ Operator — คะแนน นาฬิกา ฟาวล์ และ Timeout",
      hint: "OPERATOR", accent: c.gold },
    { id: "display", index: "02", icon: "display", title: "ARENA DISPLAY",
      desc: "จอเต็มสำหรับโปรเจกเตอร์หรือทีวีในสนามแข่งขัน",
      hint: "ARENA", accent: "#2FA8DC" },
    { id: "players", index: "03", icon: "players", title: "PLAYER MANAGER",
      desc: "จัดการรายชื่อและฟาวล์รายบุคคล ซิงก์กับ Firebase ทันที",
      hint: "ROSTER", accent: c.live },
    { id: "overlay", index: "04", icon: "overlay", title: "OBS OVERLAY",
      desc: "Score bug แบบโปร่งใสสำหรับ Live Stream · 1920×1080",
      hint: "BROWSER SOURCE", accent: "#E86A3A" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: c.bg, color: c.text,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "clamp(32px,7vh,80px) 24px",
      fontFamily: font.body, position: "relative", overflow: "hidden",
    }}>
      <style>{`
        ${FONT_IMPORT}
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes hb-pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .hb-card{transition:transform .18s ease, border-color .18s ease, background .18s ease;}
        .hb-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,0.16);background:${c.surface2};}
        .hb-card:hover .hb-arrow{transform:translateX(4px);}
        .hb-arrow{transition:transform .18s ease;}
      `}</style>

      {/* faint top vignette — atmosphere, not neon */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(120% 80% at 50% -20%, rgba(255,255,255,0.035), transparent 60%)" }} />

      {/* Masthead */}
      <header style={{ width: "100%", maxWidth: 1080, marginBottom: "clamp(32px,6vh,64px)",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: r.md, background: c.surface,
            border: `1px solid ${c.lineStrong}`, display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0 }}>
            <Ball size={28} />
          </div>
          <div>
            <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: "clamp(26px,4vw,40px)",
              letterSpacing: "0.06em", lineHeight: 0.95 }}>
              BASKETBALL <span style={{ color: c.dim, fontWeight: 300 }}>SCOREBOARD</span>
            </div>
            <div style={{ ...overline({ marginTop: 6, color: c.mute, letterSpacing: "0.42em" }) }}>
              LIVE BROADCAST SYSTEM
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 9,
          padding: "7px 14px", borderRadius: r.pill, background: c.surface,
          border: `1px solid ${c.line}` }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.live,
            animation: "hb-pulse 2.4s ease-in-out infinite" }} />
          <span style={{ ...overline({ color: c.live, letterSpacing: "0.24em" }) }}>READY</span>
        </div>
      </header>

      {/* Cards */}
      <main style={{ width: "100%", maxWidth: 1080, display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {cards.map((card) => (
          <button key={card.id} onClick={() => onNavigate(card.id)} className="hb-card"
            style={{ textAlign: "left", cursor: "pointer", background: c.surface,
              border: `1px solid ${c.line}`, borderRadius: r.xl, padding: 24,
              display: "flex", flexDirection: "column", gap: 0, minHeight: 220,
              position: "relative", boxShadow: shadow.sm, color: c.text }}>
            {/* top row: index + hint */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 22 }}>
              <span style={{ fontFamily: font.num, fontSize: 15, fontWeight: 500,
                color: card.accent, letterSpacing: "0.1em" }}>{card.index}</span>
              <span style={{ ...overline({ fontSize: 9, color: c.faint }) }}>{card.hint}</span>
            </div>

            {/* icon */}
            <div style={{ width: 44, height: 44, borderRadius: r.md, background: c.surface2,
              border: `1px solid ${c.line}`, display: "flex", alignItems: "center",
              justifyContent: "center", color: card.accent, marginBottom: 18 }}>
              <Icon name={card.icon} size={22} color={card.accent} />
            </div>

            {/* title */}
            <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: 21,
              letterSpacing: "0.02em", lineHeight: 1.05, marginBottom: 8 }}>
              {card.title}
            </div>

            {/* desc */}
            <div style={{ fontFamily: font.body, fontSize: 14, lineHeight: 1.5,
              color: c.dim, marginBottom: "auto" }}>{card.desc}</div>

            {/* footer */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20,
              ...overline({ fontSize: 10, color: c.mute, letterSpacing: "0.2em" }) }}>
              เปิด
              <span className="hb-arrow" style={{ color: card.accent, fontSize: 15,
                display: "inline-block", lineHeight: 1 }}>→</span>
            </div>
          </button>
        ))}
      </main>

      {/* Footer */}
      <footer style={{ marginTop: "auto", paddingTop: 48, textAlign: "center",
        ...overline({ fontSize: 9.5, color: c.faint, letterSpacing: "0.32em" }) }}>
        THAILAND OPEN 2026 · REALTIME VIA SOCKET.IO
      </footer>
    </div>
  );
}
