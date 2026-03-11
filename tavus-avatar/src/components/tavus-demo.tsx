"use client";

import DailyIframe from "@daily-co/daily-js";
import type {
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectCameraError,
} from "@daily-co/daily-js";
import { DailyAudio, DailyProvider, DailyVideo, useParticipantIds } from "@daily-co/daily-react";
import type { DailyAudioHandle } from "@daily-co/daily-react/dist/components/DailyAudio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type DemoStatus =
  | "idle"
  | "requesting-permissions"
  | "loading"
  | "joining"
  | "connected"
  | "leaving"
  | "error";

const START_BUTTON_LABELS: Record<Exclude<DemoStatus, "connected" | "error">, string> = {
  idle: "Start demo",
  "requesting-permissions": "Approve camera and microphone",
  loading: "Creating AI conversation",
  joining: "Joining session",
  leaving: "Ending current session",
};

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

const REPLICA_READY_EVENT_TYPES = new Set([
  "system.replica_present",
  "system.replica_joined",
  "conversation.replica.started_speaking",
]);

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
  onToggle(): void;
};

function FloatingMicControl({ isMuted, onToggle }: FloatingMicControlProps) {
  return (
    <div className="absolute left-4 top-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/72 px-3 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <span
        className={isMuted ? "size-2 rounded-full bg-rose-400" : "size-2 rounded-full bg-emerald-300"}
      />
      <div className="min-w-0">
        <p className="text-[0.6rem] uppercase tracking-[0.26em] text-slate-400">Mic</p>
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-white">
          {isMuted ? "Muted" : "Live"}
        </p>
      </div>
      <button
        className={
          isMuted
            ? "rounded-full border border-emerald-300/30 bg-emerald-400/12 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400/18"
            : "rounded-full border border-rose-300/30 bg-rose-400/12 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/18"
        }
        onClick={onToggle}
        type="button"
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
      <span className="hidden text-[0.58rem] uppercase tracking-[0.18em] text-slate-500 sm:block">
        Ctrl+D
      </span>
    </div>
  );
}

