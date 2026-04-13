import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/api/:path*"],
};

export function middleware(request: NextRequest) {
  // The auth endpoint itself must always be reachable to set the session cookie.
  if (request.nextUrl.pathname === "/api/auth") {
    return NextResponse.next();
  }

  const token = process.env.DEMO_API_TOKEN;

  if (!token) {
    // Fail closed in production — a missing token means the deployment is
    // misconfigured, not that auth should be skipped.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Service misconfigured: DEMO_API_TOKEN is not set" },
        { status: 503 },
      );
    }
    // Local dev convenience: skip auth when token is not configured.
    return NextResponse.next();
  }

  const session = request.cookies.get("demo-session");
  if (session?.value === token) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
