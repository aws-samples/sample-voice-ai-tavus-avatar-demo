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

import {
  CONTENT_ITEMS,
  resolveContentItemKey,
  type ContentItemKey,
} from "@/lib/content-items";
import type {
  TavusAppMessage,
  TavusConversationCreateResponse,
  TavusConversationEchoMessage,
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
  loading: "Creating Tavus conversation",
  joining: "Joining Tavus CVI",
  leaving: "Ending current session",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while starting the Tavus demo.";
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

function getProcessedToolCallStore() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const globalWindow = window as Window & {
    __tavusProcessedToolCalls__?: Set<string>;
  };

  if (!globalWindow.__tavusProcessedToolCalls__) {
    globalWindow.__tavusProcessedToolCalls__ = new Set<string>();
  }

  return globalWindow.__tavusProcessedToolCalls__;
}

const REPLICA_READY_EVENT_TYPES = new Set([
  "system.replica_present",
  "system.replica_joined",
  "conversation.replica.started_speaking",
]);

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

type TavusSessionProps = {
  audioBlocked: boolean;
  contentItemKey: ContentItemKey | null;
  replicaReady: boolean;
  onAudioBlockedChange(nextValue: boolean): void;
};

function TavusSession({
  audioBlocked,
  contentItemKey,
  replicaReady,
  onAudioBlockedChange,
}: TavusSessionProps) {
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const audioHandleRef = useRef<DailyAudioHandle | null>(null);

  const activeContent = useMemo(() => {
    if (!contentItemKey) {
      return null;
    }

    return CONTENT_ITEMS[contentItemKey];
  }, [contentItemKey]);

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

  if (!activeContent) {
    return (
      <>
        <div className="relative h-screen w-screen overflow-hidden bg-black">
          {canRenderAvatar && avatarSessionId ? (
            <DailyVideo
              className="h-full w-full bg-black object-cover"
              fit="cover"
              sessionId={avatarSessionId}
              type="video"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black text-sm uppercase tracking-[0.25em] text-slate-400">
              {replicaReady ? "Waiting for Tavus video track" : "Waiting for Tavus replica"}
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
        <iframe
          className="absolute inset-0 h-full w-full bg-white"
          src={activeContent.url}
          title={activeContent.label}
        />

        <div className="absolute bottom-6 right-6 z-20 h-[210px] w-[280px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950/90 shadow-2xl backdrop-blur">
          {canRenderAvatar && avatarSessionId ? (
            <DailyVideo
              className="h-full w-full bg-slate-950 object-cover"
              fit="cover"
              sessionId={avatarSessionId}
              type="video"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.96)_0%,_rgba(2,6,23,1)_100%)] p-6 text-center text-sm text-slate-300">
              {replicaReady ? "Waiting for the Tavus video track." : "Waiting for the Tavus replica."}
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
  const [contentItemKey, setContentItemKey] = useState<ContentItemKey | null>(null);
  const [replicaReady, setReplicaReady] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const callObjectRef = useRef<DailyCall | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const processedToolCallsRef = useRef<Set<string> | null>(null);
  const startInFlightRef = useRef(false);
  const isManualTeardownRef = useRef(false);

  if (processedToolCallsRef.current == null) {
    processedToolCallsRef.current = getProcessedToolCallStore();
  }

  useEffect(() => {
    callObjectRef.current = callObject;
  }, [callObject]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

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

    console.log("[Tavus tool call]", {
      fromId: event.fromId,
      payload,
    });

    let responseText = "I updated the screen.";

    try {
      const rawArguments = payload.properties.arguments;
      const parsedArguments =
        typeof rawArguments === "string" && rawArguments.length > 0
          ? (JSON.parse(rawArguments) as { item?: string })
          : typeof rawArguments === "object" && rawArguments !== null
            ? (rawArguments as { item?: string })
            : {};

      switch (payload.properties.name) {
        case "show_content": {
          const nextContentItemKey = resolveContentItemKey(parsedArguments.item);
          if (!nextContentItemKey) {
            responseText = "I could not find that screen to show.";
            break;
          }

          setContentItemKey(nextContentItemKey);
          responseText = `Showing ${CONTENT_ITEMS[nextContentItemKey].label}.`;
          break;
        }
        case "dismiss_content": {
          setContentItemKey(null);
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

  const createConversation = useCallback(async () => {
    const response = await fetch("/api/conversation", {
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
          : "Tavus did not return a valid conversation.";
      throw new Error(message);
    }

    return responseJson;
  }, []);

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
    setContentItemKey(null);
    setReplicaReady(false);
    setAudioBlocked(false);
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
      setContentItemKey(null);
      setReplicaReady(false);
      setAudioBlocked(false);

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
    setContentItemKey(null);
    setReplicaReady(false);

    let nextCallObject: DailyCall | null = null;
    let nextConversationId: string | null = null;

    try {
      if (callObjectRef.current) {
        await teardownDemo();
      }

      nextCallObject = DailyIframe.createCallObject();
      callObjectRef.current = nextCallObject;
      setCallObject(nextCallObject);

      setStatus("requesting-permissions");
      await nextCallObject.startCamera();

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
  }, [createConversation, destroyCallObject, endConversation, status, teardownDemo]);

  const showStartScreen = !callObject || status === "idle" || status === "error";
  const showSession = Boolean(callObject) && !showStartScreen;

  if (showSession && callObject) {
    return (
      <DailyProvider callObject={callObject}>
        <TavusSession
          audioBlocked={audioBlocked}
          contentItemKey={contentItemKey}
          replicaReady={replicaReady}
          onAudioBlockedChange={setAudioBlocked}
        />
      </DailyProvider>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(41,80,200,0.35),_transparent_38%),linear-gradient(180deg,_#09101d_0%,_#060912_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_bottom,_rgba(123,204,163,0.2),_transparent_35%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-sky-200/80">AWS Booth Demo</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-4xl">
              Tavus Conversational Video Interface
            </h1>
          </div>
          <div className="rounded-full border border-white/15 bg-white/6 px-4 py-2 text-sm text-slate-200 backdrop-blur">
            {status}
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full max-w-5xl gap-6 rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur md:grid-cols-[1.25fr_0.95fr] md:p-10">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <span className="inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-emerald-200">
                  Camera-aware Tavus demo
                </span>
                <div className="space-y-4">
                  <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl">
                    Start the Tavus booth experience with a single click.
                  </h2>
                  <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                    The demo requests camera and microphone access, creates a Tavus conversation,
                    joins the Daily room, and listens for tool calls that can change the on-screen
                    content while the avatar keeps speaking.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <button
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                  disabled={startInFlightRef.current || status === "leaving"}
                  onClick={() => void handleStart()}
                  type="button"
                >
                  {START_BUTTON_LABELS[status as keyof typeof START_BUTTON_LABELS] ?? "Start demo"}
                </button>
                <p className="text-sm text-slate-400">
                  Browser prompt expected. The Tavus CVI does not load until you approve access.
                </p>
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
                  <li>1. Request camera and microphone permissions through Daily.</li>
                  <li>2. Create a Tavus conversation through the Next.js API route.</li>
                  <li>3. Join the Tavus Daily room with the existing call object.</li>
                  <li>4. Render Tavus video plus a dedicated remote audio sink.</li>
                </ol>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">Tool Proof of Concept</p>
                <p className="mt-4 leading-7 text-slate-300">
                  Ask the agent to show the AWS voice AI overview. Tavus emits a
                  `conversation.tool_call`, the client switches into overlay mode, and the same-origin
                  content page fills the main stage.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-violet-200/70">Visual Reasoning Check</p>
                <p className="mt-4 leading-7 text-slate-300">
                  After the call connects, ask what Tavus can see. The avatar should be able to answer
                  questions about your camera feed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
