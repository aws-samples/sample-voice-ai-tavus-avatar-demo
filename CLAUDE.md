# Voice AI Demo

## Project Overview
Next.js app (`tavus-avatar/`) for an AWS Summit Sydney booth demo. Real-time conversational voice AI with Tavus video avatar, Deepgram STT/TTS, Amazon Bedrock LLM, Pipecat orchestration, Daily WebRTC transport, Krisp noise cancellation.

## Key Files
- `tavus-avatar/src/lib/tavus-api.ts` - Core API client (base URL: `https://tavusapi.com/v2`, auth via `x-api-key` header)
- `tavus-avatar/src/lib/tavus-personas.ts` - Persona resolution with derived persona creation & caching
- `tavus-avatar/src/lib/tavus-custom-llms.ts` - Custom LLM layer config (currently empty map)
- `tavus-avatar/src/lib/persona-tools.ts` - Tool definitions (show_content, show_schedule, dismiss_content)
- `tavus-avatar/src/types/tavus.ts` - TypeScript types for Tavus conversation messages
- `tavus-avatar/src/components/tavus-demo.tsx` - Main demo component with Daily.js integration
- `tavus-avatar/src/app/api/conversation/route.ts` - POST to create conversation
- `tavus-avatar/src/app/api/conversation/[conversationId]/route.ts` - DELETE to end conversation
- `tavus-avatar/src/app/api/persona/setup-tools/route.ts` - PATCH persona with tool definitions
- `tavus-avatar/src/app/api/personas/route.ts` - GET list all personas
- `prompts/tavus-system-instruction-1.md` - System prompt for the booth assistant
- `agent-kiosk-shell/` - Electron kiosk shell for the booth display

## Environment Variables
- `TAVUS_API_KEY` - API key for Tavus
- `TAVUS_PERSONA_ID` - Default persona ID. **For Pipecat integrations, always use `pipecat-stream`** — this is a special Tavus persona (pipeline_mode: echo) that disables Tavus's own greeting and LLM, letting Pipecat handle all AI orchestration. It will NOT appear in `GET /v2/personas` list but is valid and available on all accounts.

## Architecture
- Frontend creates conversation via Next.js API route -> Tavus API
- Daily.js call object joins the conversation URL returned by Tavus
- App messages from Daily carry Tavus events (tool calls, utterances, speaking state)
- Tool calls handled client-side: show_content, show_schedule, dismiss_content
- `conversation.echo` sent back to Tavus after tool execution
- Persona tools set via PATCH `/v2/personas/{id}` using JSON Patch (RFC 6902)

## Tavus API Reference

Base URL: `https://tavusapi.com/v2`
Auth: `x-api-key` header

### Conversations

**Create Conversation** - `POST /v2/conversations`
```json
{
  "persona_id": "string",
  "replica_id": "string",
  "callback_url": "string",
  "conversation_name": "string",
  "conversational_context": "string",
  "custom_greeting": "string",
  "document_ids": ["string"],
  "properties": {
    "max_call_duration": 3600,
    "participant_left_timeout": 30,
    "participant_absent_timeout": 300,
    "language": "english"
  }
}
```
Response: `{ conversation_id, conversation_url, ... }`

**End Conversation** - `POST /v2/conversations/{conversation_id}/end`

### Personas

**List** - `GET /v2/personas` → `{ data: [{ persona_id, persona_name, system_prompt, layers, ... }] }`

**Get** - `GET /v2/personas/{persona_id}`

**Create** - `POST /v2/personas`
```json
{
  "persona_name": "string",
  "pipeline_mode": "full",
  "system_prompt": "string",
  "context": "string",
  "default_replica_id": "string",
  "document_ids": ["string"],
  "document_tags": ["string"],
  "layers": { "llm": {}, "tts": {}, "stt": {} }
}
```

**Patch (JSON Patch RFC 6902)** - `PATCH /v2/personas/{persona_id}`
```json
[
  { "op": "replace", "path": "/persona_name", "value": "New Name" },
  { "op": "replace", "path": "/layers/llm/model", "value": "tavus-gpt-4o" },
  { "op": "replace", "path": "/layers/llm/tools", "value": [] },
  { "op": "replace", "path": "/layers/tts/tts_engine", "value": "cartesia" },
  { "op": "add", "path": "/layers/tts/tts_emotion_control", "value": "true" },
  { "op": "remove", "path": "/layers/stt/hotwords" },
  { "op": "replace", "path": "/layers/perception/perception_tool_prompt", "value": "..." }
]
```

### Persona Layers

**LLM** - Models: `tavus-llama-4` (default, fastest), `tavus-gpt-4o-mini` (balanced), `tavus-gpt-4o` (smartest). Supports custom OpenAI-compatible LLMs. Tool calling via `layers.llm.tools` in OpenAI function calling format.

**STT** - `tavus-turbo` (lowest latency), `tavus-advanced` (higher accuracy, recommended for non-English)

**TTS** - Default Tavus TTS (fastest). Custom engines: Cartesia, ElevenLabs.

**Perception** - `raven-0` for real-time visual understanding. Configure via `perception_tool_prompt`.

### Tool Calling
Tools defined in `layers.llm.tools` using OpenAI function calling format:
```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "...",
    "parameters": { "type": "object", "properties": {}, "required": [] }
  }
}
```
Tool calls arrive as Daily app-messages with `event_type: "conversation.tool_call"`.
Respond with `conversation.echo` message via `sendAppMessage()`.

### Conversation Events (via Daily app-messages)
- `conversation.utterance` - speech (properties: role, speech)
- `conversation.tool_call` - LLM invoked a tool (properties: name, arguments)
- `conversation.echo` - response after tool execution
- `conversation.user.started_speaking` / `stopped_speaking`
- `conversation.replica.started_speaking` / `stopped_speaking`
- `conversation.replica_interrupted`
- `system.replica_present` / `system.replica_joined`

### Webhook Events
- `application.transcription_ready` - transcript ready
- `application.perception_analysis` - visual summary ready
