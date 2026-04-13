# Future Improvements

| # | Improvement | Current State | Proposed Fix | Priority |
|---|---|---|---|---|
| 1 | **Bot-frontend greeting handshake** | 6s delay after first participant joins before sending greeting | Bot sends `ready` via data channel, frontend responds with `client_ready`, bot waits before greeting. See `tavus-pipecat.py` `on_first_participant_joined`. | Medium |
| 2 | **Configurable event context** | ~~System prompt and greeting hardcoded for AWS Summit Sydney 2026~~ | Each event is a directory under `prompts/` with its own prompt files + `config.yaml`. Set `EVENT_CONFIG` env var to switch. | ✅ Done |
| 3 | **Multilingual support for cascaded pipeline** | ~~Nova Sonic supports 15 languages natively; cascaded pipeline is English-only~~ | Language selector in pipeline modal. Configures Deepgram STT locale, Cartesia TTS voice/language, and LLM prompt per language. Supports EN, FR, DE, ES, JA, KO, ZH, and auto-detect. | ✅ Done |
| 4 | **Content overlay not rendering on CloudFront** | ~~iframe loads `/content/aws-voice-ai` but S3 returns 403 (no directory index), CloudFront SPA fallback serves React app instead~~ | CloudFront Function rewrites `/content/*` paths to append `/index.html`. Dedicated cache behavior for `/content/*` with the function attached. | ✅ Done |
