// sound.js — the horn and the end-of-period buzzer.
//
// Two elements rather than one so a horn and a buzzer can overlap without
// cutting each other off mid-blast.

const hornAudio   = typeof Audio !== "undefined" ? new Audio("/horn.mp3") : null;
const buzzerAudio = typeof Audio !== "undefined" ? new Audio("/horn.mp3") : null;

const HORN_VOLUME   = 0.8;
const BUZZER_VOLUME = 1.0;

if (hornAudio)   { hornAudio.preload   = "auto"; hornAudio.volume   = HORN_VOLUME; }
if (buzzerAudio) { buzzerAudio.preload = "auto"; buzzerAudio.volume = BUZZER_VOLUME; }

// Browsers only let audio play if a user gesture asked for it, and the buzzer
// at 0:00 is fired by a socket update rather than by a click — so both
// elements are primed on the operator's first interaction with the panel.
//
// The priming play MUST be silent, which is the whole point of the muting
// below: play() genuinely starts playback and the pause() only lands once its
// promise resolves, a tick or more later. Priming at the real volume therefore
// sounded the horn — both elements at once — the moment the operator clicked
// anywhere on the panel, having touched neither the clock nor the horn.
//
// iOS ignores writes to `volume` on media elements, so mute as well; between
// the two, every browser this runs on stays quiet.
let unlocked = false;

// Elements currently mid-priming. A real playback removes itself from here so
// that the priming pause() cannot reach in and cut it off — which is the other
// way this used to misbehave, when the operator's first click was the horn
// button itself and the bubbling unlock silenced the blast it had just fired.
const priming = new Set();

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;

  for (const a of [hornAudio, buzzerAudio]) {
    if (!a || !a.paused) continue; // already sounding for real — leave it be
    const volume = a.volume;
    a.muted = true;
    a.volume = 0;
    priming.add(a);

    const finish = () => {
      if (!priming.delete(a)) return; // a real playback claimed it meanwhile
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      a.volume = volume;
    };
    // Rejected play (no gesture yet, or no audio device) still has to restore.
    a.play().then(finish, finish);
  }
}

function sound(a, volume) {
  if (!a) return;
  priming.delete(a); // this one is wanted — priming must not stop it
  a.muted = false;
  a.currentTime = 0;
  a.volume = volume;
  a.play().catch(() => {});
}

export const playHorn   = () => sound(hornAudio, HORN_VOLUME);
export const playBuzzer = () => sound(buzzerAudio, BUZZER_VOLUME);

// Test seam — lets the unlock behaviour be exercised without a login.
export const __audio = { hornAudio, buzzerAudio, priming, isUnlocked: () => unlocked };
