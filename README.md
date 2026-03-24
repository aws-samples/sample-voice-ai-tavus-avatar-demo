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
| **Deepgram API Key** | Tavus persona settings (not in `.env.local`) | Sign up at [deepgram.com](https://deepgram.com) |

The **Deepgram API key** is configured inside the Tavus persona's pipeline settings, not in this app's environment variables. To set it up:

1. Log in to [platform.tavus.io](https://platform.tavus.io).
2. Navigate to your persona and open the pipeline settings.
3. Add your Deepgram API key in the credentials section.

## Model Configuration

This demo uses a cascaded voice agent pipeline: STT → LLM → TTS.

| Layer | Model | Provider |
|---|---|---|
| Speech-to-Text (STT) | Nova-3 | [Deepgram](https://deepgram.com) |
| LLM | Configurable (Claude, Nova, Llama, Mistral, etc.) | [Amazon Bedrock](https://aws.amazon.com/bedrock/) |
| Text-to-Speech (TTS) | Aura | [Deepgram](https://deepgram.com) |

### Switching STT and TTS to Deepgram

The STT and TTS models are managed through the Tavus persona configuration, not through this app's environment variables:

1. Log in to [platform.tavus.io](https://platform.tavus.io).
2. Navigate to your persona and open the pipeline settings.
3. Set the **STT provider** to **Deepgram** and the model to **nova-3**.
4. Set the **TTS provider** to **Deepgram** and select your preferred **Aura** voice.
5. Add your **Deepgram API key** in the Tavus persona credentials section.

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

## TODO

| # | Task | Where | Details |
|---|---|---|---|
| 1 | Upload schedule knowledge base | [platform.tavus.io](https://platform.tavus.io) | Upload `prompts/aws-summit-sydney-schedule-kb.md` as a persona document, then replace `TODO-upload-new-schedule-to-tavus` in `tavus-avatar/src/app/api/conversation/route.ts` with the new document ID |
| 2 | Update persona system prompt | [platform.tavus.io](https://platform.tavus.io) | Copy contents of `prompts/tavus-system-instruction-1.md` into the persona's system prompt field |
| 3 | Configure Deepgram in persona pipeline | [platform.tavus.io](https://platform.tavus.io) | Set STT to Deepgram Nova-3, TTS to Deepgram Aura, and add your Deepgram API key |
| 4 | Push updated tool definitions | App deployment | After deploying, call `POST /api/persona/setup-tools` to sync the updated tool schema |

## Production Build

```bash
cd tavus-avatar
npm run build
npm run start
```
