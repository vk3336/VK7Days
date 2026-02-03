// Custom Service Worker for VK7Days PWA
// Handles background notifications and default ringtone playback

const ALARM_STORAGE_KEY = "vk7days_alarms_v1";
const FIRED_KEY = "vk7days_fired_v1";
const DEFAULT_RINGTONE = "/ringtone/Dholida.mp3";

let currentAlarmAudio = null;
let alarmInterval = null;
let isPlayingDefaultRingtone = false;

// IndexedDB for persistent storage in service worker
let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("VK7DaysDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("alarms")) {
        db.createObjectStore("alarms", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("fired")) {
        db.createObjectStore("fired", { keyPath: "key" });
      }
    };
  });
}

async function getStoredAlarms() {
  if (!db) await initDB();

  return new Promise((resolve) => {
    const transaction = db.transaction(["alarms"], "readonly");
    const store = transaction.objectStore("alarms");
    const request = store.getAll();

    request.onsuccess = () => {
      const alarms = {};
      request.result.forEach((alarm) => {
        alarms[alarm.id] = alarm;
      });
      resolve(alarms);
    };

    request.onerror = () => resolve({});
  });
}

async function storeAlarms(alarms) {
  if (!db) await initDB();

  const transaction = db.transaction(["alarms"], "readwrite");
  const store = transaction.objectStore("alarms");

  // Clear existing alarms
  await store.clear();

  // Store new alarms
  Object.values(alarms).forEach((alarm) => {
    store.put(alarm);
  });
}

async function getFiredAlarms() {
  if (!db) await initDB();

  return new Promise((resolve) => {
    const transaction = db.transaction(["fired"], "readonly");
    const store = transaction.objectStore("fired");
    const request = store.getAll();

    request.onsuccess = () => {
      const fired = {};
      request.result.forEach((item) => {
        fired[item.key] = true;
      });
      resolve(fired);
    };

    request.onerror = () => resolve({});
  });
}

async function markAlarmFired(fireKey) {
  if (!db) await initDB();

  const transaction = db.transaction(["fired"], "readwrite");
  const store = transaction.objectStore("fired");
  store.put({ key: fireKey, timestamp: Date.now() });
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
}

// Check for due alarms
async function checkAlarms() {
  try {
    const alarms = await getStoredAlarms();
    const day = todayKey();
    const hhmm = hhmmNow();
    const fired = await getFiredAlarms();
    const base = `${ymd(new Date())}_${day}_${hhmm}`;

    for (const [taskId, alarm] of Object.entries(alarms)) {
      if (!alarm.enabled || alarm.day !== day || alarm.time !== hhmm) continue;

      const fireKey = `${base}_${taskId}`;
      if (fired[fireKey]) continue;

      await markAlarmFired(fireKey);
      await triggerAlarm(alarm);
    }
  } catch (error) {
    console.error("Error checking alarms:", error);
  }
}

async function triggerAlarm(alarm) {
  try {
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
      "VK7Days Reminder",
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

    if (!isAppOpen) {
      // App is closed - play default ringtone
      await playAlarmAudio(DEFAULT_RINGTONE, true);
    } else {
      // App is open - send message to play custom audio
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
self.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case "SCHEDULE_ALARMS":
      await storeAlarms(data.alarms);
      break;

    case "STOP_ALARM":
      stopAlarmAudio();
      break;

    case "UPDATE_ALARM":
      const alarms = await getStoredAlarms();
      alarms[data.id] = data.alarm;
      await storeAlarms(alarms);
      break;

    case "DELETE_ALARM":
      const currentAlarms = await getStoredAlarms();
      delete currentAlarms[data.id];
      await storeAlarms(currentAlarms);
      break;
  }
});

// Check alarms every minute
setInterval(checkAlarms, 60000);

// Also check on service worker activation
self.addEventListener("activate", (event) => {
  event.waitUntil(checkAlarms());
});

// Initialize DB on install
self.addEventListener("install", (event) => {
  event.waitUntil(initDB());
});
