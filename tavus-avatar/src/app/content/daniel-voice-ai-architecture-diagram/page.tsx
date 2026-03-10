import Image from "next/image";

import { ExpandableQr } from "@/components/expandable-qr";

export default function DanielVoiceAiArchitectureDiagramPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#06101b_0%,_#02060d_100%)] p-6">
      <figure className="flex w-full max-w-7xl flex-col gap-4">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
          <Image
            alt="Daniel's voice AI architecture diagram"
            className="h-auto w-full object-contain"
            height={1040}
            src="/content/reference-architecture-pipecat.png"
            width={1440}
          />
        </div>
        <figcaption className="text-center text-xs uppercase tracking-[0.28em] text-slate-300/80">
          Daniel&apos;s Voice AI Architecture Diagram
        </figcaption>
      </figure>
      <div className="mt-6 flex items-center gap-6">
        <a
          className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/12 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
          href="https://github.com/aws-samples/sample-voice-agent"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get started on GitHub
          <span aria-hidden="true">&rarr;</span>
        </a>
        <ExpandableQr
          alt="Scan to open on GitHub"
          href="https://github.com/aws-samples/sample-voice-agent"
          src="/content/qr-voice-agent-guidance.png"
        />
      </div>
    </main>
  );
}
