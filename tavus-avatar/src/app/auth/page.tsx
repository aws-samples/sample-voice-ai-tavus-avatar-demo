"use client";

import { useState } from "react";

export default function AuthPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setErrorMsg(data.error ?? "Invalid token");
      setStatus("error");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-8"
      >
        <h1 className="text-lg font-semibold">Demo access</h1>
        <input
          type="password"
          placeholder="Enter access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="rounded-lg border border-white/15 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          autoFocus
        />
        {status === "error" && (
          <p className="text-sm text-rose-400">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={status === "loading" || !token}
          className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
