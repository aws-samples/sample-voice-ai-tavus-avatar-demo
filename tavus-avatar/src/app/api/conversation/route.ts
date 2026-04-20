import { NextResponse } from "next/server";

import { getCustomTavusLlmConfig } from "@/lib/tavus-custom-llms";
import { resolveConversationPersonaId } from "@/lib/tavus-personas";
import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";
import type { TavusConversationCreateResponse } from "@/types/tavus";

// Tavus knowledge base document for the AWS Summit Sydney schedule.
const AWS_SUMMIT_SCHEDULE_DOCUMENT_ID = "d4-c663569fd55d";

// Module-level singletons — survive across requests in the same Node process (kiosk/Docker).
// Tracks the last created conversation so orphaned sessions can be ended before creating a new one.
let trackedConversationId: string | null = null;
const lastCreatedAt = new Map<string, number>(); // sessionToken → ms timestamp
const RATE_LIMIT_MS = 60_000;

function getSessionToken(request: Request): string | null {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith("demo-session="))
      ?.split("=")[1]
      ?.trim() ?? null
  );
}

export async function POST(request: Request) {
  try {
    const { personaId: defaultPersonaId } = getTavusConfig();
    const params = new URL(request.url).searchParams;
    const llmName = params.get("llm");
    const personaId = params.get("persona") || defaultPersonaId;

    // Rate limiting — only enforced when DEMO_API_TOKEN is set (skipped in local dev).
    const sessionToken = getSessionToken(request);
    if (sessionToken && process.env.DEMO_API_TOKEN) {
      const last = lastCreatedAt.get(sessionToken);
      if (last !== undefined && Date.now() - last < RATE_LIMIT_MS) {
        const retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
        return NextResponse.json(
          { error: `Please wait ${retryAfter} seconds before starting a new conversation.` },
          {
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(retryAfter),
            },
            status: 429,
          },
        );
      }
    }

    if (llmName && !getCustomTavusLlmConfig(llmName)) {
      return NextResponse.json(
        {
          error: `Unknown Tavus LLM configuration "${llmName}".`,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 400,
        },
      );
    }

    // End any previously tracked conversation before creating a new one.
    // This cleans up orphans caused by browser crashes or failed pagehide requests.
    if (trackedConversationId) {
      const prevId = trackedConversationId;
      trackedConversationId = null;
      try {
        await tavusFetch(`/conversations/${prevId}/end`, { method: "POST" });
      } catch {
        // Best-effort cleanup — do not block conversation creation.
      }
    }

    const conversationPersonaId = await resolveConversationPersonaId(personaId, llmName);

    const response = await tavusFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({
        persona_id: conversationPersonaId,
        document_ids: [AWS_SUMMIT_SCHEDULE_DOCUMENT_ID],
        custom_greeting:
          "Hi, welcome to the AWS booth at Summit Sydney! I'm here to help you explore voice AI on AWS. Before we get started, what's your name and which company are you with? I can also show you diagrams, walk you through the Summit schedule, and answer questions about our tech stack.",
        properties: {
          max_call_duration: 600,
          participant_left_timeout: 30,
          participant_absent_timeout: 600,
        },
      }),
    });

    const payload = await readResponsePayload<TavusConversationCreateResponse | { error?: string; message?: string }>(
      response,
    );

    if (!response.ok || !payload.json || !("conversation_id" in payload.json)) {
      return NextResponse.json(
        {
          error: getTavusErrorMessage(
            response,
            payload.json,
            "Failed to create Tavus conversation.",
          ),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: response.status || 500,
        },
      );
    }

    // Track the new conversation and record the creation time for rate limiting.
    trackedConversationId = payload.json.conversation_id;
    if (sessionToken) {
      lastCreatedAt.set(sessionToken, Date.now());
    }

    return NextResponse.json(
      {
        conversation_id: payload.json.conversation_id,
        conversation_url: payload.json.conversation_url,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while creating Tavus conversation.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 500,
      },
    );
  }
}
