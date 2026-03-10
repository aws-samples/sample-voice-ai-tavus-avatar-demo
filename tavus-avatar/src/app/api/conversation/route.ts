import { NextResponse } from "next/server";

import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";
import type { TavusConversationCreateResponse } from "@/types/tavus";

// Tavus knowledge base document for prompts/aws-gtc-schedule-kb-1.md.
const AWS_GTC_SCHEDULE_DOCUMENT_ID = "d5-a250fbf7c53f";

export async function POST() {
  try {
    const { personaId } = getTavusConfig();

    const response = await tavusFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({
        persona_id: personaId,
        document_ids: [AWS_GTC_SCHEDULE_DOCUMENT_ID],
        custom_greeting:
          "Hi, welcome to the AWS booth. Ask me about voice AI, or ask me to show a diagram.",
        properties: {
          max_call_duration: 3600,
          participant_left_timeout: 30,
          participant_absent_timeout: 300,
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
