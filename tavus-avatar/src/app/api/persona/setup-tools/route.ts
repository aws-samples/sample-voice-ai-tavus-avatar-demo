import { NextResponse } from "next/server";

import { PERSONA_TOOL_PATCH } from "@/lib/persona-tools";
import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";

export async function POST() {
  try {
    const { personaId } = getTavusConfig();

    const response = await tavusFetch(`/personas/${personaId}`, {
      method: "PATCH",
      body: JSON.stringify(PERSONA_TOOL_PATCH),
    });

    const payload = await readResponsePayload<Record<string, unknown> | { error?: string; message?: string }>(
      response,
    );

    if (response.status === 304) {
      return NextResponse.json(
        {
          ok: true,
          modified: false,
          message: "Persona tools already match the expected configuration.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: getTavusErrorMessage(response, payload.json, "Failed to update Tavus persona tools."),
          tavusResponse: payload.text || null,
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
        ok: true,
        modified: true,
        persona: payload.json,
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
            : "Unexpected error while updating Tavus persona tools.",
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
