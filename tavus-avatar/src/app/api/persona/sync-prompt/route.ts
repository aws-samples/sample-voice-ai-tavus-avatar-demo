import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import { NextResponse } from "next/server";

import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";

function getEventDir(): string {
  const eventConfig = process.env.EVENT_CONFIG || "aws-summit-sydney-2026";
  const eventDir = resolve(process.cwd(), `../prompts/${eventConfig}`);
  if (!existsSync(eventDir)) {
    throw new Error(`Event config directory not found: ${eventDir}. Set EVENT_CONFIG to a valid event name.`);
  }
  return eventDir;
}

export async function POST() {
  try {
    const { personaId } = getTavusConfig();

    const eventDir = getEventDir();
    const systemPrompt = readFileSync(resolve(eventDir, "system-instruction.md"), "utf-8");

    const response = await tavusFetch(`/personas/${personaId}`, {
      method: "PATCH",
      body: JSON.stringify([
        { op: "replace", path: "/system_prompt", value: systemPrompt },
      ]),
    });

    const payload = await readResponsePayload<Record<string, unknown> | { error?: string; message?: string }>(
      response,
    );

    if (response.status === 304) {
      return NextResponse.json(
        {
          ok: true,
          modified: false,
          message: "Persona system prompt already matches.",
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
          error: getTavusErrorMessage(response, payload.json, "Failed to update Tavus persona system prompt."),
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
            : "Unexpected error while updating Tavus persona system prompt.",
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
