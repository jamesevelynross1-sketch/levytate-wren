"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2,
  ChevronRight, Send, ShieldCheck,
} from "lucide-react";
import { ExploreHeader, ExploreFooter } from "./ExploreHome";
import { ExploreAiExplanation } from "./ExploreAiExplanation";
import { getExploreRouteByName, getExploreRouteHref } from "@/lib/levytate/explore/occupational-routes";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";
import {
  EXPLORE_GUIDANCE_CONSENT_TEXT, EXPLORE_MANAGER_CONSENT_TEXT,
  EXPLORE_PRIVACY_URL, type ExploreRequesterType,
} from "@/lib/levytate/explore/policy";

type ContactForm = { fullName: string; email: string; organisation: string; jobTitle: string; note: string; website: string };

const initialContact: ContactForm = { fullName: "", email: "", organisation: "", jobTitle: "", note: "", website: "" };

function ManagerEmail({ standard }: { standard: ExploreStandard }) {
  const [managerEmail, setManagerEmail] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [shareOrigin, setShareOrigin] = useState("https://www.levytate.co.uk");
  useEffect(() => setShareOrigin(window.location.origin), []);
  const subject = "Could we discuss an apprenticeship opportunity?";
  const message = [
    "Hi,",
    "",
    "I've been exploring how I could develop my skills while continuing in my current role, and found an apprenticeship that looks interesting:",
    "",
    standard.title + " (Level " + standard.level + ", " + standard.code + ")",
    "A straightforward explanation: " + shareOrigin + "/explore/" + standard.code.toLowerCase() + "?audience=manager",
    "Official apprenticeship standard: " + standard.officialUrl,
    "",
    personalNote.trim() ? "Why it interests me: " + personalNote.trim() : "I think it could be worth discussing how the learning might apply to my work.",
    "",
    "Could we find a time to talk about whether this would be useful for my role and the team?",
    "",
    "There's no commitment at this stage. LevyTate Explore is free to use, and the apprenticeship would need the organisation's support and an eligibility review.",
    "",
    "Thanks",
  ].join("\n");
  const address = managerEmail.replace(/[^a-zA-Z0-9_+@.\-]/g, "");
  const mailto = "mailto:" + address + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(message);

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm leading-6 text-[#102c3d]/65">
        Create a request in your own email app. You decide when to send it, and we don&apos;t contact your manager behind your back.
      </p>
      <label className="block text-xs font-semibold text-[#102c3d]/70" htmlFor="manager-email">
        Manager&apos;s email <span className="font-normal text-[#102c3d]/45">(optional)</span>
        <input id="manager-email" type="email" placeholder="manager@company.co.uk" value={managerEmail} onChange={e => setManagerEmail(e.target.value)}
          className="mt-2 min-h-[46px] w-full rounded-xl border border-[#102c3d]/15 bg-white px-3 text-sm outline-none focus:border-[#159b8f]" />
      </label>
      <label className="block text-xs font-semibold text-[#102c3d]/70" htmlFor="manager-reason">
        Why does it appeal to you? <span className="font-normal text-[#102c3d]/45">(optional)</span>
        <textarea id="manager-reason" rows={3} maxLength={600} placeholder="I'd like to learn how to..." value={personalNote} onChange={e => setPersonalNote(e.target.value)}
          className="mt-2 w-full resize-y rounded-xl border border-[#102c3d]/15 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#159b8f]" />
      </label>
      <a href={mailto} className="inline-flex min-h-[49px] w-full items-center justify-center gap-3 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:bg-[#1e4960]">
        Open your email draft <ArrowUpRight size={17} aria-hidden="true" />
      </a>
      <p className="text-xs leading-5 text-[#102c3d]/50">
        Your email app opens a draft for you to review. Nothing is automatically sent to the manager or MPR.
      </p>
    </div>
  );
}

