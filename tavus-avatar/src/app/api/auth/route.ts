import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = process.env.DEMO_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Service misconfigured: DEMO_API_TOKEN is not set" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as { token?: string };

  if (body.token !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("demo-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return response;
}
