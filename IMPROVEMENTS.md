# Future Improvements

| # | Improvement | Current State | Proposed Fix | Priority |
|---|---|---|---|---|
| 1 | **Bot-frontend greeting handshake** | 6s delay after first participant joins before sending greeting | Bot sends `ready` via data channel, frontend responds with `client_ready`, bot waits before greeting. See `tavus-pipecat.py` `on_first_participant_joined`. | Medium |
| 2 | **Configurable event context** | System prompt and greeting hardcoded for AWS Summit Sydney 2026 | Template the prompt with env vars or config files per event (e.g., `prompts/events/summit-sydney-2026.yaml`) | High |
| 3 | **Multilingual support for cascaded pipeline** | Nova Sonic supports 15 languages natively; cascaded pipeline is English-only | Add language selection to cascaded mode — configure Deepgram STT locale, Bedrock prompt language, and Deepgram Aura TTS voice per language | Medium |
