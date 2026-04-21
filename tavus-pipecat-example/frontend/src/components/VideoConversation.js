import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCClient } from '../webrtc-client';
import { DailyClient } from '../daily-client';
import './VideoConversation.css';

// Transport mode: "daily" for cloud (ECS), "webrtc" for local dev
const TRANSPORT = process.env.REACT_APP_TRANSPORT || 'webrtc';

// Content items matching the backend definitions
const CONTENT_ITEMS = {
  aws_voice_ai_overview: {
    url: '/content/aws-voice-ai',
    label: 'AWS Voice AI Overview',
  },
  guidance_voice_agents_aws: {
    url: '/content/guidance-voice-agents-aws',
    label: 'Guidance for Voice Agents on AWS',
  },
  common_use_cases: {
    url: '/content/common-use-cases',
    label: 'Voice AI Use Cases by Industry',
  },
};

// Content pages are served from the same origin (public/content/)
const CONTENT_BASE_URL = '';

// ---------------------------------------------------------------------------
// Transcript Panel
// ---------------------------------------------------------------------------

function TranscriptPanel({ userText, agentText, userSpeaking, agentSpeaking }) {
  const show = userSpeaking || agentSpeaking || userText || agentText;
  if (!show) return null;

  const displayUser = userSpeaking && !userText
    ? 'Listening...'
    : userText || 'Waiting for your first question.';
  const displayAgent = agentSpeaking && !agentText
    ? 'Speaking...'
    : agentText || 'Agent responses appear here.';

  return (
    <div className="transcript-panel">
      <div className="transcript-rows">
        <TranscriptRow active={userSpeaking} label="You" text={displayUser} />
        <TranscriptRow active={agentSpeaking} label="Agent" text={displayAgent} />
      </div>
    </div>
  );
}

