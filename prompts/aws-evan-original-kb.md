# GTC 2026 — Voice Agent Knowledge Base

> **Purpose:** This document is the knowledge base for the voice/Tavus agent running at the AWS SageMaker AI booth at NVIDIA GTC 2026. The agent should be able to answer questions about the demo, the technology stack, AWS AI products, partner technologies, voice AI use cases, and guide visitors toward the intake form.

---

## 1. Booth Overview

### Where We Are
- **Booth:** AWS Booth #921, NVIDIA GTC 2026 (indoor); plus AWS Outdoor Booth #8002, House of Kiro
- **Location:** San Jose Convention Center, San Jose, CA
- **Conference dates:** Monday March 16 – Thursday March 19, 2026
- **Our demo (Kiosk 3):** Drop-in demo available all exhibitor hours on **Tuesday March 17** and **Thursday March 19**
- **Demo title:** "Building Real-time Voice Agents Using NVIDIA Speech Models, Pipecat and AWS"
- **What's here:** A live, real-time voice AI agent demo — you're talking to it right now
- **AWS GTC website:** https://aws.amazon.com/events/aws-at-nvidia-gtc26/

### What You're Experiencing
- You are speaking with a real-time voice AI agent built entirely on AWS infrastructure
- Your speech is being transcribed by NVIDIA Nemotron ASR in under 100 milliseconds
- An LLM on Amazon Bedrock is reasoning about your question and generating a response
- NVIDIA TTS is converting that response into natural-sounding speech
- Pipecat (by Daily) is orchestrating the entire pipeline end-to-end
- Tavus is rendering the visual avatar you see on screen
- Krisp is filtering out booth noise so the agent can hear you clearly
- Everything is hosted on Amazon SageMaker AI on AWS

### Our Team
- We are the AWS Voice AI team — we help customers design, build, and deploy production voice agents on AWS
- We work across AWS services (SageMaker, Bedrock, EKS) and partner with leading voice AI companies (NVIDIA, Daily/Pipecat, Tavus, Krisp, and others)

---

## 2. The Demo Architecture

### How This Voice Agent Works

This demo uses a **cascaded voice agent architecture**: speech comes in, gets transcribed to text, an LLM reasons and responds, and text-to-speech converts the response back to audio. The full pipeline runs in real time with sub-800ms voice-to-voice latency.

```
User speaks → Daily WebRTC → Pipecat Pipeline → Audio response
                                   │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              NVIDIA Nemotron   Amazon Bedrock   NVIDIA TTS
              Streaming ASR       (LLM)         Magpie/Super
                    │               │               │
                    └───────┬───────┘───────────────┘
                            ▼
                  Amazon SageMaker AI
                 (BYOC / NIM containers)
```

### The Full Stack

| Layer | Technology | What It Does |
|---|---|---|
| **Orchestration** | Pipecat (by Daily) | Open-source Python framework that chains STT → LLM → TTS into a real-time pipeline. Handles turn-taking, interruptions, and streaming audio. |
| **Speech-to-Text** | NVIDIA Nemotron Speech Streaming ASR | Transcribes spoken audio to text with ~80ms token emission latency. Supports 40+ languages. Cache-aware streaming for efficiency. |
| **LLM** | Amazon Bedrock (model of choice) | The "brain" — reasons about the user's input and generates a response. Supports Claude, Nova, Llama, Mistral, and more via a single API. |
| **Text-to-Speech** | NVIDIA TTS (Magpie / Super) | Converts text responses into natural-sounding speech. Magpie supports 5 languages with 60 voices and emotion variants. Super model is upcoming with enhanced quality. |
| **Compute** | Amazon SageMaker AI | Hosts NVIDIA models using bidirectional streaming BYOC (Bring Your Own Container) with NIM containers. Enterprise-grade autoscaling. |
| **Compute (fallback)** | Amazon EKS | If SageMaker isn't feasible for a specific workload, Amazon Elastic Kubernetes Service provides flexible container orchestration. |
| **Transport / WebRTC** | Daily | Managed WebRTC infrastructure for real-time audio/video streaming between the user's device and the cloud pipeline. |
| **Video Avatar** | Tavus | AI-generated visual avatar that renders a realistic face synchronized with the TTS audio output. |
| **Noise Suppression** | Krisp | Server-side noise cancellation SDK integrated into the Pipecat pipeline. Filters ambient noise so ASR gets clean audio. |
| **Observability** | Amazon CloudWatch | Logging, latency tracking, and monitoring for the full pipeline. |

### Why This Architecture

- **Cascaded pipeline** (ASR → LLM → TTS) gives you full control over each component — swap models, tune latency, add processing steps
- **Open-source orchestration** with Pipecat means no vendor lock-in and full customizability
- **Best-of-breed models** at each layer rather than a single monolithic solution
- **AWS-native compute** with SageMaker and Bedrock for enterprise security, compliance, and scale

---

## 3. AWS AI Products for Voice Agents

### Amazon SageMaker AI
- Fully managed service for building, training, and deploying ML models
- **Key feature for voice AI:** Bidirectional streaming support for real-time inference — critical for voice agents that need to stream audio in and out simultaneously
- **BYOC (Bring Your Own Container):** Deploy any model (including NVIDIA NIMs) in your own container on SageMaker endpoints
- **NIM containers:** NVIDIA's optimized inference containers that simplify deployment of NVIDIA models on SageMaker
- Enterprise-grade autoscaling, A/B testing, model monitoring
- Supported GPU instances: g5, g6, p5, inf2

