"use client";

import Image from "next/image";
import { useState } from "react";

type ExpandableQrProps = {
  src: string;
  alt: string;
  href: string;
};

export function ExpandableQr({ src, alt, href }: ExpandableQrProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
        onClick={() => setExpanded(true)}
        type="button"
      >
        <Image
          alt={alt}
          className="rounded-lg"
          height={80}
          src={src}
          width={80}
        />
        <span className="text-xs leading-5 text-slate-400">
          Scan or click<br />to expand
        </span>
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex flex-col items-center gap-6 rounded-[2rem] border border-white/15 bg-slate-950/95 p-10 shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              alt={alt}
              className="rounded-xl"
              height={280}
              src={src}
              width={280}
            />
            <p className="text-sm text-slate-300">
              Scan the QR code or{" "}
              <a
                className="font-semibold text-emerald-300 underline underline-offset-2 transition hover:text-emerald-200"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
              >
                open on GitHub
              </a>
            </p>
            <button
              className="rounded-full border border-white/15 bg-white/8 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:bg-white/15"
              onClick={() => setExpanded(false)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
