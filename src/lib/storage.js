const LS_KEY = "vk7days_state_v1";

export const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

export function makeDefaultState() {
  return {
    activeDay: "monday",
    settings: {
      showSunday: true,
    },
    schedule: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
  };
}

export function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function sortByTime(list) {
  return [...list].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return makeDefaultState();
    const parsed = JSON.parse(raw);
    const base = makeDefaultState();
    const merged = {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      schedule: { ...base.schedule, ...(parsed.schedule || {}) },
    };

    // ✅ normalize tasks (migrate from old voice system to new recording system)
    for (const dayKey of Object.keys(merged.schedule || {})) {
      const list = Array.isArray(merged.schedule[dayKey])
        ? merged.schedule[dayKey]
        : [];
      merged.schedule[dayKey] = list.map((t) => {
        const x = { ...(t || {}) };
        if (typeof x.enabled !== "boolean") x.enabled = true;

        // Remove old voice gender properties and migrate to new system
        delete x.voiceGender;

        // Set hasCustomVoice to false for existing tasks (they'll need to re-record)
        if (typeof x.hasCustomVoice !== "boolean") x.hasCustomVoice = false;

        return x;
      });
    }

    // Remove old voice settings
    delete merged.settings.voiceGender;

    return merged;
  } catch {
    return makeDefaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

export function clearAllState() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}