### Amazon Bedrock
- Fully managed service for accessing foundation models via API
- **Why it matters for voice agents:** The LLM is the "brain" of the voice agent — it understands the user's intent and generates the response
- **Available models:** Claude (Anthropic), Nova (Amazon), Llama (Meta), Mistral, and more
- Single API to access multiple models — swap models without changing code
- **Function calling:** Critical for voice agents that need to take actions (look up orders, book appointments, process payments)
- Runs in your AWS account with enterprise security and data privacy

### Amazon EKS (Elastic Kubernetes Service)
- Managed Kubernetes for container orchestration
- Fallback compute option when workloads need more flexibility than SageMaker endpoints
- Supports GPU node pools for model inference
- Good fit for complex multi-container voice agent deployments

### Amazon CloudWatch
- Monitoring and observability for voice agent pipelines
- Track latency at each pipeline stage (ASR, LLM, TTS)
- Set alarms for latency spikes or error rates
- Log and analyze conversation data for quality improvement

### Other AWS Services Used in Voice AI
- **Amazon S3:** Audio storage, training data, conversation recordings, post-call analytics
- **Amazon Chime SDK:** WebRTC and PSTN/SIP connectivity for telephony-based voice agents
- **AWS Lambda:** Serverless business logic, webhooks, and function calling backends
- **Amazon VPC / PrivateLink:** Secure networking for enterprise deployments
- **AWS Global Accelerator:** Edge routing to reduce latency variance for real-time applications

---

## 4. Partner Technologies

### Pipecat (by Daily)
- **What it is:** Open-source Python framework for building real-time voice AI agents
- **License:** BSD (fully open source)
- **GitHub:** github.com/pipecat-ai/pipecat
- **What it does:**
  - Orchestrates the full voice pipeline: STT → LLM → TTS
  - Handles the hard parts of real-time voice: turn-taking, interruption handling, streaming audio, multi-model coordination
  - Pipeline-based architecture — chain together services like building blocks
  - Supports multiple STT providers (NVIDIA, Deepgram, Whisper, Azure), TTS providers (NVIDIA, ElevenLabs, Cartesia, PlayHT), and LLM providers (Bedrock, OpenAI, Anthropic, Google)
- **Built by Daily:** Daily provides the underlying WebRTC transport infrastructure. Pipecat is transport-agnostic but uses Daily by default.
- **Why we chose it:** Production-proven, open source, no lock-in, active community, and the most mature orchestration framework for voice agents

### Daily
- **What it is:** Real-time video and audio infrastructure as a service
- **What it does:** Provides the WebRTC transport layer that carries audio between the user's device and the cloud-based Pipecat pipeline
- **Also provides:** SIP/PSTN telephony integration, recording (WebRTC track recording, direct S3 upload), and managed TURN servers
- **Relationship to Pipecat:** Same company — Daily built Pipecat and maintains it. Daily handles transport, Pipecat handles AI orchestration.

### NVIDIA (Speech Models)
- **Nemotron Speech Streaming ASR:**
  - Next-generation speech-to-text model (rebranded from Parakeet)
  - ~80ms token emission latency with cache-aware streaming
  - Supports up to 40 languages (14+ high-quality at GTC launch)
  - 3x more concurrent sessions per GPU compared to prior generations
  - No accuracy degradation from streaming (vs. batch processing)
- **NVIDIA TTS — Magpie:**
  - Current production TTS model
  - 5 languages (English, Spanish, French, German, Chinese)
  - 60 voices with emotion variants (Angry, Calm, Happy, Neutral, Sad, Fearful)
- **NVIDIA TTS — Super model:**
  - Upcoming next-generation TTS with enhanced naturalness and quality
  - Expected to significantly improve voice realism
- **NIM containers:** NVIDIA's optimized inference containers that package models with TensorRT optimization for easy deployment on AWS (SageMaker, EKS, EC2)

### Tavus
- **What it is:** AI video avatar platform
- **Website:** tavus.io
- **What it does:** Renders a realistic visual avatar that syncs lip movements and facial expressions with the TTS audio output
- **Why we use it:** Adds a visual "face-to-face" element to the voice agent experience, making booth interactions more engaging
- **Built on AWS:** Tavus runs its production infrastructure on AWS

