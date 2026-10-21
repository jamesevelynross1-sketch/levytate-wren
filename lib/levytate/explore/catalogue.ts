import type { ApprenticeshipStandard } from "@/lib/levytate/domain/types";

/**
 * Explore is a public discovery surface, not an employer programme approval list.
 * Only approved apprenticeship standards are searchable. Editorial copy is reviewed
 * separately from government source metadata; we never infer learning outcomes
 * from a title or tell someone that funding/eligibility is guaranteed.
 */
export type ExploreStory = {
  hook: string;
  introduction: string;
  outcomes: [string, string, string];
  suitability: string;
  reality: string;
  theme: string;
};

export type ExploreStandard = {
  code: string;
  title: string;
  level: number;
  route: string;
  duration: string;
  officialUrl: string;
  sourceVerified: string;
  version: string;
  jobTitles: string[];
  story: ExploreStory | null;
  featured: boolean;
};

export const FEATURED_CODES = ["ST1512", "ST0118", "ST0117", "ST0310", "ST0384", "ST0385", "ST0120", "ST0810"] as const;

export const EXPLORER_INTERESTS = [
  { id: "ai", title: "Make work smarter", subtitle: "AI, automation & digital tools", terms: ["artificial intelligence", "automation", "digital", "software", "data", "information"] },
  { id: "people", title: "Lead with confidence", subtitle: "People, teams & management", terms: ["manager", "leader", "people", "coaching", "supervisor", "human resources"] },
  { id: "projects", title: "Make ideas happen", subtitle: "Projects, improvement & change", terms: ["project", "improvement", "business analyst", "change", "operations"] },
  { id: "business", title: "Grow your expertise", subtitle: "Commercial, finance & business skills", terms: ["accounting", "finance", "procurement", "supply", "marketing", "business", "customer"] },
] as const;

const editorial: Record<string, ExploreStory> = {
  ST1512: {
    hook: "What if the most frustrating part of your working day simply stopped taking up your time?",
    introduction: "This route is about spotting where work gets unnecessarily complicated and learning how AI and automation can help. Think of repetitive admin, disconnected systems or processes everyone works around. You could help your organisation solve problems like these with practical technology and thoughtful change.",
    outcomes: [
      "Find opportunities to improve how work gets done, then assess whether automation is appropriate.",
      "Build and test useful AI-enabled or automated workflows, with human oversight where it matters.",
      "Help colleagues adopt improvements safely, rather than just introducing another piece of software.",
    ],
    suitability: "Worth exploring if you're curious about problem-solving, technology and making everyday work better. You do not need to assume you must become a software developer, but you will need genuine opportunities to apply the learning.",
    reality: "You'll need support from your employer, dedicated learning time and suitable work-based projects. Tools and responsibilities depend on your role and training provider.",
    theme: "Technology & change",
  },
  ST0118: {
    hook: "Turn 'we think' into 'here's what the evidence says'.",
    introduction: "If you enjoy asking why things happen, this could turn that curiosity into a valuable professional skill. You'll develop ways to work with information, uncover patterns and explain what the data means to people making decisions.",
    outcomes: [
      "Work with data to answer genuine questions in your organisation.",
      "Spot trends and explain findings in a way other people understand.",
      "Use analytical techniques and tools to support better decisions.",
    ],
    suitability: "A possibility if your role involves data, reporting, performance information or finding answers to business questions.",
    reality: "This is practical technical development, not just learning to use a spreadsheet. Your employer will need to provide the right work and support.",
    theme: "Data & insight",
  },
  ST0117: {
    hook: "Become the person who gets to the bottom of what really needs to change.",
    introduction: "Organisations often know something isn't working without knowing why. Business analysts listen, ask better questions, connect people and processes, and help teams define improvements that actually solve the problem.",
    outcomes: [
      "Understand where processes, systems or services are falling short.",
      "Bring together different perspectives to define the real need.",
      "Help shape and evaluate practical improvements.",
    ],
    suitability: "Particularly relevant if you work across teams, solve operational problems or want to play a bigger part in change.",
    reality: "You'll need access to real business problems and stakeholders so you can apply the analytical skills.",
    theme: "Problem-solving & change",
  },
  ST0310: {
    hook: "Take a good idea and help make it happen.",
    introduction: "Projects are how businesses turn plans into results. This apprenticeship develops the organisation, communication and judgement needed to keep people moving towards the same outcome.",
    outcomes: [
      "Help plan work, coordinate people and understand risks.",
      "Track progress and communicate clearly with stakeholders.",
      "Support projects from initial idea through to delivery.",
    ],
    suitability: "Useful if you're starting to coordinate initiatives, support change or want more responsibility for getting things delivered.",
    reality: "The learning needs to be grounded in genuine project activities at work, with the right level of responsibility and support.",
    theme: "Projects & delivery",
  },
  ST0384: {
    hook: "Good teams don't just happen. Learn how to help yours thrive.",
    introduction: "Moving from doing the work yourself to helping others do their best is a big change. This apprenticeship helps you build the foundations of leading a team, communicating expectations and supporting people.",
    outcomes: [
      "Build confidence in everyday team leadership and communication.",
      "Help organise workloads and tackle problems constructively.",
      "Support colleagues' performance and development.",
    ],
    suitability: "Relevant if you're taking on team-leading responsibilities or already coordinate colleagues and want to develop your approach.",
    reality: "You'll need practical opportunities to develop leadership skills in your role. A qualification alone doesn't confer a promotion.",
    theme: "People & leadership",
  },
  ST0385: {
    hook: "Move from managing the day to shaping what happens next.",
    introduction: "Operations management connects people, resources and decisions. This pathway is about understanding the bigger picture and improving how a function or organisation performs.",
    outcomes: [
      "Make better decisions about operational performance and priorities.",
      "Lead people and manage resources more effectively.",
      "Help deliver improvement and longer-term business objectives.",
    ],
    suitability: "Worth discussing if you already manage operational responsibilities or are moving into a position with broader accountability.",
    reality: "This requires appropriate management responsibilities and employer commitment; it isn't an automatic route into a senior job.",
    theme: "Management & operations",
  },
  ST0120: {
    hook: "Be the person who makes technology easier for everyone else.",
    introduction: "Every organisation needs people who can make digital tools work for real humans. You could help colleagues overcome problems, feel more confident and make better use of everyday technology.",
    outcomes: [
      "Support people as they use workplace digital tools and systems.",
      "Help solve practical technical problems and improve user experience.",
      "Build professional digital service and communication skills.",
    ],
    suitability: "An option if you enjoy technology, supporting colleagues and finding clear answers to everyday digital problems.",
    reality: "You'll need to work in a role where digital support forms a meaningful part of your responsibilities.",
    theme: "Digital support",
  },
  ST0810: {
    hook: "Discover how the things a business buys shape everything it delivers.",
    introduction: "Procurement is about more than placing orders. It's about understanding needs, working with suppliers and helping an organisation make thoughtful, effective purchasing decisions.",
    outcomes: [
      "Understand the stages of sourcing and buying goods or services.",
      "Develop supplier communication and commercial awareness.",
      "Support more effective purchasing processes and decisions.",
    ],
    suitability: "Relevant if you work with purchasing, suppliers, contracts, operations or commercial administration.",
    reality: "The right work-based responsibilities and employer support matter as much as your interest.",
    theme: "Commercial & procurement",
  },
};

