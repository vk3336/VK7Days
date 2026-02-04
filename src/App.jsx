import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

import { DAYS, clearAllState, loadState, makeDefaultState, saveState, sortByTime } from "./lib/storage";
import { ensureNotificationPermission, tick } from "./lib/alarm";
import { audioStorage, audioPlayer } from "./lib/recorder";
import { canScheduleTriggeredNotifications, syncAllTriggeredNotifications, scheduleTriggeredNotificationForTask } from "./lib/notify";
import { androidNotifications } from "./lib/androidNotifications";
import { backgroundAlarms } from "./lib/backgroundAlarms";
import { analytics } from "./lib/analytics";

import DayTabs from "./components/DayTabs";
import TaskForm from "./components/TaskForm";
import TaskList from "./components/TaskList";
import EditTaskModal from "./components/EditTaskModal";
import AlarmModal from "./components/AlarmModal";

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [search, setSearch] = useState("");
  const [editTask, setEditTask] = useState(null);

  const [alarmTask, setAlarmTask] = useState(null);
  const [alarmDayKey, setAlarmDayKey] = useState(null);

  const [notifStatus, setNotifStatus] = useState(() => {
    // Check if running as installed app first
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://') ||
                         window.location.protocol === 'file:' ||
                         (window.navigator.userAgent.includes('wv') && window.navigator.userAgent.includes('Android')) ||
                         window.Capacitor;
    
    if (isStandalone) return "granted";
    
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return "default";
  });

  // Detect if running as installed app (APK)
  const [isInstalledApp, setIsInstalledApp] = useState(false);

  useEffect(() => {
    // Detect if running as installed APK vs web browser
    const isCapacitor = !!(window.Capacitor);
    const isAndroidApp = isCapacitor && window.Capacitor.getPlatform() === 'android';
    
    console.log('App detection:', {
      isCapacitor,
      isAndroidApp,
      platform: window.Capacitor?.getPlatform(),
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      userAgent: window.navigator.userAgent
    });
    
    // Only show APK UI if it's actually running in Capacitor on Android
    setIsInstalledApp(isAndroidApp);
    
    // If running as installed APK, use background alarms
    if (isInstalledApp) {
      // Setup background alarm listeners
      backgroundAlarms.setupGlobalHandlers();
      
      // Check current permissions
      backgroundAlarms.checkPermissions().then(result => {
        if (result.granted) {
          setNotifStatus("granted");
        }
      });

      // Global function to show alarm when app is opened from notification
      window.showAlarmFromNotification = (task, dayKey) => {
        console.log('🔔 Showing alarm from notification:', task);
        setAlarmTask(task);
        setAlarmDayKey(dayKey);
      };
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ✅ Audio player for custom recordings (replaces TTS looper)
  useEffect(() => {
    // Make audio player and storage available globally for notifications
    window.audioPlayer = audioPlayer;
    window.audioStorage = audioStorage;
    
    return () => {
      try {
        audioPlayer.stopLoop();
      } catch {}
    };
  }, []);

  // Service Worker registration and message handling
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Unregister any existing service workers first
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          if (registration.active && registration.active.scriptURL.includes('sw.js')) {
            registration.unregister();
          }
        });
      });

      // Register our custom service worker
      navigator.serviceWorker.register('/sw-custom.js', { scope: '/' })
        .then(registration => {
          console.log('✅ Custom SW registered:', registration);
          
          // Wait for service worker to be ready
          return navigator.serviceWorker.ready;
        })
        .then(registration => {
          console.log('✅ Service worker ready:', registration);
          
          // Send initial alarm data
          if (registration.active) {
            const alarms = {};
            Object.entries(state.schedule).forEach(([day, tasks]) => {
              tasks.forEach(task => {
                if (task.enabled) {
                  alarms[task.id] = {
                    id: task.id,
                    title: task.title,
                    time: task.time,
                    day: day,
                    enabled: task.enabled,
                    hasCustomVoice: task.hasCustomVoice,
                    customAudioUrl: task.hasCustomVoice ? `/recordings/${task.id}.webm` : null
                  };
                }
              });
            });
            
            registration.active.postMessage({
              type: 'SCHEDULE_ALARMS',
              data: { alarms }
            });
            console.log('✅ Alarms sent to service worker:', alarms);
          }
        })
        .catch(error => {
          console.error('❌ Custom SW registration failed:', error);
        });
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', async (event) => {
        const { type, alarmId, customAudioUrl, alarm } = event.data || {};
        console.log('📨 Message from SW:', event.data);
        
        if (type === 'PLAY_CUSTOM_ALARM' && alarmId && customAudioUrl) {
          try {
            await audioPlayer.startLoop(customAudioUrl, 2500);
          } catch (error) {
            console.error('Failed to play custom alarm audio:', error);
          }
        }
        
        if (type === 'ALARM_TRIGGERED' && alarm) {
          // Set alarm modal for foreground display
          setAlarmTask(alarm);
          setAlarmDayKey(alarm.day);
          
          // Play custom audio if available
          if (alarm.hasCustomVoice) {
            try {
              const recording = await audioStorage.getRecording(alarm.id);
              if (recording.success && recording.audioUrl) {
                await audioPlayer.startLoop(recording.audioUrl, 2500);
              }
            } catch (error) {
              console.error('Failed to play custom recording:', error);
            }
          }
        }
      });
    }
  }, []);

  // Sync alarms with service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Wait for service worker to be ready
      navigator.serviceWorker.ready.then((registration) => {
        const alarms = {};
        
        // Convert schedule to alarm format for service worker
        Object.entries(state.schedule).forEach(([day, tasks]) => {
          tasks.forEach(task => {
            if (task.enabled) {
              alarms[task.id] = {
                id: task.id,
                title: task.title,
                time: task.time,
                day: day,
                enabled: task.enabled,
                hasCustomVoice: task.hasCustomVoice,
                customAudioUrl: task.hasCustomVoice ? `/recordings/${task.id}.webm` : null
              };
            }
          });
        });
        
        console.log('Sending alarms to service worker:', alarms);
        
        // Send to custom service worker
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => {
            if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
              reg.active.postMessage({
                type: 'SCHEDULE_ALARMS',
                data: { alarms }
              });
            }
          });
        });
        
        // Also try sending to controller if available
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SCHEDULE_ALARMS',
            data: { alarms }
          });
        }
      });
    }
  }, [state.schedule]);

  const visibleDays = useMemo(() => {
    if (state.settings.showSunday) return DAYS;
    return DAYS.filter((d) => d.key !== "sunday");
  }, [state.settings.showSunday]);

  const activeDay = state.activeDay;
  const dayLabel = useMemo(() => visibleDays.find((d) => d.key === activeDay)?.label || "", [visibleDays, activeDay]);

  const tasks = state.schedule[activeDay] || [];

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    
    // Track search activity
    analytics.taskSearched(q);
    
    return tasks.filter((t) => {
      const hay = `${t.title || ""} ${t.notes || ""} ${t.time || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, search]);

  async function enableNotifications() {
    analytics.notificationEnabled();
    
    // If running as installed app (Capacitor/APK), use background alarms
    if (isInstalledApp || window.Capacitor) {
      try {
        const result = await backgroundAlarms.requestPermissions();
        
        if (result.granted) {
          setNotifStatus("granted");
          
          // Schedule all enabled tasks using background alarms
          await backgroundAlarms.scheduleAllTasks(state.schedule);
          
          alert(result.message || "🎉 Background alarms enabled successfully!\n\n✅ Your tasks will trigger even when the app is closed\n✅ Voice recordings will play automatically\n✅ Notifications work reliably in background");
          return;
        } else {
          const permissionDetails = result.permissions || {};
          let message = "🔒 Some permissions are needed for reliable alarms:\n\n";
          
          if (!permissionDetails.hasNotificationPermission) {
            message += "❌ Allow Notifications\n";
          }
          if (!permissionDetails.hasExactAlarmPermission) {
            message += "❌ Allow Exact Alarms\n";
          }
          if (permissionDetails.isBatteryOptimized) {
            message += "⚠️ Disable Battery Optimization\n";
          }
          
          message += "\nPlease check your device settings and try again.";
          alert(message);
          return;
        }
      } catch (error) {
        console.error('Background alarm setup failed:', error);
        alert("❌ Failed to setup background alarms.\n\nPlease check your device settings and try again.");
        return;
      }
    }
    
    // Browser fallback
    if (typeof Notification === "undefined") {
      alert("🚫 Notifications are not supported in this browser.\n\nFor the best experience, please:\n1. Use Chrome, Firefox, or Edge\n2. Download our Android app");
      return;
    }

    // If already denied, show helpful instructions
    if (Notification.permission === "denied") {
      alert("🔒 Notifications are currently blocked.\n\nTo enable notifications:\n\n1. Click the 🔒 lock icon in your address bar\n2. Change notifications to 'Allow'\n3. Refresh this page\n\nOr download our Android app for guaranteed notifications!");
      return;
    }

    const ok = await ensureNotificationPermission();
    setNotifStatus(ok ? "granted" : (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

    // Track permission result
    if (ok) {
      analytics.notificationPermissionGranted();
      alert("🎉 Notifications enabled successfully!\n\n✅ You'll now receive reminders even when the app is closed\n✅ Background alarms are active\n✅ Voice recordings will play automatically\n\nYour tasks will never be missed!");
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      analytics.notificationPermissionDenied();
      alert("❌ Notifications were blocked.\n\nFor reliable reminders:\n• Allow notifications in browser settings\n• Or download our Android app for guaranteed alerts");
    }

    // Best-effort background scheduling (only on browsers that support Notification Triggers)
    try {
      if (ok) await syncAllTriggeredNotifications(state.schedule);
    } catch {}
  }

  // When permission is already granted, keep background schedule updated.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!canScheduleTriggeredNotifications()) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await syncAllTriggeredNotifications(state.schedule);
        if (!cancelled && res?.ok) setNotifStatus("granted");
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [state.schedule]);

  // Alarm ticker (checks every 5s)
  useEffect(() => {
    const id = window.setInterval(() => {
      tick(state.schedule, async (task, dayKey) => {
        // Track alarm trigger
        analytics.alarmTriggered(task, dayKey);
        
        setAlarmTask(task);
        setAlarmDayKey(dayKey);

        const ok = await ensureNotificationPermission();
        setNotifStatus(ok ? "granted" : (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

        // Foreground notification (immediate)
        if (ok) {
          try {
            new Notification("VK7Days Reminder", { body: `${task.title} (${task.time})`, requireInteraction: true });
          } catch {}
        }

        // Play custom recorded audio if available, otherwise fallback to title display
        if (task.hasCustomVoice) {
          try {
            const recording = await audioStorage.getRecording(task.id);
            if (recording.success && recording.audioUrl) {
              await audioPlayer.startLoop(recording.audioUrl, 2500);
            }
          } catch (error) {
            console.error("Failed to play custom recording:", error);
          }
        }

        // Best-effort schedule next occurrence (weekly) for browsers that support Notification Triggers
        try {
          await scheduleTriggeredNotificationForTask(task, dayKey);
        } catch {}
      });
    }, 5000);

    return () => window.clearInterval(id);
  }, [state.schedule]);

  function setActiveDay(dayKey) {
    analytics.dayChanged(dayKey);
    setState((p) => ({ ...p, activeDay: dayKey }));
  }

  function addTask(task) {
    analytics.taskAdded(task);
    setState((p) => {
      const list = p.schedule[p.activeDay] || [];
      const next = sortByTime([...list, task]);
      return { ...p, schedule: { ...p.schedule, [p.activeDay]: next } };
    });
  }

  function toggleTask(id) {
    setState((p) => {
      const list = p.schedule[p.activeDay] || [];
      const task = list.find(t => t.id === id);
      if (task) {
        analytics.taskToggled(id, !task.enabled);
        
        // Update background alarms
        if (isInstalledApp || window.Capacitor) {
          if (!task.enabled) {
            // Task being enabled - schedule background alarm
            backgroundAlarms.scheduleAlarm({...task, enabled: true}, p.activeDay);
          } else {
            // Task being disabled - cancel background alarm
            backgroundAlarms.cancelAlarm(task.id);
          }
        }
        
        // Update service worker
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => {
            if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
              if (!task.enabled) {
                // Task being enabled - update alarm
                reg.active.postMessage({
                  type: 'UPDATE_ALARM',
                  data: {
                    id: task.id,
                    alarm: {
                      id: task.id,
                      title: task.title,
                      time: task.time,
                      day: p.activeDay,
                      enabled: true,
                      hasCustomVoice: task.hasCustomVoice,
                      customAudioUrl: task.hasCustomVoice ? `/recordings/${task.id}.webm` : null
                    }
                  }
                });
              } else {
                // Task being disabled - remove alarm
                reg.active.postMessage({
                  type: 'DELETE_ALARM',
                  data: { id: task.id }
                });
              }
            }
          });
        });
      }
      return {
        ...p,
        schedule: {
          ...p.schedule,
          [p.activeDay]: list.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
        },
      };
    });
  }

  function deleteTask(id) {
    analytics.taskDeleted(id);
    
    // Cancel background alarm
    if (isInstalledApp || window.Capacitor) {
      backgroundAlarms.cancelAlarm(id);
    }
    
    // Update service worker
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => {
        if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
          reg.active.postMessage({
            type: 'DELETE_ALARM',
            data: { id }
          });
        }
      });
    });
    
    setState((p) => {
      const list = p.schedule[p.activeDay] || [];
      return { ...p, schedule: { ...p.schedule, [p.activeDay]: list.filter((t) => t.id !== id) } };
    });
  }

  function saveEdited(updated) {
    analytics.taskEdited(updated);
    
    // Update service worker
    if (updated.enabled) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
            reg.active.postMessage({
              type: 'UPDATE_ALARM',
              data: {
                id: updated.id,
                alarm: {
                  id: updated.id,
                  title: updated.title,
                  time: updated.time,
                  day: activeDay,
                  enabled: updated.enabled,
                  hasCustomVoice: updated.hasCustomVoice,
                  customAudioUrl: updated.hasCustomVoice ? `/recordings/${updated.id}.webm` : null
                }
              }
            });
          }
        });
      });
    }
    
    setState((p) => {
      const list = p.schedule[p.activeDay] || [];
      const next = sortByTime(list.map((t) => (t.id === updated.id ? updated : t)));
      return { ...p, schedule: { ...p.schedule, [p.activeDay]: next } };
    });
    setEditTask(null);
  }

  function clearDay() {
    if (!confirm(`🗑️ Clear All Tasks for ${dayLabel}?\n\nThis will permanently delete all tasks scheduled for ${dayLabel}.\n\nAre you sure?`)) return;
    analytics.dayCleared(activeDay);
    
    // Clear tasks for the day
    setState((p) => ({ ...p, schedule: { ...p.schedule, [p.activeDay]: [] } }));
    
    // Update service worker to remove alarms for this day
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => {
        if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
          // Send updated alarms without the cleared day
          const updatedAlarms = {};
          Object.entries(state.schedule).forEach(([day, tasks]) => {
            if (day !== activeDay) {
              tasks.forEach(task => {
                if (task.enabled) {
                  updatedAlarms[task.id] = {
                    id: task.id,
                    title: task.title,
                    time: task.time,
                    day: day,
                    enabled: task.enabled,
                    hasCustomVoice: task.hasCustomVoice,
                    customAudioUrl: task.hasCustomVoice ? `/recordings/${task.id}.webm` : null
                  };
                }
              });
            }
          });
          
          reg.active.postMessage({
            type: 'SCHEDULE_ALARMS',
            data: { alarms: updatedAlarms }
          });
        }
      });
    });
    
    alert(`✅ All tasks for ${dayLabel} have been cleared.`);
  }

  function resetAll() {
    if (!confirm("⚠️ Reset All Data?\n\nThis will permanently delete:\n• All your tasks and schedules\n• All voice recordings\n• All app settings\n\nThis action cannot be undone!\n\nAre you sure you want to continue?")) return;
    
    analytics.allDataReset();
    
    // Clear all data
    clearAllState();
    
    // Reset state
    setState(makeDefaultState());
    
    // Clear any playing audio
    try {
      audioPlayer.stopLoop();
    } catch {}
    
    // Clear service worker alarms
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => {
        if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
          reg.active.postMessage({
            type: 'SCHEDULE_ALARMS',
            data: { alarms: {} }
          });
        }
      });
    });
    
    // Show success message
    alert("✅ All data has been reset successfully!\n\nYou can now start fresh with new tasks and schedules.");
  }

  function stopAlarm() {
    analytics.alarmStopped();
    
    // Stop service worker alarm
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => {
        if (reg.active && reg.active.scriptURL.includes('sw-custom.js')) {
          reg.active.postMessage({
            type: 'STOP_ALARM'
          });
        }
      });
    });
    
    try {
      audioPlayer.stopLoop();
    } catch {}
    setAlarmTask(null);
    setAlarmDayKey(null);
  }

  async function playAgain() {
    if (!alarmTask) return;
    analytics.alarmPlayAgain();
    
    if (alarmTask.hasCustomVoice) {
      try {
        const recording = await audioStorage.getRecording(alarmTask.id);
        if (recording.success && recording.audioUrl) {
          await audioPlayer.startLoop(recording.audioUrl, 2500);
        }
      } catch (error) {
        console.error("Failed to play custom recording:", error);
      }
    }
  }

  const alarmDayLabel = useMemo(() => DAYS.find((d) => d.key === alarmDayKey)?.label || "", [alarmDayKey]);

  const canBgSchedule = canScheduleTriggeredNotifications();

  return (
    <div className="page">
      <header className="topBar">
        <div className="brand">
          <div className="logo">
            <img className="logoImg" src="/icons/vk7.png" alt="VK7Days" />
          </div>
          <div>
            <div className="brandName">VK7Days</div>
            <div className="brandSub">
              {isInstalledApp ? (
                // APK: Show notification status
                <>
                  {notifStatus === "granted" ? "✅ Notifications Active" : 
                   notifStatus === "denied" ? "❌ Notifications: BLOCKED" : "⚠️ Notifications: OFF"}
                  {canBgSchedule ? " • Background alarms supported" : ""}
                </>
              ) : (
                // Web: Show download message
                "📱 Download the app for full functionality"
              )}
            </div>
          </div>
        </div>

        <div className="topActions">
          {isInstalledApp ? (
            // APK: Show functional buttons
            <>
              <button className="btn btn-primary" type="button" onClick={enableNotifications}>
                {notifStatus === "granted" ? "🔔 Alarms Active" : "🔔 Allow Permissions"}
              </button>
              <button className="btn btn-danger" type="button" onClick={resetAll}>
                🗑️ Reset All Data
              </button>
            </>
          ) : (
            // Web: Only show download button
            <a 
              href="/downloads/VK7Days.apk" 
              download="VK7Days.apk"
              className="btn btn-success"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              📱 Download App
            </a>
          )}
        </div>
      </header>

      <main className="container">
        {!isInstalledApp && (
          <section className="panel" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: '20px' }}>
            <div className="panelHeader">
              <div>
                <div className="panelTitle">📱 Get the Full Experience</div>
                <div className="panelHint" style={{ color: '#f0f0f0' }}>
                  Download our Android app for reliable notifications, background alarms, and voice reminders that work even when your phone is closed.
                </div>
              </div>
              <a 
                href="/downloads/VK7Days.apk" 
                download="VK7Days.apk"
                className="btn btn-success"
                style={{ textDecoration: 'none', color: 'inherit', backgroundColor: '#28a745', border: 'none' }}
              >
                📱 Download APK
              </a>
            </div>
            <div style={{ padding: '15px 0', fontSize: '14px', opacity: '0.9' }}>
              <strong>Why download the app?</strong>
              <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                <li>✅ Reliable background notifications</li>
                <li>✅ Custom voice recordings that play automatically</li>
                <li>✅ Works even when your phone is locked</li>
                <li>✅ No browser limitations</li>
              </ul>
              <em>This web version is for preview only. Download the app for full functionality.</em>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">📅 Weekly Schedule</div>
              <div className="panelHint">Choose a day, add tasks with time and voice reminders.</div>
            </div>
            <button className="btn btn-danger" type="button" onClick={clearDay}>
              🗑️ Clear {dayLabel}
            </button>
          </div>

          <DayTabs days={visibleDays} activeDay={activeDay} onChange={setActiveDay} />

          <div className="searchRow">
            <div className="searchBox">
              <span className="searchIcon">⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search tasks in ${dayLabel}...`} />
            </div>
          </div>

          <TaskForm onAdd={addTask} />
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">📋 Tasks for {dayLabel}</div>
              <div className="panelHint">
                ✨ Custom voice recordings play when alarms trigger. Enable notifications for the best experience.
              </div>
            </div>
          </div>

          <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} onEdit={(task) => {
            analytics.editModalOpened(task.id);
            setEditTask(task);
          }} />
        </section>
      </main>

      <EditTaskModal open={!!editTask} task={editTask} onClose={() => {
        analytics.editModalClosed();
        setEditTask(null);
      }} onSave={saveEdited} />

      <AlarmModal open={!!alarmTask} task={alarmTask} dayLabel={alarmDayLabel} onStop={stopAlarm} onPlayAgain={playAgain} />
    </div>
  );
}
