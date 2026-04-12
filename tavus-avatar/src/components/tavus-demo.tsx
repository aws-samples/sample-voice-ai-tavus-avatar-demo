"use client";

import DailyIframe from "@daily-co/daily-js";
import type {
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectCameraError,
} from "@daily-co/daily-js";
import { DailyAudio, DailyProvider, DailyVideo, useDevices, useParticipantIds } from "@daily-co/daily-react";
import type { DailyAudioHandle } from "@daily-co/daily-react/dist/components/DailyAudio";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { ScheduleOverlay, type ScheduleOverlayColumn } from "@/components/schedule-overlay";
import {
  CONTENT_ITEMS,
  resolveContentItemKey,
  type ContentItemKey,
} from "@/lib/content-items";
import { getCustomTavusLlmConfig } from "@/lib/tavus-custom-llms";
import type {
  TavusAppMessage,
  TavusConversationCreateResponse,
  TavusConversationEchoMessage,
  TavusConversationUtteranceMessage,
  TavusToolCallMessage,
} from "@/types/tavus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoStatus =
  | "idle"
  | "requesting-permissions"
  | "loading"
  | "joining"
  | "connected"
  | "leaving"
  | "error";

type TranscriptEntry = {
  inferenceId?: string;
  text: string;
};

type OverlayState =
  | {
      kind: "content";
      contentItemKey: ContentItemKey;
    }
  | {
      kind: "schedule";
      columns: ScheduleOverlayColumn[];
      title?: string;
    };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const START_BUTTON_LABELS: Record<Exclude<DemoStatus, "connected" | "error">, string> = {
  idle: "Start demo",
  "requesting-permissions": "Approve camera and microphone",
  loading: "Creating AI conversation",
  joining: "Joining session",
  leaving: "Ending current session",
};

const REPLICA_READY_EVENT_TYPES = new Set([
  "system.replica_present",
  "system.replica_joined",
  "conversation.replica.started_speaking",
]);

const START_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while starting the demo.";
}

function getRequestedLlmName() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("llm");
}

function hasEnabledQueryFlag(name: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const value = new URLSearchParams(window.location.search).get(name);
  return value === "1" || value === "true";
}

function hasAutoStartAlreadyBeenClaimed() {
  if (typeof window === "undefined") {
    return false;
  }

  const globalWindow = window as Window & {
    __tavusAutoStartClaimed__?: boolean;
  };

  if (globalWindow.__tavusAutoStartClaimed__) {
    return true;
  }

  globalWindow.__tavusAutoStartClaimed__ = true;
  return false;
}

function getDeviceDisplayName(label: string | null | undefined, fallback: string) {
  const trimmedLabel = label?.trim();
  return trimmedLabel ? trimmedLabel : fallback;
}

async function playToolCallChime(audioContextRef: { current: AudioContext | null }) {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
    return;
  }

  const audioContext = audioContextRef.current ?? new window.AudioContext();
  audioContextRef.current = audioContext;

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const now = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.024, now + 0.012);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

  const lowTone = audioContext.createOscillator();
  lowTone.type = "sine";
  lowTone.frequency.setValueAtTime(784, now);
  lowTone.frequency.exponentialRampToValueAtTime(1046, now + 0.18);
  lowTone.connect(masterGain);

  const highTone = audioContext.createOscillator();
  highTone.type = "triangle";
  highTone.frequency.setValueAtTime(1174, now + 0.03);
  highTone.frequency.exponentialRampToValueAtTime(1318, now + 0.2);
  highTone.connect(masterGain);

  lowTone.start(now);
  lowTone.stop(now + 0.26);
  highTone.start(now + 0.028);
  highTone.stop(now + 0.22);
}

function getConversationEcho(
  toolCall: TavusToolCallMessage,
  text: string,
): TavusConversationEchoMessage {
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: toolCall.conversation_id,
    properties: {
      inference_id: toolCall.inference_id,
      modality: "text",
      text,
      done: true,
    },
  };
}

function getToolCallKey(toolCall: TavusToolCallMessage) {
  return JSON.stringify({
    conversationId: toolCall.conversation_id,
    inferenceId: toolCall.inference_id ?? "",
    name: toolCall.properties.name,
    arguments: toolCall.properties.arguments,
  });
}

function getUtteranceKey(utterance: TavusConversationUtteranceMessage) {
  return JSON.stringify({
    conversationId: utterance.conversation_id ?? "",
    inferenceId: utterance.inference_id ?? "",
    role: utterance.properties.role,
    speech: utterance.properties.speech,
  });
}

function getProcessedMessageStore(storeName: "__tavusProcessedToolCalls__" | "__tavusProcessedUtterances__") {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const globalWindow = window as Window & {
    __tavusProcessedToolCalls__?: Set<string>;
    __tavusProcessedUtterances__?: Set<string>;
  };

  if (!globalWindow[storeName]) {
    globalWindow[storeName] = new Set<string>();
  }

  return globalWindow[storeName];
}

/** Race a promise against an AbortSignal so that hung Daily methods can be escaped. */
function raceAbortSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new Error("The connection timed out."));
  }

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new Error("The connection timed out.")),
        { once: true },
      );
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isTavusMessage(payload: unknown): payload is TavusAppMessage {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "event_type" in payload &&
    "message_type" in payload
  );
}

function isToolCallMessage(payload: TavusAppMessage): payload is TavusToolCallMessage {
  return payload.event_type === "conversation.tool_call";
}

