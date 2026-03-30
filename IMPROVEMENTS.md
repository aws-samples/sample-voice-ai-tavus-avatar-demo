# Future Improvements

Tracked improvements and enhancements for the voice AI demo.

## Bot-frontend greeting handshake

**Current state:** The bot waits 6 seconds after the first participant joins before sending the greeting, to ensure the avatar and audio pipeline are ready. This is a timing workaround.

**Proper fix:** Implement a bot-frontend handshake:
1. Bot sends `{"type": "ready"}` via data channel after the pipeline starts
2. Frontend receives it, sends `{"type": "client_ready"}` back via `sendAppMessage`
3. Bot waits for `client_ready` before triggering the greeting

This guarantees both sides are fully connected before the greeting plays. See `tavus-pipecat.py` `on_first_participant_joined` handler.

## Configurable event context

**Current state:** The system prompt and greeting are hardcoded for AWS Summit Sydney 2026 (venue, dates, booth context). Switching to a different event requires editing `prompts/tavus-system-instruction-1.md` and the `CUSTOM_GREETING` in `tavus-pipecat.py`.

**Improvement:** Make the demo configurable per event via environment variables or a config file:
- `EVENT_NAME`, `EVENT_VENUE`, `EVENT_DATES`, `EVENT_DESCRIPTION`
- `DEMO_TITLE`, `CUSTOM_GREETING`
- Template the system prompt with these variables at runtime
- Store event configs in `prompts/events/` (e.g., `summit-sydney-2026.yaml`, `reinvent-2026.yaml`)

## Deploy to US region for lower latency

**Current state:** ECS runs in `ap-southeast-2` (Sydney) but Deepgram, Cartesia, and Tavus APIs are US-based, adding ~150ms per cross-Pacific hop.

**Improvement:** Deploy the ECS backend to `us-east-1` for lower service-to-service latency. The user-facing latency is handled by Daily's WebRTC edge network regardless of bot location.
