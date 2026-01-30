function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function hasAny(hay, needles = []) {
  const s = (hay || "").toLowerCase();
  return needles.some((n) => s.includes(String(n).toLowerCase()));
}

async function getVoicesSafe(timeoutMs = 700) {
  if (typeof window === "undefined") return [];
  const synth = window.speechSynthesis;
  if (!synth) return [];

  let voices = synth.getVoices?.() || [];
  if (voices.length) return voices;

  return await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        synth.removeEventListener?.("voiceschanged", onChange);
      } catch {}
      resolve(synth.getVoices?.() || []);
    };
    const onChange = () => finish();
    try {
      synth.addEventListener?.("voiceschanged", onChange);
    } catch {}
    setTimeout(finish, timeoutMs);
  });
}

function pickVoice(voices, gender = "female") {
  const list = Array.isArray(voices) ? voices : [];
  if (!list.length) return null;

  const preferLang = ["en-IN", "en-GB", "en-US", "en"];
  const byLang = (v) => {
    const lang = (v?.lang || "").toLowerCase();
    const idx = preferLang.findIndex((p) => lang.startsWith(p.toLowerCase()));
    return idx === -1 ? 99 : idx;
  };

  const femaleHints = ["female", "zira", "susan", "samantha", "heera", "joanna", "kate", "tessa", "neural"];
  const maleHints = ["male", "david", "mark", "george", "ravi", "hemant", "daniel", "arthur", "thomas"];

  const hints = gender === "male" ? maleHints : femaleHints;

  const scored = list
    .map((v) => {
      const name = `${v?.name || ""} ${v?.voiceURI || ""} ${v?.lang || ""}`;
      let score = 100;

      score += byLang(v) * 10;
      if (hasAny(name, hints)) score -= 25;
      if (hasAny(name, ["google", "microsoft", "apple", "natural", "neural"])) score -= 5;

      return { v, score };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.v || null;
}

function canSpeak() {
  return typeof window !== "undefined" && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== "undefined";
}

async function speakOnce(text, gender = "female") {
  const msg = cleanStr(text);
  if (!msg) return;

  if (!canSpeak()) throw new Error("Speech synthesis not supported in this browser.");

  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch {}

  const voices = await getVoicesSafe();
  const picked = pickVoice(voices, gender);

  await new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(msg);
    if (picked) u.voice = picked;
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;

    u.onend = () => resolve();
    u.onerror = () => reject(new Error("Speech synthesis failed."));

    try {
      synth.speak(u);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * createTtsLooper({ repeatMs })
 * Repeats task title (TTS) until stop() is called.
 */
export function createTtsLooper({ repeatMs = 4500 } = {}) {
  let active = false;
  let timer = null;
  let lastText = "";
  let lastGender = "female";

  async function loop() {
    if (!active) return;

    try {
      await speakOnce(lastText, lastGender);
    } catch {
      // ignore
    }

    if (!active) return;
    timer = window.setTimeout(loop, repeatMs);
  }

  async function start({ text, gender }) {
    lastText = cleanStr(text);
    lastGender = gender === "male" ? "male" : "female";
    if (!lastText) return;

    stop(); // reset any previous loop
    active = true;
    await loop();
  }

  function stop() {
    active = false;
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    try {
      window.speechSynthesis?.cancel?.();
    } catch {}
  }

  async function playOnce({ text, gender }) {
    const t = cleanStr(text);
    if (!t) return;
    lastText = t;
    lastGender = gender === "male" ? "male" : "female";
    try {
      window.speechSynthesis?.cancel?.();
    } catch {}
    try {
      await speakOnce(lastText, lastGender);
    } catch {}
  }

  return {
    start,
    stop,
    playOnce,
    get active() {
      return active;
    },
  };
}