function TranscriptRow({ active, label, text }) {
  return (
    <div className={`transcript-row ${active ? 'active' : 'inactive'}`}>
      <div className="transcript-row-header">
        <span className={`transcript-dot ${active ? 'active' : 'inactive'}`} />
        {label}
      </div>
      <p className="transcript-text">{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating Mic Control
// ---------------------------------------------------------------------------

function FloatingMicControl({ isMuted, isOverlayActive, onToggle, onDisconnect }) {
  const [isHovered, setIsHovered] = useState(false);
  const isCollapsed = isOverlayActive && !isHovered;

  return (
    <div
      className={`mic-control ${isCollapsed ? 'collapsed' : 'expanded'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mic-row">
        <span className={`mic-status-dot ${isMuted ? 'muted' : 'live'}`} />
        {!isCollapsed && (
          <div className="mic-label-group">
            <p className="mic-label-tiny">Mic</p>
            <p className="mic-label-status">{isMuted ? 'Muted' : 'Live'}</p>
          </div>
        )}
        <button
          className={`mic-btn ${isMuted ? 'unmute' : 'mute-action'}`}
          onClick={onToggle}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        {!isCollapsed && (
          <button className="disconnect-btn" onClick={onDisconnect}>
            End
          </button>
        )}
      </div>
      {!isCollapsed && (
        <div className="mic-extras">
          <p className="mic-hint">Ctrl+D mute</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// Backend URL: empty string routes through the dev proxy (package.json → localhost:7860)
// and works in production (same origin via CloudFront). Never use an explicit host here.
const API_URL = process.env.REACT_APP_API_URL ?? '';

const PIPELINE_CASCADED = 'cascaded';
const PIPELINE_NOVA_SONIC = 'nova-sonic';

const PIPELINE_OPTIONS = [
  {
    id: PIPELINE_CASCADED,
    label: 'Cascaded',
    description: 'Deepgram STT + Bedrock Claude + Cartesia TTS',
  },
  {
    id: PIPELINE_NOVA_SONIC,
    label: 'Nova Sonic',
    description: 'Amazon Nova Sonic speech-to-speech',
  },
];

function VideoConversation() {
  const [hasStarted, setHasStarted] = useState(false);
  const [connectionState, setConnectionState] = useState('idle');
  const [error, setError] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [overlay, setOverlay] = useState(null);
  const [pipeline, setPipeline] = useState(PIPELINE_CASCADED);
  const [showPipelineModal, setShowPipelineModal] = useState(false);

  // Transcript state
  const [userText, setUserText] = useState('');
  const [agentText, setAgentText] = useState('');
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const webrtcClient = useRef(null);
  const remoteVideoRef = useRef(null);
  const isMicEnabledRef = useRef(true);

  const handleBotMessage = useCallback((message) => {
    if (message.type === 'tool_call') {
      const { tool, data } = message;
      console.log('Tool call received:', tool, data);

      if (tool === 'show_content') {
        const item = CONTENT_ITEMS[data.item];
        if (item) {
          setOverlay({
            type: 'content',
            url: `${CONTENT_BASE_URL}${item.url}`,
            label: item.label,
          });
        }
      } else if (tool === 'show_schedule') {
        setOverlay({
          type: 'schedule',
          title: data.title,
          columns: data.columns || [],
        });
      } else if (tool === 'dismiss_content') {
        setOverlay(null);
      }
    } else if (message.type === 'transcript') {
      const { role, text, final: isFinal } = message;
      if (role === 'user') {
        setUserText(text);
        setUserSpeaking(!isFinal);
        if (isFinal) {
          // Brief speaking indicator before it settles
          setUserSpeaking(false);
        }
      } else if (role === 'agent') {
        if (text) setAgentText(text);
        setAgentSpeaking(!isFinal);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (webrtcClient.current) {
        webrtcClient.current.disconnect();
      }
    };
  }, []);

  // Esc key to dismiss overlay
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setOverlay(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Ctrl+D mute hotkey
  useEffect(() => {
    const handler = (e) => {
      if (e.repeat || !e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'd') return;
      e.preventDefault();
      toggleMic();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleConnect = async () => {
    setHasStarted(true);
    setConnectionState('connecting');
    setError('');
    try {
      webrtcClient.current = TRANSPORT === 'daily'
        ? new DailyClient(API_URL)
        : new WebRTCClient(API_URL);

      webrtcClient.current.on('track', (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      webrtcClient.current.on('connectionStateChange', (state) => {
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'failed' || state === 'disconnected') {
          setError('Connection lost');
          setConnectionState('error');
        }
      });

      webrtcClient.current.on('error', (err) => {
        setError(err.message);
        setConnectionState('error');
      });

      webrtcClient.current.on('botMessage', handleBotMessage);

      await webrtcClient.current.initializeLocalMedia();
      await webrtcClient.current.connect({
        requestData: { pipeline },
      });
    } catch (err) {
      setError(err.message || 'Failed to start conversation');
      setConnectionState('error');
    }
  };

  const handleDisconnect = () => {
    if (webrtcClient.current) {
      webrtcClient.current.disconnect();
    }
    setHasStarted(false);
    setConnectionState('idle');
    setError('');
    setOverlay(null);
    setUserText('');
    setAgentText('');
    setUserSpeaking(false);
    setAgentSpeaking(false);
  };

  const toggleMic = () => {
    if (webrtcClient.current) {
      const newState = !isMicEnabledRef.current;
      isMicEnabledRef.current = newState;
      webrtcClient.current.toggleMicrophone(newState);
      setIsMicEnabled(newState);
    }
  };

  const dismissOverlay = () => {
    setOverlay(null);
  };

  // --- Start screen ---
  if (!hasStarted || connectionState === 'idle') {
    return (
      <div className="start-screen">
        <div className="start-screen-overlay" />
        <div className="start-inner">
          <header className="start-header">
            <div>
              <p className="eyebrow">{({'aws-summit-sydney-2026':'AWS Summit Sydney 2026','aws-summit-bengaluru-2026':'AWS Summit Bengaluru 2026'})[process.env.REACT_APP_EVENT_CONFIG] || 'AWS Booth Demo'}</p>
              <h1>Real-Time Voice AI on AWS</h1>
            </div>
            <div className="start-header-right">
              <button
                className="start-btn"
                onClick={() => setShowPipelineModal(true)}
              >
                Start demo
              </button>
            </div>
          </header>

          <section className="start-body">
            <div className="start-card">
              <div className="start-card-left">
                <div>
                  <span className="start-card-badge">Voice Agents on AWS</span>
                  <h2>Build real-time voice AI agents on AWS.</h2>
                  <p>
                    Two pipeline modes to compare. <strong>Cascaded</strong> chains
                    Deepgram STT, Bedrock Claude, and Cartesia TTS for full control.{' '}
                    <strong>Nova Sonic</strong> uses Amazon's speech-to-speech model
                    for a single-model approach. Both run on AWS with Pipecat
                    orchestration and Tavus avatar.
                  </p>
                </div>

                {(error || connectionState === 'error') && (
                  <div className="error-panel">
                    <p>{error || 'Something went wrong while starting the demo.'}</p>
                    <button className="retry-btn" onClick={handleConnect}>
                      Retry
                    </button>
                  </div>
                )}
              </div>

              <div className="start-card-right">
                <div className="info-box">
                  <p className="info-eyebrow sky">Join Flow</p>
                  <ol>
                    <li>1. Grant microphone permissions.</li>
                    <li>2. Connect to the Pipecat bot via WebRTC.</li>
                    <li>3. Real-time avatar video and audio starts.</li>
                  </ol>
                </div>
                <div className="info-box">
                  <p className="info-eyebrow green">Tool Use Demo</p>
                  <p className="info-text">
                    Ask the agent to show content on screen. Try{' '}
                    <em>"Show the architecture diagram"</em> or{' '}
                    <em>"Show me the use cases"</em>.
                  </p>
                </div>
                <div className="info-box">
                  <p className="info-eyebrow violet">Two Pipelines</p>
                  <p className="info-text">
                    Cascaded: swap best-of-breed STT, LLM, and TTS independently.
                    Nova Sonic: single speech-to-speech model on Bedrock with
                    15 languages and built-in function calling.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <footer className="start-footer">
            <svg className="footer-logo aws-logo" viewBox="0 0 304 182" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AWS"><path d="M86.4 66.4c0 3.7.4 6.7 1.1 8.9.8 2.2 1.8 4.6 3.2 7.1.5.8.7 1.6.7 2.3 0 1-.6 2-1.9 3l-6.3 4.2c-.9.6-1.8.9-2.6.9-1 0-2-.5-3-1.4-1.4-1.5-2.6-3.1-3.6-4.7-1-1.7-2-3.6-3.1-5.9-7.8 9.2-17.6 13.8-29.4 13.8-8.4 0-15.1-2.4-20-7.2-4.9-4.8-7.4-11.2-7.4-19.2 0-8.5 3-15.4 9.1-20.6 6.1-5.2 14.2-7.8 24.5-7.8 3.4 0 6.9.3 10.6.8 3.7.5 7.5 1.3 11.5 2.2v-7.3c0-7.6-1.6-12.9-4.7-16-3.2-3.1-8.6-4.6-16.3-4.6-3.5 0-7.1.4-10.8 1.3-3.7.9-7.3 2-10.8 3.4-1.6.7-2.8 1.1-3.5 1.3-.7.2-1.2.3-1.6.3-1.4 0-2.1-1-2.1-3.1v-4.9c0-1.6.2-2.8.7-3.5.5-.7 1.4-1.4 2.8-2.1 3.5-1.8 7.7-3.3 12.6-4.5 4.9-1.3 10.1-1.9 15.6-1.9 11.9 0 20.6 2.7 26.2 8.1 5.5 5.4 8.3 13.6 8.3 24.6v32.4h.1zm-40.6 15.2c3.3 0 6.7-.6 10.3-1.8 3.6-1.2 6.8-3.4 9.5-6.4 1.6-1.9 2.8-4 3.4-6.4.6-2.4 1-5.3 1-8.7v-4.2c-2.8-.7-5.8-1.3-8.9-1.7-3.1-.4-6.1-.6-9.1-.6-6.7 0-11.6 1.3-14.9 4-3.3 2.7-4.9 6.5-4.9 11.5 0 4.7 1.2 8.2 3.7 10.6 2.4 2.5 5.9 3.7 9.9 3.7zm80.3 10.8c-1.8 0-3-.3-3.8-1-.8-.6-1.5-2-2.1-3.9L96.7 10.2c-.6-2-.9-3.3-.9-4 0-1.6.8-2.5 2.4-2.5h9.8c1.9 0 3.2.3 3.9 1 .8.6 1.4 2 2 3.9l16.8 66.2 15.6-66.2c.5-2 1.1-3.3 1.9-3.9.8-.6 2.2-1 4-1h8c1.9 0 3.2.3 4 1 .8.6 1.5 2 1.9 3.9l15.8 67 17.3-67c.6-2 1.3-3.3 2-3.9.8-.6 2.1-1 3.9-1h9.3c1.6 0 2.5.8 2.5 2.5 0 .5-.1 1-.2 1.6-.1.6-.3 1.4-.7 2.5l-24.1 77.3c-.6 2-1.3 3.3-2.1 3.9-.8.6-2.1 1-3.8 1h-8.6c-1.9 0-3.2-.3-4-1-.8-.7-1.5-2-1.9-4L156 23l-15.4 64.4c-.5 2-1.1 3.3-1.9 4-.8.7-2.2 1-4 1h-8.6zm128.5 2.7c-5.2 0-10.4-.6-15.4-1.8-5-1.2-8.9-2.5-11.5-4-1.6-.9-2.7-1.9-3.1-2.8-.4-.9-.6-1.9-.6-2.8v-5.1c0-2.1.8-3.1 2.3-3.1.6 0 1.2.1 1.8.3.6.2 1.5.6 2.5 1 3.4 1.5 7.1 2.7 11 3.5 4 .8 7.9 1.2 11.9 1.2 6.3 0 11.2-1.1 14.6-3.3 3.4-2.2 5.2-5.4 5.2-9.5 0-2.8-.9-5.1-2.7-7-1.8-1.9-5.2-3.6-10.1-5.2L246 52c-7.3-2.3-12.7-5.7-16-10.2-3.3-4.4-5-9.3-5-14.5 0-4.2.9-7.9 2.7-11.1 1.8-3.2 4.2-6 7.2-8.2 3-2.3 6.4-4 10.4-5.2 4-1.2 8.2-1.7 12.6-1.7 2.2 0 4.5.1 6.7.4 2.3.3 4.4.7 6.5 1.1 2 .5 3.9 1 5.7 1.6 1.8.6 3.2 1.2 4.2 1.8 1.4.8 2.4 1.6 3 2.5.6.8.9 1.8.9 3.3v4.7c0 2.1-.8 3.2-2.3 3.2-.8 0-2.1-.4-3.8-1.2-5.7-2.6-12.1-3.9-19.2-3.9-5.7 0-10.2.9-13.3 2.8-3.1 1.9-4.7 4.8-4.7 8.9 0 2.8 1 5.2 3 7.1 2 1.9 5.7 3.8 11 5.5l14.2 4.5c7.2 2.3 12.4 5.5 15.5 9.6 3.1 4.1 4.6 8.8 4.6 14 0 4.3-.9 8.2-2.6 11.6-1.8 3.4-4.2 6.4-7.3 8.8-3.1 2.5-6.8 4.3-11.1 5.6-4.5 1.4-9.2 2.1-14.3 2.1z" fill="white"/><path d="M273.5 143.7c-32.9 24.3-80.7 37.2-121.8 37.2-57.6 0-109.5-21.3-148.7-56.7-3.1-2.8-.3-6.6 3.4-4.4 42.4 24.6 94.7 39.5 148.8 39.5 36.5 0 76.6-7.6 113.5-23.2 5.6-2.3 10.2 3.7 4.8 7.6z" fill="white"/><path d="M287.2 128.1c-4.2-5.4-27.8-2.6-38.5-1.3-3.2.4-3.7-2.4-.8-4.5 18.8-13.2 49.7-9.4 53.3-5 3.6 4.5-1 35.4-18.6 50.2-2.7 2.3-5.3 1.1-4.1-1.9 4-9.9 12.9-32.2 8.7-37.5z" fill="white"/></svg>
            <img className="footer-logo footer-logo-img logo-deepgram" src="/deepgram-logo.png" alt="Deepgram" />
            <img className="footer-logo footer-logo-img" src="/pipecat-logo.png" alt="Pipecat" />
            <img className="footer-logo footer-logo-img no-invert logo-tavus" src="/tavus-logo.svg" alt="Tavus" />
          </footer>
        </div>

        {/* Pipeline selection modal */}
        {showPipelineModal && (
          <div className="pipeline-modal-backdrop" onClick={() => setShowPipelineModal(false)}>
            <div className="pipeline-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="pipeline-modal-title">Choose Pipeline Mode</h3>
              <div className="pipeline-modal-options">
                {PIPELINE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`pipeline-modal-option ${pipeline === opt.id ? 'active' : ''}`}
                    onClick={() => setPipeline(opt.id)}
                  >
                    <span className="pipeline-option-label">{opt.label}</span>
                    <span className="pipeline-option-desc">{opt.description}</span>
                  </button>
                ))}
              </div>
              <button
                className="pipeline-modal-go"
                onClick={() => { setShowPipelineModal(false); handleConnect(); }}
              >
                Start
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Active session ---
  return (
    <div className={`session ${overlay ? 'has-overlay' : ''}`}>
      {/* Remote avatar video */}
      {overlay ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="session-video-pip"
        />
      ) : (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="session-video"
        />
      )}

      {/* Connecting overlay with AWS logo — smile sweeps left to right */}
      {connectionState === 'connecting' && (
        <div className="connecting-overlay">
          <div className="aws-logo-pulse">
            <svg viewBox="0 0 304 182" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AWS">
              <path d="M86.4 66.4c0 3.7.4 6.7 1.1 8.9.8 2.2 1.8 4.6 3.2 7.1.5.8.7 1.6.7 2.3 0 1-.6 2-1.9 3l-6.3 4.2c-.9.6-1.8.9-2.6.9-1 0-2-.5-3-1.4-1.4-1.5-2.6-3.1-3.6-4.7-1-1.7-2-3.6-3.1-5.9-7.8 9.2-17.6 13.8-29.4 13.8-8.4 0-15.1-2.4-20-7.2-4.9-4.8-7.4-11.2-7.4-19.2 0-8.5 3-15.4 9.1-20.6 6.1-5.2 14.2-7.8 24.5-7.8 3.4 0 6.9.3 10.6.8 3.7.5 7.5 1.3 11.5 2.2v-7.3c0-7.6-1.6-12.9-4.7-16-3.2-3.1-8.6-4.6-16.3-4.6-3.5 0-7.1.4-10.8 1.3-3.7.9-7.3 2-10.8 3.4-1.6.7-2.8 1.1-3.5 1.3-.7.2-1.2.3-1.6.3-1.4 0-2.1-1-2.1-3.1v-4.9c0-1.6.2-2.8.7-3.5.5-.7 1.4-1.4 2.8-2.1 3.5-1.8 7.7-3.3 12.6-4.5 4.9-1.3 10.1-1.9 15.6-1.9 11.9 0 20.6 2.7 26.2 8.1 5.5 5.4 8.3 13.6 8.3 24.6v32.4h.1zm-40.6 15.2c3.3 0 6.7-.6 10.3-1.8 3.6-1.2 6.8-3.4 9.5-6.4 1.6-1.9 2.8-4 3.4-6.4.6-2.4 1-5.3 1-8.7v-4.2c-2.8-.7-5.8-1.3-8.9-1.7-3.1-.4-6.1-.6-9.1-.6-6.7 0-11.6 1.3-14.9 4-3.3 2.7-4.9 6.5-4.9 11.5 0 4.7 1.2 8.2 3.7 10.6 2.4 2.5 5.9 3.7 9.9 3.7zm80.3 10.8c-1.8 0-3-.3-3.8-1-.8-.6-1.5-2-2.1-3.9L96.7 10.2c-.6-2-.9-3.3-.9-4 0-1.6.8-2.5 2.4-2.5h9.8c1.9 0 3.2.3 3.9 1 .8.6 1.4 2 2 3.9l16.8 66.2 15.6-66.2c.5-2 1.1-3.3 1.9-3.9.8-.6 2.2-1 4-1h8c1.9 0 3.2.3 4 1 .8.6 1.5 2 1.9 3.9l15.8 67 17.3-67c.6-2 1.3-3.3 2-3.9.8-.6 2.1-1 3.9-1h9.3c1.6 0 2.5.8 2.5 2.5 0 .5-.1 1-.2 1.6-.1.6-.3 1.4-.7 2.5l-24.1 77.3c-.6 2-1.3 3.3-2.1 3.9-.8.6-2.1 1-3.8 1h-8.6c-1.9 0-3.2-.3-4-1-.8-.7-1.5-2-1.9-4L156 23l-15.4 64.4c-.5 2-1.1 3.3-1.9 4-.8.7-2.2 1-4 1h-8.6zm128.5 2.7c-5.2 0-10.4-.6-15.4-1.8-5-1.2-8.9-2.5-11.5-4-1.6-.9-2.7-1.9-3.1-2.8-.4-.9-.6-1.9-.6-2.8v-5.1c0-2.1.8-3.1 2.3-3.1.6 0 1.2.1 1.8.3.6.2 1.5.6 2.5 1 3.4 1.5 7.1 2.7 11 3.5 4 .8 7.9 1.2 11.9 1.2 6.3 0 11.2-1.1 14.6-3.3 3.4-2.2 5.2-5.4 5.2-9.5 0-2.8-.9-5.1-2.7-7-1.8-1.9-5.2-3.6-10.1-5.2L246 52c-7.3-2.3-12.7-5.7-16-10.2-3.3-4.4-5-9.3-5-14.5 0-4.2.9-7.9 2.7-11.1 1.8-3.2 4.2-6 7.2-8.2 3-2.3 6.4-4 10.4-5.2 4-1.2 8.2-1.7 12.6-1.7 2.2 0 4.5.1 6.7.4 2.3.3 4.4.7 6.5 1.1 2 .5 3.9 1 5.7 1.6 1.8.6 3.2 1.2 4.2 1.8 1.4.8 2.4 1.6 3 2.5.6.8.9 1.8.9 3.3v4.7c0 2.1-.8 3.2-2.3 3.2-.8 0-2.1-.4-3.8-1.2-5.7-2.6-12.1-3.9-19.2-3.9-5.7 0-10.2.9-13.3 2.8-3.1 1.9-4.7 4.8-4.7 8.9 0 2.8 1 5.2 3 7.1 2 1.9 5.7 3.8 11 5.5l14.2 4.5c7.2 2.3 12.4 5.5 15.5 9.6 3.1 4.1 4.6 8.8 4.6 14 0 4.3-.9 8.2-2.6 11.6-1.8 3.4-4.2 6.4-7.3 8.8-3.1 2.5-6.8 4.3-11.1 5.6-4.5 1.4-9.2 2.1-14.3 2.1z" fill="white"/>
              <g className="aws-smile">
                <path d="M273.5 143.7c-32.9 24.3-80.7 37.2-121.8 37.2-57.6 0-109.5-21.3-148.7-56.7-3.1-2.8-.3-6.6 3.4-4.4 42.4 24.6 94.7 39.5 148.8 39.5 36.5 0 76.6-7.6 113.5-23.2 5.6-2.3 10.2 3.7 4.8 7.6z" fill="white"/>
                <path d="M287.2 128.1c-4.2-5.4-27.8-2.6-38.5-1.3-3.2.4-3.7-2.4-.8-4.5 18.8-13.2 49.7-9.4 53.3-5 3.6 4.5-1 35.4-18.6 50.2-2.7 2.3-5.3 1.1-4.1-1.9 4-9.9 12.9-32.2 8.7-37.5z" fill="white"/>
              </g>
            </svg>
          </div>
          <div className="connecting-text-cycle">
            <span className="ct-a">Connecting...</span>
            <span className="ct-b">Loading Tavus video avatar...</span>
          </div>
          <img src="/tavus-logo.svg" alt="Tavus" className="connecting-tavus-logo" />
        </div>
      )}

      {/* Pipeline badge */}
      {connectionState === 'connected' && (
        <div className="pipeline-badge">
          {pipeline === PIPELINE_NOVA_SONIC ? 'Nova Sonic' : 'Cascaded'}
        </div>
      )}

      {/* Tavus logo watermark — bottom-right during active session */}
      {connectionState === 'connected' && !overlay && (
        <img src="/tavus-logo.svg" alt="Tavus" className="tavus-watermark" />
      )}

      {/* AWS logo watermark — hidden when overlay is active */}
      {connectionState === 'connected' && !overlay && (
        <div className="aws-watermark">
          <svg viewBox="0 0 304 182" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AWS"><path d="M86.4 66.4c0 3.7.4 6.7 1.1 8.9.8 2.2 1.8 4.6 3.2 7.1.5.8.7 1.6.7 2.3 0 1-.6 2-1.9 3l-6.3 4.2c-.9.6-1.8.9-2.6.9-1 0-2-.5-3-1.4-1.4-1.5-2.6-3.1-3.6-4.7-1-1.7-2-3.6-3.1-5.9-7.8 9.2-17.6 13.8-29.4 13.8-8.4 0-15.1-2.4-20-7.2-4.9-4.8-7.4-11.2-7.4-19.2 0-8.5 3-15.4 9.1-20.6 6.1-5.2 14.2-7.8 24.5-7.8 3.4 0 6.9.3 10.6.8 3.7.5 7.5 1.3 11.5 2.2v-7.3c0-7.6-1.6-12.9-4.7-16-3.2-3.1-8.6-4.6-16.3-4.6-3.5 0-7.1.4-10.8 1.3-3.7.9-7.3 2-10.8 3.4-1.6.7-2.8 1.1-3.5 1.3-.7.2-1.2.3-1.6.3-1.4 0-2.1-1-2.1-3.1v-4.9c0-1.6.2-2.8.7-3.5.5-.7 1.4-1.4 2.8-2.1 3.5-1.8 7.7-3.3 12.6-4.5 4.9-1.3 10.1-1.9 15.6-1.9 11.9 0 20.6 2.7 26.2 8.1 5.5 5.4 8.3 13.6 8.3 24.6v32.4h.1zm-40.6 15.2c3.3 0 6.7-.6 10.3-1.8 3.6-1.2 6.8-3.4 9.5-6.4 1.6-1.9 2.8-4 3.4-6.4.6-2.4 1-5.3 1-8.7v-4.2c-2.8-.7-5.8-1.3-8.9-1.7-3.1-.4-6.1-.6-9.1-.6-6.7 0-11.6 1.3-14.9 4-3.3 2.7-4.9 6.5-4.9 11.5 0 4.7 1.2 8.2 3.7 10.6 2.4 2.5 5.9 3.7 9.9 3.7zm80.3 10.8c-1.8 0-3-.3-3.8-1-.8-.6-1.5-2-2.1-3.9L96.7 10.2c-.6-2-.9-3.3-.9-4 0-1.6.8-2.5 2.4-2.5h9.8c1.9 0 3.2.3 3.9 1 .8.6 1.4 2 2 3.9l16.8 66.2 15.6-66.2c.5-2 1.1-3.3 1.9-3.9.8-.6 2.2-1 4-1h8c1.9 0 3.2.3 4 1 .8.6 1.5 2 1.9 3.9l15.8 67 17.3-67c.6-2 1.3-3.3 2-3.9.8-.6 2.1-1 3.9-1h9.3c1.6 0 2.5.8 2.5 2.5 0 .5-.1 1-.2 1.6-.1.6-.3 1.4-.7 2.5l-24.1 77.3c-.6 2-1.3 3.3-2.1 3.9-.8.6-2.1 1-3.8 1h-8.6c-1.9 0-3.2-.3-4-1-.8-.7-1.5-2-1.9-4L156 23l-15.4 64.4c-.5 2-1.1 3.3-1.9 4-.8.7-2.2 1-4 1h-8.6zm128.5 2.7c-5.2 0-10.4-.6-15.4-1.8-5-1.2-8.9-2.5-11.5-4-1.6-.9-2.7-1.9-3.1-2.8-.4-.9-.6-1.9-.6-2.8v-5.1c0-2.1.8-3.1 2.3-3.1.6 0 1.2.1 1.8.3.6.2 1.5.6 2.5 1 3.4 1.5 7.1 2.7 11 3.5 4 .8 7.9 1.2 11.9 1.2 6.3 0 11.2-1.1 14.6-3.3 3.4-2.2 5.2-5.4 5.2-9.5 0-2.8-.9-5.1-2.7-7-1.8-1.9-5.2-3.6-10.1-5.2L246 52c-7.3-2.3-12.7-5.7-16-10.2-3.3-4.4-5-9.3-5-14.5 0-4.2.9-7.9 2.7-11.1 1.8-3.2 4.2-6 7.2-8.2 3-2.3 6.4-4 10.4-5.2 4-1.2 8.2-1.7 12.6-1.7 2.2 0 4.5.1 6.7.4 2.3.3 4.4.7 6.5 1.1 2 .5 3.9 1 5.7 1.6 1.8.6 3.2 1.2 4.2 1.8 1.4.8 2.4 1.6 3 2.5.6.8.9 1.8.9 3.3v4.7c0 2.1-.8 3.2-2.3 3.2-.8 0-2.1-.4-3.8-1.2-5.7-2.6-12.1-3.9-19.2-3.9-5.7 0-10.2.9-13.3 2.8-3.1 1.9-4.7 4.8-4.7 8.9 0 2.8 1 5.2 3 7.1 2 1.9 5.7 3.8 11 5.5l14.2 4.5c7.2 2.3 12.4 5.5 15.5 9.6 3.1 4.1 4.6 8.8 4.6 14 0 4.3-.9 8.2-2.6 11.6-1.8 3.4-4.2 6.4-7.3 8.8-3.1 2.5-6.8 4.3-11.1 5.6-4.5 1.4-9.2 2.1-14.3 2.1z" fill="white"/><path d="M273.5 143.7c-32.9 24.3-80.7 37.2-121.8 37.2-57.6 0-109.5-21.3-148.7-56.7-3.1-2.8-.3-6.6 3.4-4.4 42.4 24.6 94.7 39.5 148.8 39.5 36.5 0 76.6-7.6 113.5-23.2 5.6-2.3 10.2 3.7 4.8 7.6z" fill="white"/><path d="M287.2 128.1c-4.2-5.4-27.8-2.6-38.5-1.3-3.2.4-3.7-2.4-.8-4.5 18.8-13.2 49.7-9.4 53.3-5 3.6 4.5-1 35.4-18.6 50.2-2.7 2.3-5.3 1.1-4.1-1.9 4-9.9 12.9-32.2 8.7-37.5z" fill="white"/></svg>
        </div>
      )}

      {/* Floating mic control */}
      {connectionState === 'connected' && (
        <FloatingMicControl
          isMuted={!isMicEnabled}
          isOverlayActive={Boolean(overlay)}
          onToggle={toggleMic}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Transcript panel (only when no overlay) */}
      {connectionState === 'connected' && !overlay && (
        <TranscriptPanel
          userText={userText}
          agentText={agentText}
          userSpeaking={userSpeaking}
          agentSpeaking={agentSpeaking}
        />
      )}

      {/* Content overlay — iframe */}
      {overlay && overlay.type === 'content' && (
        <div className="content-overlay">
          <div className="content-overlay-header">
            <span className="content-overlay-title">{overlay.label}</span>
            <button className="content-overlay-close" onClick={dismissOverlay}>
              Close
            </button>
          </div>
          <iframe
            src={overlay.url}
            title={overlay.label}
            className="content-overlay-iframe"
          />
        </div>
      )}

      {/* Schedule overlay */}
      {overlay && overlay.type === 'schedule' && (
        <div className="content-overlay">
          <div className="content-overlay-header">
            <span className="content-overlay-title">{overlay.title}</span>
            <button className="content-overlay-close" onClick={dismissOverlay}>
              Close
            </button>
          </div>
          <div className="schedule-columns">
            {overlay.columns.map((col, idx) => (
              <div key={idx} className="schedule-column">
                {col.title && <h4 className="schedule-column-title">{col.title}</h4>}
                <div
                  dangerouslySetInnerHTML={{
                    __html: markdownTableToHtml(col.markdown_table),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {connectionState === 'error' && (
        <div className="connecting-overlay">
          <span className="connecting-text">{error || 'Connection failed'}</span>
          <button className="start-btn" onClick={handleConnect}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function markdownTableToHtml(markdown) {
  if (!markdown) return '';
  const lines = markdown.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return `<p>${escapeHtml(markdown)}</p>`;

  let html = '<table class="schedule-table">';

  const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean);
  html += '<thead><tr>';
  headers.forEach(h => { html += `<th>${escapeHtml(h)}</th>`; });
  html += '</tr></thead>';

  const rows = lines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    return '<tr>' + cells.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
  });
  html += '<tbody>' + rows.join('') + '</tbody></table>';

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default VideoConversation;
