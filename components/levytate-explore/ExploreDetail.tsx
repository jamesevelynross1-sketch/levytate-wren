"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2,
  ChevronRight, ExternalLink, Send, ShieldCheck, Sparkles, WandSparkles,
} from "lucide-react";
import { ExploreHeader } from "./ExploreHome";
import type { ExploreStandard } from "@/lib/levytate/explore/catalogue";

type Tab = "human" | "official";
type ContactForm = { fullName: string; email: string; organisation: string; jobTitle: string; note: string; website: string };

const initialContact: ContactForm = { fullName: "", email: "", organisation: "", jobTitle: "", note: "", website: "" };

function ManagerEmail({ standard }: { standard: ExploreStandard }) {
  const [managerEmail, setManagerEmail] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const subject = "Could we discuss an apprenticeship opportunity?";
  const message = [
    "Hi,",
    "",
    "I've been exploring how I could develop my skills while continuing in my current role, and found an apprenticeship that looks interesting:",
    "",
    standard.title + " (Level " + standard.level + ", " + standard.code + ")",
    standard.officialUrl,
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

function MprContact({ standard }: { standard: ExploreStandard }) {
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
        body: JSON.stringify({ ...contact, code: standard.code, consent }),
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
      <p className="text-sm leading-6 text-[#102c3d]/65">Ask our team for practical guidance about this programme and how to start a conversation with your employer.</p>
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
        <span>I agree that LevyTate, operated by MPR Consulting, can use these details to contact me about this development enquiry. I understand my employer will not be contacted without a separate agreed step.</span>
      </label>
      <p className="text-[11px] leading-5 text-[#102c3d]/55">
        There is no charge to you or your employer for using Explore. MPR may receive commercial fees from training providers for successful introductions. This does not determine which standards appear in the catalogue. <a className="underline underline-offset-2" href="/levytate/privacy">Privacy information</a>.
      </p>
      <button type="submit" disabled={!consent || status === "sending"} className="inline-flex min-h-[50px] w-full items-center justify-center gap-3 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:bg-[#1e4960] disabled:cursor-not-allowed disabled:opacity-50">
        {status === "sending" ? "Sending your request..." : "Ask LevyTate for guidance"} <Send size={16} aria-hidden="true" />
      </button>
      {status === "error" ? <p role="alert" className="rounded-lg bg-[#fff0eb] p-3 text-sm text-[#923e42]">{message}</p> : null}
    </form>
  );
}

export function ExploreDetail({ standard }: { standard: ExploreStandard }) {
  const [tab, setTab] = useState<Tab>("human");
  const [action, setAction] = useState<"manager" | "mpr" | null>(null);
  const info = standard.story;

  return (
    <>
      <ExploreHeader />
      <main className="mx-auto max-w-[1330px] px-5 pb-20 pt-7 sm:px-9 sm:pt-11">
        <Link href="/explore" className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-[#102c3d]/65 transition hover:text-[#102c3d]"><ArrowLeft size={16} /> All opportunities</Link>
        <div className="mt-8 grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_355px] lg:gap-12">
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#dcece4] px-3 py-1.5 text-[11px] font-bold text-[#117f70]">{info?.theme || standard.route}</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#102c3d]/65">Level {standard.level}</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#102c3d]/65">{standard.duration}</span>
            </div>
            <h1 className="mt-5 max-w-[800px] text-[clamp(2.5rem,5.5vw,4.8rem)] font-semibold leading-[1.02] tracking-[-.068em]">{standard.title}</h1>
            <p className="mt-5 text-sm text-[#102c3d]/60">Official apprenticeship reference: {standard.code} · Version {standard.version}</p>

            <div className="mt-9 flex items-center gap-2 rounded-[16px] border border-[#102c3d]/10 bg-white p-1.5" role="tablist" aria-label="Choose how to read the apprenticeship">
              <button role="tab" aria-selected={tab === "human"} type="button" onClick={() => setTab("human")}
                className={"flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition " + (tab === "human" ? "bg-[#102c3d] text-white" : "text-[#102c3d]/65 hover:bg-[#f5f6f2]")}>
                <WandSparkles size={16} /> De-fluff it
              </button>
              <button role="tab" aria-selected={tab === "official"} type="button" onClick={() => setTab("official")}
                className={"flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition " + (tab === "official" ? "bg-[#102c3d] text-white" : "text-[#102c3d]/65 hover:bg-[#f5f6f2]")}>
                <BookOpen size={16} /> The official facts
              </button>
            </div>

            {tab === "human" && info ? (
              <section role="tabpanel" className="mt-7">
                <div className="rounded-[24px] bg-[#e0efe7] p-6 sm:p-9">
                  <p className="text-xs font-bold uppercase tracking-[.17em] text-[#117f70]">In plain English</p>
                  <h2 className="mt-5 max-w-[670px] font-serif text-[clamp(1.8rem,4vw,3.1rem)] leading-[1.13] tracking-[-.045em]">{info.hook}</h2>
                  <p className="mt-6 max-w-[690px] text-[15px] leading-8 text-[#102c3d]/75 sm:text-[17px]">{info.introduction}</p>
                </div>
                <h2 className="mt-10 text-2xl font-semibold tracking-[-.045em]">What could you actually learn to do?</h2>
                <div className="mt-5 grid gap-3">
                  {info.outcomes.map((outcome, index) => (
                    <div key={outcome} className="flex gap-4 rounded-[16px] border border-[#102c3d]/10 bg-white p-5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5e6e3] text-xs font-bold text-[#a54b61]">0{index + 1}</span>
                      <p className="pt-1 text-[15px] leading-7 text-[#102c3d]/85">{outcome}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[19px] bg-white p-6">
                    <h3 className="text-[17px] font-semibold tracking-[-.035em]">Does it sound like you?</h3>
                    <p className="mt-3 text-sm leading-7 text-[#102c3d]/65">{info.suitability}</p>
                  </div>
                  <div className="rounded-[19px] bg-white p-6">
                    <h3 className="text-[17px] font-semibold tracking-[-.035em]">What to be realistic about</h3>
                    <p className="mt-3 text-sm leading-7 text-[#102c3d]/65">{info.reality}</p>
                  </div>
                </div>
                <p className="mt-6 rounded-xl border border-[#102c3d]/10 p-4 text-xs leading-6 text-[#102c3d]/55">
                  This is LevyTate&apos;s explanatory interpretation of an apprenticeship, not a replacement for its official training requirements. It does not assess your eligibility or guarantee any career outcome.
                </p>
              </section>
            ) : tab === "human" ? (
              <section role="tabpanel" className="mt-7 rounded-[24px] bg-[#e0efe7] p-7 sm:p-10">
                <Sparkles size={28} className="text-[#117f70]" aria-hidden="true" />
                <h2 className="mt-5 font-serif text-3xl tracking-[-.04em]">A little more clarity is on the way.</h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-[#102c3d]/70">
                  We&apos;re preparing a carefully checked plain-English guide for this apprenticeship. Rather than guess what&apos;s taught, we&apos;ll point you to the official standard until that guide is ready.
                </p>
                <button type="button" className="mt-6 inline-flex min-h-[45px] items-center gap-2 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white" onClick={() => setTab("official")}>See what we know <ArrowRight size={16}/></button>
              </section>
            ) : (
              <section role="tabpanel" className="mt-7 rounded-[24px] border border-[#102c3d]/10 bg-white p-7 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[.17em] text-[#117f70]">Skills England source record</p>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-.04em]">The apprenticeship, without interpretation.</h2>
                <dl className="mt-7 divide-y divide-[#102c3d]/10 text-sm">
                  {[
                    ["Title", standard.title],
                    ["Reference", standard.code],
                    ["Level", String(standard.level)],
                    ["Typical duration", standard.duration],
                    ["Occupational route", standard.route],
                    ["Source version", standard.version],
                    ["Catalogue last verified", standard.sourceVerified || "Not recorded"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[125px_1fr] gap-4 py-4 sm:grid-cols-[175px_1fr]">
                      <dt className="text-[#102c3d]/50">{label}</dt>
                      <dd className="font-medium text-[#102c3d]">{value}</dd>
                    </div>
                  ))}
                </dl>
                <a href={standard.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-[47px] items-center gap-2 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition hover:bg-[#1e4960]">
                  Read the official standard <ExternalLink size={16} aria-hidden="true" />
                </a>
                <p className="mt-5 text-xs leading-6 text-[#102c3d]/55">The official page is the source of truth. Status, requirements and funding arrangements can change after the date above.</p>
              </section>
            )}
            <a href={standard.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-[#117f70] underline underline-offset-4">
              View the full Skills England apprenticeship record <ExternalLink size={16} />
            </a>
          </article>

          <aside className="lg:sticky lg:top-5">
            <div className="overflow-hidden rounded-[25px] border border-[#102c3d]/10 bg-white shadow-[0_15px_40px_rgba(16,44,61,.055)]">
              <div className="bg-[#102c3d] p-6 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#bfeadd]">Your next step</p>
                <h2 className="mt-3 text-[25px] font-semibold leading-[1.15] tracking-[-.045em]">Interested? Start a conversation.</h2>
                <p className="mt-4 text-sm leading-6 text-white/65">No applications, no commitment. Just an opportunity to explore.</p>
              </div>
              <div className="p-5 sm:p-6">
                {!action ? (
                  <div className="grid gap-3">
                    <button type="button" onClick={() => setAction("manager")} className="group flex min-h-[75px] w-full items-center justify-between gap-3 rounded-[15px] border border-[#102c3d]/15 p-4 text-left transition hover:border-[#117f70] hover:bg-[#f3f7f3]">
                      <span><span className="block text-sm font-semibold">Bring it to my manager</span><span className="mt-1 block text-xs text-[#102c3d]/55">Prepare an email to start the discussion</span></span>
                      <ChevronRight size={19} className="shrink-0 text-[#117f70]" />
                    </button>
                    <button type="button" onClick={() => setAction("mpr")} className="group flex min-h-[75px] w-full items-center justify-between gap-3 rounded-[15px] border border-[#102c3d]/15 p-4 text-left transition hover:border-[#117f70] hover:bg-[#f3f7f3]">
                      <span><span className="block text-sm font-semibold">Ask LevyTate to help</span><span className="mt-1 block text-xs text-[#102c3d]/55">Talk to our apprenticeship advisory team</span></span>
                      <ChevronRight size={19} className="shrink-0 text-[#117f70]" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <button type="button" onClick={() => setAction(null)} className="inline-flex items-center gap-2 text-xs font-semibold text-[#102c3d]/50 hover:text-[#102c3d]"><ArrowLeft size={14} /> Back to options</button>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-.035em]">{action === "manager" ? "Make the first move." : "Let's explore it together."}</h3>
                    {action === "manager" ? <ManagerEmail standard={standard} /> : <MprContact standard={standard} />}
                  </div>
                )}
                <div className="mt-6 flex items-start gap-2 border-t border-[#102c3d]/10 pt-5 text-[11px] leading-5 text-[#102c3d]/50">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#117f70]" aria-hidden="true" />
                  Your browsing is private. Nothing is shared until you deliberately choose to share it.
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[17px] border border-[#102c3d]/10 px-5 py-4 text-xs leading-6 text-[#102c3d]/60">
              Already a LevyTate employee user? <Link href="/levytate/app" className="font-semibold text-[#117f70] underline underline-offset-2">Sign in to your organisation&apos;s platform.</Link> Its application approvals are separate from this public exploration journey.
            </div>
          </aside>
        </div>
      </main>
      <footer className="border-t border-[#102c3d]/10 px-5 py-7 text-center text-xs text-[#102c3d]/55">
        <Link href="/explore" className="font-semibold hover:underline">LevyTate Explore</Link> · Independent apprenticeship discovery · <a href="https://skillsengland.education.gov.uk/apprenticeships" target="_blank" rel="noopener noreferrer" className="hover:underline">Official Skills England catalogue</a>
      <div className="mx-auto flex max-w-[1330px] flex-wrap items-center justify-center gap-4 px-5 pb-8 text-[11px] text-[#102c3d]/55">
        <a href="https://occupational-maps.skillsengland.education.gov.uk/public-api/" target="_blank" rel="noopener noreferrer">
          <Image unoptimized src="https://occupational-maps.skillsengland.education.gov.uk/media/xmehhrr0/skills-england_lesser_arms_stacked-dfe-blue-se-logo.svg?rmode=max&amp;width=500" alt="Skills England" loading="lazy" width="126" height="58" className="w-[126px] rounded-lg bg-white p-2" />
        </a>
        <span>© Skills England 2025. Source information under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Open Government Licence v3.0</a>.</span>
      </div>
      </footer>
    </>
  );
}
