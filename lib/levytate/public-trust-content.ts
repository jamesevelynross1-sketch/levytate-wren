export type PublicTrustSlug = "privacy" | "early-access-terms" | "data-processing" | "support" | "account-help" | "data-rights";

export type PublicTrustSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type PublicTrustPage = {
  slug: PublicTrustSlug;
  title: string;
  summary: string;
  version: string;
  effectiveDate: string;
  lastReviewedDate: string;
  publicOwner: string;
  contactLabel: string;
  contactEmail: string;
  sections: readonly PublicTrustSection[];
};

const shared = {
  version: "1.0",
  effectiveDate: "4 August 2026",
  lastReviewedDate: "4 August 2026",
  publicOwner: "LevyTate",
  contactLabel: "LevyTate support",
  contactEmail: "hello@levytate.co.uk",
} as const;

export const publicTrustPages: Readonly<Record<PublicTrustSlug, PublicTrustPage>> = {
  privacy: {
    ...shared,
    slug: "privacy",
    title: "Privacy notice",
    summary: "How personal information is handled when you use LevyTate.",
    sections: [
      { heading: "Information we use", paragraphs: ["LevyTate uses account, organisation, application, apprenticeship and service-usage information needed to provide a role-based apprenticeship service."], bullets: ["Account and work-contact details", "Organisation membership and access role", "Application and learner-lifecycle records supplied through the service", "Security, authentication and service-delivery events"] },
      { heading: "How information is used", paragraphs: ["Information is used to operate secure access, deliver role-appropriate workflows, maintain records requested by an authorised organisation, support users and protect the service."], bullets: ["Deliver and support the LevyTate service", "Resolve organisation and role access", "Protect accounts and investigate service problems", "Maintain operational and audit records"] },
      { heading: "Who can see information", paragraphs: ["Access is restricted by organisation and role. Authorised employer users see only the information their role permits. LevyTate service providers may process limited information where needed to host, authenticate, deliver email or operate enabled service functions."] },
      { heading: "Keeping information", paragraphs: ["Information is kept only while needed for the service, security, support and applicable organisational requirements. Detailed retention periods are being approved before live employer onboarding; requests about a specific record can be made through the data-rights route."] },
      { heading: "Your choices and rights", paragraphs: ["You can ask for help with access, correction, deletion, restriction or another data-rights request. The available outcome depends on the request and the obligations applying to the relevant organisation and record."], bullets: ["Use the Data rights page for a privacy request", "Use Account help for access problems", "Do not send passwords, sign-in links or credentials by email"] },
    ],
  },
  "early-access-terms": {
    ...shared,
    slug: "early-access-terms",
    title: "Early Access terms",
    summary: "The operating conditions for controlled LevyTate Early Access.",
    sections: [
      { heading: "Controlled access", paragraphs: ["Early Access is invitation-only. Access is personal, limited to the authorised organisation and role, and may be changed, suspended or withdrawn to protect users or the service."] },
      { heading: "Responsible use", paragraphs: ["Use LevyTate only for authorised apprenticeship and workforce-development activity. Keep your work email secure and never forward a sign-in link or allow another person to use your account."] },
      { heading: "Early Access service", paragraphs: ["Early Access functionality may change as LevyTate is tested and improved. Some features are intentionally unavailable. Users should follow their organisation’s approved decision and record-keeping processes where these extend beyond LevyTate."] },
      { heading: "Information and decisions", paragraphs: ["LevyTate supports operational work but does not replace professional, legal, funding or employment advice. Organisations remain responsible for decisions made by their authorised users."] },
      { heading: "Problems and ending access", paragraphs: ["Report access, security or service problems promptly through Support. When access ends, protected workspace access is revoked; handling of existing records is addressed with the relevant organisation."] },
    ],
  },
  "data-processing": {
    ...shared,
    slug: "data-processing",
    title: "Data processing overview",
    summary: "A factual overview of how LevyTate service data moves through the platform.",
    sections: [
      { heading: "Service processing", paragraphs: ["LevyTate processes information supplied by authorised users and organisations to provide applications, approvals, provider management, learner operations, reporting, authentication and support."] },
      { heading: "Access boundaries", paragraphs: ["Organisation membership and canonical role are revalidated server-side. Employer operational records are organisation-scoped. Platform support access is separated from normal employer decisions."] },
      { heading: "Service providers", paragraphs: ["LevyTate uses selected service providers for hosting, database and authentication services, and transactional email. An additional provider is used only where an AI-assisted function is enabled. Provider arrangements and disclosures are reviewed before live employer onboarding."] },
      { heading: "Security and lifecycle", paragraphs: ["Authentication uses time-limited sign-in links and protected sessions. Access can be revoked. Operational and security records follow controlled retention and deletion processes as those schedules are approved."] },
      { heading: "Organisation documentation", paragraphs: ["Any organisation-specific processing agreement, instructions or data schedule must be approved for that organisation before live personal data is onboarded."] },
    ],
  },
  support: {
    ...shared,
    slug: "support",
    title: "Support",
    summary: "Help with LevyTate access, operation and service issues.",
    sections: [
      { heading: "How to get help", paragraphs: ["Email LevyTate support with a short description of the issue, the page you were using and the organisation you are trying to access. Support will verify identity and access before discussing protected account information."] },
      { heading: "Security concerns", paragraphs: ["Report a suspected account, privacy or security issue promptly. Do not include passwords, magic links, authentication tokens, database credentials or sensitive learner details in an email."] },
      { heading: "What happens next", paragraphs: ["Requests are triaged according to impact and available information. Response times are not fixed during Early Access."] },
    ],
  },
  "account-help": {
    ...shared,
    slug: "account-help",
    title: "Account help",
    summary: "Safe steps for sign-in and workspace access problems.",
    sections: [
      { heading: "Sign-in help", paragraphs: ["Use the work email authorised by your organisation. For privacy and security, the sign-in screen gives the same response whether or not an address is authorised."] },
      { heading: "If no email arrives", paragraphs: ["Check junk or spam, confirm the address was typed correctly, allow a short time for delivery and request one new link. Only the newest usable link should be opened."] },
      { heading: "Wrong role or organisation", paragraphs: ["Sign out and contact Support. State the organisation and role you expected, but do not send a sign-in link, password, cookie, token or credential."] },
      { heading: "Lost or changed access", paragraphs: ["Access may be inactive, expired or revoked. Support will not confirm account or membership details until identity has been checked."] },
    ],
  },
  "data-rights": {
    ...shared,
    slug: "data-rights",
    title: "Data rights",
    summary: "How to raise a request about personal information in LevyTate.",
    sections: [
      { heading: "Make a request", paragraphs: ["Email LevyTate support and describe the information or outcome you are asking about. You may ask about access, correction, deletion, restriction or another privacy concern."] },
      { heading: "Identity and organisation checks", paragraphs: ["Identity and the relevant organisation must be verified before protected information is disclosed or changed. LevyTate may need to coordinate with the organisation responsible for the record."] },
      { heading: "Send information safely", paragraphs: ["Do not email passwords, magic links, authentication tokens, credentials or unnecessary sensitive information. Support will explain a safer route if more evidence is needed."] },
      { heading: "Outcome", paragraphs: ["The response and available action depend on the request, the record and the responsibilities applying to LevyTate and the relevant organisation."] },
    ],
  },
};

export const publicTrustLinks = [
  { href: "/levytate/privacy", label: "Privacy" },
  { href: "/levytate/early-access-terms", label: "Terms" },
  { href: "/levytate/data-processing", label: "Data processing" },
  { href: "/levytate/support", label: "Support" },
  { href: "/levytate/account-help", label: "Account help" },
  { href: "/levytate/data-rights", label: "Data rights" },
] as const;

export function getPublicTrustPage(slug: PublicTrustSlug) {
  return publicTrustPages[slug];
}
