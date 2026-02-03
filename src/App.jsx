import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { DAYS, clearAllState, loadState, makeDefaultState, saveState, sortByTime } from "./lib/storage";
import { ensureNotificationPermission, tick } from "./lib/alarm";
import { audioStorage, audioPlayer } from "./lib/recorder";
import { canScheduleTriggeredNotifications, syncAllTriggeredNotifications, scheduleTriggeredNotificationForTask } from "./lib/notify";
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
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return "default";
  });

  const ttsRef = useRef(null);

  // Save to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ✅ Audio player for custom recordings (replaces TTS looper)
  useEffect(() => {
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
          console.log('Custom SW registered:', registration);
        })
        .catch(error => {
          console.error('Custom SW registration failed:', error);
        });
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', async (event) => {
        const { type, alarmId, customAudioUrl, alarm } = event.data || {};
        
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
    
    // Check if notifications are supported
    if (typeof Notification === "undefined") {
      alert("Notifications are not supported in this browser");
      return;
    }

    // If already denied, show instructions
    if (Notification.permission === "denied") {
      alert("Notifications are blocked. Please:\n1. Click the 🔒 lock icon in address bar\n2. Allow notifications\n3. Refresh the page");
      return;
    }

    const ok = await ensureNotificationPermission();
    setNotifStatus(ok ? "granted" : (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

    // Track permission result
    if (ok) {
      analytics.notificationPermissionGranted();
      alert("✅ Notifications enabled! Background alarms will now work even when app is closed.");
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      analytics.notificationPermissionDenied();
      alert("❌ Notifications blocked. Please allow notifications in browser settings and refresh the page.");
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
    if (!confirm(`Clear all tasks for ${dayLabel}?`)) return;
    analytics.dayCleared(activeDay);
    setState((p) => ({ ...p, schedule: { ...p.schedule, [p.activeDay]: [] } }));
  }

  function resetAll() {
    if (!confirm("Clear ALL days and remove saved data from device?")) return;
    analytics.allDataReset();
    clearAllState();
    setState(makeDefaultState());
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
              {notifStatus === "granted" ? "Alerts: ON" : notifStatus === "denied" ? "Alerts: BLOCKED" : "Alerts: OFF"}
              {canBgSchedule ? " • Background notifications supported" : ""}
            </div>
          </div>
        </div>

        <div className="topActions">
          <button className="btn" type="button" onClick={enableNotifications}>
            Enable alerts
          </button>
          <button className="btnDanger" type="button" onClick={resetAll}>
            Reset all
          </button>
        </div>
      </header>

      <main className="container">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Days</div>
              <div className="panelHint">Choose a day, add tasks with time + voice.</div>
            </div>
            <button className="btn" type="button" onClick={clearDay}>
              Clear day
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
              <div className="panelTitle">Tasks for {dayLabel}</div>
              <div className="panelHint">
                Custom voice recordings play when alarms trigger. Enable alerts for notifications when supported.
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
