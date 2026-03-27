const useCases = [
  {
    industry: "Financial Services",
    useCase:
      "Account servicing, wire transfers, fraud alerts, and routine banking requests with full audit trails.",
    badge: "SOX/PCI on AWS",
  },
  {
    industry: "Healthcare",
    useCase:
      "Patient intake, clinical documentation, appointment scheduling, and triage routing.",
    badge: "HIPAA eligible",
  },
  {
    industry: "Insurance",
    useCase:
      "Claims intake (First Notice of Loss), policy servicing, renewal outreach, and adjuster scheduling.",
    badge: null,
  },
  {
    industry: "Retail / QSR",
    useCase:
      "Drive-through ordering, customer support, returns and refunds, and upsell recommendations.",
    badge: null,
  },
  {
    industry: "Telecom",
    useCase:
      "Technical support diagnostics, plan changes, outage notifications, and billing questions.",
    badge: null,
  },
  {
    industry: "Travel & Hospitality",
    useCase:
      "Reservations, disruption rebooking, multilingual concierge, and loyalty program support.",
    badge: null,
  },
  {
    industry: "Government",
    useCase:
      "Citizen services, benefits enrollment, permit applications, and multilingual support.",
    badge: "FedRAMP on GovCloud",
  },
  {
    industry: "Energy & Utilities",
    useCase:
      "Outage reporting, billing support, payment plans, and surge call handling during weather events.",
    badge: null,
  },
  {
    industry: "Education",
    useCase:
      "Enrollment support, financial aid, course registration, and voice-based tutoring.",
    badge: null,
  },
  {
    industry: "Any Industry",
    useCase:
      "Inbound support, outbound engagement, appointment booking, IT helpdesk, and live transcription.",
    badge: null,
  },
];

export default function CommonUseCasesPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(180deg,_#f6fbff_0%,_#e7f1fb_100%)] px-8 py-10 text-slate-950">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-8">
        <div className="rounded-[2rem] border border-sky-200/80 bg-white/80 p-8 shadow-[0_24px_90px_rgba(7,15,43,0.12)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
            Voice AI on AWS
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-950">
            Use Cases by Industry
          </h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
            Voice agents are transforming customer and employee interactions
            across every industry. Here are common use cases that can be built
            with the same architecture powering this demo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {useCases.map((item) => (
            <article
              className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-6 shadow-[0_12px_48px_rgba(7,15,43,0.08)]"
              key={item.industry}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-semibold text-slate-950">
                  {item.industry}
                </p>
                {item.badge ? (
                  <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sky-700">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {item.useCase}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
