import type { Metadata } from "next";
import { SolutionPage } from "@/components/levytate-public/SolutionPage";

export const metadata: Metadata = {
  title: "For Employees",
  description: "Explore how LevyTate helps employees understand approved apprenticeship pathways and manage one clear application.",
};

export default function EmployeesSolutionPage() {
  return (
    <SolutionPage
      eyebrow="LevyTate for employees"
      title="Find a development route that makes sense for your role and goals."
      description="LevyTate gives employees supportive, role-aware guidance so they can understand suitable pathways, prepare for a manager conversation and track one clear application."
      primaryCta="Request Beta Access"
      primaryHref="mailto:hello@levytate.co.uk?subject=LevyTate employee experience"
      secondaryCta="Beta Login"
      secondaryHref="/login"
      painsTitle="Employees should not need apprenticeship expertise to understand their options."
      pains={[
        "Long lists of standards are difficult to interpret",
        "Programme names do not explain role relevance",
        "Career goals are disconnected from available pathways",
        "Application steps and ownership are unclear",
        "Employees repeat the same information to different people",
        "Progress is difficult to track after submission",
      ]}
      sections={[
        {
          label: "Ask LevyTate AI",
          title: "Start with your role, interests and future goals",
          copy: "Ask open questions and receive plain-English guidance grounded in pathways approved by your employer.",
          points: ["Role-aware conversations", "Support for career uncertainty", "Clear suitability explanations", "Honest guidance when information is limited"],
        },
        {
          label: "Pathway discovery",
          title: "Compare suitable routes without marketplace noise",
          copy: "Explore approved pathways by role fit, learner benefit, business value, duration and commitment.",
          points: ["Primary and alternative pathways", "Business and learner outcomes", "Time commitment explained", "Approved options only"],
        },
        {
          label: "Application support",
          title: "Prepare one clear expression of interest",
          copy: "LevyTate helps structure the information a manager needs while enforcing one active application at a time.",
          points: ["Reason for interest", "Career goal", "Current role and site", "Support requirements"],
        },
        {
          label: "Progress tracking",
          title: "See exactly where your application sits",
          copy: "Follow progress from submission to manager review, final approval and enrolment readiness.",
          points: ["Current status", "Current reviewer", "Decision history", "Clear next step"],
        },
        {
          label: "Manager conversation",
          title: "Make development conversations easier to start",
          copy: "Use concise pathway rationale and manager-ready notes to discuss suitability, timing and business benefit.",
          points: ["Plain-English pathway summary", "Business benefit prompts", "Support needs captured", "Manager message draft"],
        },
      ]}
      closingTitle="Development guidance should feel supportive, not confusing."
      closingCopy="Join the LevyTate beta to explore a clearer employee experience for apprenticeship discovery and applications."
    />
  );
}