type TavusSessionProps = {
  audioBlocked: boolean;
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

  if (!overlayState) {
    return (
      <>
        <div className="relative h-screen w-screen overflow-hidden bg-black">
          <FloatingMicControl isMuted={isMicMuted} onToggle={onToggleMicMute} />

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

          <TranscriptPanel
            latestReplicaTranscript={latestReplicaTranscript}
            latestUserTranscript={latestUserTranscript}
            replicaSpeaking={replicaSpeaking}
            userSpeaking={userSpeaking}
          />
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

  return (
    <>
      <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
        <FloatingMicControl isMuted={isMicMuted} onToggle={onToggleMicMute} />

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

export function TavusDemo() {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [overlayState, setOverlayState] = useState<OverlayState | null>(null);
  const [replicaReady, setReplicaReady] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [latestUserTranscript, setLatestUserTranscript] = useState<TranscriptEntry | null>(null);
  const [latestReplicaTranscript, setLatestReplicaTranscript] = useState<TranscriptEntry | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [replicaSpeaking, setReplicaSpeaking] = useState(false);
  const [personas, setPersonas] = useState<{ persona_id: string; persona_name: string }[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  const callObjectRef = useRef<DailyCall | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const toolCallAudioContextRef = useRef<AudioContext | null>(null);
  const processedToolCallsRef = useRef<Set<string> | null>(null);
  const processedUtterancesRef = useRef<Set<string> | null>(null);
  const startInFlightRef = useRef(false);
  const isManualTeardownRef = useRef(false);

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
    fetch("/api/personas", { cache: "no-store" })
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

  useEffect(() => {
    callObjectRef.current = callObject;
  }, [callObject]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const syncMicMutedState = useCallback((currentCallObject: DailyCall | null) => {
    if (!currentCallObject || currentCallObject.isDestroyed()) {
      return;
    }

    setIsMicMuted(!currentCallObject.localAudio());
  }, []);

  const handleToggleMicMute = useCallback(() => {
    setIsMicMuted((currentMuted) => {
      const nextMuted = !currentMuted;
      const currentCallObject = callObjectRef.current;

      if (currentCallObject && !currentCallObject.isDestroyed()) {
        currentCallObject.setLocalAudio(!nextMuted);
      }

      return nextMuted;
    });
  }, []);

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
      setReplicaReady(true);
    }

    switch (payload.event_type) {
      case "conversation.user.started_speaking":
        setUserSpeaking(true);
        setReplicaSpeaking(false);
        break;
      case "conversation.user.stopped_speaking":
        setUserSpeaking(false);
        break;
      case "conversation.replica.started_speaking":
        setReplicaSpeaking(true);
        setUserSpeaking(false);
        break;
      case "conversation.replica.stopped_speaking":
      case "conversation.replica_interrupted":
        setReplicaSpeaking(false);
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
        setLatestUserTranscript(transcriptEntry);
        setUserSpeaking(false);
      } else if (payload.properties.role === "replica") {
        setLatestReplicaTranscript(transcriptEntry);
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

          setOverlayState({
            kind: "content",
            contentItemKey: nextContentItemKey,
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

          setOverlayState({
            kind: "schedule",
            columns,
            title: parsedArguments.title?.trim() || "Schedule Snapshot",
          });
          responseText = "Showing the schedule on screen.";
          break;
        }
        case "dismiss_content": {
          setOverlayState(null);
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

  const createConversation = useCallback(async () => {
    const llmName = getRequestedLlmName();
    const params = new URLSearchParams();
    if (llmName) params.set("llm", llmName);
    if (selectedPersonaId) params.set("persona", selectedPersonaId);
    const qs = params.toString();
    const conversationUrl = qs ? `/api/conversation?${qs}` : "/api/conversation";

    const response = await fetch(conversationUrl, {
      method: "POST",
      cache: "no-store",
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

  const resetUiState = useCallback(() => {
    setCallObject(null);
    setConversationId(null);
    setOverlayState(null);
    setReplicaReady(false);
    setAudioBlocked(false);
    setLatestUserTranscript(null);
    setLatestReplicaTranscript(null);
    setUserSpeaking(false);
    setReplicaSpeaking(false);
    setErrorMessage(null);
    setStatus("idle");
  }, []);

  const cleanupAfterLeave = useCallback(
    async (currentCallObject: DailyCall | null) => {
      await destroyCallObject(currentCallObject);

      if (callObjectRef.current === currentCallObject) {
        callObjectRef.current = null;
      }

      conversationIdRef.current = null;
      resetUiState();
    },
    [destroyCallObject, resetUiState],
  );

  const teardownDemo = useCallback(
    async (options?: { keepalive?: boolean }) => {
      const keepalive = options?.keepalive ?? false;
      const activeConversationId = conversationIdRef.current;
      const currentCallObject = callObjectRef.current;

      conversationIdRef.current = null;
      setConversationId(null);
      setOverlayState(null);
      setReplicaReady(false);
      setAudioBlocked(false);
      setLatestUserTranscript(null);
      setLatestReplicaTranscript(null);
      setUserSpeaking(false);
      setReplicaSpeaking(false);

      if (!currentCallObject) {
        if (activeConversationId) {
          await endConversation(activeConversationId, keepalive);
        }

        if (!keepalive) {
          setStatus("idle");
        }
        return;
      }

      if (keepalive) {
        await destroyCallObject(currentCallObject);
        callObjectRef.current = null;
        setCallObject(null);
        return;
      }

      setStatus("leaving");
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
      return;
    },
    [cleanupAfterLeave, destroyCallObject, endConversation],
  );

  useEffect(() => {
    return () => {
      isManualTeardownRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !callObjectRef.current || status !== "connected") {
        return;
      }

      void teardownDemo();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [status, teardownDemo]);

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

  useEffect(() => {
    const currentCallObject = callObject;

    if (!currentCallObject) {
      return;
    }

    const handleMeetingStateChange = () => {
      const meetingState = currentCallObject.meetingState();

      switch (meetingState) {
        case "joined-meeting":
          setStatus("connected");
          setErrorMessage(null);
          break;
        case "left-meeting":
          if (isManualTeardownRef.current) {
            return;
          }

          void cleanupAfterLeave(currentCallObject);
          break;
        case "error":
          setStatus("error");
          break;
        default:
          break;
      }
    };

    const handleCameraError = (event: DailyEventObjectCameraError) => {
      setStatus("error");
      setErrorMessage(
        event.error?.msg ?? event.errorMsg?.errorMsg ?? "Daily could not access the selected camera or microphone.",
      );
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

  const handleStart = useCallback(async () => {
    if (startInFlightRef.current || status === "leaving") {
      return;
    }

    startInFlightRef.current = true;
    isManualTeardownRef.current = false;
    setErrorMessage(null);
    setAudioBlocked(false);
    setOverlayState(null);
    setReplicaReady(false);
    setLatestUserTranscript(null);
    setLatestReplicaTranscript(null);
    setUserSpeaking(false);
    setReplicaSpeaking(false);

    let nextCallObject: DailyCall | null = null;
    let nextConversationId: string | null = null;

    try {
      if (callObjectRef.current) {
        await teardownDemo();
      }

      nextCallObject = DailyIframe.createCallObject();
      callObjectRef.current = nextCallObject;
      setCallObject(nextCallObject);

      const requestedLlmName = getRequestedLlmName();
      const requestedLlmConfig = requestedLlmName ? getCustomTavusLlmConfig(requestedLlmName) : null;
      const shouldDisableVideo = requestedLlmConfig?.disableVideo === true;

      setStatus("requesting-permissions");
      await nextCallObject.startCamera(
        shouldDisableVideo
          ? {
              audioSource: true,
              videoSource: false,
            }
          : undefined,
      );

      if (shouldDisableVideo) {
        nextCallObject.setLocalVideo(false);
      }

      nextCallObject.setLocalAudio(!isMicMuted);

      setStatus("loading");
      const conversation = await createConversation();
      nextConversationId = conversation.conversation_id;
      conversationIdRef.current = conversation.conversation_id;
      setConversationId(conversation.conversation_id);

      setStatus("joining");
      await nextCallObject.join({ url: conversation.conversation_url });
    } catch (error) {
      if (nextConversationId) {
        await endConversation(nextConversationId);
      }

      conversationIdRef.current = null;
      setConversationId(null);
      setStatus("error");
      setErrorMessage(getErrorMessage(error));

      if (nextCallObject) {
        await destroyCallObject(nextCallObject);
      }

      if (callObjectRef.current === nextCallObject) {
        callObjectRef.current = null;
      }

      setCallObject(null);
    } finally {
      startInFlightRef.current = false;
      isManualTeardownRef.current = false;
    }
  }, [createConversation, destroyCallObject, endConversation, isMicMuted, status, teardownDemo]);

  const showStartScreen = !callObject || status === "idle" || status === "error";
  const showSession = Boolean(callObject) && !showStartScreen;

  if (showSession && callObject) {
    return (
      <DailyProvider callObject={callObject}>
        <TavusSession
          audioBlocked={audioBlocked}
          isMicMuted={isMicMuted}
          latestReplicaTranscript={latestReplicaTranscript}
          latestUserTranscript={latestUserTranscript}
          onToggleMicMute={handleToggleMicMute}
          overlayState={overlayState}
          replicaReady={replicaReady}
          replicaSpeaking={replicaSpeaking}
          onAudioBlockedChange={setAudioBlocked}
          userSpeaking={userSpeaking}
        />
      </DailyProvider>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(41,80,200,0.35),_transparent_38%),linear-gradient(180deg,_#09101d_0%,_#060912_100%)] text-white">
      <FloatingMicControl isMuted={isMicMuted} onToggle={handleToggleMicMute} />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_bottom,_rgba(123,204,163,0.2),_transparent_35%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-sky-200/80">AWS Booth Demo</p>
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
              disabled={startInFlightRef.current || status === "leaving"}
              onClick={() => void handleStart()}
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
                  {errorMessage}
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
                  Ask the agent to show a diagram on screen. Try{" "}
                  <em>&ldquo;Show the architecture diagram&rdquo;</em>,{" "}
                  <em>&ldquo;Show the AWS voice agent guidance&rdquo;</em>, or{" "}
                  <em>&ldquo;Show the NVIDIA guidance&rdquo;</em>.
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
          <svg className="h-12 w-auto opacity-40" viewBox="35 31 352 259" xmlns="http://www.w3.org/2000/svg" aria-label="NVIDIA"><path d="M384.195,282.109c0,3.771-2.769,6.302-6.047,6.302v-0.023c-3.371,0.023-6.089-2.508-6.089-6.278 c0-3.769,2.718-6.293,6.089-6.293C381.427,275.816,384.195,278.34,384.195,282.109z M386.648,282.109c0-5.175-4.02-8.179-8.5-8.179 c-4.511,0-8.531,3.004-8.531,8.179c0,5.172,4.021,8.188,8.531,8.188C382.629,290.297,386.648,287.281,386.648,282.109 M376.738,282.801h0.91l2.109,3.703h2.316l-2.336-3.859c1.207-0.086,2.2-0.661,2.2-2.286c0-2.019-1.392-2.668-3.75-2.668h-3.411 v8.813h1.961V282.801 M376.738,281.309v-2.122h1.364c0.742,0,1.753,0.06,1.753,0.965c0,0.985-0.523,1.157-1.398,1.157H376.738" fill="white"/><path d="M329.406,237.027l10.598,28.993H318.48L329.406,237.027z M318.056,225.738l-24.423,61.88h17.246l3.863-10.934 h28.903l3.656,10.934h18.722l-24.605-61.888L318.056,225.738z M269.023,287.641h17.497v-61.922l-17.5-0.004L269.023,287.641z M147.556,225.715l-14.598,49.078l-13.984-49.074l-18.879-0.004l19.972,61.926h25.207l20.133-61.926H147.556z M218.281,239.199h7.52 c10.91,0,17.966,4.898,17.966,17.609c0,12.714-7.056,17.613-17.966,17.613h-7.52V239.199z M200.931,225.715v61.926h28.366 c15.113,0,20.048-2.512,25.384-8.148c3.769-3.957,6.207-12.641,6.207-22.134c0-8.707-2.063-16.468-5.66-21.304 c-6.481-8.649-15.817-10.34-29.75-10.34H200.931z M35.188,225.629v62.012h17.645v-47.086l13.672,0.004 c4.527,0,7.754,1.128,9.934,3.457c2.765,2.945,3.894,7.699,3.894,16.395v27.23h17.098v-34.262c0-24.453-15.586-27.75-30.836-27.75 H35.188z M172.771,225.715l0.007,61.926h17.489v-61.926H172.771z" fill="white"/><path d="M82.211,102.414c0,0,22.504-33.203,67.437-36.638V53.73 c-49.769,3.997-92.867,46.149-92.867,46.149s24.41,70.565,92.867,77.026v-12.804C99.411,157.781,82.211,102.414,82.211,102.414z M149.648,138.637v11.726c-37.968-6.769-48.507-46.237-48.507-46.237s18.23-20.195,48.507-23.47v12.867 c-0.023,0-0.039-0.007-0.058-0.007c-15.891-1.907-28.305,12.938-28.305,12.938S128.243,131.445,149.648,138.637 M149.648,31.512 V53.73c1.461-0.112,2.922-0.207,4.391-0.257c56.582-1.907,93.449,46.406,93.449,46.406s-42.343,51.488-86.457,51.488 c-4.043,0-7.828-0.375-11.383-1.005v13.739c3.04,0.386,6.192,0.613,9.481,0.613c41.051,0,70.738-20.965,99.484-45.778 c4.766,3.817,24.278,13.103,28.289,17.168c-27.332,22.883-91.031,41.329-127.144,41.329c-3.481,0-6.824-0.211-10.11-0.528v19.306 h156.032V31.512H149.648z M149.648,80.656V65.777c1.446-0.101,2.903-0.179,4.391-0.226c40.688-1.278,67.382,34.965,67.382,34.965 s-28.832,40.043-59.746,40.043c-4.449,0-8.438-0.715-12.028-1.922V93.523c15.84,1.914,19.028,8.911,28.551,24.786l21.18-17.859 c0,0-15.461-20.277-41.524-20.277C155.021,80.172,152.31,80.371,149.648,80.656" fill="white"/></svg>
          <img className="h-9 w-auto opacity-40 invert" src="/pipecat-logo.png" alt="Pipecat" />
        </footer>
      </div>
    </div>
  );
}
