import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { audioRecorder, audioStorage, audioPlayer, isRecordingSupported } from "../lib/recorder";
import { analytics } from "../lib/analytics";

function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export default function EditTaskModal({ open, task, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(true);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [hasExistingRecording, setHasExistingRecording] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(cleanStr(task.title));
    setTime(task.time || "");
    setNotes(cleanStr(task.notes));
    setEnabled(typeof task.enabled === "boolean" ? task.enabled : true);
    setHasExistingRecording(!!task.hasCustomVoice);
    
    // Load existing recording if available
    if (task.hasCustomVoice && task.id) {
      loadExistingRecording(task.id);
    }
    
    // Reset recording states
    setIsRecording(false);
    setHasRecording(false);
    setRecordingUrl(null);
    setIsPlaying(false);
    setRecordingError("");
  }, [task]);

  async function loadExistingRecording(taskId) {
    try {
      const recording = await audioStorage.getRecording(taskId);
      if (recording.success && recording.audioUrl) {
        setRecordingUrl(recording.audioUrl);
        setHasRecording(true);
      }
    } catch (error) {
      console.error("Failed to load existing recording:", error);
    }
  }

  async function startRecording() {
    setRecordingError("");
    const result = await audioRecorder.startRecording();
    
    if (result.success) {
      setIsRecording(true);
      analytics.voiceRecordingStarted();
    } else {
      setRecordingError(result.error || "Failed to start recording");
    }
  }

  async function stopRecording() {
    const result = await audioRecorder.stopRecording();
    setIsRecording(false);
    
    if (result.success && result.audioBlob) {
      // Clean up previous recording URL
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
      
      setRecordingUrl(result.audioUrl);
      setHasRecording(true);
      analytics.voiceRecordingCompleted();
    } else {
      setRecordingError(result.error || "Failed to save recording");
    }
  }

  function cancelRecording() {
    audioRecorder.cancelRecording();
    setIsRecording(false);
    analytics.voiceRecordingCancelled();
  }

  async function playRecording() {
    if (!recordingUrl) return;
    
    try {
      setIsPlaying(true);
      await audioPlayer.playOnce(recordingUrl);
      analytics.voiceRecordingPreviewed();
    } catch (error) {
      console.error("Playback failed:", error);
    } finally {
      setIsPlaying(false);
    }
  }

  function deleteRecording() {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    setHasRecording(false);
    setHasExistingRecording(false);
    analytics.voiceRecordingDeleted();
  }

  async function submit(e) {
    e.preventDefault();
    if (!task) return;

    let audioSaved = hasExistingRecording; // Keep existing state if no new recording

    // Save new recording if one exists
    if (hasRecording && recordingUrl && !hasExistingRecording) {
      try {
        // Convert URL back to blob for storage
        const response = await fetch(recordingUrl);
        const audioBlob = await response.blob();
        const result = await audioStorage.saveRecording(task.id, audioBlob);
        audioSaved = result.success;
      } catch (error) {
        console.error("Failed to save recording:", error);
      }
    }

    // Delete recording if user removed it
    if (hasExistingRecording && !hasRecording) {
      try {
        await audioStorage.deleteRecording(task.id);
        audioSaved = false;
      } catch (error) {
        console.error("Failed to delete recording:", error);
      }
    }

    const next = {
      ...task,
      title: cleanStr(title),
      time,
      notes: cleanStr(notes),
      enabled,
      hasCustomVoice: audioSaved,
    };

    onSave?.(next);
  }

  // Voice recording UI component
  function VoiceRecordingSection() {
    if (!isRecordingSupported()) {
      return (
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Voice Recording</label>
          <div className="recordingUnsupported">
            Voice recording is not supported in this browser
          </div>
        </div>
      );
    }

    return (
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label>Voice Recording</label>
        <div className="recordingControls">
          {!hasRecording && !isRecording && (
            <button 
              type="button" 
              className="btn btnRecord" 
              onClick={startRecording}
              disabled={!title.trim()}
            >
              🎤 {hasExistingRecording ? 'Re-record' : 'Record'} "{title.trim() || 'your task'}"
            </button>
          )}
          
          {isRecording && (
            <div className="recordingActive">
              <div className="recordingIndicator">
                <span className="recordingDot"></span>
                Recording... Say: "{title}"
              </div>
              <div className="recordingButtons">
                <button type="button" className="btn" onClick={stopRecording}>
                  ✓ Stop
                </button>
                <button type="button" className="btnDanger" onClick={cancelRecording}>
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}
          
          {hasRecording && (
            <div className="recordingComplete">
              <div className="recordingInfo">
                ✓ Voice recorded for "{title}"
              </div>
              <div className="recordingButtons">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={playRecording}
                  disabled={isPlaying}
                >
                  {isPlaying ? "Playing..." : "▶ Preview"}
                </button>
                <button type="button" className="btnDanger" onClick={deleteRecording}>
                  🗑 Delete
                </button>
              </div>
            </div>
          )}
          
          {recordingError && (
            <div className="recordingError">
              Error: {recordingError}
            </div>
          )}
        </div>
      </div>
    );
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

          <VoiceRecordingSection />

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
