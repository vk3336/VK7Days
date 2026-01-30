// Google Analytics 4 implementation for VK7Days

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Initialize Google Analytics
export function initGA() {
  if (!GA_MEASUREMENT_ID) {
    console.warn(
      "Google Analytics Measurement ID not found in environment variables",
    );
    return false;
  }

  // Load gtag script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_title: "VK7Days Task Scheduler",
    page_location: window.location.href,
    send_page_view: true,
  });

  console.log("Google Analytics initialized with ID:", GA_MEASUREMENT_ID);
  return true;
}

// Track custom events
export function trackEvent(eventName, parameters = {}) {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") {
    console.warn("Google Analytics not initialized");
    return;
  }

  window.gtag("event", eventName, {
    event_category: "VK7Days",
    ...parameters,
  });
}

// Specific event tracking functions
export const analytics = {
  // App lifecycle events
  appStart: () =>
    trackEvent("app_start", {
      event_category: "App Lifecycle",
    }),

  // Day navigation events
  dayChanged: (dayKey) =>
    trackEvent("day_changed", {
      event_category: "Navigation",
      day: dayKey,
    }),

  // Task management events
  taskAdded: (taskData) =>
    trackEvent("task_added", {
      event_category: "Task Management",
      task_time: taskData.time,
      has_custom_voice: taskData.hasCustomVoice,
      has_notes: !!taskData.notes,
    }),

  taskEdited: (taskData) =>
    trackEvent("task_edited", {
      event_category: "Task Management",
      task_time: taskData.time,
      has_custom_voice: taskData.hasCustomVoice,
      has_notes: !!taskData.notes,
      enabled: taskData.enabled,
    }),

  taskToggled: (taskId, enabled) =>
    trackEvent("task_toggled", {
      event_category: "Task Management",
      task_id: taskId,
      enabled: enabled,
    }),

  taskDeleted: (taskId) =>
    trackEvent("task_deleted", {
      event_category: "Task Management",
      task_id: taskId,
    }),

  // Voice and recording events
  voiceRecordingStarted: () =>
    trackEvent("voice_recording_started", {
      event_category: "Voice Recording",
    }),

  voiceRecordingCompleted: () =>
    trackEvent("voice_recording_completed", {
      event_category: "Voice Recording",
    }),

  voiceRecordingCancelled: () =>
    trackEvent("voice_recording_cancelled", {
      event_category: "Voice Recording",
    }),

  voiceRecordingPreviewed: () =>
    trackEvent("voice_recording_previewed", {
      event_category: "Voice Recording",
    }),

  voiceRecordingDeleted: () =>
    trackEvent("voice_recording_deleted", {
      event_category: "Voice Recording",
    }),

  voicePreview: (gender) =>
    trackEvent("voice_preview", {
      event_category: "Voice",
      voice_gender: gender,
    }),

  voiceGenderChanged: (gender) =>
    trackEvent("voice_gender_changed", {
      event_category: "Voice",
      voice_gender: gender,
    }),

  // Alarm events
  alarmTriggered: (taskData, dayKey) =>
    trackEvent("alarm_triggered", {
      event_category: "Alarm",
      task_time: taskData.time,
      day: dayKey,
      has_custom_voice: taskData.hasCustomVoice,
    }),

  alarmStopped: () =>
    trackEvent("alarm_stopped", {
      event_category: "Alarm",
    }),

  alarmPlayAgain: () =>
    trackEvent("alarm_play_again", {
      event_category: "Alarm",
    }),

  // Notification events
  notificationEnabled: () =>
    trackEvent("notification_enabled", {
      event_category: "Notifications",
    }),

  notificationPermissionGranted: () =>
    trackEvent("notification_permission_granted", {
      event_category: "Notifications",
    }),

  notificationPermissionDenied: () =>
    trackEvent("notification_permission_denied", {
      event_category: "Notifications",
    }),

  // Search events
  taskSearched: (query) =>
    trackEvent("task_searched", {
      event_category: "Search",
      search_term: query.length > 0 ? "has_query" : "empty_query",
      query_length: query.length,
    }),

  // Data management events
  dayCleared: (dayKey) =>
    trackEvent("day_cleared", {
      event_category: "Data Management",
      day: dayKey,
    }),

  allDataReset: () =>
    trackEvent("all_data_reset", {
      event_category: "Data Management",
    }),

  // Settings events
  defaultVoiceChanged: (gender) =>
    trackEvent("default_voice_changed", {
      event_category: "Settings",
      voice_gender: gender,
    }),

  // Modal events
  editModalOpened: (taskId) =>
    trackEvent("edit_modal_opened", {
      event_category: "Modal",
      task_id: taskId,
    }),

  editModalClosed: () =>
    trackEvent("edit_modal_closed", {
      event_category: "Modal",
    }),

  alarmModalOpened: (taskId) =>
    trackEvent("alarm_modal_opened", {
      event_category: "Modal",
      task_id: taskId,
    }),

  // PWA events
  pwaInstalled: () =>
    trackEvent("pwa_installed", {
      event_category: "PWA",
    }),

  // Error events
  error: (errorType, errorMessage) =>
    trackEvent("error_occurred", {
      event_category: "Error",
      error_type: errorType,
      error_message: errorMessage,
    }),
};
