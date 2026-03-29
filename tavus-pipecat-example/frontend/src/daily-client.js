/**
 * Daily.js Client for connecting to Pipecat bot via Daily transport.
 *
 * Mirrors the WebRTCClient interface so VideoConversation.js can swap
 * between SmallWebRTC (local) and Daily (cloud) seamlessly.
 */
import Daily from '@daily-co/daily-js';

export class DailyClient {
  constructor(serverUrl = '') {
    this.serverUrl = serverUrl;
    this.callObject = null;
    this.remoteStream = new MediaStream();
    this.callbacks = {
      onTrack: null,
      onConnectionStateChange: null,
      onError: null,
      onBotMessage: null,
    };
  }

  /**
   * Request microphone (and camera) permissions.
   * Daily manages the actual tracks, but we pre-request so the browser
   * permission prompt appears before we join.
   */
  async initializeLocalMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    // Stop the tracks immediately — Daily will create its own.
    stream.getTracks().forEach((t) => t.stop());
    return stream;
  }

  /**
   * Connect to the Pipecat bot via Daily transport.
   * Calls the backend /start endpoint to get a Daily room URL and token,
   * then joins via Daily.js.
   *
   * @param {Object} [options]
   * @param {Object} [options.requestData] - Custom data sent to the backend
   */
  async connect(options = {}) {
    try {
      // 1. Call backend /start to create a Daily room and get credentials
      const startBody = {};
      if (options.requestData) {
        startBody.request_data = options.requestData;
      }

      const res = await fetch(`${this.serverUrl}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startBody),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error: ${res.status} - ${errText}`);
      }

      const { dailyRoom, dailyToken } = await res.json();
      if (!dailyRoom) {
        throw new Error('No dailyRoom returned from /start');
      }

      // 2. Create Daily call object
      this.callObject = Daily.createCallObject({
        videoSource: true,
        audioSource: true,
      });

      // 3. Wire up event handlers
      this.callObject.on('track-started', (ev) => {
        if (ev.participant && !ev.participant.local && ev.track) {
          this.remoteStream.addTrack(ev.track);
          if (this.callbacks.onTrack) {
            this.callbacks.onTrack(this.remoteStream);
          }
        }
      });

      this.callObject.on('joined-meeting', () => {
        if (this.callbacks.onConnectionStateChange) {
          this.callbacks.onConnectionStateChange('connected');
        }
      });

      this.callObject.on('left-meeting', () => {
        if (this.callbacks.onConnectionStateChange) {
          this.callbacks.onConnectionStateChange('disconnected');
        }
      });

      this.callObject.on('error', (ev) => {
        if (this.callbacks.onError) {
          this.callbacks.onError(new Error(ev.errorMsg || 'Daily error'));
        }
      });

      // Listen for app-messages (tool calls, transcripts) from the bot
      this.callObject.on('app-message', (ev) => {
        if (ev.data && !ev.fromId?.startsWith?.('local')) {
          if (this.callbacks.onBotMessage) {
            // Daily app-messages arrive as objects already
            const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            this.callbacks.onBotMessage(msg);
          }
        }
      });

      // 4. Join the Daily room
      await this.callObject.join({
        url: dailyRoom,
        token: dailyToken || undefined,
      });

      return true;
    } catch (error) {
      console.error('Daily connection error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  /**
   * Disconnect and cleanup.
   */
  disconnect() {
    if (this.callObject) {
      this.callObject.leave();
      this.callObject.destroy();
      this.callObject = null;
    }
  }

  /**
   * Toggle microphone on/off.
   */
  toggleMicrophone(enabled) {
    if (this.callObject) {
      this.callObject.setLocalAudio(enabled);
      return enabled;
    }
    return false;
  }

  /**
   * Toggle camera on/off.
   */
  toggleCamera(enabled) {
    if (this.callObject) {
      this.callObject.setLocalVideo(enabled);
      return enabled;
    }
    return false;
  }

  /**
   * Set callback functions (same interface as WebRTCClient).
   */
  on(event, callback) {
    const key = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
    if (this.callbacks.hasOwnProperty(key)) {
      this.callbacks[key] = callback;
    }
  }
}
