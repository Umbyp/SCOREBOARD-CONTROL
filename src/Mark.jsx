// Mark.jsx — the product mark.
//
// One glyph in five places: the Home and Login mastheads, and the league badge
// on the control panel, the arena screen and the OBS overlay whenever the
// organiser has not uploaded a logo of their own.
//
// It used to be a basketball — a circle with seams — drawn separately in each
// of those five files. That stopped being true when badminton and 7-a-side
// football joined the registry: the arena board would put a ball above a
// badminton match, and the same ball stood in for the league crest.
//
// So the mark is the thing the product actually is, whatever sport is on it:
// a board, a divider, and a score on either side. Line art at the same weight
// as the rest of the console's icons.
//
// public/overlay.html carries its own copy of this path because it is served
// statically and cannot import from here — keep the two in step.

export default function Mark({ size = 24, color = "currentColor", strokeWidth = 1.4, opacity = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" opacity={opacity}
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5.5" width="20" height="13" rx="2.5" />
      {/* The halves. Dimmed so the two scores read first at badge sizes. */}
      <path d="M12 5.5v13" strokeOpacity="0.45" />
      <path d="M6 12h3.5M14.5 12h3.5" />
    </svg>
  );
}
