import React from "react";

export default function TaskList({ tasks, onToggle, onDelete, onEdit }) {
  if (!tasks?.length) return <div className="empty">No tasks yet.</div>;

  return (
    <div className="list">
      {tasks.map((t) => (
        <div key={t.id} className={`task ${t.enabled ? "" : "taskDisabled"}`}>
          <div className="taskTime">{t.time}</div>

          <div className="taskMain">
            <div className="taskTitle">{t.title}</div>
            {t.notes ? <div className="taskNotes">{t.notes}</div> : null}
          </div>

          <div className="taskBtns">
            <button className="btn" type="button" onClick={() => onEdit(t)}>Edit</button>
            <button className="btn" type="button" onClick={() => onToggle(t.id)}>
              {t.enabled ? "Disable" : "Enable"}
            </button>
            <button className="btnDanger" type="button" onClick={() => onDelete(t.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
