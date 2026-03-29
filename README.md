# Building Real-time Voice Agents Using Deepgram, Pipecat and AWS

An interactive conversational video demo built for the AWS booth at AWS Summit Sydney 2026 (13-14 May, ICC Sydney). An AI-powered video avatar engages visitors in real-time voice conversations and can display content overlays (architecture diagrams, schedules) via tool calls.

## Two Demo Implementations

This repo contains two independent implementations of the same demo, each with a different architecture:

| | `tavus-avatar/` | `tavus-pipecat-example/` |
|---|---|---|
| **Approach** | Tavus hosted CVI (Conversational Video Interface) | Self-hosted Pipecat pipeline |
| **Frontend** | Next.js + Daily.js | React + WebRTC |
| **Backend** | Next.js API routes -> Tavus API | Python Pipecat server |
| **Pipeline control** | Tavus orchestrates STT/LLM/TTS | You orchestrate everything in Python |
| **Pipeline modes** | Single (Tavus-managed cascaded) | Cascaded + Amazon Nova Sonic toggle |
| **Best for** | Quick setup, Tavus manages the pipeline | Full control, custom pipeline, multi-model |

Both share the same system prompt (`prompts/tavus-system-instruction-1.md`), tool definitions, and content overlays.

---

## tavus-avatar (Tavus Hosted)

A Next.js app that delegates pipeline orchestration to Tavus. You configure the persona, STT/LLM/TTS engines, and tools via the Tavus API. Daily.js handles the WebRTC transport.

### Prerequisites

- Node.js 18+ and npm
- A Tavus account with an API key and configured persona

### Getting Started

```bash
cd tavus-avatar
npm install
cp env.example .env.local
```

Set `TAVUS_API_KEY` and `TAVUS_PERSONA_ID` in `.env.local`, then:

```bash
npm run dev
# Sync tool definitions to Tavus
curl -X POST http://localhost:3000/api/persona/setup-tools
```

