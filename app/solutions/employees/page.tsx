import type { Metadata } from "next";
import { SolutionPage } from "@/components/levytate-public/SolutionPage";

export const metadata: Metadata = {
  title: "Employee Apprenticeship Journey",
  description: "LevyTate gives employees one clear place to apply, follow application status, understand next steps and track their apprenticeship journey.",
};

export default function EmployeesSolutionPage() {
  return (
    <SolutionPage
      variant="employee"
      eyebrow="LevyTate for employees"
      title="A clear apprenticeship journey from application onwards."
      description="Apply, see where your application sits and follow what happens after approval without chasing different teams for an update."
      primaryCta="Request Early Access"
      primaryHref="/early-access"
      secondaryCta="Login"
      secondaryHref="/login"
      visualEyebrow="Employee experience"
      visualTitle="My Application"
      visualItems={[
        { label: "Current status", value: "Awaiting manager review", detail: "The current owner is clear.", status: "In progress" },
        { label: "Next step", value: "Manager decision", detail: "You will see when the status changes.", status: "Next" },
        { label: "My Apprenticeship", value: "Journey in one place", detail: "Available once the apprenticeship begins.", status: "Connected" },
        { label: "Guidance", value: "Help when you need it", detail: "Copilot and the Guidance Centre support the journey.", status: "Support" },
      ]}
      painsTitle="Employees should always understand where they are and what happens next."
      pains={[
        "Application steps are difficult to find",
        "The current decision owner is unclear",
        "Updates depend on chasing HR or L&D",
        "Manager conversations begin without enough context",
        "The journey disappears after approval",
        "Apprenticeship information can be difficult to interpret",
      ]}
      sections={[
        {
          id: "my-application",
          label: "My Application",
          title: "Complete one clear application",
          copy: "Employees can prepare, save and submit their current apprenticeship application from one focused workspace.",
          points: ["One active application", "Clear application questions", "Draft before submission", "Submit to the Line Manager"],
        },
        {
          id: "status",
          label: "Status visibility",
          title: "Know where the decision sits",
          copy: "The application view shows the current status, the responsible reviewer and the next step in the approval journey.",
          points: ["Current application status", "Current reviewer", "Decision progression", "Next action explained"],
        },
        {
          id: "next-steps",
          label: "Clear next steps",
          title: "Move forward without chasing updates",
          copy: "Employees can see when they need to provide information and when the application is waiting with someone else.",
          points: ["Action required states", "Requested information", "Manager review stage", "Final approval stage"],
        },
        {
          id: "my-apprenticeship",
          label: "My Apprenticeship",
          title: "Follow the journey after approval",
          copy: "Once learning begins, the employee experience continues with a clear view of the apprenticeship journey and current operational context.",
          points: ["Programme context", "Lifecycle visibility", "Reviews and progress", "Completion journey"],
        },
        {
          id: "manager-conversation",
          label: "Manager conversations",
          title: "Start better development conversations",
          copy: "Use the same application and apprenticeship context to make conversations about timing, support and next steps easier.",
          points: ["Shared application context", "Support needs captured", "Clear business rationale", "Visible manager ownership"],
        },
        {
          id: "guidance",
          label: "Guidance and Copilot",
          title: "Get support without losing the human journey",
          copy: "Plain-English guidance helps employees understand apprenticeship information, prepare application content and navigate to the right task.",
          points: ["Application preparation", "Next-step explanation", "Apprenticeship information", "Platform navigation"],
        },
      ]}
      closingTitle="Your apprenticeship journey should never feel hidden."
      closingCopy="LevyTate gives employees a clear application, visible next steps and one place to follow the journey after approval."
    />
  );
}
