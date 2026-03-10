# Building Real-time Voice Agents Using NVIDIA Speech Models, Pipecat and AWS

An interactive conversational video demo built with [Tavus](https://www.tavus.io/) CVI (Conversational Video Interface) and [Daily](https://www.daily.co/) WebRTC. An AI-powered video avatar engages visitors in real-time voice conversations and can display content overlays (architecture diagrams, schedules) via tool calls.

Built for the AWS booth at NVIDIA GTC 2026.

## Prerequisites

- **Node.js** 18+ and npm
- A **Tavus** account with an API key and a configured persona
- A modern browser with camera and microphone access

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <repo-url>
   cd aws-gtc-2026
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

   The demo references a pre-uploaded knowledge base document. Upload the contents of `prompts/aws-gtc-schedule-kb-1.md` to your Tavus persona as a document, then update the document ID in `src/app/api/conversation/route.ts` if it differs.

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click **Start demo** on the landing page.
2. Grant camera and microphone permissions when prompted.
3. Speak with the AI avatar in real-time.
4. Ask the avatar to show content (e.g., "show me the architecture diagram") to see overlay tool calls in action.
5. Press **Escape** to end the session.

**Keyboard shortcuts:**
- `Ctrl+D` -- Toggle microphone mute

**URL parameters:**
- `?llm=super-4-modal` -- Use the Modal-hosted Nemotron LLM backend instead of the default

## Guidance for Voice Agents

This demo promotes the [Guidance for Voice Agents on AWS](https://github.com/aws-samples/sample-voice-agent) reference architecture. During a conversation, the avatar can display two reference architecture overlays:

- **Guidance for Voice Agents on AWS** -- general architecture for deploying voice agents using speech-to-text and cascaded models on AWS.
- **Guidance for Voice Agents on AWS with NVIDIA** -- the same architecture using NVIDIA open models on SageMaker with NVIDIA TTS NIM.

Ask the avatar "show me the voice agent guidance" or "show the NVIDIA guidance" to display them. Each overlay includes a call-to-action linking to the sample repository:

> **https://github.com/aws-samples/sample-voice-agent**

## Project Structure

```
prompts/                          # System prompts and knowledge base documents
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

## Production Build

```bash
cd tavus-avatar
npm run build
npm run start
```
