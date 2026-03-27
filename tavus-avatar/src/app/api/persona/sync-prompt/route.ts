import { readFileSync } from "fs";
import { resolve } from "path";

import { NextResponse } from "next/server";

import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";

export async function POST() {
  try {
    const { personaId } = getTavusConfig();

    const promptPath = resolve(process.cwd(), "../prompts/tavus-system-instruction-1.md");
    const systemPrompt = readFileSync(promptPath, "utf-8");

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
