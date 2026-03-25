# Building Real-time Voice Agents Using Deepgram, Pipecat and AWS

An interactive conversational video demo built with [Tavus](https://www.tavus.io/) CVI (Conversational Video Interface) and [Daily](https://www.daily.co/) WebRTC. An AI-powered video avatar engages visitors in real-time voice conversations and can display content overlays (architecture diagrams, schedules) via tool calls.

Built for the AWS booth at AWS Summit Sydney 2026 (13–14 May, ICC Sydney).

## Prerequisites

- **Node.js** 18+ and npm
- A **Tavus** account with an API key and a configured persona
- A modern browser with camera and microphone access

## API Keys

| Key | Where to set | How to obtain |
|---|---|---|
| `TAVUS_API_KEY` | `tavus-avatar/.env.local` | Sign up at [platform.tavus.io](https://platform.tavus.io) |
| `TAVUS_PERSONA_ID` | `tavus-avatar/.env.local` | Create a persona in the Tavus dashboard (default: `p2bb5fbde523`) |

STT and TTS models are managed entirely within the Tavus persona pipeline — no separate API keys are needed in this app. See [Model Configuration](#model-configuration) for details.

## Model Configuration

This demo uses a cascaded voice agent pipeline: STT → LLM → TTS, orchestrated by [Pipecat](https://github.com/pipecat-ai/pipecat) inside Tavus.

| Layer | Model | Provider |
|---|---|---|
| Speech-to-Text (STT) | Managed by Tavus | [Tavus](https://tavus.io) pipeline (`tavus-advanced` engine) |
| LLM | Configurable (Claude, Nova, Llama, Mistral, etc.) | [Amazon Bedrock](https://aws.amazon.com/bedrock/) |
| Text-to-Speech (TTS) | Managed by Tavus | [Tavus](https://tavus.io) pipeline (`sonic-3` engine) |

### STT and TTS engines

The STT and TTS models are managed entirely within Tavus. You cannot select Deepgram directly as a Tavus engine — Tavus uses its own engine identifiers.

**Available STT engines:** `tavus-auto`, `tavus-whisper`, `tavus-turbo`, `tavus-advanced`, `tavus-parakeet`, `tavus-deepgram-medical`, `tavus-sarvam`, `tavus-soniox`

**Available TTS engines:** `elevenlabs`, `cartesia`, `inworld` (or leave blank to use the default Tavus voice)

To change engines, use the Tavus dashboard or API:

```bash
# Example: change STT engine via API
curl -X PATCH "https://tavusapi.com/v2/personas/$TAVUS_PERSONA_ID" \
  -H "x-api-key: $TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"op": "replace", "path": "/layers/stt/stt_engine", "value": "tavus-advanced"}]'
```

### Switching the LLM

The LLM is Amazon Bedrock and is configured in the Tavus persona's LLM layer settings. You can change the model (Claude, Nova, Llama, Mistral, etc.) from within the Tavus persona dashboard without any code changes.

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <repo-url>
   cd voice-ai-demo
   ```

2. **Install dependencies:**

   ```bash
   cd tavus-avatar
   npm install
   ```

3. **Configure environment variables:**

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` and set:

   | Variable | Description |
   |---|---|
   | `TAVUS_API_KEY` | Your Tavus API key |
   | `TAVUS_PERSONA_ID` | Tavus persona ID (default: `p2bb5fbde523`) |

4. **Upload the knowledge base (if using a new Tavus account):**

   The demo references a pre-uploaded knowledge base document. Upload the contents of `prompts/aws-summit-sydney-schedule-kb.md` to your Tavus persona as a document, then update the document ID in `src/app/api/conversation/route.ts` if it differs.

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Electron Kiosk Shell

The `agent-kiosk-shell/` directory contains a generic Electron wrapper for running the demo in a borderless full-screen kiosk window. It automatically appends `autostart=1&shell=electron` so sessions start immediately on load.

### Setup

```bash
cd agent-kiosk-shell
npm install
cp .env.example .env
```

### Run (local dev server)

```bash
npm start -- --target-url=http://localhost:3000
```

### Run (deployed app)

```bash
npm start -- --target-url=https://your-app.vercel.app --display-number=2
```

### Auto-click a hosted app's connect button

```bash
npm start -- --target-url=https://your-app.fly.dev/ --auto-click-text=Connect
```

### Keyboard shortcuts (kiosk shell)

- `Cmd+R` — Reload the target app
- `Cmd+B` — Show a local disconnected screen until the next reload
- `Cmd+Q` — Quit the shell

### Notes

- Remote targets must use `https://`; plain `http://` is only allowed for `localhost` and other loopback addresses.
- `--display-number` is a 1-based physical-display index (sorted left-to-right, then top-to-bottom).
- `--display-id` targets Electron's raw display ID directly.
- `--auto-click-text` clicks the first enabled clickable element whose text matches exactly.
- `--auto-click-selector` targets a specific DOM selector instead.

### Hosted App Contract

The hosted app should support:

- `autostart=1` to immediately start a new session on page load
- Page unload cleanup so reloads and `Cmd+B` cleanly end active sessions

The `tavus-avatar` app supports this contract.

## Usage

1. Click **Start demo** on the landing page.
2. Grant camera and microphone permissions when prompted.
3. Speak with the AI avatar in real-time.
4. Ask the avatar to show content (e.g., "show me the architecture diagram") to see overlay tool calls in action.
5. Press **Escape** to end the session.

**Keyboard shortcuts:**
- `Ctrl+D` — Toggle microphone mute
- `Ctrl+F` — Cycle microphone devices
- `Ctrl+G` — Cycle speaker devices

## Guidance for Voice Agents

This demo promotes the [Guidance for Voice Agents on AWS](https://github.com/aws-samples/sample-voice-agent) reference architecture. During a conversation, the avatar can display a reference architecture overlay showing the general architecture for deploying voice agents using speech-to-text and cascaded models on AWS.

Ask the avatar "show me the voice agent guidance" or "show the AWS guidance" to display it. The overlay includes a call-to-action linking to the sample repository:

> **https://github.com/aws-samples/sample-voice-agent**

## Project Structure

```
prompts/                          # System prompts and knowledge base documents
agent-kiosk-shell/                # Generic Electron kiosk wrapper for browser-based agent UIs
tavus-avatar/                     # Next.js application
  src/
    app/
      api/conversation/           # Create/end Tavus conversation sessions
      api/persona/setup-tools/    # Patch persona tool definitions
      content/                    # Embeddable overlay pages (iframes)
    components/                   # React components (main demo UI, schedule overlay)
    lib/                          # Tavus API client, persona/tool configs, content registry
    types/                        # TypeScript type definitions
  public/content/                 # Static assets (images for overlays)
```

## Tech Stack

- **Next.js 16** (App Router) / React 19 / TypeScript
- **Tailwind CSS v4**
- **Daily WebRTC** (`@daily-co/daily-js`, `@daily-co/daily-react`)
- **Tavus API** for conversational video AI

## Updating the Tavus Persona

The voice agent's system prompt, knowledge base, and tool definitions are managed in Tavus. Use the Tavus API or [platform.tavus.io](https://platform.tavus.io) dashboard to update them.

### Upload a knowledge base document

Upload a markdown file as a knowledge base document. The returned `document_id` must be set in `tavus-avatar/src/app/api/conversation/route.ts`.

```bash
curl -X POST "https://tavusapi.com/v2/documents" \
  -H "x-api-key: $TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"document_url": "https://raw.githubusercontent.com/<owner>/<repo>/main/prompts/aws-summit-sydney-schedule-kb.md", "document_name": "aws-summit-sydney-schedule-kb.md"}'
```

### Update the system prompt

Patch the persona with the latest system prompt from `prompts/tavus-system-instruction-1.md`:

```bash
SYSTEM_PROMPT=$(python3 -c "import json; print(json.dumps(open('prompts/tavus-system-instruction-1.md').read()))")

curl -X PATCH "https://tavusapi.com/v2/personas/$TAVUS_PERSONA_ID" \
  -H "x-api-key: $TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "[{\"op\": \"replace\", \"path\": \"/system_prompt\", \"value\": $SYSTEM_PROMPT}]"
```

### Push updated tool definitions

After deploying the app, call the setup-tools endpoint to sync tool schemas with Tavus:

```bash
curl -X POST "http://localhost:3000/api/persona/setup-tools"
```

### Change STT/TTS engines or hotwords

Use the Tavus API to change STT/TTS engines or update STT hotwords (see [Model Configuration](#model-configuration) for available engines):

```bash
# Update STT hotwords
curl -X PATCH "https://tavusapi.com/v2/personas/$TAVUS_PERSONA_ID" \
  -H "x-api-key: $TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"op": "replace", "path": "/layers/stt/hotwords", "value": "AWS, Deepgram, SageMaker, Bedrock, Pipecat"}]'
```

## Production Build

```bash
cd tavus-avatar
npm run build
npm run start
```
