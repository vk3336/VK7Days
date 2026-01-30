import React, { useEffect, useRef, useState } from "react";
import { uid } from "../lib/storage";
import { createTtsLooper } from "../lib/tts";

function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export default function TaskForm({ defaultVoiceGender = "female", onDefaultVoiceGenderChange, onAdd }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [voiceGender, setVoiceGender] = useState(defaultVoiceGender || "female");

  const ttsRef = useRef(null);

  useEffect(() => {
    setVoiceGender(defaultVoiceGender || "female");
  }, [defaultVoiceGender]);

  useEffect(() => {
    // used only for playOnce preview here
    ttsRef.current = createTtsLooper({ repeatMs: 4000 });
    return () => {
      try {
        ttsRef.current?.stop?.();
      } catch {}
    };
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    const t = cleanStr(title);
    if (!t) return;
    if (!time) return;

    const task = {
      id: uid(),
      title: t,
      time,
      notes: cleanStr(notes),
      enabled: true,
      voiceGender: voiceGender === "male" ? "male" : "female",
    };

    onAdd?.(task);

    setTitle("");
    setNotes("");
  }

  async function onVoiceChange(v) {
    const g = v === "male" ? "male" : "female";
    setVoiceGender(g);
    onDefaultVoiceGenderChange?.(g);

    // ✅ Play ONLY one time when user selects voice
    const previewText = cleanStr(title) || (g === "male" ? "Male voice" : "Female voice");
    try {
      await ttsRef.current?.playOnce?.({ text: previewText, gender: g });
    } catch {}
  }

  return (
    <div className="card">
      <div className="cardTitle">Add Task</div>

      <form onSubmit={onSubmit}>
        <div className="grid2">
          <div className="field">
            <label>Task Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eg: Study, Gym, Call..." />
          </div>

          <div className="field">
            <label>Time</label>
            <input value={time} onChange={(e) => setTime(e.target.value)} type="time" />
          </div>

          <div className="field">
            <label>Voice</label>
            <select value={voiceGender} onChange={(e) => onVoiceChange(e.target.value)}>
              <option value="female">Female voice</option>
              <option value="male">Male voice</option>
            </select>
          </div>

          <div className="field">
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." />
          </div>
        </div>

        <div className="actionsRow actionsRowAdd">
          <button className="btnPrimary btnPrimaryWide" type="submit">
            Add Task
          </button>
          <div className="hint">Tip: selecting Male/Female plays a one-time preview.</div>
        </div>
      </form>
    </div>
  );
}
