"""
Auth wrapper around the Pipecat runner.

Adds a DEMO_API_TOKEN cookie gate to protect POST /start from unauthorized
usage. GET /start is left unprotected so the ALB health check keeps passing.

Run the same way as the bare runner:
    python server.py --transport daily --host 0.0.0.0 --port 7860
"""

import argparse
import os
import sys

import uvicorn
from fastapi import Request
from fastapi.responses import JSONResponse
from loguru import logger

from pipecat.runner.run import _create_server_app

DEMO_API_TOKEN = os.getenv("DEMO_API_TOKEN")
COOKIE_NAME = "demo-session"
COOKIE_MAX_AGE = 8 * 60 * 60  # 8 hours


def create_app(args: argparse.Namespace):
    app = _create_server_app(args)

    # ── Auth endpoints ────────────────────────────────────────────────────────

    @app.post("/api/auth")
    async def auth(request: Request):
        if not DEMO_API_TOKEN:
            return JSONResponse({"error": "DEMO_API_TOKEN not configured"}, status_code=503)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "Invalid JSON"}, status_code=400)
        if body.get("token") != DEMO_API_TOKEN:
            return JSONResponse({"error": "Invalid token"}, status_code=401)
        response = JSONResponse({"ok": True})
        response.set_cookie(
            COOKIE_NAME,
            DEMO_API_TOKEN,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            secure=True,
            samesite="strict",
        )
        return response

    @app.get("/api/auth/check")
    async def auth_check(request: Request):
        if not DEMO_API_TOKEN:
            return JSONResponse({"error": "DEMO_API_TOKEN not configured"}, status_code=503)
        if request.cookies.get(COOKIE_NAME) == DEMO_API_TOKEN:
            return JSONResponse({"ok": True})
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    # ── Auth middleware ───────────────────────────────────────────────────────

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        path = request.url.path
        method = request.method

        # Always allow: auth endpoints, GET /start (ALB health check), all other GETs
        if path.startswith("/api/auth"):
            return await call_next(request)
        if path == "/start" and method != "POST":
            return await call_next(request)
        if not path.startswith("/api/") and path != "/start":
            return await call_next(request)

        # From here: POST /start and all /api/* (except /api/auth already handled above)
        if not DEMO_API_TOKEN:
            logger.warning("DEMO_API_TOKEN not set — rejecting request (fail-closed)")
            return JSONResponse({"error": "Service misconfigured"}, status_code=503)

        if request.cookies.get(COOKIE_NAME) == DEMO_API_TOKEN:
            return await call_next(request)

        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    return app


def main():
    parser = argparse.ArgumentParser(description="Pipecat server with auth")
    parser.add_argument("--host", type=str, default="localhost")
    parser.add_argument("--port", type=int, default=7860)
    parser.add_argument(
        "-t", "--transport",
        type=str,
        choices=["daily", "webrtc", "twilio", "telnyx", "plivo", "exotel"],
        default="webrtc",
    )
    parser.add_argument("-x", "--proxy", type=str, default=None)
    parser.add_argument("-d", "--direct", action="store_true", default=False)
    parser.add_argument("-f", "--folder", type=str, default=None)
    parser.add_argument("-v", "--verbose", action="count", default=0)
    parser.add_argument("--dialin", action="store_true", default=False)
    parser.add_argument("--esp32", action="store_true", default=False)
    parser.add_argument("--whatsapp", action="store_true", default=False)

    args = parser.parse_args()

    logger.remove()
    logger.add(sys.stderr, level="TRACE" if args.verbose else "DEBUG")

    if not DEMO_API_TOKEN:
        logger.warning("DEMO_API_TOKEN is not set — all POST /start requests will be rejected")

    app = create_app(args)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
