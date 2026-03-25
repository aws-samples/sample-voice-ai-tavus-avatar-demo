# Demo Guide: AWS Summit Sydney 2026

Instructions for booth staff running the voice AI demo at the AWS booth.

## Goal

1. **Promote the [Guidance for Voice Agents on AWS](https://github.com/aws-samples/sample-voice-agent)** — get visitors to star the repo and explore the reference architecture.
2. **Educate visitors** on how voice agents work and why AWS is the best place to build them.
3. **Capture leads** — encourage visitors to share their use case via the intake form / QR code.

## Before Visitors Arrive

- Verify the demo is running and the avatar is responding (click **Start demo** or use the Electron kiosk shell).
- Keep the screen visible and the avatar talking — movement and voice draw people in.
- Have the Guidance for Voice Agents QR code printed or visible at the booth.

## Opening the Conversation

Don't explain the demo yourself — **let the agent do the talking**. Your job is to get visitors engaged with the voice agent, not to narrate over it.

**Suggested openers:**

- "Have you tried talking to an AI voice agent before? Step up and say hello — it's live right now."
- "This is a real-time voice agent running entirely on AWS. Try asking it anything about voice AI."
- "Go ahead and introduce yourself — it'll ask your name and company, then you can ask it anything."

The agent's greeting already asks for the visitor's name and company, so you don't need to collect that yourself.

## Guiding the Conversation

Once a visitor is talking to the agent, you can suggest things for them to ask. These prompts are also shown on the start screen.

### To show the reference architecture

> "Ask it to show you the architecture diagram."

The agent will call the `show_content` tool and display the Guidance for Voice Agents diagram with a **Star this repo** call to action. This is your primary conversion moment.

Other phrases that trigger the diagram: "show the diagram", "show the reference architecture", "show the voice agent guidance", "show the AWS guidance".

### To show the summit schedule

> "Ask it what's happening at the summit."

The agent will display a schedule overlay. Good for visitors who are planning their day.

### To dismiss overlays

> "Ask it to go back" or "Say you're done looking."

The agent will return to full-screen video.

### High-value questions to suggest

These lead naturally into the architecture and the guidance repo:

- "How does this voice agent work?"
- "What models are you using?"
- "Can I build something like this myself?"
- "What AWS services do I need for a voice agent?"
- "Can this handle phone calls?"
- "Does it work in other languages?"
- "What industries use voice agents?"

## Key Messages

Keep these in mind when chatting with visitors between agent interactions.

### The 30-second pitch

> "This is a real-time voice agent built on AWS. Speech goes in, gets transcribed by Deepgram, an LLM on Bedrock reasons and responds, and Deepgram converts it back to speech — all in under a second. The whole pipeline is orchestrated by Pipecat, which is open source. We've published a reference architecture so you can build your own."

### Why AWS for voice agents

- **Best-of-breed models** — swap STT, LLM, and TTS independently. No lock-in to a single provider.
- **Enterprise ready** — run in your own VPC with HIPAA, SOX, PCI, and FedRAMP support.
- **Open source orchestration** — Pipecat is BSD-licensed. No proprietary lock-in.
- **Scale** — SageMaker and Bedrock autoscale from a demo to thousands of concurrent calls.

### The call to action

> "We've published a full reference architecture on GitHub — Guidance for Voice Agents on AWS. Star the repo, clone it, and you can have a working voice agent prototype in days. The QR code is right here."

**Repo:** https://github.com/aws-samples/sample-voice-agent

## Common Audience FAQs

Answers you should know in case the visitor asks you directly (the agent can also answer all of these).

### "Is this real or pre-recorded?"

It's 100% live. The agent is transcribing your speech, reasoning with an LLM, and generating audio responses in real time. Try asking it something unexpected.

### "How fast is it?"

Under 800 milliseconds end to end — from when you stop speaking to when you hear the response. That's fast enough for natural conversation.

### "What models are you using?"

Deepgram Nova 3 for speech-to-text, Amazon Bedrock for the LLM (supports Claude, Nova, Llama, Mistral, and others), and Deepgram Aura for text-to-speech. Pipecat orchestrates the pipeline.

### "Can I swap the models?"

Yes. The architecture is modular. You can swap the STT, LLM, or TTS independently. Pipecat supports multiple providers at each layer.

### "Can this handle phone calls?"

Yes. Daily provides SIP and phone connectivity alongside WebRTC. You can also use Amazon Chime SDK or third-party telephony like Twilio.

### "Is this HIPAA compliant?"

The AWS infrastructure (SageMaker, Bedrock, VPC) supports HIPAA compliance when configured with a signed BAA. We can help architect a compliant deployment.

### "How much does it cost?"

It depends on volume and model choices. AWS services are pay-per-use. A typical voice agent call costs a fraction of a human agent call. We can do a cost analysis for your specific use case — fill out the intake form.

### "What about the avatar — do I need that?"

No, the avatar (Tavus) is optional. The core voice agent works without it — it can run as a phone bot, a web widget, or a kiosk. The avatar just makes the booth demo more engaging.

### "What about background noise?"

Krisp provides server-side noise cancellation inside the Pipecat pipeline. It filters out ambient noise before the audio reaches the speech-to-text model. Critical for noisy environments like conference booths, call centers, or drive-throughs.

### "Does it work in other languages?"

Yes. Deepgram Nova 3 supports over 36 languages with automatic language detection.

### "What industries use this?"

Customer support, healthcare (patient intake, clinical documentation), financial services, insurance claims, telecom, retail/QSR ordering, travel and hospitality, government services, education, and more. Ask the agent about use cases — it has detailed examples.

### "How do I get started?"

Three options:
1. **Try it now** — clone the reference architecture from GitHub and deploy with CloudFormation.
2. **Build with us** — engage the AWS Voice AI team for an architecture review.
3. **Go deeper** — joint workshops with AWS, Deepgram, and Pipecat.

Point them to the QR code or the repo: https://github.com/aws-samples/sample-voice-agent

## Common Use Cases by Industry

When a visitor shares what industry they're in, use these talking points to make voice agents concrete and relevant. The agent knows all of these too — suggest the visitor ask *"What are the use cases for voice agents in [their industry]?"*

### Financial Services & Banking

- **Account servicing:** Balance inquiries, transaction disputes, card activations, wire transfers — all handled by voice with identity verification.
- **Loan and mortgage support:** Guide applicants through document requirements, status updates, and rate inquiries without hold queues.
- **Fraud alerts:** Proactive outbound calls to verify suspicious transactions in real time.
- **Compliance:** SOX and PCI compliant on AWS. Full audit trails, data stays in your VPC.

### Healthcare & Life Sciences

- **Patient intake and triage:** Collect symptoms, medical history, medications, and insurance details before appointments. Route urgent cases to clinical staff.
- **Clinical documentation:** Real-time transcription of doctor-patient conversations into structured clinical notes (SOAP format). Reduces after-hours charting.
- **Appointment scheduling:** Book, reschedule, and send reminders by voice — available 24/7.
- **Compliance:** HIPAA-eligible on AWS with a signed BAA. Data stays in your account.

### Insurance

- **Claims intake:** Walk claimants through First Notice of Loss, gather incident details and documentation, schedule adjusters.
- **Policy servicing:** Answer coverage questions, process endorsements, explain bills.
- **Proactive outreach:** Renewal reminders, claims status updates, and weather-event preparedness calls at scale.

### Retail & Quick Service Restaurants

- **Order taking:** Voice-driven ordering for drive-throughs, phone orders, and in-app. Handles menu navigation, customization, upsells, and payment.
- **Customer support:** Order status, returns, refunds, and exchanges without hold times.
- **Store operations:** Inventory checks, shift scheduling, and internal helpdesk via voice.

### Telecommunications

- **Technical support:** Guided diagnostics for connectivity issues, router resets, and signal troubleshooting — resolving issues without a technician visit.
- **Account changes:** Plan upgrades, add-ons, device activations, and billing questions.
- **Outage communication:** Automated outbound calls during service disruptions with estimated restoration times.

### Travel & Hospitality

- **Reservations:** Book, modify, or cancel hotel, flight, and car rental reservations with real-time availability and pricing.
- **Disruption rebooking:** When flights cancel or hotels overbook, the agent handles rebooking with empathy and efficiency at scale.
- **Concierge:** In-room voice assistant for room service, local recommendations, and hotel services. Multilingual for international guests.

### Government & Public Sector

- **Citizen services:** Benefits enrollment, permit applications, FAQ handling, and appointment scheduling for government offices.
- **Multilingual support:** Automatic language detection across 36+ languages — critical for diverse populations.
- **Compliance:** FedRAMP-compliant on AWS GovCloud.

### Energy & Utilities

- **Outage reporting:** Report outages and get estimated restoration times. Handle massive call surges during weather events without adding staff.
- **Billing support:** Explain bills, set up payment plans, and process payments by voice.
- **Field coordination:** Dispatch and schedule technicians, provide job details hands-free.

### Education

- **Student services:** Enrollment support, financial aid questions, course registration, and campus information — available around the clock during peak periods.
- **Tutoring and language practice:** Interactive voice-based tutoring and conversation practice.
- **Administrative automation:** Absence reporting, transcript requests, and IT helpdesk.

### Cross-Industry Use Cases

These apply to virtually every visitor regardless of industry:

| Use case | One-liner |
|---|---|
| **Inbound customer support** | Answer questions, resolve issues, escalate only when needed. Complete call containment for routine requests. |
| **Outbound engagement** | Lead qualification, appointment reminders, payment collection, surveys — thousands of concurrent calls. |
| **Appointment scheduling** | Natural language booking that checks availability, confirms, reschedules, and sends reminders. |
| **IT helpdesk** | Password resets, ticket creation, status checks, and common troubleshooting for employees. |
| **Real-time transcription** | Live meeting transcription with speaker diarization, summaries, and action items. |
| **Multilingual concierge** | Auto-detect the caller's language (36+) and respond natively. No IVR menus. |

### Tailoring the Conversation

When a visitor mentions their industry, connect it:

> *"You're in insurance? One of the biggest use cases we see is claims intake — walking claimants through First Notice of Loss entirely by voice. The agent collects all the details, schedules an adjuster, and follows up. Ask the voice agent about insurance use cases — it can go deeper."*

The goal is always to make it tangible, then point them back to the agent or the reference architecture.

## Troubleshooting During the Demo

| Issue | Fix |
|---|---|
| Avatar not responding | Press `Escape` to end the session, then click **Start demo** again. In kiosk mode, press `Cmd+R` to reload. |
| Audio feedback / echo | Make sure the visitor isn't standing too close to the speaker. The agent has echo cancellation but loud environments can cause issues. |
| Agent can't understand the visitor | Suggest they speak clearly and at a normal pace. Krisp handles background noise but very loud environments can still affect accuracy. |
| Overlay stuck on screen | Ask the agent to "go back" or "dismiss", or press `Escape` to end the session. |
| Screen goes blank | In kiosk mode, press `Cmd+R` to reload. Otherwise refresh the browser. |

## Keyboard Shortcuts

**In the web app:**
- `Escape` — End the session
- `Ctrl+D` — Toggle microphone mute
- `Ctrl+F` — Cycle microphone devices
- `Ctrl+G` — Cycle speaker devices

**In the Electron kiosk shell:**
- `Cmd+R` — Reload
- `Cmd+B` — Show disconnected screen (break mode)
- `Cmd+Q` — Quit
