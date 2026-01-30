import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { DAYS, clearAllState, loadState, makeDefaultState, saveState, sortByTime } from "./lib/storage";
import { ensureNotificationPermission, tick } from "./lib/alarm";
import { createTtsLooper } from "./lib/tts";
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

  // ✅ Text-to-Speech looper (repeats until Stop)
  useEffect(() => {
    ttsRef.current = createTtsLooper({ repeatMs: 4500 });
    return () => {
      try {
        ttsRef.current?.stop?.();
      } catch {}
    };
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
    analytics.notificationEnabled();
    
    const ok = await ensureNotificationPermission();
    setNotifStatus(ok ? "granted" : (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

    // Track permission result
    if (ok) {
      analytics.notificationPermissionGranted();
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      analytics.notificationPermissionDenied();
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

        // Speech loop (runs while app is active)
        try {
          const gender = task.voiceGender || state.settings.voiceGender || "female";
          await ttsRef.current?.start?.({ text: task.title, gender });
        } catch {}

        // Best-effort schedule next occurrence (weekly) for browsers that support Notification Triggers
        try {
          await scheduleTriggeredNotificationForTask(task, dayKey);
        } catch {}
      });
    }, 5000);

    return () => window.clearInterval(id);
  }, [state.schedule, state.settings.voiceGender]);

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
    analytics.alarmStopped();
    try {
      ttsRef.current?.stop?.();
    } catch {}
    setAlarmTask(null);
    setAlarmDayKey(null);
  }

  async function playAgain() {
    if (!alarmTask) return;
    analytics.alarmPlayAgain();
    const gender = alarmTask.voiceGender || state.settings.voiceGender || "female";
    try {
      await ttsRef.current?.start?.({ text: alarmTask.title, gender });
    } catch {}
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

          <TaskForm
            defaultVoiceGender={state.settings.voiceGender}
            onDefaultVoiceGenderChange={(g) => {
              analytics.defaultVoiceChanged(g);
              setState((p) => ({ ...p, settings: { ...p.settings, voiceGender: g } }));
            }}
            onAdd={addTask}
          />
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Tasks for {dayLabel}</div>
              <div className="panelHint">
                Speech plays only while the app is running. Enable alerts for notifications when supported.
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
