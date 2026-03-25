import Image from "next/image";

import { ExpandableQr } from "@/components/expandable-qr";

export default function GuidanceVoiceAgentsAwsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#06101b_0%,_#02060d_100%)] p-6">
      <div className="grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[1fr_auto]">
        {/* Diagram */}
        <figure className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
            <Image
              alt="Guidance for voice agents on AWS"
              className="h-auto w-full object-contain"
              height={720}
              src="/content/guidance-voice-agents-aws.png"
              width={1280}
            />
          </div>
          <figcaption className="text-center text-xs uppercase tracking-[0.28em] text-slate-300/80">
            Guidance for Voice Agents on AWS
          </figcaption>
        </figure>

        {/* Call to action */}
        <div className="flex flex-col items-center gap-6 lg:min-w-[220px]">
          <a
            className="inline-flex items-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-400/12 px-7 py-3.5 text-base font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
            href="https://github.com/aws-samples/sample-voice-agent"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Star this repo
          </a>
          <ExpandableQr
            alt="Scan to open on GitHub"
            href="https://github.com/aws-samples/sample-voice-agent"
            src="/content/qr-voice-agent-guidance.png"
          />
        </div>
      </div>
    </main>
  );
}
