import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Explore privacy & enquiries | LevyTate",
  description: "How the LevyTate Explore public apprenticeship discovery service handles optional development enquiries.",
  robots: { index: false, follow: false },
};

const sections = [
  {
    heading: "What information do we collect?",
    text: "You can browse apprenticeships without giving us your name, employer or email. If you choose to request support, we collect your name, work email, organisation, optional job title and question, the programme you selected, and a dated record of what you agreed to. We process limited technical information to operate and protect the service.",
  },
  {
    heading: "Why do we use it?",
    text: "We use enquiry details to respond to your development question, understand whether a supported apprenticeship route may be suitable, and help you explore next steps. We don't turn public browsing into an employee monitoring record or add you automatically to your employer's LevyTate workspace.",
  },
  {
    heading: "Will my manager or employer be contacted?",
    text: "Not merely because you browsed, saved an idea or asked MPR for guidance. Preparing an email to your manager happens in your own email application. If you submit a direct request to MPR, we contact the named requester only. Contacting another person or your organisation would require a further agreed step.",
  },
  {
    heading: "Who processes the information?",
    text: "Explore is part of LevyTate, operated by MPR Consulting. Enquiries are handled by the LevyTate/MPR advisory team, with technical support from selected hosting, database and transactional-email processors. We do not sell your personal data to apprenticeship providers. We may receive a provider-paid fee for a separately agreed successful introduction or enrolment.",
  },
  {
    heading: "How long is the information kept?",
    text: "Enquiries are retained for the period genuinely needed to respond, manage a live opportunity and meet applicable legal obligations. We will publish an approved retention period and deletion procedure before the public contact service goes live; this preview notice is not the final release text.",
  },
  {
    heading: "Your rights and contacting us",
    text: "You can request access, correction, deletion or restriction of your personal information, and raise concerns about our handling of it. Email hello@levytate.co.uk with your request; we'll verify identity before discussing private records. You can also complain to the UK Information Commissioner's Office.",
  },
];

export default function ExplorePrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#102c3d]">
      <main className="mx-auto max-w-[920px] px-5 pb-24 pt-9 sm:px-9 sm:pt-14">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm font-semibold text-[#117f70]"><ArrowLeft size={16}/> Back to Explore</Link>
        <p className="mt-12 text-xs font-bold uppercase tracking-[.2em] text-[#117f70]">LEVYTATE / EXPLORE / PRIVACY</p>
        <h1 className="mt-3 text-[clamp(2.6rem,6vw,4.5rem)] font-semibold leading-[1.05] tracking-[-.065em]">Your curiosity belongs to you.</h1>
        <p className="mt-6 max-w-[700px] text-base leading-8 text-[#102c3d]/65">
          Explore is free to use, and browsing doesn't create a named employee profile.
          We only receive the details you explicitly submit when asking our team for help.
        </p>
        <div className="mt-9 flex items-start gap-3 rounded-[18px] border border-[#d6d8ba] bg-[#fff8df] p-5 text-sm leading-7 text-[#6e632e]">
          <ShieldCheck size={21} className="mt-1 shrink-0"/>
          <span>This is a development Preview notice. Before public release we must confirm the final legal-controller identification, lawful bases, contact details and retention policy. No public launch is authorised by this page.</span>
        </div>
        <div className="mt-11 divide-y divide-[#102c3d]/10">
          {sections.map((section, index) => (
            <section key={section.heading} className="grid gap-4 py-8 sm:grid-cols-[46px_1fr]">
              <span className="text-xs font-bold text-[#c26a78]">{String(index + 1).padStart(2, "0")}</span>
              <div><h2 className="text-xl font-semibold tracking-[-.035em]">{section.heading}</h2><p className="mt-3 text-sm leading-8 text-[#102c3d]/65">{section.text}</p></div>
            </section>
          ))}
        </div>
        <p className="mt-11 text-sm leading-7 text-[#102c3d]/60">For the existing employer operating system, read the separate <Link href="/levytate/privacy" className="font-semibold text-[#117f70] underline underline-offset-2">LevyTate service privacy notice</Link>.</p>
      </main>
    </div>
  );
}
