"use client";

import { useId, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { EmployerSetupKey } from "@/lib/levytate/mvp/employer-setup";

/** Explain domain terms without changing existing saved field values or workflows. */
export const employerSetupGuidance: Record<EmployerSetupKey, string> = {
  organisation: "Tell us which employer is using LevyTate, who manages the account and where your people physically work.",
  priorities: "Choose up to three outcomes you want apprenticeships to support, such as productivity, compliance or AI adoption.",
  managers: "Add the people responsible for managing staff and reviewing their apprenticeship applications.",
  employees: "Add employees and link them to their line manager so applications follow the correct approval route.",
  providers: "Choose the apprenticeship training providers your organisation works with or wants to use.",
  programmes: "Choose apprenticeship courses offered by your selected training providers so employees can apply.",
  learners: "Optional: bring in employees who are already enrolled on an apprenticeship.",
  finance: "Optional: add Digital Apprenticeship Service (DAS) records to track funding and plan future starts.",
};

export const workspaceFieldGuidance = {
  employerName: "The name of the company or organisation using this LevyTate workspace.",
  workspaceName: "The name displayed to your colleagues within LevyTate. It can differ from your legal company name.",
  primaryContact: "The person responsible for this organisation's LevyTate workspace and apprenticeship coordination.",
  contactEmail: "A work email address LevyTate can use for organisational contact, rather than a public website address.",
  defaultSite: "Your main physical work location, such as Hull office or Leeds depot. Not your website.",
  sites: "Physical or geographical work locations, such as Hull office, Leeds depot or a Manchester branch. Not website addresses.",
  departments: "Internal business teams such as Sales, Operations, Finance or HR. These are not office locations.",
} as const;

export const employeeFieldGuidance = {
  name: "The employee's name as it should appear in workforce records.",
  email: "Their own work email address, used for identity matching when access is invited.",
  jobTitle: "Their current job role within the business, such as Operations Assistant or Team Leader.",
  department: "The team they work in, such as Sales or Operations.",
  lineManager: "The colleague who manages this employee and would review their apprenticeship application.",
  site: "The physical office, depot or workplace where this person is based. Not a website URL.",
} as const;

/** Hover, keyboard focus and touch/click all reveal the same short description.
 * The explanation is accessible to screen readers and touch users. */
export function SetupContextHelp({ label, description }: { label: string; description: string }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="group relative inline-flex shrink-0 items-center align-middle">
      <button
        type="button"
        aria-label={`Help: ${label}`}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.currentTarget.blur(); } }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lt-muted transition-colors hover:bg-[#e8f2ed] hover:text-lt-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lt-accent"
      >
        <CircleHelp size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto rounded-xl sm:absolute sm:bottom-auto sm:left-0 sm:right-auto sm:top-full sm:z-40 sm:mx-0 sm:mt-1 sm:w-56 bg-[#102c3d] px-3 py-2.5 text-left text-xs font-normal leading-5 text-white shadow-[0_12px_28px_rgba(16,44,61,0.22)] transition-opacity duration-150 ${open ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"}`}
      >
        {description}
      </span>
    </span>
  );
}
