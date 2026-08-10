import type { Metadata } from "next";
import { SolutionPage } from "@/components/levytate-public/SolutionPage";

export const metadata: Metadata = {
  title: "Apprenticeship Operations for Employers",
  description: "Run employee applications, manager approvals, learner management, providers, people and programmes from one secure LevyTate employer workspace.",
};

export default function EmployersSolutionPage() {
  return (
    <SolutionPage
      eyebrow="LevyTate for employers"
      title="Run your apprenticeship programme from one operating system."
      description="Give Apprenticeship Leads, L&D and People teams one secure workspace for applications, learners, providers and the operational work that keeps a programme moving."
      primaryCta="Request Early Access"
      primaryHref="/early-access"
      secondaryCta="Login"
      secondaryHref="/login"
      visualEyebrow="Apprenticeship Lead"
      visualTitle="Operations Centre"
      visualItems={[
        { label: "Priority work", value: "Applications awaiting decisions", detail: "Ownership and next steps stay visible.", status: "Action" },
        { label: "Learners", value: "Lifecycle operations", detail: "Enrolment, progress, reviews and completion.", status: "Active" },
        { label: "Providers", value: "Delivery relationships", detail: "Connected to programmes and learners.", status: "Visible" },
        { label: "Administration", value: "People and programmes", detail: "Organisation context in the same workspace.", status: "Controlled" },
      ]}
      painsTitle="Apprenticeship teams need an operating view, not another spreadsheet."
      pains={[
        "Applications move through disconnected email chains",
        "Manager decisions are difficult to chase and evidence",
        "Learner records sit across internal files and providers",
        "Reviews and operational actions are easy to miss",
        "Provider relationships lack shared context",
        "People, programmes and ownership drift apart",
      ]}
      sections={[
        {
          id: "operations-centre",
          label: "Operations Centre",
          title: "See what needs attention today",
          copy: "Give Apprenticeship Leads a prioritised daily view of learner, review, enrolment and operational work across the employer workspace.",
          points: ["Prioritised operational actions", "Clear owners and due context", "Learner and programme context", "Source workflow links"],
        },
        {
          id: "applications",
          label: "Applications and approvals",
          title: "Keep every decision visible",
          copy: "Connect employee submission, Line Manager review and Apprenticeship Lead approval without losing the current owner or next step.",
          points: ["One active application per employee", "Direct-report manager approvals", "Apprenticeship Lead final decision", "Clear status and decision history"],
        },
        {
          id: "learners",
          label: "Learner management",
          title: "Maintain the journey after approval",
          copy: "Move from enrolment readiness into an operational learner record covering progress, reviews, breaks and completion activity.",
          points: ["Enrolment readiness", "Lifecycle status", "Progress and review context", "Operational learner actions"],
        },
        {
          id: "providers",
          label: "Provider management",
          title: "Keep delivery relationships connected",
          copy: "Maintain visibility of the providers and programmes supporting learners inside the same employer operating environment.",
          points: ["Provider visibility", "Associated programmes", "Learner and provider relationships", "Delivery context alongside operations"],
        },
        {
          id: "people-programmes",
          label: "People and programmes",
          title: "Keep organisational context attached to the work",
          copy: "Connect people, roles, managers and available programmes so apprenticeship activity reflects the organisation operating it.",
          points: ["People and role records", "Manager relationships", "Organisation context", "Available programme view"],
        },
        {
          id: "role-experiences",
          label: "Role-based experiences",
          title: "Give each person the right operating view",
          copy: "Employees, Line Managers and Apprenticeship Leads see the modules, people and actions appropriate to their responsibilities.",
          points: ["Employee application journey", "Manager approvals and My Team", "Lead Operations Centre", "Guidance and Copilot support"],
        },
        {
          id: "copilot",
          label: "Copilot support",
          title: "Help users understand and continue their work",
          copy: "LevyTate Copilot supports next steps, apprenticeship information, applications and platform navigation without making decisions for users.",
          points: ["Role-aware guidance", "Next-step explanation", "Application support", "Platform-first navigation"],
        },
        {
          id: "control-security",
          label: "Control and security",
          title: "Protect the employer workspace by role and organisation",
          copy: "Individual sign-in, controlled permissions and organisation-level separation keep operational information available to the right people.",
          points: ["Secure individual access", "Role-based permissions", "Workspace separation", "Access expiry and revocation"],
        },
      ]}
      closingTitle="Replace fragmented apprenticeship administration with one operating model."
      closingCopy="Join employers shaping a clearer way to manage applications, learners, providers and apprenticeship operations through Core Early Access."
    />
  );
}
