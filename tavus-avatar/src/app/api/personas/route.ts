import { NextResponse } from "next/server";

import { getTavusConfig, getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";

type TavusPersona = {
  persona_id: string;
  persona_name?: string;
};

type TavusPersonaCollectionResponse = {
  data?: TavusPersona[];
};

export async function GET() {
  try {
    const { personaId: defaultPersonaId } = getTavusConfig();

    const response = await tavusFetch("/personas");
    const payload = await readResponsePayload<TavusPersonaCollectionResponse | { error?: string; message?: string }>(
      response,
    );

    if (!response.ok || !payload.json || !("data" in payload.json) || !Array.isArray(payload.json.data)) {
      return NextResponse.json(
        {
          error: getTavusErrorMessage(response, payload.json, "Failed to list Tavus personas."),
        },
        {
          headers: { "Cache-Control": "no-store" },
          status: response.status || 500,
        },
      );
    }

    const personas = payload.json.data.map((p) => ({
      persona_id: p.persona_id,
      persona_name: p.persona_name ?? p.persona_id,
    }));

    return NextResponse.json(
      {
        personas,
        default_persona_id: defaultPersonaId,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while listing Tavus personas.",
      },
      {
        headers: { "Cache-Control": "no-store" },
        status: 500,
      },
    );
  }
}
