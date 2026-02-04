// Audio recording utility for custom voice reminders

class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
  }

  async startRecording() {
    try {
      console.log("Starting recording...");

      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      console.log("Got media stream:", this.stream);

      // Check for supported MIME types
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp4";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ""; // Let browser choose
          }
        }
      }

      console.log("Using MIME type:", mimeType);

      this.mediaRecorder = new MediaRecorder(
        this.stream,
        mimeType ? { mimeType } : {},
      );
      this.audioChunks = [];
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("Data available:", event.data.size);
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log("Recording started");
      };

      this.mediaRecorder.onstop = () => {
        console.log("Recording stopped");
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
      };

      this.mediaRecorder.start(1000); // Collect data every second
      console.log("MediaRecorder started");

      return { success: true };
    } catch (error) {
      console.error("Failed to start recording:", error);
      this.isRecording = false;
      return { success: false, error: error.message };
    }
  }

  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        console.log("No active recording to stop");
        resolve({ success: false, error: "No active recording" });
        return;
      }

      console.log("Stopping recording...");

      this.mediaRecorder.onstop = () => {
        console.log("Recording stopped, processing audio...");
        this.isRecording = false;

        // Stop all tracks to release microphone
        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            console.log("Stopping track:", track.kind);
            track.stop();
          });
          this.stream = null;
        }

        // Create blob from recorded chunks
        if (this.audioChunks.length === 0) {
          console.log("No audio chunks recorded");
          resolve({ success: false, error: "No audio recorded" });
          return;
        }

        const audioBlob = new Blob(this.audioChunks, {
          type: "audio/webm",
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        console.log("Created audio blob:", audioBlob.size, "bytes");
        console.log("Created audio URL:", audioUrl);

        resolve({
          success: true,
          audioBlob,
          audioUrl,
          duration: this.audioChunks.length > 0 ? "recorded" : 0,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.audioChunks = [];
  }

  getRecordingState() {
    return {
      isRecording: this.isRecording,
      isSupported: !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ),
    };
  }
}

// Audio storage using IndexedDB for persistence
class AudioStorage {
  constructor() {
    this.dbName = "vk7days_audio";
    this.dbVersion = 1;
    this.storeName = "recordings";
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "taskId" });
        }
      };
    });
  }

  async saveRecording(taskId, audioBlob) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      await new Promise((resolve, reject) => {
        const request = store.put({ taskId, audioBlob, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      return { success: true };
    } catch (error) {
      console.error("Failed to save recording:", error);
      return { success: false, error: error.message };
    }
  }

  async getRecording(taskId) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      const result = await new Promise((resolve, reject) => {
        const request = store.get(taskId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();

      if (result && result.audioBlob) {
        const audioUrl = URL.createObjectURL(result.audioBlob);
        return { success: true, audioUrl, audioBlob: result.audioBlob };
      }

      return { success: false, error: "Recording not found" };
    } catch (error) {
      console.error("Failed to get recording:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteRecording(taskId) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      await new Promise((resolve, reject) => {
        const request = store.delete(taskId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      return { success: true };
    } catch (error) {
      console.error("Failed to delete recording:", error);
      return { success: false, error: error.message };
    }
  }

  async getAllRecordings() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      const recordings = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return { success: true, recordings };
    } catch (error) {
      console.error("Failed to get all recordings:", error);
      return { success: false, error: error.message };
    }
  }
}

// Audio playback utility
export class AudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.isPlaying = false;
    this.loopTimer = null;
  }

  async playOnce(audioUrl) {
    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = 1.0;
      this.currentAudio.preload = "auto";
      this.isPlaying = true;

      await new Promise((resolve, reject) => {
        this.currentAudio.onended = () => {
          this.isPlaying = false;
          resolve();
        };

        this.currentAudio.onerror = (e) => {
          console.error("Audio playback error:", e);
          this.isPlaying = false;
          reject(
            new Error(
              "Audio playback failed: " +
                (this.currentAudio.error?.message || "Unknown error"),
            ),
          );
        };

        const playPromise = this.currentAudio.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Audio started successfully
            })
            .catch((error) => {
              console.error("Audio play() failed:", error);
              this.isPlaying = false;
              reject(error);
            });
        }
      });
    } catch (error) {
      console.error("PlayOnce error:", error);
      this.isPlaying = false;
      throw error;
    }
  }

  async startLoop(audioUrl, intervalMs = 2500) {
    this.stopLoop();

    const playLoop = async () => {
      if (!this.loopTimer) return; // Loop was stopped

      try {
        await this.playOnce(audioUrl);
      } catch (error) {
        console.error("Audio loop playback error:", error);
      }

      if (this.loopTimer) {
        this.loopTimer = setTimeout(playLoop, intervalMs);
      }
    };

    this.loopTimer = setTimeout(playLoop, 0);
  }

  stopLoop() {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    this.isPlaying = false;
  }

  getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      hasActiveLoop: !!this.loopTimer,
    };
  }
}

// Export instances
export const audioRecorder = new AudioRecorder();
export const audioStorage = new AudioStorage();
export const audioPlayer = new AudioPlayer();

// Helper function to check if recording is supported
export function isRecordingSupported() {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
  );
}
