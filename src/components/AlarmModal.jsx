import React from "react";
import Modal from "./Modal";

export default function AlarmModal({ open, task, dayLabel, onStop, onPlayAgain }) {
  return (
    <Modal open={open} title="⏰ Reminder" onClose={onStop}>
      <div className="alarmBox">
        <div className="alarmTitle">
          {task?.title}
          {task?.hasCustomVoice && <span className="voiceIndicator">🎤</span>}
        </div>

        <div className="alarmMeta">
          {dayLabel ? <span className="pill">{dayLabel}</span> : null}
          {task?.time ? <span className="pill">{task.time}</span> : null}
          {task?.hasCustomVoice ? <span className="pill">Custom Voice</span> : null}
        </div>

        {task?.notes ? <div className="alarmNotes">{task.notes}</div> : null}

        <div className="actionsRow" style={{ marginTop: 14 }}>
          <button className="btn" type="button" onClick={onPlayAgain}>
            {task?.hasCustomVoice ? "Play recording" : "Play again"}
          </button>
          <button className="btnPrimary" type="button" onClick={onStop}>Stop</button>
        </div>
      </div>
    </Modal>
  );
}
