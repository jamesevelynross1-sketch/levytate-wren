import type { Metadata } from "next";
import { SolutionPage } from "@/components/levytate-public/SolutionPage";

export const metadata: Metadata = {
  title: "For Training Providers",
  description: "Explore LevyTate provider partnership packages and qualified employer matching opportunities.",
};

export default function TrainingProvidersSolutionPage() {
  return (
    <SolutionPage
      eyebrow="LevyTate for training providers"
      title="Build trusted employer relationships through a curated provider network."
      description="LevyTate is building a carefully selected provider network focused on qualified employer demand, delivery fit and long-term partnership rather than marketplace advertising."
      primaryCta="Discuss Partner Packages"
      primaryHref="mailto:hello@levytate.co.uk?subject=LevyTate provider partner packages"
      secondaryCta="View employer solution"
      secondaryHref="/solutions/employers"
      painsTitle="Strong providers need qualified opportunities, not another advertising marketplace."
      pains={[
        "Employer requirements often arrive without enough detail",
        "Programme fit is difficult to assess early",
        "Introductions do not always reflect delivery capability",
        "Geography and delivery model are considered too late",
        "Provider expertise is reduced to a basic listing",
        "Partnership value is difficult to demonstrate",
      ]}
      sections={[
        {
          label: "Why partner",
          title: "A partnership model built around employer outcomes",
          copy: "LevyTate is developing a curated network where provider expertise is considered alongside real employer requirements.",
          points: ["Qualified employer introductions", "Relevant sector positioning", "Strategic partnership packages", "Early access to platform capabilities"],
        },
        {
          label: "Provider matching",
          title: "Structured requests before an introduction is made",
          copy: "Employer needs are captured consistently so potential partners can assess programme, learner, location and delivery fit.",
          points: ["Role and workforce need", "Learner volumes and locations", "Delivery preference", "Funding position and urgency"],
        },
        {
          label: "Provider capability",
          title: "Present the expertise that makes delivery credible",
          copy: "Partner profiles are designed to represent specialist programme capability without implying paid influence over recommendations.",
          points: ["Programme and occupational expertise", "Delivery models and regions", "Quality and verification status", "Employer and learner fit"],
        },
        {
          label: "Partner packages",
          title: "Commercial partnerships with clear boundaries",
          copy: "Provider participation can support visibility and collaboration, but recommendations remain independent and employer-led.",
          points: ["No pay-to-rank recommendations", "Controlled provider shortlists", "Transparent matching rationale", "Long-term relationship management"],
        },
      ]}
      closingTitle="Discuss where your delivery expertise could support employer demand."
      closingCopy="Speak with LevyTate about partner packages, capability verification and the standards expected from the curated provider network."
    />
  );
}