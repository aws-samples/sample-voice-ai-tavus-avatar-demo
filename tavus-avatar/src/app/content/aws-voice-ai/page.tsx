const architectureSteps = [
  {
    title: "Speech Pipeline",
    body: "Daily transports real-time audio and video, while Tavus renders the avatar and receives visual context from the camera feed.",
  },
  {
    title: "Reasoning Layer",
    body: "Amazon Bedrock handles language understanding and response generation with tool calls available for screen control.",
  },
  {
    title: "Production Pattern",
    body: "The same flow can move from a private booth demo to a local Electron app with minimal UI changes.",
  },
];

const stackHighlights = [
  "Amazon SageMaker AI",
  "Amazon Bedrock",
  "Daily WebRTC",
  "Tavus CVI",
  "NVIDIA speech models",
  "Pipecat orchestration",
];

export default function AwsVoiceAiContentPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(180deg,_#f6fbff_0%,_#e7f1fb_100%)] px-8 py-10 text-slate-950">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.85fr]">
          <div className="rounded-[2rem] border border-sky-200/80 bg-white/80 p-8 shadow-[0_24px_90px_rgba(7,15,43,0.12)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
              AWS Voice AI Overview
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-slate-950">
              Real-time multimodal voice agents on AWS.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              This proof-of-concept page is designed for the Tavus tool-call demo. It is same-origin,
              safe to embed in an iframe, and concise enough to display while the avatar keeps talking
              in the corner overlay.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {architectureSteps.map((step) => (
                <article
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5"
                  key={step.title}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {step.title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{step.body}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_24px_90px_rgba(7,15,43,0.24)]">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
              Demo Stack
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {stackHighlights.map((highlight) => (
                <span
                  className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-slate-100"
                  key={highlight}
                >
                  {highlight}
                </span>
              ))}
            </div>
            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/6 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">
                Suggested prompts
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
                <li>What services are involved in this demo?</li>
                <li>How does Tavus fit into the voice pipeline?</li>
                <li>Can the avatar understand what it sees through the camera?</li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_24px_90px_rgba(7,15,43,0.1)]">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Architecture Snapshot
            </p>
            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
              <p>
                User audio and video enter through Daily WebRTC. Pipecat coordinates the real-time flow,
                Amazon Bedrock handles reasoning, and Tavus renders the visual avatar.
              </p>
              <p>
                The booth scenario is deliberately small and private, but the same architecture scales to
                richer demos, kiosk experiences, or local desktop deployments.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-sky-200 bg-[linear-gradient(140deg,rgba(14,165,233,0.16),rgba(37,99,235,0.08))] p-8 shadow-[0_24px_90px_rgba(7,15,43,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-700">
              Why this page works for the demo
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5">
                <p className="text-base font-semibold text-slate-950">Embeddable</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Same-origin content avoids third-party framing headers that would block the tool-call
                  proof of concept.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5">
                <p className="text-base font-semibold text-slate-950">Concise</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  The content is lightweight enough for the main stage while the Tavus avatar remains
                  visible in a smaller overlay.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
