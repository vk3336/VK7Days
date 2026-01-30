import React, { useEffect, useState } from "react";
import Modal from "./Modal";

function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export default function EditTaskModal({ open, task, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [voiceGender, setVoiceGender] = useState("female");

  useEffect(() => {
    if (!task) return;
    setTitle(cleanStr(task.title));
    setTime(task.time || "");
    setNotes(cleanStr(task.notes));
    setEnabled(typeof task.enabled === "boolean" ? task.enabled : true);
    setVoiceGender(task.voiceGender === "male" ? "male" : "female");
  }, [task]);

  function submit(e) {
    e.preventDefault();
    if (!task) return;

    const next = {
      ...task,
      title: cleanStr(title),
      time,
      notes: cleanStr(notes),
      enabled,
      voiceGender: voiceGender === "male" ? "male" : "female",
    };

    onSave?.(next);
  }

  return (
    <Modal open={open} title="✏️ Edit Task" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          <div className="field">
            <label>Task Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="field">
            <label>Time</label>
            <input value={time} onChange={(e) => setTime(e.target.value)} type="time" />
          </div>

          <div className="field">
            <label>Voice</label>
            <select value={voiceGender} onChange={(e) => setVoiceGender(e.target.value)}>
              <option value="female">Female voice</option>
              <option value="male">Male voice</option>
            </select>
          </div>

          <div className="field">
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
          </div>
        </div>

        <div className="actionsRow" style={{ marginTop: 14 }}>
          <button className="btnPrimary" type="submit">
            Save
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
