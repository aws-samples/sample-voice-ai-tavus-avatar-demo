import { NextResponse } from "next/server";

import { getCustomTavusLlmConfig } from "@/lib/tavus-custom-llms";
import { resolveConversationPersonaId } from "@/lib/tavus-personas";
import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";
import type { TavusConversationCreateResponse } from "@/types/tavus";

// Tavus knowledge base document for prompts/aws-gtc-schedule-kb-1.md.
const AWS_GTC_SCHEDULE_DOCUMENT_ID = "d5-a250fbf7c53f";

export async function POST(request: Request) {
  try {
    const { personaId: defaultPersonaId } = getTavusConfig();
    const params = new URL(request.url).searchParams;
    const llmName = params.get("llm");
    const personaId = params.get("persona") || defaultPersonaId;

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

    const conversationPersonaId = await resolveConversationPersonaId(personaId, llmName);

    const response = await tavusFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({
        persona_id: conversationPersonaId,
        document_ids: [AWS_GTC_SCHEDULE_DOCUMENT_ID],
        custom_greeting:
          "Hi, welcome to the AWS booth! I'm here to help you explore voice AI on AWS. Before we get started, what's your name and which company are you with? I can also show you diagrams, walk you through the GTC schedule, and answer questions about our tech stack.",
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