function MprContact({ standard, requesterType, enabled }: { standard: ExploreStandard; requesterType: ExploreRequesterType; enabled: boolean }) {
  const [contact, setContact] = useState<ContactForm>(initialContact);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function change<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setContact(current => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || status === "sending") return;
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/levytate-explore/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, code: standard.code, consent, requesterType }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "We couldn't send your request just now.");
      setStatus("success");
      setMessage(result.message || "Your request has been received.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn't send your request just now.");
    }
  }

  if (!enabled) return (
    <div role="status" className="mt-5 rounded-[18px] border border-[#102c3d]/10 bg-[#f2f6f1] p-5">
      <ShieldCheck size={24} className="text-[#117f70]" aria-hidden="true" />
      <h3 className="mt-3 text-lg font-semibold">Guidance enquiries are being prepared.</h3>
      <p className="mt-2 text-sm leading-7 text-[#102c3d]/65">
        This development Preview lets you explore apprenticeships and create a message for your manager, but we are not yet accepting personal enquiries through the app. The service will open when secure record-keeping and privacy checks are complete.
      </p>
      <p className="mt-3 text-xs leading-6 text-[#102c3d]/50">No personal details have been collected or submitted.</p>
    </div>
  );

  if (status === "success") return (
    <div role="status" className="mt-5 rounded-[18px] border border-[#138372]/20 bg-[#e1f4eb] p-5">
      <CheckCircle2 size={28} className="text-[#117f70]" aria-hidden="true" />
      <h3 className="mt-3 text-lg font-semibold">Thanks for reaching out.</h3>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/70">{message}</p>
      <p className="mt-3 text-xs leading-5 text-[#102c3d]/55">This is not an apprenticeship application or a guarantee of enrolment.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <p className="text-sm leading-6 text-[#102c3d]/65">{requesterType === "manager"
          ? "Explore the development request with an impartial apprenticeship adviser. We can help you understand suitability, commitment, funding considerations and next steps."
          : "Ask our team for practical guidance about this programme and how to start a conversation with your employer."}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="text-xs font-semibold text-[#102c3d]/70">Your name
          <input required autoComplete="name" maxLength={100} value={contact.fullName} onChange={e => change("fullName", e.target.value)} className="mt-1.5 min-h-[45px] w-full rounded-xl border border-[#102c3d]/15 bg-white px-3 text-sm font-normal outline-none focus:border-[#159b8f]" />
        </label>
        <label className="text-xs font-semibold text-[#102c3d]/70">Your work email
          <input required type="email" autoComplete="email" maxLength={254} value={contact.email} onChange={e => change("email", e.target.value)} className="mt-1.5 min-h-[45px] w-full rounded-xl border border-[#102c3d]/15 bg-white px-3 text-sm font-normal outline-none focus:border-[#159b8f]" />
        </label>
        <label className="text-xs font-semibold text-[#102c3d]/70">Organisation
          <input required autoComplete="organization" maxLength={140} value={contact.organisation} onChange={e => change("organisation", e.target.value)} className="mt-1.5 min-h-[45px] w-full rounded-xl border border-[#102c3d]/15 bg-white px-3 text-sm font-normal outline-none focus:border-[#159b8f]" />
        </label>
        <label className="text-xs font-semibold text-[#102c3d]/70">Your role <span className="font-normal text-[#102c3d]/45">(optional)</span>
          <input maxLength={120} value={contact.jobTitle} onChange={e => change("jobTitle", e.target.value)} className="mt-1.5 min-h-[45px] w-full rounded-xl border border-[#102c3d]/15 bg-white px-3 text-sm font-normal outline-none focus:border-[#159b8f]" />
        </label>
        <label className="text-xs font-semibold text-[#102c3d]/70">What would you like help with? <span className="font-normal text-[#102c3d]/45">(optional)</span>
          <textarea rows={3} maxLength={800} value={contact.note} onChange={e => change("note", e.target.value)} placeholder="For example: I'd like to talk to my manager about this..." className="mt-1.5 w-full resize-y rounded-xl border border-[#102c3d]/15 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#159b8f]" />
        </label>
      </div>
      <label className="absolute -left-[10000px] -top-[10000px] opacity-0" aria-hidden="true">Leave this empty
        <input type="text" tabIndex={-1} autoComplete="off" value={contact.website} onChange={e => change("website", e.target.value)} />
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#eff3ef] p-3 text-xs leading-5 text-[#102c3d]/75">
        <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#117f70]" />
        <span>{requesterType === "manager" ? EXPLORE_MANAGER_CONSENT_TEXT : EXPLORE_GUIDANCE_CONSENT_TEXT}</span>
      </label>
      <p className="text-[11px] leading-5 text-[#102c3d]/55">
        There is no charge to you or your employer for using Explore. MPR may receive commercial fees from training providers for successful introductions. This does not determine which standards appear in the catalogue. <a className="underline underline-offset-2" href={EXPLORE_PRIVACY_URL}>Privacy information</a>.
      </p>
      <button type="submit" disabled={!consent || status === "sending"} className="inline-flex min-h-[50px] w-full items-center justify-center gap-3 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:bg-[#1e4960] disabled:cursor-not-allowed disabled:opacity-50">
        {status === "sending" ? "Sending your request..." : "Ask LevyTate for guidance"} <Send size={16} aria-hidden="true" />
      </button>
      {status === "error" ? <p role="alert" className="rounded-lg bg-[#fff0eb] p-3 text-sm text-[#923e42]">{message}</p> : null}
    </form>
  );
}

