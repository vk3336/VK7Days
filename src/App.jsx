import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { DAYS, clearAllState, loadState, makeDefaultState, saveState, sortByTime } from "./lib/storage";
import { ensureNotificationPermission, tick } from "./lib/alarm";
import { audioStorage, audioPlayer } from "./lib/recorder";
import { canScheduleTriggeredNotifications, syncAllTriggeredNotifications, scheduleTriggeredNotificationForTask, showBackgroundNotification } from "./lib/notify";
import { scheduleBackgroundAlarms } from "./lib/backgroundAlarms";
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

  // ✅ Service Worker registration and message handling
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register our custom service worker for notifications
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Custom SW registered:', registration);
        })
        .catch(error => {
          console.log('Custom SW registration failed:', error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data.type === 'TRIGGER_ALARM') {
          const { taskId, dayKey, taskTitle, taskTime, hasCustomVoice } = event.data;
          
          // Create task object for alarm modal
          const task = {
            id: taskId,
            title: taskTitle,
            time: taskTime,
            hasCustomVoice: hasCustomVoice
          };
          
          // Trigger alarm modal
          setAlarmTask(task);
          setAlarmDayKey(dayKey);
          
          // Play audio if available
          if (hasCustomVoice) {
            try {
              const recording = await audioStorage.getRecording(taskId);
              if (recording.success && recording.audioUrl) {
                await audioPlayer.startLoop(recording.audioUrl, 2500);
              }
            } catch (error) {
              console.error("Failed to play custom recording:", error);
            }
          }
        } else if (event.data.type === 'REQUEST_SCHEDULE_CHECK') {
          // Service worker is requesting schedule data for background checking
          const { currentDay, currentTime } = event.data;
          
          // Send schedule data back to service worker
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SCHEDULE_RESPONSE',
              data: {
                schedule: state.schedule,
                currentDay,
                currentTime
              }
            });
          }
        }
      });
    }

    // Handle URL parameters for alarm (when app is opened from notification)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('alarm') === 'true') {
      const taskId = urlParams.get('taskId');
      const dayKey = urlParams.get('dayKey');
      const taskTitle = urlParams.get('taskTitle');
      const taskTime = urlParams.get('taskTime');
      const hasCustomVoice = urlParams.get('hasCustomVoice') === 'true';
      
      if (taskId && dayKey && taskTitle && taskTime) {
        // Create task object for alarm modal
        const task = {
          id: taskId,
          title: taskTitle,
          time: taskTime,
          hasCustomVoice: hasCustomVoice
        };
        
        // Trigger alarm modal
        setAlarmTask(task);
        setAlarmDayKey(dayKey);
        
        // Play audio if available
        if (hasCustomVoice) {
          setTimeout(async () => {
            try {
              const recording = await audioStorage.getRecording(taskId);
              if (recording.success && recording.audioUrl) {
                await audioPlayer.startLoop(recording.audioUrl, 2500);
              }
            } catch (error) {
              console.error("Failed to play custom recording:", error);
            }
          }, 500);
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

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
    console.log("Enabling notifications..."); // Debug log
    analytics.notificationEnabled();
    
    const ok = await ensureNotificationPermission();
    console.log("Notification permission result:", ok); // Debug log
    setNotifStatus(ok ? "granted" : (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

    // Track permission result
    if (ok) {
      analytics.notificationPermissionGranted();
      
      // Test notification
      try {
        new Notification("VK7Days Test", {
          body: "Notifications are working!",
          icon: "/icons/vk7.png",
          requireInteraction: false
        });
        console.log("Test notification sent"); // Debug log
      } catch (error) {
        console.error("Test notification failed:", error);
      }
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      analytics.notificationPermissionDenied();
    }

    // Best-effort background scheduling
    try {
      if (ok) {
        console.log("Scheduling background alarms..."); // Debug log
        const bgResult = await scheduleBackgroundAlarms(state.schedule);
        console.log("Background scheduling result:", bgResult); // Debug log
        
        // Fallback to original method
        await syncAllTriggeredNotifications(state.schedule);
      }
    } catch (error) {
      console.error("Background scheduling failed:", error);
    }
  }

  // When permission is already granted, keep background schedule updated.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;
    (async () => {
      try {
        // Use enhanced background alarm scheduling
        const bgResult = await scheduleBackgroundAlarms(state.schedule);
        console.log("Background alarms scheduled:", bgResult);
        
        // Fallback to original method if available
        if (canScheduleTriggeredNotifications()) {
          const res = await syncAllTriggeredNotifications(state.schedule);
          if (!cancelled && res?.ok) setNotifStatus("granted");
        }
      } catch (error) {
        console.error("Failed to schedule background alarms:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.schedule]);

  // Alarm ticker (checks every 5s) + Enhanced background notification support
  useEffect(() => {
    const id = window.setInterval(() => {
      tick(state.schedule, async (task, dayKey) => {
        // Track alarm trigger
        analytics.alarmTriggered(task, dayKey);
        
        setAlarmTask(task);
        setAlarmDayKey(dayKey);

        const ok = await ensureNotificationPermission();
        setNotifStatus(ok ? "granted" : (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

        // Enhanced notification system - try multiple approaches
        if (ok) {
          try {
            // First try: Use service worker for background notifications
            const bgResult = await showBackgroundNotification(task, dayKey);
            if (!bgResult.ok) {
              // Fallback: Regular notification
              new Notification("VK7Days Reminder", { 
                body: `${task.title} (${task.time})`, 
                requireInteraction: true,
                icon: "/icons/vk7.png",
                tag: `vk7_${task.id}`,
                renotify: true
              });
            }
          } catch {
            // Final fallback
            try {
              new Notification("VK7Days Reminder", { 
                body: `${task.title} (${task.time})`, 
                requireInteraction: true,
                icon: "/icons/vk7.png"
              });
            } catch {}
          }
        }

        // Play custom recorded audio if available
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
    setState((p) => {
      const list = p.schedule[p.activeDay] || [];
      return { ...p, schedule: { ...p.schedule, [p.activeDay]: list.filter((t) => t.id !== id) } };
    });
  }

  function saveEdited(updated) {
    analytics.taskEdited(updated);
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
    console.log("stopAlarm called"); // Debug log
    analytics.alarmStopped();
    try {
      audioPlayer.stopLoop();
    } catch {}
    setAlarmTask(null);
    setAlarmDayKey(null);
  }

  async function playAgain() {
    console.log("playAgain called"); // Debug log
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