function isUtteranceMessage(payload: TavusAppMessage): payload is TavusConversationUtteranceMessage {
  return payload.event_type === "conversation.utterance";
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type DemoState = {
  status: DemoStatus;
  errorMessage: string | null;
  callObject: DailyCall | null;
  conversationId: string | null;
  isMicMuted: boolean;
  overlayState: OverlayState | null;
  replicaReady: boolean;
  audioBlocked: boolean;
  latestUserTranscript: TranscriptEntry | null;
  latestReplicaTranscript: TranscriptEntry | null;
  userSpeaking: boolean;
  replicaSpeaking: boolean;
};

const INITIAL_DEMO_STATE: DemoState = {
  status: "idle",
  errorMessage: null,
  callObject: null,
  conversationId: null,
  isMicMuted: false,
  overlayState: null,
  replicaReady: false,
  audioBlocked: false,
  latestUserTranscript: null,
  latestReplicaTranscript: null,
  userSpeaking: false,
  replicaSpeaking: false,
};

type DemoAction =
  | { type: "RESET" }
  | { type: "PREPARE_START" }
  | { type: "CLEAR_SESSION" }
  | { type: "SET_STATUS"; status: DemoStatus }
  | { type: "CONNECTED" }
  | { type: "ERROR"; message: string }
  | { type: "SET_CALL_OBJECT"; callObject: DailyCall | null }
  | { type: "SET_CONVERSATION_ID"; id: string | null }
  | { type: "SET_MIC_MUTED"; muted: boolean }
  | { type: "SET_OVERLAY"; overlay: OverlayState | null }
  | { type: "SET_REPLICA_READY" }
  | { type: "SET_AUDIO_BLOCKED"; blocked: boolean }
  | { type: "SET_USER_TRANSCRIPT"; transcript: TranscriptEntry }
  | { type: "SET_REPLICA_TRANSCRIPT"; transcript: TranscriptEntry }
  | { type: "USER_STARTED_SPEAKING" }
  | { type: "USER_STOPPED_SPEAKING" }
  | { type: "REPLICA_STARTED_SPEAKING" }
  | { type: "REPLICA_STOPPED_SPEAKING" };

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "RESET":
      return { ...INITIAL_DEMO_STATE, isMicMuted: state.isMicMuted };
    case "PREPARE_START":
      return {
        ...state,
        errorMessage: null,
        audioBlocked: false,
        overlayState: null,
        replicaReady: false,
        latestUserTranscript: null,
        latestReplicaTranscript: null,
        userSpeaking: false,
        replicaSpeaking: false,
      };
    case "CLEAR_SESSION":
      return {
        ...state,
        conversationId: null,
        overlayState: null,
        replicaReady: false,
        audioBlocked: false,
        latestUserTranscript: null,
        latestReplicaTranscript: null,
        userSpeaking: false,
        replicaSpeaking: false,
      };
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "CONNECTED":
      return { ...state, status: "connected", errorMessage: null };
    case "ERROR":
      return { ...state, status: "error", errorMessage: action.message };
    case "SET_CALL_OBJECT":
      return { ...state, callObject: action.callObject };
    case "SET_CONVERSATION_ID":
      return { ...state, conversationId: action.id };
    case "SET_MIC_MUTED":
      return { ...state, isMicMuted: action.muted };
    case "SET_OVERLAY":
      return { ...state, overlayState: action.overlay };
    case "SET_REPLICA_READY":
      return { ...state, replicaReady: true };
    case "SET_AUDIO_BLOCKED":
      return { ...state, audioBlocked: action.blocked };
    case "SET_USER_TRANSCRIPT":
      return { ...state, latestUserTranscript: action.transcript, userSpeaking: false };
    case "SET_REPLICA_TRANSCRIPT":
      return { ...state, latestReplicaTranscript: action.transcript };
    case "USER_STARTED_SPEAKING":
      return { ...state, userSpeaking: true, replicaSpeaking: false };
    case "USER_STOPPED_SPEAKING":
      return { ...state, userSpeaking: false };
    case "REPLICA_STARTED_SPEAKING":
      return { ...state, replicaSpeaking: true, userSpeaking: false };
    case "REPLICA_STOPPED_SPEAKING":
      return { ...state, replicaSpeaking: false };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TranscriptPanelProps = {
  latestReplicaTranscript: TranscriptEntry | null;
  latestUserTranscript: TranscriptEntry | null;
  replicaSpeaking: boolean;
  userSpeaking: boolean;
};

function TranscriptPanel({
  latestReplicaTranscript,
  latestUserTranscript,
  replicaSpeaking,
  userSpeaking,
}: TranscriptPanelProps) {
  const showPanel =
    userSpeaking || replicaSpeaking || Boolean(latestUserTranscript?.text || latestReplicaTranscript?.text);

  if (!showPanel) {
    return null;
  }

  const userText = userSpeaking && !latestUserTranscript?.text
    ? "Listening..."
    : latestUserTranscript?.text ?? "Waiting for your first question.";
  const replicaText = replicaSpeaking && !latestReplicaTranscript?.text
    ? "Speaking..."
    : latestReplicaTranscript?.text ?? "Agent responses appear here.";

  return (
    <div className="absolute bottom-6 left-6 z-20 w-[min(34rem,calc(100vw-3rem))] rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="space-y-3">
        <TranscriptPanelRow active={userSpeaking} label="You" text={userText} />
        <TranscriptPanelRow active={replicaSpeaking} label="Agent" text={replicaText} />
      </div>
    </div>
  );
}

type TranscriptPanelRowProps = {
  active: boolean;
  label: string;
  text: string;
};

function TranscriptPanelRow({ active, label, text }: TranscriptPanelRowProps) {
  return (
    <div
      className={
        active
          ? "rounded-[1.25rem] border border-sky-300/20 bg-sky-400/10 px-4 py-3"
          : "rounded-[1.25rem] border border-white/8 bg-white/5 px-4 py-3"
      }
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-400">
        <span className={active ? "size-2 rounded-full bg-sky-300" : "size-2 rounded-full bg-slate-500"} />
        {label}
      </div>
      <p className={active ? "mt-2 text-sm leading-6 text-slate-50" : "mt-2 text-sm leading-6 text-slate-200/90"}>
        {text}
      </p>
    </div>
  );
}

type FloatingMicControlProps = {
  isMuted: boolean;
  isOverlayActive?: boolean;
  micName?: string | null;
  onToggle(): void;
  onCycleMic?(): void;
  onCycleSpeaker?(): void;
  speakerName?: string | null;
};

function FloatingMicControl({
  isMuted,
  isOverlayActive,
  micName,
  onToggle,
  onCycleMic,
  onCycleSpeaker,
  speakerName,
}: FloatingMicControlProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isCollapsed = isOverlayActive && !isHovered;

  return (
    <div
      className="absolute left-4 top-4 z-40 overflow-hidden rounded-[1rem] border border-white/10 bg-slate-950/78 px-2.5 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: isCollapsed ? "4.5rem" : "11.5rem" }}
    >
      <div className="flex items-center gap-2">
        <span
          className={isMuted ? "size-1.5 shrink-0 rounded-full bg-rose-400" : "size-1.5 shrink-0 rounded-full bg-emerald-300"}
        />
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[0.45rem] uppercase tracking-[0.32em] text-slate-500">Mic</p>
            <p className="text-[0.6rem] font-medium uppercase tracking-[0.16em] text-white">
              {isMuted ? "Muted" : "Live"}
            </p>
          </div>
        )}
        <button
          className={
            isMuted
              ? "shrink-0 rounded-full border border-emerald-300/30 bg-emerald-400/12 px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400/18"
              : "shrink-0 rounded-full border border-rose-300/30 bg-rose-400/12 px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/18"
          }
          onClick={onToggle}
          type="button"
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      {!isCollapsed && (
        <div className="mt-1.5 space-y-1 border-t border-white/8 pt-1.5">
          <button
            className="flex w-full items-center gap-2 rounded-[0.75rem] bg-white/5 px-2 py-1 text-left transition hover:bg-white/8 disabled:cursor-default disabled:hover:bg-white/5"
            disabled={!onCycleMic}
            onClick={onCycleMic}
            type="button"
          >
            <span className="shrink-0 text-[0.42rem] uppercase tracking-[0.26em] text-slate-500">Mic</span>
            <span className="min-w-0 flex-1 truncate text-[0.54rem] text-slate-200">
              {getDeviceDisplayName(micName, "Waiting")}
            </span>
            <span className="shrink-0 text-[0.42rem] uppercase tracking-[0.16em] text-slate-500">^F</span>
          </button>

          <button
            className="flex w-full items-center gap-2 rounded-[0.75rem] bg-white/5 px-2 py-1 text-left transition hover:bg-white/8 disabled:cursor-default disabled:hover:bg-white/5"
            disabled={!onCycleSpeaker}
            onClick={onCycleSpeaker}
            type="button"
          >
            <span className="shrink-0 text-[0.42rem] uppercase tracking-[0.22em] text-slate-500">Out</span>
            <span className="min-w-0 flex-1 truncate text-[0.54rem] text-slate-200">
              {getDeviceDisplayName(speakerName, "Waiting")}
            </span>
            <span className="shrink-0 text-[0.42rem] uppercase tracking-[0.16em] text-slate-500">^G</span>
          </button>

          <p className="px-1 text-[0.42rem] uppercase tracking-[0.16em] text-slate-500">
            Ctrl+D mute
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TavusSession – renders the active call with video, overlays, and audio
// ---------------------------------------------------------------------------

type TavusSessionProps = {
  audioBlocked: boolean;
  callObject: DailyCall;
  isMicMuted: boolean;
  latestReplicaTranscript: TranscriptEntry | null;
  latestUserTranscript: TranscriptEntry | null;
  onToggleMicMute(): void;
  overlayState: OverlayState | null;
  replicaReady: boolean;
  replicaSpeaking: boolean;
  onAudioBlockedChange(nextValue: boolean): void;
  userSpeaking: boolean;
};

function TavusSession({
  audioBlocked,
  callObject,
  isMicMuted,
  latestReplicaTranscript,
  latestUserTranscript,
  onToggleMicMute,
  overlayState,
  replicaReady,
  replicaSpeaking,
  onAudioBlockedChange,
  userSpeaking,
}: TavusSessionProps) {
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const { currentMic, currentSpeaker, refreshDevices, setSpeaker, speakers } = useDevices();
  const audioHandleRef = useRef<DailyAudioHandle | null>(null);

  const activeContent = useMemo(() => {
    if (!overlayState || overlayState.kind !== "content") {
      return null;
    }

    return CONTENT_ITEMS[overlayState.contentItemKey];
  }, [overlayState]);

  const activeSchedule = overlayState?.kind === "schedule" ? overlayState : null;

  const avatarSessionId = remoteParticipantIds[0] ?? null;
  const canRenderAvatar = replicaReady && Boolean(avatarSessionId);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  const handleCycleMic = useCallback(async () => {
    if (callObject.isDestroyed()) {
      return;
    }

    await callObject.cycleMic();
  }, [callObject]);

  const handleCycleSpeaker = useCallback(async () => {
    if (speakers.length === 0) {
      return;
    }

    const selectedSpeakerIndex = speakers.findIndex((speaker) => speaker.selected);
    const currentSpeakerIndex = selectedSpeakerIndex >= 0
      ? selectedSpeakerIndex
      : speakers.findIndex((speaker) => speaker.device.deviceId === currentSpeaker?.device.deviceId);
    const nextSpeaker = speakers[(currentSpeakerIndex + 1 + speakers.length) % speakers.length];

    if (!nextSpeaker?.device.deviceId) {
      return;
    }

    await setSpeaker(nextSpeaker.device.deviceId);
  }, [currentSpeaker?.device.deviceId, setSpeaker, speakers]);

  useEffect(() => {
    const handleDeviceHotkeys = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "f") {
        event.preventDefault();
        void handleCycleMic();
        return;
      }

      if (key === "g") {
        event.preventDefault();
        void handleCycleSpeaker();
      }
    };

    window.addEventListener("keydown", handleDeviceHotkeys);
    return () => {
      window.removeEventListener("keydown", handleDeviceHotkeys);
    };
  }, [handleCycleMic, handleCycleSpeaker]);

  const handleResumeAudio = useCallback(async () => {
    const audioElements = audioHandleRef.current?.getAllAudio() ?? [];

    if (audioElements.length === 0) {
      onAudioBlockedChange(false);
      return;
    }

    const playResults = await Promise.allSettled(
      audioElements.map((audioElement) => audioElement.play()),
    );

    onAudioBlockedChange(playResults.some((result) => result.status === "rejected"));
  }, [onAudioBlockedChange]);

  return (
    <>
      <div className={`relative h-screen w-screen overflow-hidden ${overlayState ? "bg-slate-950" : "bg-black"}`}>
        <FloatingMicControl
          isMuted={isMicMuted}
          isOverlayActive={Boolean(overlayState)}
          micName={currentMic?.device.label}
          onCycleMic={() => {
            void handleCycleMic();
          }}
          onCycleSpeaker={() => {
            void handleCycleSpeaker();
          }}
          onToggle={onToggleMicMute}
          speakerName={currentSpeaker?.device.label}
        />

        {overlayState ? (
          <>
            {activeContent ? (
              <iframe
                className="absolute inset-0 h-full w-full bg-white"
                src={activeContent.url}
                title={activeContent.label}
              />
            ) : activeSchedule ? (
              <ScheduleOverlay
                columns={activeSchedule.columns}
                title={activeSchedule.title}
              />
            ) : null}

            <div className="absolute right-4 top-4 z-20 h-[96px] w-[128px] overflow-hidden rounded-[1.1rem] border border-white/15 bg-slate-950/90 shadow-2xl backdrop-blur sm:h-[108px] sm:w-[144px] md:h-[120px] md:w-[160px]">
              {canRenderAvatar && avatarSessionId ? (
                <DailyVideo
                  className="h-full w-full bg-slate-950 object-cover"
                  fit="cover"
                  sessionId={avatarSessionId}
                  type="video"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.96)_0%,_rgba(2,6,23,1)_100%)] p-6 text-center text-sm text-slate-300">
                  {replicaReady ? "Waiting for video." : "Waiting for avatar."}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {canRenderAvatar && avatarSessionId ? (
              <DailyVideo
                className="h-full w-full bg-black object-cover"
                fit="cover"
                sessionId={avatarSessionId}
                type="video"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black text-sm uppercase tracking-[0.25em] text-slate-400">
                {replicaReady ? "Waiting for video track" : "Waiting for avatar"}
              </div>
            )}

            <TranscriptPanel
              latestReplicaTranscript={latestReplicaTranscript}
              latestUserTranscript={latestUserTranscript}
              replicaSpeaking={replicaSpeaking}
              userSpeaking={userSpeaking}
            />
          </>
        )}

        {audioBlocked ? (
          <div className="absolute inset-x-0 bottom-6 z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-amber-300/30 bg-amber-400/15 px-4 py-3 text-sm text-amber-50 backdrop-blur">
            <span>Browser blocked audio playback.</span>
            <button
              className="rounded-full bg-amber-300 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-amber-200"
              onClick={() => void handleResumeAudio()}
              type="button"
            >
              Enable audio
            </button>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
        <DailyAudio
          maxSpeakers={1}
          onPlayFailed={() => {
            onAudioBlockedChange(true);
          }}
          ref={audioHandleRef}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): HeadersInit {
  const token = process.env.NEXT_PUBLIC_DEMO_API_TOKEN;
  return token ? { "x-demo-token": token } : {};
}

// ---------------------------------------------------------------------------
// TavusDemo – top-level component managing the full session lifecycle
// ---------------------------------------------------------------------------

export function TavusDemo() {
  const [state, dispatch] = useReducer(demoReducer, INITIAL_DEMO_STATE);
  const {
    status,
    errorMessage,
    callObject,
    conversationId,
    isMicMuted,
    overlayState,
    replicaReady,
    audioBlocked,
    latestUserTranscript,
    latestReplicaTranscript,
    userSpeaking,
    replicaSpeaking,
  } = state;
  const [personas, setPersonas] = useState<{ persona_id: string; persona_name: string }[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  // Refs that mirror state for use inside async callbacks where reading state
  // directly would capture a stale closure.
  const callObjectRef = useRef<DailyCall | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const statusRef = useRef<DemoStatus>("idle");
  const isMicMutedRef = useRef(false);

  const toolCallAudioContextRef = useRef<AudioContext | null>(null);
  const processedToolCallsRef = useRef<Set<string> | null>(null);
  const processedUtterancesRef = useRef<Set<string> | null>(null);
  const startInFlightRef = useRef(false);
  const isManualTeardownRef = useRef(false);
  const autoStartAttemptedRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { callObjectRef.current = callObject; }, [callObject]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);

  // Initialize global deduplication stores
  if (processedToolCallsRef.current == null) {
    processedToolCallsRef.current = getProcessedMessageStore("__tavusProcessedToolCalls__");
  }

  if (processedUtterancesRef.current == null) {
    processedUtterancesRef.current = getProcessedMessageStore("__tavusProcessedUtterances__");
  }

  const showPersonaSelector = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("personas");

  useEffect(() => {
    if (!showPersonaSelector) return;

    let cancelled = false;
    fetch("/api/personas", { cache: "no-store", headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: { personas?: { persona_id: string; persona_name: string }[]; default_persona_id?: string }) => {
        if (cancelled) return;
        if (data.personas) {
          setPersonas(data.personas);
        }
        if (data.default_persona_id) {
          setSelectedPersonaId(data.default_persona_id);
        }
      })
      .catch(() => {
        // Persona list is best-effort; the default env var persona will still be used.
      });
    return () => { cancelled = true; };
  }, [showPersonaSelector]);

  // -------------------------------------------------------------------------
  // Mic control
  // -------------------------------------------------------------------------

  const syncMicMutedState = useCallback((currentCallObject: DailyCall | null) => {
    if (!currentCallObject || currentCallObject.isDestroyed()) {
      return;
    }

    dispatch({ type: "SET_MIC_MUTED", muted: !currentCallObject.localAudio() });
  }, []);

  const handleToggleMicMute = useCallback(() => {
    const nextMuted = !isMicMutedRef.current;
    dispatch({ type: "SET_MIC_MUTED", muted: nextMuted });

    const currentCallObject = callObjectRef.current;
    if (currentCallObject && !currentCallObject.isDestroyed()) {
      currentCallObject.setLocalAudio(!nextMuted);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Tavus app-message handler
  // -------------------------------------------------------------------------

  // All values accessed are either stable (dispatch) or refs, so deps are empty.
  const handleAppMessage = useCallback((event: DailyEventObjectAppMessage<TavusAppMessage>) => {
    const payload = event.data;

    if (!isTavusMessage(payload)) {
      return;
    }

    console.log("[Tavus event]", {
      fromId: event.fromId,
      payload,
    });

    if (REPLICA_READY_EVENT_TYPES.has(payload.event_type)) {
      dispatch({ type: "SET_REPLICA_READY" });
    }

    switch (payload.event_type) {
      case "conversation.user.started_speaking":
        dispatch({ type: "USER_STARTED_SPEAKING" });
        break;
      case "conversation.user.stopped_speaking":
        dispatch({ type: "USER_STOPPED_SPEAKING" });
        break;
      case "conversation.replica.started_speaking":
        dispatch({ type: "REPLICA_STARTED_SPEAKING" });
        break;
      case "conversation.replica.stopped_speaking":
      case "conversation.replica_interrupted":
        dispatch({ type: "REPLICA_STOPPED_SPEAKING" });
        break;
      default:
        break;
    }

    if (isUtteranceMessage(payload)) {
      const speech = payload.properties.speech.trim();

      if (!speech) {
        return;
      }

      const utteranceKey = getUtteranceKey(payload);

      if (processedUtterancesRef.current?.has(utteranceKey)) {
        return;
      }

      if (processedUtterancesRef.current && processedUtterancesRef.current.size >= 100) {
        processedUtterancesRef.current.clear();
      }

      processedUtterancesRef.current?.add(utteranceKey);

      const transcriptEntry = {
        inferenceId: payload.inference_id,
        text: speech,
      };

      if (payload.properties.role === "user") {
        dispatch({ type: "SET_USER_TRANSCRIPT", transcript: transcriptEntry });
      } else if (payload.properties.role === "replica") {
        dispatch({ type: "SET_REPLICA_TRANSCRIPT", transcript: transcriptEntry });
      }

      return;
    }

    if (!isToolCallMessage(payload)) {
      return;
    }

    const toolCallKey = getToolCallKey(payload);

    if (processedToolCallsRef.current?.has(toolCallKey)) {
      console.debug("[Tavus tool call duplicate ignored]", {
        fromId: event.fromId,
        inferenceId: payload.inference_id,
        name: payload.properties.name,
      });
      return;
    }

    if (processedToolCallsRef.current && processedToolCallsRef.current.size >= 100) {
      processedToolCallsRef.current.clear();
    }

    processedToolCallsRef.current?.add(toolCallKey);
    void playToolCallChime(toolCallAudioContextRef);

    console.log("[Tavus tool call]", {
      fromId: event.fromId,
      payload,
    });

    let responseText = "I updated the screen.";

    try {
      const rawArguments = payload.properties.arguments;
      const parsedArguments =
        typeof rawArguments === "string" && rawArguments.length > 0
          ? (JSON.parse(rawArguments) as {
              item?: string;
              columns?: Array<{
                markdown?: string;
                markdown_table?: string;
                table?: string;
                title?: string;
              }>;
              markdown?: string;
              markdown_table?: string;
              table?: string;
              title?: string;
            })
          : typeof rawArguments === "object" && rawArguments !== null
            ? (rawArguments as {
                item?: string;
                columns?: Array<{
                  markdown?: string;
                  markdown_table?: string;
                  table?: string;
                  title?: string;
                }>;
                markdown?: string;
                markdown_table?: string;
                table?: string;
                title?: string;
              })
            : {};

      switch (payload.properties.name) {
        case "show_content": {
          const nextContentItemKey = resolveContentItemKey(parsedArguments.item);
          if (!nextContentItemKey) {
            responseText = "I could not find that screen to show.";
            break;
          }

          dispatch({
            type: "SET_OVERLAY",
            overlay: { kind: "content", contentItemKey: nextContentItemKey },
          });
          responseText = `Showing ${CONTENT_ITEMS[nextContentItemKey].label}.`;
          break;
        }
        case "show_schedule": {
          const columns = Array.isArray(parsedArguments.columns)
            ? parsedArguments.columns
              .map((column): ScheduleOverlayColumn | null => {
                const markdownTable = column.markdown_table ?? column.markdown ?? column.table;

                if (typeof markdownTable !== "string" || markdownTable.trim().length === 0) {
                  return null;
                }

                return {
                  markdownTable: markdownTable.trim(),
                  title: column.title?.trim() || undefined,
                };
              })
              .filter((column): column is ScheduleOverlayColumn => column !== null)
              .slice(0, 3)
            : [];

          if (columns.length === 0) {
            const markdownTable = parsedArguments.markdown_table ?? parsedArguments.markdown ?? parsedArguments.table;

            if (typeof markdownTable !== "string" || markdownTable.trim().length === 0) {
              responseText = "I could not generate the schedule table for the screen.";
              break;
            }

            columns.push({
              markdownTable: markdownTable.trim(),
              title: parsedArguments.title?.trim() || undefined,
            });
          }

          dispatch({
            type: "SET_OVERLAY",
            overlay: {
              kind: "schedule",
              columns,
              title: parsedArguments.title?.trim() || "Schedule Snapshot",
            },
          });
          responseText = "Showing the schedule on screen.";
          break;
        }
        case "dismiss_content": {
          dispatch({ type: "SET_OVERLAY", overlay: null });
          responseText = "Returning to the full conversation view.";
          break;
        }
        default: {
          responseText = `I do not recognize the tool ${payload.properties.name}.`;
        }
      }
    } catch (error) {
      responseText = `I hit an error while handling that screen request: ${getErrorMessage(error)}`;
    }

    callObjectRef.current?.sendAppMessage(getConversationEcho(payload, responseText), event.fromId);
  }, []);

  // -------------------------------------------------------------------------
  // Register app-message handler on callObject
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!callObject) {
      return;
    }

    callObject.off("app-message", handleAppMessage);
    callObject.on("app-message", handleAppMessage);

    return () => {
      callObject.off("app-message", handleAppMessage);
    };
  }, [callObject, handleAppMessage]);

  // -------------------------------------------------------------------------
  // Sync mic muted state from Daily events
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!callObject) {
      return;
    }

    const syncFromCallObject = () => {
      syncMicMutedState(callObject);
    };

    callObject.on("started-camera", syncFromCallObject);
    callObject.on("joined-meeting", syncFromCallObject);
    callObject.on("participant-updated", syncFromCallObject);

    return () => {
      callObject.off("started-camera", syncFromCallObject);
      callObject.off("joined-meeting", syncFromCallObject);
      callObject.off("participant-updated", syncFromCallObject);
    };
  }, [callObject, syncMicMutedState]);

  // -------------------------------------------------------------------------
  // API helpers
  // -------------------------------------------------------------------------

  const createConversation = useCallback(async (signal?: AbortSignal) => {
    const llmName = getRequestedLlmName();
    const params = new URLSearchParams();
    if (llmName) params.set("llm", llmName);
    if (selectedPersonaId) params.set("persona", selectedPersonaId);
    const qs = params.toString();
    const conversationUrl = qs ? `/api/conversation?${qs}` : "/api/conversation";

    const response = await fetch(conversationUrl, {
      method: "POST",
      cache: "no-store",
      headers: getAuthHeaders(),
      signal,
    });

    const responseText = await response.text();
    const responseJson = responseText
      ? (JSON.parse(responseText) as TavusConversationCreateResponse | { error?: string })
      : null;

    if (!response.ok || !responseJson || !("conversation_id" in responseJson)) {
      const message =
        responseJson && "error" in responseJson && responseJson.error
          ? responseJson.error
          : "Could not start a valid conversation.";
      throw new Error(message);
    }

    return responseJson;
  }, [selectedPersonaId]);

  const endConversation = useCallback(async (id: string, keepalive = false) => {
    try {
      await fetch(`/api/conversation/${id}`, {
        method: "DELETE",
        keepalive,
        cache: "no-store",
        headers: getAuthHeaders(),
      });
    } catch {
      // Best effort cleanup only.
    }
  }, []);

  const destroyCallObject = useCallback(async (currentCallObject: DailyCall | null) => {
    if (!currentCallObject || currentCallObject.isDestroyed()) {
      return;
    }

    try {
      await currentCallObject.destroy();
    } catch {
      // Best effort cleanup only.
    }
  }, []);

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  const cleanupAfterLeave = useCallback(
    async (currentCallObject: DailyCall | null) => {
      await destroyCallObject(currentCallObject);

      if (callObjectRef.current === currentCallObject) {
        callObjectRef.current = null;
      }

      conversationIdRef.current = null;
      dispatch({ type: "RESET" });
    },
    [destroyCallObject],
  );

  const teardownDemo = useCallback(
    async (options?: { keepalive?: boolean }) => {
      const keepalive = options?.keepalive ?? false;
      const activeConversationId = conversationIdRef.current;
      const currentCallObject = callObjectRef.current;

      conversationIdRef.current = null;
      dispatch({ type: "CLEAR_SESSION" });

      if (!currentCallObject) {
        if (activeConversationId) {
          await endConversation(activeConversationId, keepalive);
        }

        if (!keepalive) {
          dispatch({ type: "SET_STATUS", status: "idle" });
        }
        return;
      }

      if (keepalive) {
        await destroyCallObject(currentCallObject);
        callObjectRef.current = null;
        dispatch({ type: "SET_CALL_OBJECT", callObject: null });
        return;
      }

      dispatch({ type: "SET_STATUS", status: "leaving" });
      isManualTeardownRef.current = true;

      try {
        const meetingState = currentCallObject.meetingState();
        if (meetingState !== "new" && meetingState !== "left-meeting") {
          await currentCallObject.leave();
        }
      } catch {
        // Fall through to hard cleanup.
      }

      await cleanupAfterLeave(currentCallObject);

      if (activeConversationId) {
        await endConversation(activeConversationId, keepalive);
      }

      isManualTeardownRef.current = false;
    },
    [cleanupAfterLeave, destroyCallObject, endConversation],
  );

  // -------------------------------------------------------------------------
  // Start / restart
  // -------------------------------------------------------------------------

  const handleStart = useCallback(async () => {
    if (startInFlightRef.current || statusRef.current === "leaving") {
      return;
    }

    startInFlightRef.current = true;
    isManualTeardownRef.current = false;
    dispatch({ type: "PREPARE_START" });

    // Clear deduplication stores for the new session so stale keys from a
    // previous session can never suppress a legitimate message in this one.
    processedToolCallsRef.current?.clear();
    processedUtterancesRef.current?.clear();

    let nextCallObject: DailyCall | null = null;
    let nextConversationId: string | null = null;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), START_TIMEOUT_MS);

    try {
      if (callObjectRef.current) {
        await teardownDemo();
      }

      nextCallObject = DailyIframe.createCallObject();
      callObjectRef.current = nextCallObject;
      dispatch({ type: "SET_CALL_OBJECT", callObject: nextCallObject });

      const requestedLlmName = getRequestedLlmName();
      const requestedLlmConfig = requestedLlmName ? getCustomTavusLlmConfig(requestedLlmName) : null;
      const shouldDisableVideo = requestedLlmConfig?.disableVideo === true;

      dispatch({ type: "SET_STATUS", status: "requesting-permissions" });
      await raceAbortSignal(
        nextCallObject.startCamera(
          shouldDisableVideo
            ? { audioSource: true, videoSource: false }
            : undefined,
        ),
        abortController.signal,
      );

      if (shouldDisableVideo) {
        nextCallObject.setLocalVideo(false);
      }

      nextCallObject.setLocalAudio(!isMicMutedRef.current);

      dispatch({ type: "SET_STATUS", status: "loading" });
      const conversation = await createConversation(abortController.signal);
      nextConversationId = conversation.conversation_id;
      conversationIdRef.current = conversation.conversation_id;
      dispatch({ type: "SET_CONVERSATION_ID", id: conversation.conversation_id });

      dispatch({ type: "SET_STATUS", status: "joining" });
      await raceAbortSignal(
        nextCallObject.join({ url: conversation.conversation_url }),
        abortController.signal,
      );

    } catch (error) {
      if (nextConversationId) {
        await endConversation(nextConversationId);
      }

      conversationIdRef.current = null;

      const message = abortController.signal.aborted
        ? "The connection timed out."
        : getErrorMessage(error);
      dispatch({ type: "ERROR", message });
      dispatch({ type: "SET_CALL_OBJECT", callObject: null });
      dispatch({ type: "SET_CONVERSATION_ID", id: null });

      if (nextCallObject) {
        await destroyCallObject(nextCallObject);
      }

      if (callObjectRef.current === nextCallObject) {
        callObjectRef.current = null;
      }

    } finally {
      clearTimeout(timeoutId);
      startInFlightRef.current = false;
      isManualTeardownRef.current = false;
    }
  }, [createConversation, destroyCallObject, endConversation, teardownDemo]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      isManualTeardownRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !callObjectRef.current || statusRef.current !== "connected") {
        return;
      }

      void teardownDemo();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [teardownDemo]);

  useEffect(() => {
    const handleMicHotkey = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "d"
      ) {
        return;
      }

      event.preventDefault();
      handleToggleMicMute();
    };

    window.addEventListener("keydown", handleMicHotkey);
    return () => {
      window.removeEventListener("keydown", handleMicHotkey);
    };
  }, [handleToggleMicMute]);

  // -------------------------------------------------------------------------
  // Meeting state change & camera-error handlers
  // -------------------------------------------------------------------------

  useEffect(() => {
    const currentCallObject = callObject;

    if (!currentCallObject) {
      return;
    }

    const handleMeetingStateChange = () => {
      const meetingState = currentCallObject.meetingState();

      switch (meetingState) {
        case "joined-meeting":
          dispatch({ type: "CONNECTED" });
          break;
        case "left-meeting":
          if (isManualTeardownRef.current) {
            return;
          }

          void cleanupAfterLeave(currentCallObject);
          break;
        case "error":
          dispatch({ type: "ERROR", message: "The Daily call encountered an error." });
          break;
        default:
          break;
      }
    };

    const handleCameraError = (event: DailyEventObjectCameraError) => {
      dispatch({
        type: "ERROR",
        message: event.error?.msg ?? event.errorMsg?.errorMsg ?? "Daily could not access the selected camera or microphone.",
      });
    };

    currentCallObject.on("joined-meeting", handleMeetingStateChange);
    currentCallObject.on("left-meeting", handleMeetingStateChange);
    currentCallObject.on("error", handleMeetingStateChange);
    currentCallObject.on("camera-error", handleCameraError);
    handleMeetingStateChange();

    return () => {
      currentCallObject.off("joined-meeting", handleMeetingStateChange);
      currentCallObject.off("left-meeting", handleMeetingStateChange);
      currentCallObject.off("error", handleMeetingStateChange);
      currentCallObject.off("camera-error", handleCameraError);
    };
  }, [callObject, cleanupAfterLeave]);

  // -------------------------------------------------------------------------
  // Page-hide & unmount cleanup
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handlePageHide = () => {
      const activeConversationId = conversationIdRef.current;
      const currentCallObject = callObjectRef.current;

      conversationIdRef.current = null;

      if (activeConversationId) {
        void endConversation(activeConversationId, true);
      }

      if (currentCallObject && !currentCallObject.isDestroyed()) {
        void currentCallObject.destroy();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [endConversation]);

  useEffect(() => {
    return () => {
      const currentCallObject = callObjectRef.current;
      const activeConversationId = conversationIdRef.current;

      if (activeConversationId) {
        conversationIdRef.current = null;
        void endConversation(activeConversationId);
      }

      if (currentCallObject && !currentCallObject.isDestroyed()) {
        void currentCallObject.destroy();
      }
    };
  }, [endConversation]);

  useEffect(() => {
    if (
      !hasEnabledQueryFlag("autostart") ||
      autoStartAttemptedRef.current ||
      hasAutoStartAlreadyBeenClaimed()
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void handleStart();
  }, [handleStart]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const showStartScreen = !callObject || status === "idle" || status === "error";
  const showSession = Boolean(callObject) && !showStartScreen;

  const handleManualStart = useCallback(() => {
    void handleStart();
  }, [handleStart]);

  const handleAudioBlockedChange = useCallback(
    (blocked: boolean) => dispatch({ type: "SET_AUDIO_BLOCKED", blocked }),
    [],
  );

  if (showSession && callObject) {
    return (
      <DailyProvider callObject={callObject}>
        <TavusSession
          audioBlocked={audioBlocked}
          callObject={callObject}
          isMicMuted={isMicMuted}
          latestReplicaTranscript={latestReplicaTranscript}
          latestUserTranscript={latestUserTranscript}
          onToggleMicMute={handleToggleMicMute}
          overlayState={overlayState}
          replicaReady={replicaReady}
          replicaSpeaking={replicaSpeaking}
          onAudioBlockedChange={handleAudioBlockedChange}
          userSpeaking={userSpeaking}
        />
      </DailyProvider>
    );
  }

  return (
    <div className="relative h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(41,80,200,0.35),_transparent_38%),linear-gradient(180deg,_#09101d_0%,_#060912_100%)] text-white">
      <FloatingMicControl
        isMuted={isMicMuted}
        micName="Join to detect"
        onToggle={handleToggleMicMute}
        speakerName="Join to detect"
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_bottom,_rgba(123,204,163,0.2),_transparent_35%)]" />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-6 py-8 md:px-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-sky-200/80">AWS Summit Sydney 2026</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-4xl">
              Conversational Voice AI
            </h1>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            {showPersonaSelector && personas.length > 0 ? (
              <select
                className="min-h-10 rounded-full border border-white/15 bg-slate-800/80 px-4 py-2 text-sm text-white backdrop-blur transition hover:border-white/25 focus:border-sky-400/60 focus:outline-none"
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
              >
                {personas.map((p) => (
                  <option key={p.persona_id} value={p.persona_id}>
                    {p.persona_name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              disabled={status !== "idle" && status !== "error"}
              onClick={handleManualStart}
              type="button"
            >
              {START_BUTTON_LABELS[status as keyof typeof START_BUTTON_LABELS] ?? "Start demo"}
            </button>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full max-w-5xl gap-6 rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur md:grid-cols-[1.25fr_0.95fr] md:p-10">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-emerald-200">
                  Camera-aware voice AI demo
                </span>
                <div className="space-y-4">
                  <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl">
                    Start the voice AI booth experience with a single click.
                  </h2>
                  <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                    The demo requests camera and microphone access, creates an AI conversation,
                    joins the session room, and listens for tool calls that can change the on-screen
                    content while the avatar keeps speaking.
                  </p>
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
                  <p>{errorMessage}</p>
                  <div className="mt-3">
                    <button
                      className="rounded-full border border-rose-300/30 bg-rose-400/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:bg-rose-400/30"
                      onClick={handleManualStart}
                      type="button"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 text-sm text-slate-200">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-sky-200/70">Join Flow</p>
                <ol className="mt-4 space-y-3 text-slate-200">
                  <li>1. Request camera and microphone permissions.</li>
                  <li>2. Create an AI conversation via the API.</li>
                  <li>3. Join the session room.</li>
                  <li>4. Render avatar video and audio.</li>
                </ol>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Tool Use Demo</p>
                <p className="mt-4 leading-7 text-slate-300">
                  Ask the agent to show content on screen. Try{" "}
                  <em>&ldquo;Show the voice agent guidance&rdquo;</em> or{" "}
                  <em>&ldquo;Show me the schedule&rdquo;</em>.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-violet-200/70">Visual Reasoning Check</p>
                <p className="mt-4 leading-7 text-slate-300">
                  After the call connects, ask what the agent can see. The avatar should be able to answer
                  questions about your camera feed.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-center gap-8 pb-4">
          <svg className="h-10 w-auto opacity-40" viewBox="0 0 304 182" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AWS"><path d="M86.4 66.4c0 3.7.4 6.7 1.1 8.9.8 2.2 1.8 4.6 3.2 7.1.5.8.7 1.6.7 2.3 0 1-.6 2-1.9 3l-6.3 4.2c-.9.6-1.8.9-2.6.9-1 0-2-.5-3-1.4-1.4-1.5-2.6-3.1-3.6-4.7-1-1.7-2-3.6-3.1-5.9-7.8 9.2-17.6 13.8-29.4 13.8-8.4 0-15.1-2.4-20-7.2-4.9-4.8-7.4-11.2-7.4-19.2 0-8.5 3-15.4 9.1-20.6 6.1-5.2 14.2-7.8 24.5-7.8 3.4 0 6.9.3 10.6.8 3.7.5 7.5 1.3 11.5 2.2v-7.3c0-7.6-1.6-12.9-4.7-16-3.2-3.1-8.6-4.6-16.3-4.6-3.5 0-7.1.4-10.8 1.3-3.7.9-7.3 2-10.8 3.4-1.6.7-2.8 1.1-3.5 1.3-.7.2-1.2.3-1.6.3-1.4 0-2.1-1-2.1-3.1v-4.9c0-1.6.2-2.8.7-3.5.5-.7 1.4-1.4 2.8-2.1 3.5-1.8 7.7-3.3 12.6-4.5 4.9-1.3 10.1-1.9 15.6-1.9 11.9 0 20.6 2.7 26.2 8.1 5.5 5.4 8.3 13.6 8.3 24.6v32.4h.1zm-40.6 15.2c3.3 0 6.7-.6 10.3-1.8 3.6-1.2 6.8-3.4 9.5-6.4 1.6-1.9 2.8-4 3.4-6.4.6-2.4 1-5.3 1-8.7v-4.2c-2.8-.7-5.8-1.3-8.9-1.7-3.1-.4-6.1-.6-9.1-.6-6.7 0-11.6 1.3-14.9 4-3.3 2.7-4.9 6.5-4.9 11.5 0 4.7 1.2 8.2 3.7 10.6 2.4 2.5 5.9 3.7 9.9 3.7zm80.3 10.8c-1.8 0-3-.3-3.8-1-.8-.6-1.5-2-2.1-3.9L96.7 10.2c-.6-2-.9-3.3-.9-4 0-1.6.8-2.5 2.4-2.5h9.8c1.9 0 3.2.3 3.9 1 .8.6 1.4 2 2 3.9l16.8 66.2 15.6-66.2c.5-2 1.1-3.3 1.9-3.9.8-.6 2.2-1 4-1h8c1.9 0 3.2.3 4 1 .8.6 1.5 2 1.9 3.9l15.8 67 17.3-67c.6-2 1.3-3.3 2-3.9.8-.6 2.1-1 3.9-1h9.3c1.6 0 2.5.8 2.5 2.5 0 .5-.1 1-.2 1.6-.1.6-.3 1.4-.7 2.5l-24.1 77.3c-.6 2-1.3 3.3-2.1 3.9-.8.6-2.1 1-3.8 1h-8.6c-1.9 0-3.2-.3-4-1-.8-.7-1.5-2-1.9-4L156 23l-15.4 64.4c-.5 2-1.1 3.3-1.9 4-.8.7-2.2 1-4 1h-8.6zm128.5 2.7c-5.2 0-10.4-.6-15.4-1.8-5-1.2-8.9-2.5-11.5-4-1.6-.9-2.7-1.9-3.1-2.8-.4-.9-.6-1.9-.6-2.8v-5.1c0-2.1.8-3.1 2.3-3.1.6 0 1.2.1 1.8.3.6.2 1.5.6 2.5 1 3.4 1.5 7.1 2.7 11 3.5 4 .8 7.9 1.2 11.9 1.2 6.3 0 11.2-1.1 14.6-3.3 3.4-2.2 5.2-5.4 5.2-9.5 0-2.8-.9-5.1-2.7-7-1.8-1.9-5.2-3.6-10.1-5.2L246 52c-7.3-2.3-12.7-5.7-16-10.2-3.3-4.4-5-9.3-5-14.5 0-4.2.9-7.9 2.7-11.1 1.8-3.2 4.2-6 7.2-8.2 3-2.3 6.4-4 10.4-5.2 4-1.2 8.2-1.7 12.6-1.7 2.2 0 4.5.1 6.7.4 2.3.3 4.4.7 6.5 1.1 2 .5 3.9 1 5.7 1.6 1.8.6 3.2 1.2 4.2 1.8 1.4.8 2.4 1.6 3 2.5.6.8.9 1.8.9 3.3v4.7c0 2.1-.8 3.2-2.3 3.2-.8 0-2.1-.4-3.8-1.2-5.7-2.6-12.1-3.9-19.2-3.9-5.7 0-10.2.9-13.3 2.8-3.1 1.9-4.7 4.8-4.7 8.9 0 2.8 1 5.2 3 7.1 2 1.9 5.7 3.8 11 5.5l14.2 4.5c7.2 2.3 12.4 5.5 15.5 9.6 3.1 4.1 4.6 8.8 4.6 14 0 4.3-.9 8.2-2.6 11.6-1.8 3.4-4.2 6.4-7.3 8.8-3.1 2.5-6.8 4.3-11.1 5.6-4.5 1.4-9.2 2.1-14.3 2.1z" fill="white"/><path d="M273.5 143.7c-32.9 24.3-80.7 37.2-121.8 37.2-57.6 0-109.5-21.3-148.7-56.7-3.1-2.8-.3-6.6 3.4-4.4 42.4 24.6 94.7 39.5 148.8 39.5 36.5 0 76.6-7.6 113.5-23.2 5.6-2.3 10.2 3.7 4.8 7.6z" fill="white"/><path d="M287.2 128.1c-4.2-5.4-27.8-2.6-38.5-1.3-3.2.4-3.7-2.4-.8-4.5 18.8-13.2 49.7-9.4 53.3-5 3.6 4.5-1 35.4-18.6 50.2-2.7 2.3-5.3 1.1-4.1-1.9 4-9.9 12.9-32.2 8.7-37.5z" fill="white"/></svg>
          <img className="h-10 w-auto opacity-40 invert" src="/deepgram-logo.png" alt="Deepgram" />
          <img className="h-9 w-auto opacity-40 invert" src="/pipecat-logo.png" alt="Pipecat" />
        </footer>
      </div>
    </div>
  );
}