export function ExploreDetail({ standard, managerView = false, enquiriesEnabled = false, returnHref = null }: { standard: ExploreStandard; managerView?: boolean; enquiriesEnabled?: boolean; returnHref?: string | null }) {
  const [action, setAction] = useState<"manager" | "mpr" | null>(null);
  const occupationalRoute = getExploreRouteByName(standard.route);

  return (
    <>
      <ExploreHeader />
      <main className="mx-auto max-w-[1200px] px-4 pb-20 pt-6 sm:px-8 sm:pt-9">
        <Link href={returnHref || (occupationalRoute ? getExploreRouteHref(occupationalRoute) : "/explore")} className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-[#102c3d]/65 transition hover:text-[#102c3d]"><ArrowLeft size={16} /> {returnHref ? "Back to standards" : occupationalRoute ? "Back to " + occupationalRoute.name : "All occupational routes"}</Link>
        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_355px] lg:gap-7">
          <article className="min-w-0">
            <div className="explore-detail-hero">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#142f3a]/10 bg-white/70 px-3 py-1.5 text-[11px] font-extrabold text-[#245b53]">{standard.route}</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#102c3d]/65">Level {standard.level}</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#102c3d]/65">{standard.duration}</span>
            </div>
            <h1 className="explore-display mt-5 max-w-[800px] text-[clamp(2.3rem,5.3vw,4.7rem)]">{standard.title}</h1>
            <p className="mt-5 text-[12px] font-semibold text-[#142f3a]/65">OFFICIAL STANDARD <span className="mx-2 opacity-40">/</span> {standard.code} <span className="mx-2 opacity-40">/</span> VERSION {standard.version}</p>
            </div>
            {managerView ? (
              <div className="mt-5 rounded-[18px] border border-[#142f3a]/10 bg-[#e3f1e0] p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#117f70]">For line managers</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-.04em]">Someone on your team wants to grow.</h2>
                <p className="mt-3 text-sm leading-7 text-[#102c3d]/70">This is a starting point for a development conversation, not a formal application. Explore how the skills might benefit your team, whether the employee has suitable work opportunities and what employer support would involve. LevyTate can help without charging you for an initial enquiry.</p>
              </div>
            ) : null}

            <ExploreAiExplanation standard={standard} />
          </article>

          <aside className="lg:sticky lg:top-5">
            <div className="explore-action-panel">
              <div className="explore-action-panel-heading">
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#bfeadd]">{managerView ? "Your team member" : "Your next step"}</p>
                <span className="explore-action-accent" aria-hidden="true" />
                <h2 className="mt-3 text-[26px] font-extrabold leading-[1.13] tracking-[-.05em]">{managerView ? "Could this benefit your team?" : "Interested? Start a conversation."}</h2>
                <p className="mt-4 text-sm leading-6 text-white/65">{managerView ? "A useful conversation starts with understanding what the employee wants to learn and what the business needs." : "No applications, no commitment. Just an opportunity to explore."}</p>
              </div>
              <div className="p-5 sm:p-6">
                {!action ? (
                  <div className="grid gap-3">
                    {!managerView ? <button type="button" onClick={() => setAction("manager")} className="explore-contact-choice group">
                      <span><span className="block text-sm font-semibold">Bring it to my manager</span><span className="mt-1 block text-xs text-[#102c3d]/55">Prepare an email to start the discussion</span></span>
                      <ChevronRight size={19} className="shrink-0 text-[#117f70]" />
                    </button> : null}
                    <button type="button" onClick={() => setAction("mpr")} className="group flex min-h-[75px] w-full items-center justify-between gap-3 rounded-[15px] border border-[#102c3d]/15 p-4 text-left transition hover:border-[#117f70] hover:bg-[#f3f7f3]">
                      <span><span className="block text-sm font-semibold">{managerView ? "Discuss it with LevyTate" : "Ask LevyTate to help"}</span><span className="mt-1 block text-xs text-[#102c3d]/55">Talk to our apprenticeship advisory team</span></span>
                      <ChevronRight size={19} className="shrink-0 text-[#117f70]" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <button type="button" onClick={() => setAction(null)} className="inline-flex items-center gap-2 text-xs font-semibold text-[#102c3d]/50 hover:text-[#102c3d]"><ArrowLeft size={14} /> Back to options</button>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-.035em]">{action === "manager" ? "Make the first move." : "Let's explore it together."}</h3>
                    {action === "manager" ? <ManagerEmail standard={standard} /> : <MprContact standard={standard} requesterType={managerView ? "manager" : "employee"} enabled={enquiriesEnabled} />}
                  </div>
                )}
                <div className="mt-6 flex items-start gap-2 border-t border-[#102c3d]/10 pt-5 text-[11px] leading-5 text-[#102c3d]/50">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#117f70]" aria-hidden="true" />
                  Your browsing is private. Enquiries only go to MPR when you explicitly submit them.
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[17px] border border-[#142f3a]/10 bg-[#eff3e9] px-5 py-4 text-xs leading-6 text-[#142f3a]/70">
              Already a LevyTate employee user? <Link href="/levytate/app" className="font-semibold text-[#117f70] underline underline-offset-2">Sign in to your organisation&apos;s platform.</Link> Its application approvals are separate from this public exploration journey.
            </div>
          </aside>
        </div>
      </main>
      <ExploreFooter />
    </>
  );
}
