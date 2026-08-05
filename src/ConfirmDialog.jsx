// ConfirmDialog.jsx — in-app replacement for window.confirm().
//
// Native dialogs are not reliable here: embedded browser views (the dev
// preview pane, OBS browser docks, some kiosk setups) suppress them and
// return false, so a confirm-gated button silently does nothing at all. That
// hit the sport switcher and ↺ RESET — both looked broken to the operator.
// Everything that asks "are you sure?" goes through this instead.
import { useState, useCallback, useEffect } from "react";
import { c, font, r, shadow, overline, btn } from "./theme";

function ConfirmDialog({ req, onClose }) {
  // Escape cancels, Enter confirms — the reflexes a native dialog gave us.
  useEffect(() => {
    if (!req) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Enter") { e.preventDefault(); req.onConfirm?.(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, onClose]);

  if (!req) return null;
  const tone = req.tone || "danger";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 900,
      background: "rgba(4,5,8,0.72)", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: "100%",
        background: c.surface, border: `1px solid ${c.lineStrong}`, borderRadius: r.lg,
        padding: "20px 22px", boxShadow: shadow.lg }}>
        <div style={{ ...overline({ marginBottom: 10, color: tone === "danger" ? c.danger : c.gold }) }}>
          {req.title}
        </div>
        {req.body && (
          <div style={{ fontFamily: font.body, fontSize: 14, color: c.dim, lineHeight: 1.65,
            marginBottom: 20, whiteSpace: "pre-line" }}>{req.body}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btn("neutral"), padding: "10px 18px", fontSize: 13, color: c.mute }}>
            ยกเลิก
          </button>
          <button autoFocus className="press" onClick={() => { req.onConfirm?.(); onClose(); }}
            style={{ ...btn(tone, { active: true }), padding: "10px 22px", fontSize: 13, letterSpacing: "0.06em" }}>
            {req.confirmLabel || "ยืนยัน"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns [ask, dialog]. Call ask({ title, body, confirmLabel, tone, onConfirm })
 * where you would have called window.confirm(), and render `dialog` once.
 */
export function useConfirm() {
  const [req, setReq] = useState(null);
  const ask = useCallback((cfg) => setReq(cfg), []);
  const close = useCallback(() => setReq(null), []);
  return [ask, <ConfirmDialog key="confirm" req={req} onClose={close} />];
}

export default ConfirmDialog;