function normaliseDuration(raw: string): string {
  const value = raw.trim();
  return /^\d+$/.test(value) && Number(value) > 0 ? value + " months" : value || "Confirm with provider";
}

const aiPractitioner: ExploreStandard = {
  code: "ST1512",
  title: "Artificial intelligence (AI) and automation practitioner",
  level: 4,
  route: "Digital",
  duration: "18 months",
  officialUrl: "https://skillsengland.education.gov.uk/apprenticeship-standards/st1512",
  sourceVerified: "2026-10-21",
  version: "2.1",
  jobTitles: ["Automation practitioner", "AI adoption", "Digital improvement"],
  story: editorial.ST1512,
  featured: true,
};

export function createExploreCatalogue(source: ApprenticeshipStandard[]): ExploreStandard[] {
  const standards: ExploreStandard[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    const code = (item.referenceCode || item.id).toUpperCase();
    if (
      item.programmeType !== "Apprenticeship standard" ||
      (item.sourceStatus || "").toLowerCase() !== "approved for delivery" ||
      !/^ST\d{4}$/.test(code) ||
      seen.has(code)
    ) continue;

    seen.add(code);
    standards.push({
      code,
      title: item.title,
      level: item.level,
      route: item.occupationalRoute,
      duration: normaliseDuration(item.typicalDuration),
      officialUrl: item.officialUrl,
      sourceVerified: item.lastVerified,
      version: item.version,
      jobTitles: (item.jobTitles || []).slice(0, 10),
      story: editorial[code] || null,
      featured: FEATURED_CODES.some(featured => featured === code),
    });
  }

  if (!seen.has("ST1512")) standards.push(aiPractitioner);
  return standards.sort((a, b) => a.title.localeCompare(b.title));
}

export function searchExploreCatalogue(standards: ExploreStandard[], query: string, interest?: string, level?: number) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8);
  const chosen = EXPLORER_INTERESTS.find(group => group.id === interest);
  return standards
    .filter(item => !level || item.level === level)
    .map(item => {
      const indexed = [item.title, item.code, item.route, item.story?.theme || "", ...item.jobTitles].join(" ").toLowerCase();
      const searchMatch = !terms.length || terms.every(term => indexed.includes(term));
      const interestScore = chosen ? chosen.terms.filter(term => indexed.includes(term)).length : 0;
      return { item, searchMatch, interestScore };
    })
    .filter(result => result.searchMatch && (!chosen || result.interestScore > 0))
    .sort((a, b) => b.interestScore - a.interestScore || Number(b.item.featured) - Number(a.item.featured) || a.item.title.localeCompare(b.item.title))
    .map(result => result.item);
}
