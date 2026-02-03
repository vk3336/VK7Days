// Custom Service Worker for VK7Days PWA
// Handles background notifications and default ringtone playback

const ALARM_STORAGE_KEY = "vk7days_alarms_v1";
const FIRED_KEY = "vk7days_fired_v1";
const DEFAULT_RINGTONE = "/ringtone/Dholida.mp3";

let currentAlarmAudio = null;
let alarmInterval = null;
let isPlayingDefaultRingtone = false;
let alarmCheckInterval = null;

// Use localStorage for service worker storage (simpler than IndexedDB)
function getStoredAlarms() {
  try {
    const stored = self.localStorage?.getItem(ALARM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    // Fallback to a simple in-memory storage
    return self.alarmsCache || {};
  }
}

function storeAlarms(alarms) {
  try {
    if (self.localStorage) {
      self.localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(alarms));
    }
    // Also keep in memory as backup
    self.alarmsCache = alarms;
  } catch {
    self.alarmsCache = alarms;
  }
}

function getFiredAlarms() {
  try {
    const stored = self.localStorage?.getItem(FIRED_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return self.firedCache || {};
  }
}

function markAlarmFired(fireKey) {
  try {
    const fired = getFiredAlarms();
    fired[fireKey] = true;
    if (self.localStorage) {
      self.localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    }
    self.firedCache = fired;
  } catch {
    if (!self.firedCache) self.firedCache = {};
    self.firedCache[fireKey] = true;
  }
}

function todayKey() {
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[new Date().getDay()];
}

function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmmNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Play audio with repeat every 2.5 seconds
async function playAlarmAudio(audioUrl, isDefault = false) {
  try {
    stopAlarmAudio(); // Stop any existing audio

    isPlayingDefaultRingtone = isDefault;

    const audio = new Audio(audioUrl);
    currentAlarmAudio = audio;

    // Set volume to maximum
    audio.volume = 1.0;

    const playAudio = () => {
      if (currentAlarmAudio === audio) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      }
    };

    // Play immediately
    playAudio();

    // Repeat every 2.5 seconds
    alarmInterval = setInterval(playAudio, 2500);

    console.log("Playing alarm audio:", audioUrl, "isDefault:", isDefault);
  } catch (error) {
    console.error("Failed to play alarm audio:", error);
  }
}

function stopAlarmAudio() {
  if (currentAlarmAudio) {
    currentAlarmAudio.pause();
    currentAlarmAudio = null;
  }

  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }

  isPlayingDefaultRingtone = false;
  console.log("Stopped alarm audio");
}

// Check for due alarms
function checkAlarms() {
  try {
    const alarms = getStoredAlarms();
    const day = todayKey();
    const hhmm = hhmmNow();
    const fired = getFiredAlarms();
    const base = `${ymd(new Date())}_${day}_${hhmm}`;

    console.log("Checking alarms:", {
      day,
      hhmm,
      alarmsCount: Object.keys(alarms).length,
    });

    for (const [taskId, alarm] of Object.entries(alarms)) {
      if (!alarm.enabled || alarm.day !== day || alarm.time !== hhmm) continue;

      const fireKey = `${base}_${taskId}`;
      if (fired[fireKey]) continue;

      console.log("Triggering alarm:", alarm);
      markAlarmFired(fireKey);
      triggerAlarm(alarm);
    }
  } catch (error) {
    console.error("Error checking alarms:", error);
  }
}

async function triggerAlarm(alarm) {
  try {
    console.log("Alarm triggered:", alarm.title, alarm.time);

    // Show notification
    const notificationOptions = {
      body: `${alarm.title} (${alarm.time})`,
      icon: "/icons/vk7.png",
      badge: "/icons/vk7.png",
      tag: `vk7_alarm_${alarm.id}`,
      requireInteraction: true,
      actions: [
        { action: "stop", title: "Stop" },
        { action: "open", title: "Open App" },
      ],
      data: {
        alarmId: alarm.id,
        hasCustomVoice: alarm.hasCustomVoice,
        customAudioUrl: alarm.customAudioUrl,
      },
    };

    await self.registration.showNotification(
      "🔔 VK7Days Reminder",
      notificationOptions,
    );

    // Check if app is in foreground
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const isAppOpen = clients.some(
      (client) => client.visibilityState === "visible",
    );

    console.log("App is open:", isAppOpen);

    if (!isAppOpen) {
      // App is closed - play default ringtone
      console.log("App closed - playing default ringtone");
      await playAlarmAudio(DEFAULT_RINGTONE, true);
    } else {
      // App is open - send message to play custom audio
      console.log("App open - sending message to play custom audio");
      clients.forEach((client) => {
        client.postMessage({
          type: "ALARM_TRIGGERED",
          alarm: alarm,
        });
      });
    }
  } catch (error) {
    console.error("Error triggering alarm:", error);
  }
}

// Handle notification clicks
self.addEventListener("notificationclick", async (event) => {
  console.log("Notification clicked:", event.action);
  event.notification.close();

  const { alarmId, hasCustomVoice, customAudioUrl } =
    event.notification.data || {};

  if (event.action === "stop") {
    stopAlarmAudio();
    return;
  }

  // Stop default ringtone when notification is clicked
  if (isPlayingDefaultRingtone) {
    stopAlarmAudio();
  }

  // Open the app
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  if (clients.length > 0) {
    // Focus existing window
    await clients[0].focus();

    // Send message to play custom audio if available
    if (hasCustomVoice && customAudioUrl) {
      clients[0].postMessage({
        type: "PLAY_CUSTOM_ALARM",
        alarmId,
        customAudioUrl,
      });
    }
  } else {
    // Open new window
    await self.clients.openWindow("/");
  }
});

// Handle messages from main app
self.addEventListener("message", (event) => {
  const { type, data } = event.data || {};

  console.log("Service worker received message:", type, data);

  switch (type) {
    case "SCHEDULE_ALARMS":
      storeAlarms(data.alarms);
      console.log("Alarms scheduled:", Object.keys(data.alarms).length);
      break;

    case "STOP_ALARM":
      stopAlarmAudio();
      break;

    case "UPDATE_ALARM":
      const alarms = getStoredAlarms();
      alarms[data.id] = data.alarm;
      storeAlarms(alarms);
      console.log("Alarm updated:", data.id);
      break;

    case "DELETE_ALARM":
      const currentAlarms = getStoredAlarms();
      delete currentAlarms[data.id];
      storeAlarms(currentAlarms);
      console.log("Alarm deleted:", data.id);
      break;
  }
});

// Start checking alarms every 30 seconds (more frequent)
function startAlarmChecker() {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval);
  }

  // Check immediately
  checkAlarms();

  // Then check every 30 seconds
  alarmCheckInterval = setInterval(checkAlarms, 30000);
  console.log("Alarm checker started - checking every 30 seconds");
}

// Service worker lifecycle events
self.addEventListener("install", (event) => {
  console.log("Service worker installing");
  self.skipWaiting();
  startAlarmChecker();
});

self.addEventListener("activate", (event) => {
  console.log("Service worker activated");
  event.waitUntil(self.clients.claim());
  startAlarmChecker();
});

// Keep service worker alive
self.addEventListener("fetch", (event) => {
  // Just pass through all requests
  event.respondWith(fetch(event.request));
});

// Start alarm checker when service worker loads
startAlarmChecker();
