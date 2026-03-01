// Home.jsx — หน้าหลัก Navigation Hub
export default function Home({ onNavigate }) {
  const S = (style) => ({ fontFamily: "'Bebas Neue',Impact,sans-serif", ...style });

  const cards = [
    {
      id: "control",
      icon: "🎮",
      title: "SCOREBOARD CONTROL",
      subtitle: "จัดการคะแนน · นาฬิกา · ฟาวล์ · Timeout",
      desc: "แผงควบคุมหลักสำหรับ Operator ใช้งานระหว่างแข่งขัน",
      color: "#FF6B35",
      accent: "rgba(255,107,53,0.15)",
      border: "rgba(255,107,53,0.35)",
      hint: "OPERATOR PANEL",
    },
    {
      id: "display",
      icon: "📺",
      title: "ARENA DISPLAY",
      subtitle: "จอใหญ่แสดงคะแนนในสนาม",
      desc: "หน้าจอ Full Screen สำหรับโปรเจคเตอร์หรือ TV ในสนามแข่งขัน",
      color: "#00D4FF",
      accent: "rgba(0,212,255,0.12)",
      border: "rgba(0,212,255,0.3)",
      hint: "ARENA SCREEN",
    },
    {
      id: "players",
      icon: "👥",
      title: "PLAYER MANAGER",
      subtitle: "จัดการรายชื่อผู้เล่น + ฟาวล์แต่ละคน",
      desc: "เพิ่ม/ลบผู้เล่นได้ไม่จำกัด บันทึกข้อมูลขึ้น Firebase Realtime Database ทันที",
      color: "#00E87A",
      accent: "rgba(0,232,122,0.1)",
      border: "rgba(0,232,122,0.28)",
      hint: "FIREBASE SYNC",
    },
    {
      id: "overlay",
      icon: "🎬",
      title: "OBS OVERLAY",
      subtitle: "Browser Source สำหรับ OBS Studio",
      desc: "Score Bug แบบ Transparent สำหรับ Live Stream บน OBS",
      color: "#FFD700",
      accent: "rgba(255,215,0,0.1)",
      border: "rgba(255,215,0,0.3)",
      hint: "OBS · 1920×1080",
    },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 0%, #1a0f2e 0%, #08080f 50%, #0a0d14 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Background decoration */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(255,107,53,0.06) 0%, transparent 50%),
          radial-gradient(circle at 85% 80%, rgba(0,212,255,0.06) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(255,215,0,0.03) 0%, transparent 60%)
        `,
        pointerEvents: "none",
      }} />

      {/* Grid lines */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* Logo / Title */}
      <div style={{ textAlign: "center", marginBottom: 52, position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 14,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🏀</div>
          <div>
            <div style={{
              ...S({ fontSize: 52, letterSpacing: "0.2em", lineHeight: 0.9 }),
              background: "linear-gradient(135deg, #FF6B35 0%, #FFD700 45%, #00D4FF 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              BASKETBALL
            </div>
            <div style={{
              ...S({ fontSize: 22, letterSpacing: "0.6em", lineHeight: 1 }),
              color: "rgba(255,255,255,0.35)",
            }}>
              SCOREBOARD SYSTEM
            </div>
          </div>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 16px", borderRadius: 100,
          background: "rgba(0,232,122,0.07)",
          border: "1px solid rgba(0,232,122,0.2)",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#00E87A",
            boxShadow: "0 0 8px #00E87A",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <span style={{ ...S({ fontSize: 11, letterSpacing: "0.3em" }), color: "#00E87A" }}>
            LIVE BROADCAST READY
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 260px)",
        gap: 14,
        maxWidth: 1100,
        width: "100%",
      }}>
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            style={{
              background: `linear-gradient(160deg, ${card.accent}, rgba(0,0,0,0.4))`,
              border: `1px solid ${card.border}`,
              borderRadius: 20,
              padding: "32px 28px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s cubic-bezier(0.34, 1.3, 0.64, 1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
              e.currentTarget.style.boxShadow = `0 20px 50px ${card.color}22, 0 0 0 1px ${card.color}44`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Top glow line */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
            }} />

            {/* Hint badge */}
            <div style={{
              position: "absolute", top: 16, right: 16,
              ...S({ fontSize: 9, letterSpacing: "0.3em" }),
              color: card.color,
              background: `${card.color}15`,
              border: `1px solid ${card.color}30`,
              padding: "3px 8px", borderRadius: 100,
              opacity: 0.7,
            }}>
              {card.hint}
            </div>

            {/* Icon */}
            <div style={{ fontSize: 40, marginBottom: 16, lineHeight: 1 }}>
              {card.icon}
            </div>

            {/* Title */}
            <div style={{
              ...S({ fontSize: 26, letterSpacing: "0.12em", lineHeight: 1 }),
              color: card.color,
              marginBottom: 6,
            }}>
              {card.title}
            </div>

            {/* Subtitle */}
            <div style={{
              ...S({ fontSize: 13, letterSpacing: "0.08em" }),
              color: "rgba(255,255,255,0.5)",
              marginBottom: 14,
            }}>
              {card.subtitle}
            </div>

            {/* Divider */}
            <div style={{
              height: 1,
              background: `linear-gradient(90deg, ${card.color}30, transparent)`,
              marginBottom: 14,
            }} />

            {/* Description */}
            <div style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              lineHeight: 1.6,
              fontFamily: "system-ui",
            }}>
              {card.desc}
            </div>

            {/* Arrow */}
            <div style={{
              marginTop: 20,
              display: "flex", alignItems: "center", gap: 6,
              ...S({ fontSize: 12, letterSpacing: "0.2em" }),
              color: card.color, opacity: 0.7,
            }}>
              เปิดหน้านี้ <span style={{ fontSize: 16 }}>→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 48,
        ...S({ fontSize: 10, letterSpacing: "0.4em" }),
        color: "rgba(255,255,255,0.1)",
        textAlign: "center",
      }}>
        สนามบาส · THAILAND OPEN 2026 · POWERED BY SOCKET.IO
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}