### Krisp
- **What it is:** AI-powered noise cancellation SDK
- **Website:** krisp.ai
- **What it does:** Filters background noise from audio in real-time so the ASR model receives clean speech
- **Integration:** Runs server-side within the Pipecat pipeline (not on the user's device)
- **Why it matters:** Conference booth environments are noisy — without noise cancellation, ASR accuracy degrades significantly

---

## 5. Voice AI Use Cases

### Horizontal (Cross-Industry)

**Inbound Customer Support**
Answers customer questions, resolves issues, and only escalates to a human when truly needed. Can look up orders, make account changes, process refunds, and handle returns using function calling to connect with backend systems. Achieves complete call containment for common request types.

**Outbound Engagement**
Proactively calls customers for lead qualification, appointment reminders, payment collection, survey completion, and follow-ups. Scales to thousands of concurrent calls. Handles objections and schedules callbacks naturally.

**Appointment Booking & Scheduling**
Natural language scheduling — checks availability, books appointments, reschedules, cancels, and sends confirmations. Integrates with calendaring systems like Google Calendar, Microsoft Outlook, or custom scheduling APIs.

**Order Taking**
Voice-driven ordering for QSR (quick service restaurants), retail, and hospitality. Handles menu navigation, item customization, upsell suggestions, combo recommendations, and payment processing. Works for drive-through, phone, and in-app ordering.

**IT Helpdesk / Internal Support**
Employee-facing voice agent for password resets, ticket creation and status checks, knowledge base Q&A, system status updates, and common IT troubleshooting. Reduces internal support costs and wait times.

**Real-Time Transcription & Note-Taking**
Live transcription of meetings, calls, or consultations with speaker diarization (who said what), automatic summary generation, and action item extraction. Useful for sales calls, medical consultations, legal depositions, and internal meetings.

**Voice-Enabled Search & Navigation**
Hands-free information retrieval for field workers, warehouse staff, drivers, or accessibility use cases. Ask a question by voice, get an answer by voice — no screen or keyboard needed.

**Multilingual Concierge**
Automatically detects the caller's language (40+ supported with Nemotron ASR) and responds in that language natively. No IVR language selection menus. Ideal for global businesses, hospitality, and public services.

### Industry-Specific

**Healthcare — Patient Intake & Triage**
Collect symptoms, medical history, medication lists, and insurance information before appointments. Route urgent cases to clinical staff. Run on AWS with HIPAA-compliant infrastructure.

**Healthcare — Clinical Documentation**
Real-time transcription of doctor-patient conversations into structured clinical notes (SOAP format). Reduces physician documentation burden and after-hours charting.

**Financial Services — Account Servicing & Wire Transfers**
Authenticate callers via voice or knowledge-based verification, process wire transfers, explain account statements, and handle routine banking requests. SOX and PCI-compliant with full audit trails on AWS.

**Insurance — Claims Intake & Investigation**
Walk claimants through First Notice of Loss (FNOL), gather incident details and documentation, schedule adjusters, and provide status updates. Reduce claims cycle time and improve claimant experience.

**Telecom — Technical Support & Provisioning**
Troubleshoot connectivity issues with guided diagnostics, process plan changes and upgrades, schedule technician visits, and handle billing questions. Reduce average handle time by 40%+.

**Retail / QSR — Drive-Through & Phone Ordering**
Natural voice ordering with full menu awareness, modifier handling (no pickles, extra cheese), combo and upsell suggestions, and integrated payment processing. Consistent experience across all locations.

**Travel & Hospitality — Reservation Management**
Book, modify, or cancel hotel, flight, and rental car reservations. Provide real-time availability and pricing. Handle disruption rebooking (cancelled flights, overbooked hotels) with empathy and efficiency.

**Government / Public Sector — Citizen Services**
Benefits enrollment assistance, permit and license applications, FAQ handling, and appointment scheduling for government offices. Multilingual support for diverse populations. FedRAMP-compliant on AWS GovCloud.

**Energy & Utilities — Outage Reporting & Billing**
Report outages and get estimated restoration times, explain utility bills, set up payment plans, and handle high-volume call surges during weather events or service disruptions.

**Education — Student Services & Tutoring**
Enrollment support, financial aid Q&A, course registration assistance, and interactive voice-based tutoring and language practice. Available 24/7 during peak enrollment periods.

---

## 6. Key Technical Concepts

### What is a Voice Agent?
A voice agent is an AI system that can have a real-time spoken conversation with a human. It listens to speech, understands intent, reasons about what to do, and responds with natural-sounding speech — all in under a second. Unlike traditional IVRs (Interactive Voice Response systems) that follow rigid scripts and menu trees, voice agents use large language models to understand context, handle complex requests, and take actions.

### Cascaded Architecture vs. End-to-End
- **Cascaded (what we use):** Separate models for STT, LLM, and TTS connected in a pipeline. Gives full control over each component — you can swap models, optimize latency per stage, and debug issues at each layer.
- **End-to-end:** A single model that takes audio in and produces audio out directly. Simpler but less flexible, harder to debug, and currently less mature for production use.
- We use cascaded because it gives enterprises the control and flexibility they need for production deployments.

### Latency Budget
- The target for natural conversation is **under 800ms voice-to-voice latency** (from when the user stops speaking to when they hear the response begin)
- Breakdown: ASR ~100ms, LLM first token ~350ms, TTS first audio ~120ms, plus network overhead
- This is achievable today with the stack we're demonstrating

### Turn-Taking & Interruptions
- Voice agents must handle natural conversation dynamics: knowing when the user is done speaking, handling interruptions ("actually, never mind"), and managing overlapping speech
- Pipecat handles this with Voice Activity Detection (VAD) using Silero, configurable pause thresholds, and cancellable pipeline stages
- When a user interrupts, the current TTS output is cancelled and the pipeline restarts with the new input

### Function Calling
- Voice agents become truly useful when they can take actions — not just talk
- Function calling lets the LLM invoke backend APIs: look up an order, check appointment availability, process a payment, create a support ticket
- Amazon Bedrock supports function calling natively across multiple model providers

---

## 7. Why Build on AWS?

### Enterprise-Grade Infrastructure
- Run voice agents in your own VPC with full network control
- HIPAA, SOX, PCI, FedRAMP, and other compliance frameworks supported
- Data stays in your AWS account — no third-party data sharing for model inference via Bedrock

### Scale
- SageMaker autoscaling handles traffic spikes (think: utility company during a storm, airline during a disruption)
- Bedrock scales automatically with no infrastructure management
- Deploy globally across AWS regions for low-latency access worldwide

### Flexibility
- **Best-of-breed model selection:** Choose the best STT, LLM, and TTS for your use case and swap them as better models emerge
- **Open-source orchestration:** Pipecat is BSD-licensed — no proprietary lock-in
- **Multiple compute options:** SageMaker endpoints, EKS clusters, EC2 instances — use what fits your workload
- **Any channel:** Phone (via Chime SDK or third-party telephony), web (via WebRTC), in-app, kiosk, or avatar

### Cost
- Pay-per-use pricing across SageMaker, Bedrock, and all AWS services
- No upfront commitments required (though reserved capacity is available for predictable workloads)
- Significant cost reduction vs. human agent staffing for high-volume, routine interactions

---

## 8. Getting Started

### Three Paths to Production

**Path 1: Try It Now (Days)**
Deploy our reference architecture using a CloudFormation template. Swap in your own models, system prompts, and backend integrations. Get a working voice agent prototype in days, not months.
- Reference repo: github.com/fciannella/nemotron-speech-demos
- Pipecat framework: github.com/pipecat-ai/pipecat

**Path 2: Build With Us (Weeks)**
Engage the AWS Voice AI team for a hands-on architecture review. We'll help you select the right models for your use case, design your pipeline, plan your deployment, and get to production.

**Path 3: Go Deeper (Ongoing)**
Joint workshops with AWS, NVIDIA, and Pipecat for enterprise-scale voice agent design, optimization, and deployment. Ongoing support for tuning latency, improving quality, and scaling to production traffic.

### Next Step
Tell us about your use case via our intake form and we'll follow up with architecture guidance, model recommendations, and a path to production:

**Intake form:** https://app.smartsheet.com/b/form/019c9c91dc4971558355de2878aace8c

---

## 9. FAQs the Agent Should Handle

**Q: What models are you using?**
A: NVIDIA Nemotron for speech-to-text, Amazon Bedrock for the LLM (you can choose Claude, Nova, Llama, Mistral, or others), and NVIDIA TTS (Magpie today, Super model coming soon) for text-to-speech. All orchestrated by the open-source Pipecat framework.

**Q: Is this running live on AWS right now?**
A: Yes — everything you're experiencing is running in real time on Amazon SageMaker AI and Amazon Bedrock. This is not a recording or a mockup.

**Q: How fast is it?**
A: The full pipeline runs with sub-800 millisecond voice-to-voice latency. The ASR alone transcribes speech in about 80-100 milliseconds.

**Q: Can I use different models?**
A: Absolutely. The stack is modular — you can swap the STT, LLM, or TTS models independently. Pipecat supports multiple providers at each layer.

**Q: What about telephony? Can this handle phone calls?**
A: Yes. Daily provides SIP/PSTN connectivity alongside WebRTC. You can also integrate with Amazon Chime SDK or third-party telephony providers like Twilio, Vonage, or Telnyx.

**Q: Is this HIPAA compliant?**
A: The AWS infrastructure (SageMaker, Bedrock, VPC) supports HIPAA compliance when configured correctly with a signed BAA. We can help you architect a compliant deployment.

**Q: How much does it cost?**
A: It depends on your volume and model choices. AWS services are pay-per-use. A typical voice agent call costs a fraction of a human agent call. We can do a cost analysis for your specific use case — just fill out the intake form.

**Q: What's Pipecat?**
A: Pipecat is an open-source Python framework for building real-time voice AI agents, created by Daily. It handles the orchestration complexity — turn-taking, interruptions, streaming audio, multi-model coordination. It's BSD-licensed with a growing community.

**Q: Can this work in multiple languages?**
A: Yes. NVIDIA Nemotron ASR supports up to 40 languages with automatic language detection. The TTS currently supports 5 languages with more coming. The agent can detect what language you're speaking and respond in that language.

**Q: How do I get started?**
A: The fastest way is to scan the QR code or visit our intake form. Tell us about your use case and we'll follow up with architecture guidance and next steps. You can also deploy our open-source reference architecture today from GitHub.

**Q: What's the visual avatar?**
A: That's Tavus — an AI video avatar platform that generates a realistic face synchronized with the speech output. It makes the voice agent experience more engaging and personal. Tavus runs on AWS infrastructure.

**Q: What about background noise?**
A: We use Krisp for server-side noise cancellation. It runs inside the Pipecat pipeline and filters out ambient noise before the audio reaches the ASR model. Critical for noisy environments like conference booths, call centers, or drive-throughs.

**Q: What else should I see at the AWS booth?**
A: There are over 40 demos across 11 indoor kiosks plus the outdoor House of Kiro. I can tell you what's happening today, recommend demos by topic, or walk you through the full schedule. Just ask!

**Q: Where is the AWS booth?**
A: The main AWS booth is Booth #921 inside the convention center. There's also an outdoor booth, #8002, called the House of Kiro. You're at Kiosk 3 in the SageMaker AI area right now.

---

## 10. AWS at GTC — Full Booth & Kiosk Directory

AWS has over 40 demos at GTC 2026 across indoor Booth #921 and outdoor Booth #8002.

### Indoor Booth #921 — Kiosk Map

| Kiosk | Area | Demos |
|---|---|---|
| **0** | Physical AI / Manufacturing | Humanoid Demo: AWS Swag Factory (all days) |
| **1** | Amazon Nova | 1. Build Your Own Frontier Models with Nova Forge (Wed, Thu) |
| | | 2. Inside Amazon's Future: A VR Journey Through AI-Powered Amazon Fulfillment (Mon, Tue) |
| **2** | Startup Showcase | Rotating schedule — see daily schedule below. Features: Deepgram, Monte Carlo, LinearGame, PolyAI, AdaptiveML, Deepdub, Doe Labs, Moments Lab, Arize, Xgrids |
| **3** | Amazon SageMaker AI | 1. EAGLE-based Speculative Decoding Using Blackwell GPUs on Amazon SageMaker (Mon, Wed) |
| | | **2. Building Real-time Voice Agents Using NVIDIA Speech Models, Pipecat and AWS (Tue, Thu) — THIS IS US** |
| **4** | Research Agent (FSI) | 1. Scaling "AI Researcher" for Financial Services with NVIDIA AI-Q and RAG Blueprint on Amazon EKS (Mon, Tue) |
| | | 2. Hybrid Enterprise Agentic AI: Bridging Amazon Quick and NVIDIA NIM for Multi-Agent Orchestration (Wed, Thu) |
| **5** | AI Competency Partners | Rotating schedule — features: Snowflake, Deepchecks, Thoughtworks, Mistral AI, Pariveda, Fireworks AI, Zilliz, Deepset |
| **6** | Ring / IoT | 1. Ring: From Edge to Enterprise — AI-Powered Computer Vision (Mon–Thu) |
| | | 2. Agentic Smart Machines with Strands Agents and NVIDIA — Assisted Maintenance with mini excavator (Mon–Wed) |
| **7** | Amplifier Partner Solutions | Rotating schedule — features: EXL, Reply, Rescale, Capgemini, Softserve, Innoactive/Roche |
| **8** | EMR / EKS | 1. Accelerating Data Pipelines with Amazon EMR on EKS and NVIDIA (Mon, Tue) |
| | | 2. Build Resilient EKS Cluster with GPUs for Large-scale ML Training and Inference (Wed, Thu) |
| **9** | Telco (6G) / Retail | 1. 6G Born in the Cloud: Accelerating AI-Native Networks (Mon, Tue) |
| | | 2. AR/VR Glasses: NextGen Shopping Experience with Qualcomm and SoftServe (Wed, Thu) |
| **10** | AI Apps & Agents (Bedrock / AgentCore) | 1. Deploying and Optimizing Nemotron Open Reasoning Models Using Amazon Bedrock (Mon, Wed) |
| | | 2. Agent Solution Blueprint with Amazon Bedrock AgentCore, Strands Agents and NVIDIA NeMo Agent Toolkit (Tue, Thu) |

### Outdoor Booth #8002 — House of Kiro (All Days)

| Kiosk | Demo |
|---|---|
| **1** | Spec-driven Agentic Software Engineering with Kiro and NVIDIA Nemotron on Amazon Bedrock |
| **2** | Optimizing GenAI Workloads on GPU-based Amazon EC2 instances Using Kiro |

Plus: Scavenger hunt at the Haunted House of KIRO.

### Voice AI-Adjacent Demos Worth Visiting

If you're interested in voice AI, these other demos at the AWS booth are especially relevant:

| Demo | Kiosk | When | Why It's Relevant |
|---|---|---|---|
| Deepgram: Building Real-Time Agentic Voice for Healthcare IVR with Amazon Connect and NVIDIA | 2 | Wed 5–7 PM | Voice AI for healthcare IVR — alternative STT provider, uses Amazon Connect |
| PolyAI: Understanding & Analyzing Customer Conversations at Scale | 2 | Wed 3–5 PM | Enterprise voice conversation analytics at scale |
| Deepdub: Real-Time Emotional Voice AI in Production — Live eTTS Inference on AWS | 2 | Mon 3–5 PM | Emotional text-to-speech on AWS — relevant to TTS quality |
| Pariveda: Voice GenAI Clinical Summary with Transcribe + Bedrock | 5 | Wed 12–3 PM | Voice-powered clinical documentation using AWS services |
| Deploying and Optimizing Nemotron Open Reasoning Models Using Amazon Bedrock | 10 | Mon, Wed (drop-in) | NVIDIA Nemotron models on Bedrock — same model family we use for ASR |
| Agent Solution Blueprint with Bedrock AgentCore, Strands Agents and NeMo | 10 | Tue, Thu (drop-in) | Agentic AI architecture patterns on AWS with NVIDIA |

---

## 11. Daily Schedule — Booth Demos

### Monday, March 16

**Scheduled Demos (specific times):**
| Time | Demo | Kiosk |
|---|---|---|
| 1–3 PM | Doe Labs: The Action Engine — AI Agents That Execute Your Work | 2 |
| 1–4 PM | Cognizant: LookR.AI — Computer Vision for Retail | 5 |
| 1–4 PM | Agentic Smart Machines with Strands Agents and NVIDIA — Assisted Maintenance | 6 |
| 3–5 PM | Deepdub: Real-Time Emotional Voice AI in Production — Live eTTS Inference on AWS | 2 |
| 4–7 PM | Snowflake: Supercharging ML with NVIDIA CUDA-X Libraries | 5 |
| 4–7 PM | Rescale: AI Physics & Agentic Engineering on AWS | 7 |
| 4–7 PM | Ring: From Edge to Enterprise — AI-Powered Computer Vision | 6 |
| 5–7 PM | AdaptiveML: Optimizing LLMs for Enterprise at Scale on AWS | 2 |

**Drop-in Demos (all exhibitor hours):**
- Humanoid Robotics Demo: AWS Swag Factory (Kiosk 0)
- Inside Amazon's Future: VR Journey Through AI-Powered Fulfillment (Kiosk 1)
- EAGLE-based Speculative Decoding Using Blackwell GPUs on SageMaker (Kiosk 3)
- Scaling "AI Researcher" for FSI with NVIDIA AI-Q on Amazon EKS (Kiosk 4)
- Accelerating Data Pipelines with Amazon EMR on EKS and NVIDIA (Kiosk 8)
- 6G Born in the Cloud: Accelerating AI-Native Networks (Kiosk 9)
- Deploying and Optimizing Nemotron Open Reasoning Models Using Amazon Bedrock (Kiosk 10)

---

### Tuesday, March 17

**Scheduled Demos (specific times):**
| Time | Demo | Kiosk |
|---|---|---|
| 12–3 PM | Moments Lab: AI-Powered Video Discovery Platform | 2 |
| 12–3 PM | Fireworks AI: AI Fine-Tuning Agent Powered by NVIDIA on AWS | 5 |
| 12–3 PM | Capgemini: Inside the HERO Car — Digital Twins, Synthetic Data, ADAS | 7 |
| 12–5 PM | Agentic Smart Machines with Strands Agents and NVIDIA — Assisted Maintenance | 6 |
| 3–5 PM | Xgrids: Multi-SLAM and 3DGS Solutions for Digital Twins | 2 |
| 3–5 PM | Zilliz: Agentic Multimodal AI Search on AWS with NVIDIA | 5 |
| 3–5 PM | Reply: Industrial OneLoop — AI Fast Lane for the Industrial Edge | 7 |
| 5–7 PM | LinearGame: Yoroll AI-Native Interactive Video Game | 2 |
| 5–7 PM | Thoughtworks: Graph Neural Networks for Real-Time Fraud Detection | 5 |
| 5–7 PM | EXL: EXLerate.ai Agent Factory — Accelerated Agentic Development at Scale | 7 |
| 5–7 PM | Ring: From Edge to Enterprise — AI-Powered Computer Vision | 6 |

**Drop-in Demos (all exhibitor hours):**
- Humanoid Robotics Demo: AWS Swag Factory (Kiosk 0)
- Inside Amazon's Future: VR Journey Through AI-Powered Fulfillment (Kiosk 1)
- **Building Real-time Voice Agents Using NVIDIA Speech Models, Pipecat and AWS (Kiosk 3) — OUR DEMO**
- Scaling "AI Researcher" for FSI with NVIDIA AI-Q on Amazon EKS (Kiosk 4)
- Accelerating Data Pipelines with Amazon EMR on EKS and NVIDIA (Kiosk 8)
- 6G Born in the Cloud: Accelerating AI-Native Networks (Kiosk 9)
- Agent Solution Blueprint with Bedrock AgentCore, Strands Agents and NeMo (Kiosk 10)

---

### Wednesday, March 18

**Scheduled Demos (specific times):**
| Time | Demo | Kiosk |
|---|---|---|
| 12–3 PM | Arize: AgentCore Observability Demo | 2 |
| 12–3 PM | Pariveda: Voice GenAI Clinical Summary with Transcribe + Bedrock | 5 |
| 12–3 PM | Innoactive/Roche: NVIDIA Omniverse — The Roche Virtual Lab | 7 |
| 12–5 PM | Ring: From Edge to Enterprise — AI-Powered Computer Vision | 6 |
| 3–5 PM | PolyAI: Understanding & Analyzing Customer Conversations at Scale | 2 |
| 3–5 PM | Mistral AI: Enterprise AI That Delivers Real ROI | 5 |
| 3–5 PM | Softserve: Intelligent Video Monitoring | 7 |
| 5–7 PM | Deepgram: Building Real-Time Agentic Voice for Healthcare IVR with Amazon Connect and NVIDIA | 2 |
| 5–7 PM | Deepchecks: Building Trustworthy AI Agents on AWS with NVIDIA | 5 |
| 5–7 PM | Agentic Smart Machines with Strands Agents and NVIDIA — Assisted Maintenance | 6 |
| 5–7 PM | Capgemini: Inside the HERO Car — Digital Twins, Synthetic Data, ADAS | 7 |

**Drop-in Demos (all exhibitor hours):**
- Humanoid Robotics Demo: AWS Swag Factory (Kiosk 0)
- Build Your Own Frontier Models with Nova Forge (Kiosk 1)
- EAGLE-based Speculative Decoding Using Blackwell GPUs on SageMaker (Kiosk 3)
- Hybrid Enterprise Agentic AI: Amazon Quick and NVIDIA NIM for Multi-Agent Orchestration (Kiosk 4)
- Build Resilient EKS Cluster with GPUs for Large-scale ML Training and Inference (Kiosk 8)
- AR/VR Glasses: NextGen Shopping Experience with Qualcomm and SoftServe (Kiosk 9)
- Deploying and Optimizing Nemotron Open Reasoning Models Using Amazon Bedrock (Kiosk 10)

**Note:** Our voice AI demo is NOT running Wednesday (booth rotation day for Kiosk 3).

---

### Thursday, March 19

**Scheduled Demos (specific times):**
| Time | Demo | Kiosk |
|---|---|---|
| 12–3 PM | Monte Carlo: Trusted Agents — Delivering Reliable Data + AI Systems at Scale | 2 |
| 12–3 PM | Deepset: From RAG to Agents — Building Governed Enterprise GenAI on AWS | 5 |
| 12–2 PM | Ring: From Edge to Enterprise — AI-Powered Computer Vision | 6 |

**Drop-in Demos (all exhibitor hours):**
- Humanoid Robotics Demo: AWS Swag Factory (Kiosk 0)
- Build Your Own Frontier Models with Nova Forge (Kiosk 1)
- **Building Real-time Voice Agents Using NVIDIA Speech Models, Pipecat and AWS (Kiosk 3) — OUR DEMO**
- Hybrid Enterprise Agentic AI: Amazon Quick and NVIDIA NIM for Multi-Agent Orchestration (Kiosk 4)
- Build Resilient EKS Cluster with GPUs for Large-scale ML Training and Inference (Kiosk 8)
- AR/VR Glasses: NextGen Shopping Experience with Qualcomm and SoftServe (Kiosk 9)
- Agent Solution Blueprint with Bedrock AgentCore, Strands Agents and NeMo (Kiosk 10)

---

### Outdoor Booth #8002 — House of Kiro (All Days)
- Optimizing GenAI Workloads on GPU-based Amazon EC2 instances Using Kiro
- Spec-driven Agentic Software Engineering with Kiro and NVIDIA Nemotron

---

## 12. AWS Booth Theater Sessions (30-minute talks)

The AWS booth features an in-booth theater with over 30 sessions from AWS specialists and partners.

### Monday, March 16
| Time | Session |
|---|---|
| 1:00–1:30 | NVIDIA Cosmos on AWS: Accelerating Synthetic Data Generation at Scale |
| 1:35–2:05 | Scaling Physical AI: Fine-tuning NVIDIA GR00T Foundation Models on AWS |
| 2:10–2:40 | Unified GenAI Inference Across Cloud and On-Premises: NVIDIA NIM with Amazon EKS Hybrid Nodes |
| 2:45–3:15 | Accelerating Fraud Detection: AWS and NVIDIA AI Blueprint for Financial Services |
| 3:20–3:50 | Enterprise AI at Scale: How NVIDIA Accelerates Innovation through Frictionless LLM Access |
| 3:55–4:25 | Robot Training at Scale: Imitation and Reinforcement Learning at Scale with NVIDIA and AWS |
| 4:30–5:00 | Kiro for Physical AI |
| 5:05–5:35 | Building Trillion-Parameter Foundation Models: AWS SageMaker HyperPod with NVIDIA GB200 NVL72 UltraServers |
| 5:40–6:10 | Making Spark Sweat with RAPIDS on EKS Using GPUs |
| 6:15–6:45 | From Prototype to Production: Deploying Multi-Agent AI Systems with Amazon Bedrock AgentCore and NVIDIA NeMo |

### Tuesday, March 17
| Time | Session |
|---|---|
| 12:00–12:30 | Adaptive Agentic Intelligence Framework (AAIF): Why Small Language Models Are the Future of Agentic AI |
| 12:35–1:05 | From Chatbots to AI Operators: Building Agentic Physical AI with NVIDIA on AWS |
| 1:10–1:40 | Beyond Text: Multimodal Generative AI for the Real World with NVIDIA on AWS |
| 1:45–2:15 | Designing Agentic AI Platforms with MCP, Strands Agents, Amazon Bedrock AgentCore, and NVIDIA on AWS |
| 2:20–2:50 | Modernizing Data Centers into AI Factories for Financial Services |
| 2:55–3:25 | Operating AI-powered Applications with AWS and NVIDIA AIOps Best Practices |
| 3:30–4:00 | How Anyone Can Build AI Applications on AWS with NVIDIA GPUs |
| 4:05–4:35 | Building an AI-accelerated Drug Discovery Pipeline with Amazon HealthOmics and NVIDIA BioNeMo |
| 4:40–5:10 | How DTN Accelerates Operational Weather Prediction Using NVIDIA Earth-2 on AWS |
| 5:15–5:45 | Ring Appstore: Turning Everyday Cameras into Actionable Intelligence |
| 5:50–6:20 | Scaling Agentic AI with NVIDIA NeMo RL on Amazon SageMaker HyperPod: GRPO Training on H100 GPUs |
| 6:25–6:55 | Finetuning Agents for Tool Calling on Amazon SageMaker P5 Instances with NVIDIA H100s and Deploying to AgentCore |

### Wednesday, March 18
| Time | Session |
|---|---|
| 12:35–1:50 | SUP Pitch Competition (75 minutes) |
| 1:55–2:25 | Conversational AI for Automotive Experiences |
| 2:30–3:00 | AI-Driven Robotics Simulation and Training |
| 3:05–3:35 | Securing the Agentic AI Revolution: From Red Teaming to Runtime Protection |
| 3:40–4:10 | A Guide to AWS Compute Options for Your Accelerated Computing Workloads |
| 4:15–4:45 | Breaking Free from SIEM Lock-In: Building an AI-Native Security Data Mesh |
| 4:50–5:20 | Optimizing GenAI Workloads on AWS GPUs Using Kiro |
| 5:25–5:55 | Intelligent Robotics for Everyone: From Natural Language to Robot Actions — One SDK |
| 6:00–6:30 | The Next Frontier in Financial Systems: Transformer-based Foundation Models |

### Thursday, March 19
| Time | Session |
|---|---|
| 11:00–11:30 | Accelerating Industrial Metaverse with Siemens Digital Twin Composer and NVIDIA Omniverse on AWS |
| 11:35–12:05 | Building Intelligent Agents: Amazon Nova + NVIDIA for Frontier Performance at Breakthrough Cost |
| 12:10–12:40 | Day 0 Trusted AI: Automated Red-Teaming with NVIDIA Garak, Amazon Bedrock Guardrails |
| 12:45–1:15 | AI-Driven Mobile Diagnostics with MCE and NVIDIA on AWS |
| 1:20–1:50 | Agent Solution Blueprint with Amazon Bedrock AgentCore, Strands Agents and NVIDIA NeMo Agent Toolkit (NAT) |

---

## 13. AWS GTC Sessions (Main Conference)

| Day | Time | Session | Speakers |
|---|---|---|---|
| Mon Mar 16 | 4:00–4:40 PM | Optimizing the Shopping Experience at Amazon Ads with NVIDIA Dynamo | Muthu Muthukrishnan (VP, Amazon), Runqing Yang (Amazon) |
| Tue Mar 17 | 2:00–2:40 PM | Building the Future of AI Infrastructure: The HUMAIN-AWS AI Factory Partnership | Susmitha Marupaka (AWS), Sukirti Gupta (AWS) |
| Tue Mar 17 | 2:00–2:40 PM | CSO Insights: Driving AI-Optimized Energy Efficiency and Data Center Performance | Christopher Wellise (Equinix), Tenika Versey Walker (NVIDIA), Kara Hurst (Amazon), Jim Andrew (PepsiCo) |
| Wed Mar 18 | 10:00–10:40 AM | Transforming How Vehicles Are Designed, Bought, and Serviced with Agentic AI | Chris Dillon (Cox Automotive), Ozgur Tohumcu (AWS) |
| Wed Mar 18 | 4:00–4:40 PM | Build Fault-Tolerant Distributed AI Training at Scale | Shreya Gupta (NVIDIA), Aravind Neelakantan (AWS) |
| Wed Mar 18 | 4:00–4:40 PM | The Augmented Workforce: Build and Deploy AI Agents for Enterprise XR | Greg Barbone (NVIDIA), + partners |
| Thu Mar 19 | 12:20–12:35 PM | Life Sciences: Scale Multi-Agent for Accelerated Clinical Operation Systems (by Cognizant) | Derek Debe (Abbvie), Gaurav Josan (Clario) |

---

## 14. Ancillary Events & Receptions

### Sunday, March 15
| Time | Event |
|---|---|
| 5–7 PM | Poster Reception — San Jose Civic Center |

### Monday, March 16
| Time | Event |
|---|---|
| 7:30–10 PM | Public Sector Reception |
| 8–10 PM | AWS and Snowflake Physical AI Reception for Startups |

### Tuesday, March 17
| Time | Event |
|---|---|
| 8–10 AM | Nemotron on Amazon Bedrock: Customer Roundtable |
| 8–10:30 AM | Beyond the Hype: Frontier Models in Production — From Training to Revenue |
| **10–11 AM** | **NVIDIA-AWS Solutions for Agentic AI and Voice AI** |
| 10:30 AM–12 PM | AWS AI Factories: Transform Your Infrastructure into AI Innovation Hubs |
| 11 AM–1 PM | AWS x NVIDIA Physical AI Luncheon |
| 12:30–2 PM | From Bench to Breakthrough: AI, Health Care & Life Sciences Networking Event |
| 1:30–3:30 PM | Executive Roundtable on Physical AI and Robotics in Energy |
| 2:30–3:30 PM | NVIDIA-AWS Multi-partner Amplifier Reception |
| 4–5:30 PM | AWS and NVIDIA Automotive & Manufacturing Networking Reception |
| 4–5:30 PM | AdTech & MarTech GTC Networking Event |
| 7–10 PM | AWS Welcome Event |
| 7:30–10:30 PM | LATAM Reception |
| 7:30–9:30 PM | Healthcare & Life Science Reception |

### Wednesday, March 18
| Time | Event |
|---|---|
| 9:30–11:30 AM | Public Sector NV / AWS ISV Roundtable |
| 7–10 PM | Media2 VIP Reception |
| 7:30–9:30 PM | FSI Reception |

**Note:** The "NVIDIA-AWS Solutions for Agentic AI and Voice AI" event on Tuesday 10–11 AM is directly relevant to voice AI — recommend attending if possible.
