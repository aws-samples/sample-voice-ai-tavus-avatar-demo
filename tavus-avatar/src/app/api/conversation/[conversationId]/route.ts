import { NextResponse } from "next/server";

import { getTavusErrorMessage, readResponsePayload, tavusFetch } from "@/lib/tavus-api";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { conversationId } = await context.params;

  try {
    const response = await tavusFetch(`/conversations/${conversationId}/end`, {
      method: "POST",
    });

    const payload = await readResponsePayload<{ error?: string; message?: string }>(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: getTavusErrorMessage(
            response,
            payload.json,
            "Failed to end Tavus conversation.",
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
        ok: true,
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
            : "Unexpected error while ending Tavus conversation.",
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
