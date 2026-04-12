import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/api/:path*"],
};

export function middleware(request: NextRequest) {
  const token = process.env.DEMO_API_TOKEN;

  // If no token is configured, pass through (local dev convenience)
  if (!token) {
    return NextResponse.next();
  }

  const provided = request.headers.get("x-demo-token");

  if (provided !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}
