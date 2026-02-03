import React, { useEffect, useRef, useState } from "react";
import { uid } from "../lib/storage";
import { audioRecorder, audioStorage, audioPlayer, isRecordingSupported } from "../lib/recorder";
import { analytics } from "../lib/analytics";

function cleanStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingError, setRecordingError] = useState("");

  const currentTaskId = useRef(null);

  useEffect(() => {
    // Generate a unique ID for this task form session
    currentTaskId.current = uid();
    
    return () => {
      // Cleanup on unmount
      audioPlayer.stopLoop();
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, []);

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
    analytics.voiceRecordingDeleted();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const t = cleanStr(title);
    if (!t) return;
    if (!time) return;

    const taskId = uid();
    let audioSaved = false;

    // Save the recording if one exists
    if (hasRecording && recordingUrl) {
      try {
        // Convert URL back to blob for storage
        const response = await fetch(recordingUrl);
        const audioBlob = await response.blob();
        const result = await audioStorage.saveRecording(taskId, audioBlob);
        audioSaved = result.success;
      } catch (error) {
        console.error("Failed to save recording:", error);
      }
    }

    const task = {
      id: taskId,
      title: t,
      time,
      notes: cleanStr(notes),
      enabled: true,
      hasCustomVoice: audioSaved,
    };

    onAdd?.(task);

    // Reset form
    setTitle("");
    setNotes("");
    deleteRecording();
    
    // Generate new task ID for next task
    currentTaskId.current = uid();
  }

  // Voice recording UI component
  function VoiceRecordingSection() {
    if (!isRecordingSupported()) {
      return (
        <div className="field">
          <label>Voice Recording</label>
          <div className="recordingUnsupported">
            Voice recording is not supported in this browser
          </div>
        </div>
      );
    }

    return (
      <div className="field">
        <label>Voice Recording</label>
        <div className="recordingControls">
          {!hasRecording && !isRecording && (
            <button 
              type="button" 
              className="btn btnRecord" 
              onClick={startRecording}
              disabled={!title.trim()}
            >
              🎤 Record "{title.trim() || 'your task'}"
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

          <VoiceRecordingSection />

          <div className="field">
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." />
          </div>
        </div>

        <div className="actionsRow actionsRowAdd">
          <button className="btnPrimary btnPrimaryWide" type="submit">
            Add Task
          </button>
          <div className="hint">
            {isRecordingSupported() 
              ? "Record your voice saying the task title for personalized reminders" 
              : "Voice recording not supported in this browser"
            }
          </div>
        </div>
      </form>
    </div>
  );
}
