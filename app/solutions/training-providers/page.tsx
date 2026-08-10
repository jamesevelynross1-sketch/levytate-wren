import type { Metadata } from "next";
import { SolutionPage } from "@/components/levytate-public/SolutionPage";

export const metadata: Metadata = {
  title: "Provider Relationships in LevyTate",
  description: "See how LevyTate helps employers maintain clearer provider, programme and learner relationships inside their apprenticeship operations.",
};

export default function TrainingProvidersSolutionPage() {
  return (
    <SolutionPage
      variant="provider"
      eyebrow="Training providers in LevyTate"
      title="Help employers maintain clearer, more connected provider relationships."
      description="LevyTate is employer-led. Its developing provider ecosystem keeps delivery partners, programmes and learner relationships visible alongside apprenticeship operations."
      primaryCta="Talk to LevyTate"
      primaryHref="mailto:hello@levytate.co.uk?subject=LevyTate%20provider%20relationships"
      secondaryCta="View employer solution"
      secondaryHref="/solutions/employers"
      visualEyebrow="Employer provider view"
      visualTitle="Provider relationships"
      visualItems={[
        { label: "Provider record", value: "Delivery partner", detail: "Clear organisation and delivery context.", status: "Visible" },
        { label: "Programmes", value: "Associated provision", detail: "Programmes stay connected to the employer view.", status: "Linked" },
        { label: "Learners", value: "Operational relationships", detail: "Provider context sits alongside learner operations.", status: "Connected" },
        { label: "Workspace", value: "Employer controlled", detail: "The employer operating model remains central.", status: "Employer-led" },
      ]}
      painsTitle="Provider relationships work better when operational context stays connected."
      pains={[
        "Provider details sit in separate files",
        "Programmes are disconnected from learner activity",
        "Ownership is unclear across organisations",
        "Operational context gets lost between conversations",
        "Provider activity is difficult to view alongside the programme",
        "Employers lack one consistent relationship record",
      ]}
      sections={[
        {
          id: "employer-led",
          label: "Employer-led model",
          title: "Keep the employer programme at the centre",
          copy: "LevyTate is built to help employers operate their apprenticeship programme. Provider information supports that operating view.",
          points: ["Employer-controlled workspace", "Operational purpose first", "Clear role boundaries", "No paid recommendation influence"],
        },
        {
          id: "provider-visibility",
          label: "Provider visibility",
          title: "Maintain a clear delivery-partner view",
          copy: "Provider records give employer apprenticeship teams consistent context about the organisations supporting delivery.",
          points: ["Provider organisation context", "Delivery information", "Relationship visibility", "Controlled provider records"],
        },
        {
          id: "programmes",
          label: "Associated programmes",
          title: "Connect providers to the programmes they support",
          copy: "Programme associations help employers understand how delivery partners fit into their current apprenticeship environment.",
          points: ["Programme associations", "Delivery context", "Employer programme view", "Clear provider links"],
        },
        {
          id: "learner-relationships",
          label: "Learner relationships",
          title: "Keep provider context beside learner operations",
          copy: "Provider relationships remain visible alongside the learner lifecycle so operational teams do not have to reconstruct the context elsewhere.",
          points: ["Learner and provider connection", "Operational clarity", "Shared programme context", "Visible relationship ownership"],
        },
        {
          id: "developing-ecosystem",
          label: "Developing ecosystem",
          title: "Build clearer ways to work together",
          copy: "LevyTate is developing its provider-management capability with a focus on factual information, controlled relationships and employer needs.",
          points: ["Factual provider information", "Transparent relationship context", "Employer-led development", "Clear commercial boundaries"],
        },
      ]}
      closingTitle="Make provider relationships part of the operating model."
      closingCopy="Talk to LevyTate about its developing provider ecosystem and how clearer provider information can support employer apprenticeship operations."
    />
  );
}