Open [http://localhost:3000](http://localhost:3000).

### Model Configuration

Uses a cascaded pipeline orchestrated by Pipecat inside Tavus:

**Audio In -> Noise Cancellation (local) -> VAD -> STT -> LLM -> TTS -> Audio Out**

| Layer | Engine | Role |
|---|---|---|
| Noise Cancellation | [Krisp](https://krisp.ai) (local macOS) | Filters background noise via a virtual microphone device |
| VAD | Tavus Sparrow | Turn-taking and interruption detection |
| STT | `tavus-advanced` (via Tavus) | Real-time speech-to-text |
| LLM | `tavus-gpt-oss` (via Tavus) | Reasoning and response generation |
| TTS | `sonic-3` (Cartesia via Tavus) | Natural-sounding speech synthesis |

STT/TTS engines are managed within Tavus. See [Updating the Tavus Persona](#updating-the-tavus-persona) for details.

---

## tavus-pipecat-example (Self-Hosted Pipecat)

A Python Pipecat server with a React frontend. You control the full pipeline in code. Supports two pipeline modes that visitors can toggle at the kiosk:

- **Cascaded**: Deepgram STT -> Bedrock Claude -> Cartesia TTS (best-of-breed at each layer)
- **Nova Sonic**: Amazon Nova 2 Sonic speech-to-speech on Bedrock (single model, 15 languages)

Both modes use Tavus for avatar rendering and Pipecat for orchestration.

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- API keys: Deepgram, Cartesia, Tavus, AWS credentials (for Bedrock)

### Getting Started

```bash
cd tavus-pipecat-example

# Backend
python -m venv env && source env/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Set API keys in .env

# Frontend
cd frontend && npm install && cd ..

# Run both
python tavus-pipecat.py --transport webrtc --host 0.0.0.0 --port 7860 &
cd frontend && npm start     # Frontend on port 3000
```

Open [http://localhost:3000](http://localhost:3000). Click **Start demo**, choose a pipeline mode, and begin.

### Pipeline Architecture

**Cascaded mode:**
```
Audio In -> Deepgram Nova 3 STT -> Bedrock Claude LLM -> Cartesia TTS -> Tavus Avatar -> Audio/Video Out
```

**Nova Sonic mode:**
```
Audio In -> Amazon Nova 2 Sonic (STT+LLM+TTS) -> Tavus Avatar -> Audio/Video Out
```

### Environment Variables

| Variable | Description |
|---|---|
| `DEEPGRAM_API_KEY` | Deepgram API key (cascaded STT) |
| `CARTESIA_API_KEY` | Cartesia API key (cascaded TTS) |
| `TAVUS_API_KEY` | Tavus API key (avatar) |
| `TAVUS_REPLICA_ID` | Tavus replica for cascaded mode |
| `TAVUS_REPLICA_ID_NOVA_SONIC` | Tavus replica for Nova Sonic mode (different avatar) |
| `DAILY_API_KEY` | Daily.co API key (required for cloud deployment with Daily transport) |
| `REACT_APP_TRANSPORT` | WebRTC transport (`daily` or `webrtc`). Set automatically by CI/CD — not user-configured. |
| `AWS_REGION_NOVA_SONIC` | AWS region for Nova Sonic (default: `ap-northeast-1`) |
| `AWS_ACCESS_KEY_ID` | AWS credentials (optional if using default credential chain) |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials (optional if using default credential chain) |

### Deploying to AWS

The Pipecat demo deploys to AWS with a GitHub Actions CI/CD pipeline that triggers **only** on changes to `tavus-pipecat-example/` or `prompts/`.

**Architecture:**
- **Backend**: ECS Fargate (Docker container) behind an ALB
- **Frontend**: S3 + CloudFront (static React build)
- **CloudFront**: Serves frontend and proxies `/api/*` to the ALB (single HTTPS domain)
- **Secrets**: SSM Parameter Store (SecureString)
- **Transport**: Daily.js for cloud (reliable WebRTC relay), SmallWebRTC for local dev

#### 1. Store API keys in SSM Parameter Store

```bash
aws ssm put-parameter --name /tavus-pipecat/DEEPGRAM_API_KEY --type SecureString --value "your-key"
aws ssm put-parameter --name /tavus-pipecat/CARTESIA_API_KEY --type SecureString --value "your-key"
aws ssm put-parameter --name /tavus-pipecat/TAVUS_API_KEY --type SecureString --value "your-key"
aws ssm put-parameter --name /tavus-pipecat/TAVUS_REPLICA_ID --type SecureString --value "your-replica-id"
aws ssm put-parameter --name /tavus-pipecat/TAVUS_REPLICA_ID_NOVA_SONIC --type SecureString --value "your-replica-id"
aws ssm put-parameter --name /tavus-pipecat/DAILY_API_KEY --type SecureString --value "your-daily-api-key"
```

#### 2. Deploy infrastructure (one-time)

```bash
aws cloudformation deploy \
  --template-file tavus-pipecat-example/infra/template.yaml \
  --stack-name tavus-pipecat \
  --parameter-overrides \
    VpcId=vpc-xxx \
    PublicSubnetIds=subnet-aaa,subnet-bbb \
  --capabilities CAPABILITY_NAMED_IAM
```

Note the outputs — you'll need them for GitHub Actions secrets.

#### 3. Set up GitHub Actions OIDC

Create a GitHub OIDC identity provider and IAM role so GitHub Actions can assume credentials without static keys:

```bash
# Create OIDC provider (one-time per account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create IAM role with trust policy for your repo, then attach
# ECR, ECS, S3, and CloudFront permissions (see infra/template.yaml)
```

#### 4. Configure GitHub Actions secrets

| Secret | Value (from CloudFormation outputs) |
|---|---|
| `AWS_ROLE_ARN` | IAM role ARN for GitHub Actions OIDC |
| `S3_BUCKET_NAME` | `FrontendBucketName` output |
| `CLOUDFRONT_DISTRIBUTION_ID` | `CloudFrontDistributionId` output |

#### 5. Push to deploy

The workflow at `.github/workflows/deploy-pipecat.yml` runs automatically on push to `main` when files in `tavus-pipecat-example/` or `prompts/` change. It:

1. Builds the Docker image and pushes to ECR
2. Forces a new ECS Fargate deployment and waits for stability
3. Builds the React frontend (with `REACT_APP_API_URL=''` for same-origin CloudFront)
4. Syncs to S3 and invalidates the CloudFront cache

The frontend and backend deploy in parallel. Access the demo at the CloudFront domain (`CloudFrontDomainName` output).

> **Note:** Regenerate `frontend/package-lock.json` with Node 20 (`fnm use 20 && npm install`) to match CI. The first CloudFormation deploy is slow (~15 min) as the ECS service waits for a Docker image — subsequent deploys via CI/CD are faster.

---

## Shared Resources

### System Prompt

Both implementations use `prompts/tavus-system-instruction-1.md` as the system prompt. It contains booth context, demo architecture knowledge, AWS services info, voice AI use cases, FAQs, and Nova Sonic details.

### Tool Calls

Both implementations support three tools:

- **show_content** — Display content overlays (architecture diagram, voice AI overview, use cases)
- **show_schedule** — Show summit schedule as markdown tables
- **dismiss_content** — Return to full-screen avatar view

### Content Pages

Static HTML content pages are served from `tavus-pipecat-example/frontend/public/content/` and `tavus-avatar/src/app/content/`.

---

## Electron Kiosk Shell

The `agent-kiosk-shell/` directory contains a generic Electron wrapper for running either demo in a borderless full-screen kiosk window. It appends `autostart=1&shell=electron` so sessions start immediately.

```bash
cd agent-kiosk-shell
npm install
cp .env.example .env

# Local dev
npm start -- --target-url=http://localhost:3000

# Deployed app
npm start -- --target-url=https://your-app.vercel.app --display-number=2
```

**Keyboard shortcuts:**
- `Cmd+R` — Reload
- `Cmd+B` — Show disconnected screen
- `Cmd+Q` — Quit

---

## Noise Cancellation

Noise cancellation runs locally on the kiosk Mac using [Krisp](https://krisp.ai), not inside the pipeline:

1. Install the [Krisp desktop app](https://krisp.ai).
2. Enable Noise Cancellation for the microphone.
3. In macOS System Settings -> Sound -> Input, select **Krisp Microphone**.
4. The browser uses the Krisp virtual mic automatically.

---

## Guidance for Voice Agents

This demo promotes the [Guidance for Voice Agents on AWS](https://github.com/aws-samples/sample-voice-agent) reference architecture. Ask the avatar "show me the voice agent guidance" to display it.

---

## Usage

1. Click **Start demo** on the landing page.
2. Grant microphone permissions when prompted.
3. Speak with the AI avatar in real-time.
4. Ask the avatar to show content (e.g., "show me the architecture diagram").
5. Press **End** or **Escape** to end the session.

**Keyboard shortcuts:**
- `Ctrl+D` — Toggle microphone mute
- `Ctrl+F` — Cycle microphone devices (tavus-avatar only)
- `Ctrl+G` — Cycle speaker devices (tavus-avatar only)

---

## Updating the Tavus Persona

For `tavus-avatar` only. The persona's system prompt, tools, and engines are managed via the Tavus API.

### Update the system prompt

```bash
SYSTEM_PROMPT=$(python3 -c "import json; print(json.dumps(open('prompts/tavus-system-instruction-1.md').read()))")

curl -X PATCH "https://tavusapi.com/v2/personas/$TAVUS_PERSONA_ID" \
  -H "x-api-key: $TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "[{\"op\": \"replace\", \"path\": \"/system_prompt\", \"value\": $SYSTEM_PROMPT}]"
```

### Sync tool definitions

```bash
curl -X POST "http://localhost:3000/api/persona/setup-tools"
```

### Change STT/TTS engines

```bash
curl -X PATCH "https://tavusapi.com/v2/personas/$TAVUS_PERSONA_ID" \
  -H "x-api-key: $TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"op": "replace", "path": "/layers/stt/stt_engine", "value": "tavus-advanced"}]'
```

---

## Project Structure

```
prompts/                          # Shared system prompts and knowledge base documents
agent-kiosk-shell/                # Generic Electron kiosk wrapper
tavus-avatar/                     # Tavus hosted CVI (Next.js)
  src/
    app/
      api/conversation/           # Create/end Tavus conversation sessions
      api/persona/setup-tools/    # Patch persona tool definitions
      content/                    # Embeddable overlay pages
    components/                   # React components
    lib/                          # Tavus API client, persona/tool configs
    types/                        # TypeScript type definitions
tavus-pipecat-example/            # Self-hosted Pipecat pipeline (Python + React)
  tavus-pipecat.py                # Pipecat bot (dual pipeline: cascaded + Nova Sonic)
  requirements.txt                # Python dependencies
  frontend/                       # React frontend
    src/
      components/                 # VideoConversation UI
      webrtc-client.js            # WebRTC client
    public/
      content/                    # Static content overlay pages
```

## Tech Stack

- **tavus-avatar**: Next.js 16 / React 19 / TypeScript / Tailwind CSS v4 / Daily.js / Tavus API
- **tavus-pipecat-example**: Python / Pipecat / Deepgram / Cartesia / Amazon Bedrock / Amazon Nova Sonic / Tavus / React
- **Shared**: Tavus avatar rendering, Pipecat orchestration, AWS infrastructure
