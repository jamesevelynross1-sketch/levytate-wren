import type { Metadata } from "next";
import { SolutionPage } from "@/components/levytate-public/SolutionPage";

export const metadata: Metadata = {
  title: "For Employers",
  description: "Manage employees, apprenticeship applications, pathway decisions, provider matching and reporting in one LevyTate workspace.",
};

export default function EmployersSolutionPage() {
  return (
    <SolutionPage
      eyebrow="LevyTate for employers"
      title="Manage apprenticeship operations from one clear workspace."
      description="Give HR, L&D, managers and apprenticeship leads a shared operating system for employees, pathways, approvals, provider matching and workforce insight."
      primaryCta="Request Employer Beta Access"
      primaryHref="mailto:hello@levytate.co.uk?subject=Employer beta access"
      secondaryCta="Beta Login"
      secondaryHref="/login"
      painsTitle="Employer apprenticeship activity is often spread across disconnected systems."
      pains={[
        "Employee and role data sits in separate spreadsheets",
        "Applications move through long email chains",
        "Managers lack clear pathway information",
        "Provider conversations are difficult to compare",
        "Reporting takes too long to prepare",
        "Workforce demand is disconnected from apprenticeship planning",
      ]}
      sections={[
        {
          id: "core-workflows",
          label: "Core workflows",
          title: "One controlled route from interest to enrolment",
          copy: "LevyTate keeps each decision visible while showing stakeholders only the actions relevant to their role.",
          points: ["Employee expression of interest", "Line Manager review", "Apprenticeship Lead final approval", "Provider introduction and enrolment tracking"],
        },
        {
          id: "employee-management",
          label: "Employee management",
          title: "Clean workforce records ready for pathway mapping",
          copy: "Maintain employee, role, department, site and manager assignments in one consistent operating model.",
          points: ["Searchable employee records", "Role and manager assignments", "Department and site visibility", "Application status at a glance"],
        },
        {
          id: "applications",
          label: "Applications and approvals",
          title: "Simple approval workflows with clear ownership",
          copy: "Employees submit once, managers review direct reports and apprenticeship leads make the final decision.",
          points: ["One active application per employee", "Manager decision history", "Final approval queue", "Approved for enrolment status"],
        },
        {
          id: "provider-matching",
          label: "Provider matching",
          title: "Independent matching based on employer need",
          copy: "Submit structured requirements to LevyTate for a controlled shortlist based on programme, delivery, geography and learner needs.",
          points: ["No open marketplace", "Employer requirements captured upfront", "Recommended and alternative options", "Qualified consultancy support"],
        },
        {
          id: "reporting",
          label: "Reporting",
          title: "Board-ready workforce and apprenticeship visibility",
          copy: "Bring participation, applications, workforce readiness and provider activity into reporting designed for decisions.",
          points: ["Participation by department and site", "Applications and approval pipeline", "Workforce readiness insight", "Levy and provider reporting"],
        },
        {
          id: "ai-guidance",
          label: "Ask LevyTate AI",
          title: "Role-aware guidance without losing control",
          copy: "Use AI to explain suitable pathways and next steps while keeping permissions and application actions deterministic.",
          points: ["Grounded in approved pathways", "Role-specific guidance", "No invented programme availability", "Human confirmation before actions"],
        },
      ]}
      closingTitle="Replace fragmented apprenticeship admin with one operating model."
      closingCopy="Join the LevyTate employer beta and shape a clearer way to manage workforce development and provider decisions."
    />
  );
}