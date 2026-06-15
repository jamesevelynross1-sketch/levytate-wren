"use client";

import { FormEvent, useMemo, useState } from "react";
import { LevyTateLogo, PlatformButton, PlatformMetric, PlatformPanel } from "@/components/levytate-demo/PlatformShell";

type UserType = "Employer" | "School" | "Pupil";
type EmployerName = "Portakabin" | "Wren Kitchens" | "Connexin";

type EmployerProfile = {
  name: EmployerName;
  sector: string;
  headline: string;
  location: string;
  strengths: string[];
  pathways: Array<{ title: string; from: string; to: string; apprenticeship: string; progression: string }>;
  stories: Array<{ name: string; role: string; route: string; quote: string }>;
  apprenticeships: string[];
  challenges: Array<{ title: string; type: string; skill: string; minutes: number }>;
  colour: string;
};

type PupilPersona = {
  name: string;
  year: string;
  school: string;
  interests: string[];
  strengths: string[];
  savedEmployers: EmployerName[];
  completedChallenges: string[];
  badges: string[];
};

const employers: EmployerProfile[] = [
  {
    name: "Portakabin",
    sector: "Modular buildings, manufacturing and site delivery",
    headline: "Design, build and deliver high-quality spaces for customers across the UK.",
    location: "York and UK visitor centres",
    strengths: ["Manufacturing", "Engineering", "Customer experience", "Project delivery"],
    pathways: [
      { title: "Production to Team Leader", from: "Production Operative", to: "Production Supervisor", apprenticeship: "Level 3 Team Leader", progression: "Manufacturing leadership" },
      { title: "Technical Design Route", from: "Design Assistant", to: "Engineering Design Technician", apprenticeship: "Level 3 Engineering Design Technician", progression: "Design and technical careers" },
      { title: "Customer Hire Route", from: "Customer Advisor", to: "Account Support Lead", apprenticeship: "Level 3 Customer Service Specialist", progression: "Customer and commercial careers" },
    ],
    stories: [
      { name: "Amelia Hart", role: "Production Team Member", route: "Team Leader pathway", quote: "The route helped me understand how improvement work connects to everyday production decisions." },
      { name: "Tom Harrison", role: "Maintenance Technician", route: "Engineering pathway", quote: "I use technical evidence from real equipment, so the learning feels connected to the job." },
    ],
    apprenticeships: ["Engineering Technician", "Team Leader", "Customer Service Specialist", "Supply Chain Practitioner"],
    challenges: [
      { title: "Design a modular classroom layout", type: "Challenge", skill: "Planning", minutes: 25 },
      { title: "Spot the production quality issue", type: "Quiz", skill: "Attention to detail", minutes: 12 },
      { title: "Plan a customer site delivery", type: "Activity", skill: "Organisation", minutes: 20 },
    ],
    colour: "#ffd200",
  },
  {
    name: "Wren Kitchens",
    sector: "Retail, design, manufacturing and installation",
    headline: "Help customers design, produce and install kitchens through a national retail and manufacturing operation.",
    location: "Showrooms, manufacturing sites and support teams",
    strengths: ["Retail design", "Manufacturing excellence", "Installation", "Customer service"],
    pathways: [
      { title: "Retail Sales and Design", from: "Showroom Advisor", to: "Kitchen Designer", apprenticeship: "Level 3 Customer Service Specialist", progression: "Retail design and sales" },
      { title: "Manufacturing Route", from: "Production Operative", to: "Manufacturing Technician", apprenticeship: "Level 3 Engineering Technician", progression: "Production and engineering" },
      { title: "Installation Route", from: "Field Support", to: "Installation Coordinator", apprenticeship: "Level 3 Construction Support", progression: "Field operations" },
    ],
    stories: [
      { name: "Mia Clarke", role: "Kitchen Designer", route: "Retail design route", quote: "I learned how customer conversations, design software and confidence all connect." },
      { name: "Jordan Ellis", role: "Manufacturing Technician", route: "Engineering route", quote: "The work is practical, fast moving and full of problem solving." },
    ],
    apprenticeships: ["Customer Service Specialist", "Sales Executive", "Engineering Technician", "Team Leader"],
    challenges: [
      { title: "Create a customer kitchen brief", type: "Activity", skill: "Communication", minutes: 20 },
      { title: "Match materials to customer needs", type: "Quiz", skill: "Problem solving", minutes: 10 },
      { title: "Plan a showroom handover", type: "Challenge", skill: "Customer experience", minutes: 18 },
    ],
    colour: "#00a651",
  },
  {
    name: "Connexin",
    sector: "Digital infrastructure, connectivity and smart technology",
    headline: "Build digital networks, smart city solutions and technology services for connected communities.",
    location: "Hull, regional teams and digital operations",
    strengths: ["Digital networks", "Data", "Customer support", "Smart technology"],
    pathways: [
      { title: "Digital Support Route", from: "Support Assistant", to: "Network Support Technician", apprenticeship: "Level 3 Information Communications Technician", progression: "Technical support" },
      { title: "Data and Insight Route", from: "Data Assistant", to: "Data Analyst", apprenticeship: "Level 4 Data Analyst", progression: "Data careers" },
      { title: "Smart Cities Route", from: "Project Support", to: "IoT Project Coordinator", apprenticeship: "Level 4 Associate Project Manager", progression: "Connected infrastructure" },
    ],
    stories: [
      { name: "Aisha Khan", role: "Network Support Technician", route: "Digital support route", quote: "I liked seeing how technical skills help real customers and communities stay connected." },
      { name: "Ben Morris", role: "Data Analyst", route: "Data pathway", quote: "The best bit is turning messy data into useful decisions." },
    ],
    apprenticeships: ["Information Communications Technician", "Data Analyst", "Business Analyst", "Associate Project Manager"],
    challenges: [
      { title: "Map a connected neighbourhood", type: "Challenge", skill: "Systems thinking", minutes: 25 },
      { title: "Read a simple network status board", type: "Quiz", skill: "Digital confidence", minutes: 12 },
      { title: "Find a smart city data insight", type: "Activity", skill: "Data awareness", minutes: 20 },
    ],
    colour: "#4f46e5",
  },
];

const pupils: PupilPersona[] = [
  {
    name: "Leah Thompson",
    year: "Year 10",
    school: "Riverside Academy",
    interests: ["Design", "Making things", "Helping customers"],
    strengths: ["Creativity", "Communication", "Practical problem solving"],
    savedEmployers: ["Portakabin", "Wren Kitchens"],
    completedChallenges: ["Design a modular classroom layout", "Create a customer kitchen brief"],
    badges: ["Career Explorer", "Design Thinker", "Challenge Starter"],
  },
  {
    name: "Noah Williams",
    year: "Year 11",
    school: "Riverside Academy",
    interests: ["Technology", "Data", "Networks"],
    strengths: ["Logic", "Curiosity", "Analytical thinking"],
    savedEmployers: ["Connexin"],
    completedChallenges: ["Read a simple network status board", "Find a smart city data insight"],
    badges: ["Digital Explorer", "Data Starter"],
  },
  {
    name: "Sofia Patel",
    year: "Year 9",
    school: "Northfield High",
    interests: ["Business", "Planning", "Leadership"],
    strengths: ["Organisation", "Teamwork", "Confidence"],
    savedEmployers: ["Portakabin", "Connexin"],
    completedChallenges: ["Plan a customer site delivery"],
    badges: ["Future Leader"],
  },
];

const schools = [
  { name: "Riverside Academy", pupils: 184, activePupils: 92, activities: 318, employerViews: 641, completion: 68 },
  { name: "Northfield High", pupils: 142, activePupils: 57, activities: 146, employerViews: 284, completion: 51 },
  { name: "Eastbank School", pupils: 210, activePupils: 88, activities: 265, employerViews: 427, completion: 59 },
];

const roleNav: Record<UserType, string[]> = {
  Employer: ["Overview", "Profile", "Case Studies", "Pathways", "Activities", "Analytics"],
  School: ["Overview", "Pupil Participation", "Activity Completion", "Employer Engagement"],
  Pupil: ["Overview", "Explore Employers", "Stories", "Challenges", "Badges", "Ask LevyTate AI"],
};

export default function FutureTalentPortal() {
  const [userType, setUserType] = useState<UserType>("Employer");
  const [activeEmployer, setActiveEmployer] = useState<EmployerName>("Portakabin");
  const [activePupil, setActivePupil] = useState(pupils[0].name);
  const [activeSection, setActiveSection] = useState("Overview");
  const [savedEmployers, setSavedEmployers] = useState<EmployerName[]>(pupils[0].savedEmployers);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>(pupils[0].completedChallenges);
  const [aiResponse, setAiResponse] = useState<ReturnType<typeof buildPupilRecommendation> | null>(null);

  const employer = employers.find((item) => item.name === activeEmployer) ?? employers[0];
  const pupil = pupils.find((item) => item.name === activePupil) ?? pupils[0];

  const employerAnalytics = useMemo(() => {
    const profileViews = activeEmployer === "Portakabin" ? 428 : activeEmployer === "Wren Kitchens" ? 392 : 354;
    const challengeStarts = employer.challenges.length * 46 + savedEmployers.filter((item) => item === activeEmployer).length * 8;
    return {
      profileViews,
      challengeStarts,
      savedByPupils: pupils.filter((item) => item.savedEmployers.includes(activeEmployer)).length * 24,
      schoolReach: activeEmployer === "Portakabin" ? 18 : activeEmployer === "Wren Kitchens" ? 16 : 14,
    };
  }, [activeEmployer, employer.challenges.length, savedEmployers]);

  function switchUser(next: UserType) {
    setUserType(next);
    setActiveSection("Overview");
  }

  function switchPupil(nextName: string) {
    const nextPupil = pupils.find((item) => item.name === nextName);
    if (!nextPupil) return;
    setActivePupil(nextName);
    setSavedEmployers(nextPupil.savedEmployers);
    setCompletedChallenges(nextPupil.completedChallenges);
    setAiResponse(null);
  }

  function toggleEmployer(name: EmployerName) {
    setSavedEmployers((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function completeChallenge(title: string) {
    setCompletedChallenges((current) => current.includes(title) ? current : [...current, title]);
  }

  function askAI(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setAiResponse(buildPupilRecommendation(String(data.get("question") || ""), pupil));
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8faf8_0%,#eef5f2_48%,#f7f8f5_100%)] text-[#102c3d]">
      <div className="grid min-h-screen lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#102c3d]/[0.08] bg-white/95 px-4 py-5 shadow-[8px_0_32px_rgba(16,44,61,0.035)] lg:flex lg:h-screen lg:flex-col">
          <div className="px-2">
            <LevyTateLogo className="[--levytate-logo-size:2.6rem]" />
          </div>
          <div className="mt-5 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0b6f63]">Strategic module</p>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em]">Future Talent Portal</h1>
            <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">Employer, school and pupil engagement powered by LevyTate.</p>
          </div>
          <nav className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#102c3d]/32">{userType} workspace</p>
              <div className="mt-2 grid gap-1">
                {roleNav[userType].map((item) => (
                  <button key={item} onClick={() => setActiveSection(item)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeSection === item ? "bg-[#edf6f2] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/56 hover:bg-[#f7faf6] hover:text-[#102c3d]"}`}>
                    <span className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] font-semibold ${activeSection === item ? "bg-white text-[#159b8f]" : "bg-[#f8faf4] text-[#102c3d]/44"}`}>{item.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span>
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </div>
          </nav>
          <div className="mt-5 rounded-2xl bg-[#f8faf4] px-4 py-3">
            <p className="text-xs font-semibold">Commercial signal</p>
            <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">Early engagement creates employer demand, future apprenticeship pipelines and advisory conversations.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#102c3d]/[0.08] bg-white/92 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-5 py-3 sm:px-7 lg:px-8">
              <div className="flex h-10 min-w-[220px] flex-1 items-center rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm text-[#102c3d]/44">Search careers, schools or activities</div>
              <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Employer</span>
                <select value={activeEmployer} onChange={(event) => setActiveEmployer(event.target.value as EmployerName)} className="h-full min-w-0 bg-transparent text-sm font-medium text-[#102c3d]/74 outline-none">
                  {employers.map((item) => <option key={item.name}>{item.name}</option>)}
                </select>
              </label>
              {userType === "Pupil" ? (
                <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Pupil</span>
                  <select value={activePupil} onChange={(event) => switchPupil(event.target.value)} className="h-full min-w-0 bg-transparent text-sm font-medium text-[#102c3d]/74 outline-none">
                    {pupils.map((item) => <option key={item.name}>{item.name}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="flex min-h-10 flex-wrap items-center rounded-[1.25rem] border border-[#102c3d]/[0.06] bg-[#edf5f1] p-1">
                {(["Employer", "School", "Pupil"] as UserType[]).map((item) => (
                  <button key={item} onClick={() => switchUser(item)} className={`h-8 rounded-full px-3 text-xs font-semibold transition ${userType === item ? "bg-white text-[#102c3d] shadow-[0_6px_16px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/52 hover:text-[#102c3d]"}`}>{item}</button>
                ))}
              </div>
            </div>
          </header>

          <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 py-5 sm:px-7 lg:px-8 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              <Hero userType={userType} employer={employer} pupil={pupil} />
              {userType === "Employer" ? <EmployerWorkspace employer={employer} analytics={employerAnalytics} activeSection={activeSection} /> : null}
              {userType === "School" ? <SchoolWorkspace activeSection={activeSection} /> : null}
              {userType === "Pupil" ? (
                <PupilWorkspace
                  activeSection={activeSection}
                  pupil={pupil}
                  employers={employers}
                  savedEmployers={savedEmployers}
                  completedChallenges={completedChallenges}
                  aiResponse={aiResponse}
                  onToggleEmployer={toggleEmployer}
                  onCompleteChallenge={completeChallenge}
                  onAskAI={askAI}
                />
              ) : null}
            </div>
            <aside className="grid h-fit gap-4 2xl:sticky 2xl:top-20">
              <GuidePanel userType={userType} />
              <PlatformPanel eyebrow="Pipeline signal" title="Future talent value">
                <div className="grid gap-3">
                  <SignalRow label="Employer reach" value="3 employers" />
                  <SignalRow label="School participation" value="416 pupils" />
                  <SignalRow label="Activities completed" value="729" />
                  <SignalRow label="Saved employers" value="128" />
                </div>
              </PlatformPanel>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Hero({ userType, employer, pupil }: { userType: UserType; employer: EmployerProfile; pupil: PupilPersona }) {
  const title = userType === "Employer" ? `${employer.name} future talent hub` : userType === "School" ? "School future talent dashboard" : `${pupil.name}'s career discovery hub`;
  const copy = userType === "Employer"
    ? "Build school relationships, showcase real employee stories and turn early career interest into future apprenticeship demand."
    : userType === "School"
      ? "Track pupil participation, activity completion and employer engagement from one guided LevyTate workspace."
      : "Explore employers, complete challenges, earn badges and ask LevyTate AI which careers might suit your interests.";

  return (
    <section className="rounded-[1.1rem] border border-[#102c3d]/[0.065] bg-white/96 p-5 shadow-[0_12px_30px_rgba(16,44,61,0.045)]">
      <p className="w-fit rounded-full bg-[#fff4bd] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7b6100]">Future Talent Portal</p>
      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-end">
        <div>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#102c3d]">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#102c3d]/62">{copy}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <PlatformMetric label="Career routes" value="9" copy="Mapped employer pathways" />
          <PlatformMetric label="Challenges" value="9" copy="Quizzes and activities" />
          <PlatformMetric label="School reach" value="3" copy="Demo school partners" />
        </div>
      </div>
    </section>
  );
}

function EmployerWorkspace({ employer, analytics, activeSection }: { employer: EmployerProfile; analytics: { profileViews: number; challengeStarts: number; savedByPupils: number; schoolReach: number }; activeSection: string }) {
  return (
    <div className="space-y-5">
      {(activeSection === "Overview" || activeSection === "Analytics") ? (
        <section className="grid gap-3 md:grid-cols-4">
          <PlatformMetric label="Profile views" value={analytics.profileViews} copy="Pupil employer profile visits" />
          <PlatformMetric label="Challenge starts" value={analytics.challengeStarts} copy="Activities opened by pupils" />
          <PlatformMetric label="Saved by pupils" value={analytics.savedByPupils} copy="Future interest signal" />
          <PlatformMetric label="School reach" value={analytics.schoolReach} copy="Schools engaged this term" />
        </section>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Profile") ? (
        <PlatformPanel eyebrow="Employer profile" title={employer.name}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-sm leading-6 text-[#102c3d]/64">{employer.headline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {employer.strengths.map((item) => <Tag key={item}>{item}</Tag>)}
              </div>
            </div>
            <div className="rounded-2xl border border-[#102c3d]/[0.06] p-4" style={{ backgroundColor: employer.colour }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/56">Employer sector</p>
              <p className="mt-2 text-lg font-semibold leading-6">{employer.sector}</p>
              <p className="mt-2 text-sm font-medium text-[#102c3d]/64">{employer.location}</p>
            </div>
          </div>
        </PlatformPanel>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Case Studies") ? <CaseStudies employer={employer} /> : null}
      {(activeSection === "Overview" || activeSection === "Pathways") ? <PathwayMaps employer={employer} /> : null}
      {(activeSection === "Overview" || activeSection === "Activities") ? <ActivitiesPanel employer={employer} /> : null}
    </div>
  );
}

function SchoolWorkspace({ activeSection }: { activeSection: string }) {
  const totalActive = schools.reduce((sum, item) => sum + item.activePupils, 0);
  const totalActivities = schools.reduce((sum, item) => sum + item.activities, 0);

  return (
    <div className="space-y-5">
      {(activeSection === "Overview" || activeSection === "Pupil Participation") ? (
        <section className="grid gap-3 md:grid-cols-4">
          <PlatformMetric label="Active pupils" value={totalActive} copy="Participating this term" />
          <PlatformMetric label="Activities completed" value={totalActivities} copy="Career tasks completed" />
          <PlatformMetric label="Employer views" value="1,352" copy="Profile and story views" />
          <PlatformMetric label="Completion rate" value="61%" copy="Average activity completion" />
        </section>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Pupil Participation" || activeSection === "Activity Completion") ? (
        <PlatformPanel eyebrow="School dashboard" title="Pupil participation">
          <div className="grid gap-3">
            {schools.map((school) => (
              <article key={school.name} className="grid gap-3 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_120px] md:items-center">
                <div>
                  <p className="font-semibold">{school.name}</p>
                  <p className="mt-1 text-sm text-[#102c3d]/58">{school.activePupils} of {school.pupils} pupils active</p>
                </div>
                <MiniMetric label="Activities" value={school.activities} />
                <MiniMetric label="Employer views" value={school.employerViews} />
                <MiniMetric label="Completion" value={`${school.completion}%`} />
              </article>
            ))}
          </div>
        </PlatformPanel>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Employer Engagement") ? (
        <PlatformPanel eyebrow="Employer engagement" title="Most viewed employers">
          <div className="grid gap-4 md:grid-cols-3">
            {employers.map((employer, index) => (
              <article key={employer.name} className="rounded-2xl border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_8px_20px_rgba(16,44,61,0.035)]">
                <p className="text-sm font-semibold">{employer.name}</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{employer.sector}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ecf6f2]">
                  <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${[84, 76, 68][index]}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-[#102c3d]/54">{[84, 76, 68][index]} engagement score</p>
              </article>
            ))}
          </div>
        </PlatformPanel>
      ) : null}
    </div>
  );
}

function PupilWorkspace({
  activeSection,
  pupil,
  employers,
  savedEmployers,
  completedChallenges,
  aiResponse,
  onToggleEmployer,
  onCompleteChallenge,
  onAskAI,
}: {
  activeSection: string;
  pupil: PupilPersona;
  employers: EmployerProfile[];
  savedEmployers: EmployerName[];
  completedChallenges: string[];
  aiResponse: ReturnType<typeof buildPupilRecommendation> | null;
  onToggleEmployer: (name: EmployerName) => void;
  onCompleteChallenge: (title: string) => void;
  onAskAI: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="space-y-5">
      {(activeSection === "Overview" || activeSection === "Badges") ? (
        <section className="grid gap-3 md:grid-cols-4">
          <PlatformMetric label="Saved employers" value={savedEmployers.length} copy="Favourite employer profiles" />
          <PlatformMetric label="Challenges done" value={completedChallenges.length} copy="Completed quizzes and tasks" />
          <PlatformMetric label="Badges earned" value={pupil.badges.length} copy="Career discovery badges" />
          <PlatformMetric label="Career fit" value="86%" copy="Matched to interests" />
        </section>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Explore Employers") ? (
        <PlatformPanel eyebrow="Explore employers" title="Employer discovery">
          <div className="grid gap-4 lg:grid-cols-3">
            {employers.map((employer) => (
              <article key={employer.name} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 shadow-[0_8px_20px_rgba(16,44,61,0.035)]">
                <div className="h-2 rounded-full" style={{ backgroundColor: employer.colour }} />
                <h3 className="mt-4 text-lg font-semibold">{employer.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{employer.headline}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {employer.strengths.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}
                </div>
                <PlatformButton className="mt-4 w-full" variant={savedEmployers.includes(employer.name) ? "amber" : "soft"} onClick={() => onToggleEmployer(employer.name)}>
                  {savedEmployers.includes(employer.name) ? "Saved" : "Save employer"}
                </PlatformButton>
              </article>
            ))}
          </div>
        </PlatformPanel>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Stories") ? <AllStories /> : null}

      {(activeSection === "Overview" || activeSection === "Challenges") ? (
        <PlatformPanel eyebrow="Challenges and quizzes" title="Build skills through short activities">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {employers.flatMap((employer) => employer.challenges.map((challenge) => ({ ...challenge, employer: employer.name }))).map((challenge) => (
              <article key={`${challenge.employer}-${challenge.title}`} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_8px_20px_rgba(16,44,61,0.035)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{challenge.type} - {challenge.employer}</p>
                <h3 className="mt-2 text-base font-semibold">{challenge.title}</h3>
                <p className="mt-2 text-sm text-[#102c3d]/58">{challenge.skill} - {challenge.minutes} minutes</p>
                <PlatformButton className="mt-4" variant={completedChallenges.includes(challenge.title) ? "amber" : "dark"} onClick={() => onCompleteChallenge(challenge.title)}>
                  {completedChallenges.includes(challenge.title) ? "Completed" : "Complete activity"}
                </PlatformButton>
              </article>
            ))}
          </div>
        </PlatformPanel>
      ) : null}

      {(activeSection === "Overview" || activeSection === "Ask LevyTate AI") ? (
        <PlatformPanel eyebrow="Ask LevyTate AI" title="Career and apprenticeship guidance">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={onAskAI} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
              <p className="text-sm leading-6 text-[#102c3d]/62">Ask about careers, industries, apprenticeships or future progression routes. LevyTate will use your interests and strengths to suggest next steps.</p>
              <textarea name="question" rows={4} placeholder="I like technology and problem solving. What careers could suit me?" className="mt-4 min-h-[112px] w-full rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
              <PlatformButton className="mt-4">Generate recommendation</PlatformButton>
            </form>
            <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Pupil profile</p>
              <p className="mt-2 text-sm font-semibold">{pupil.name}</p>
              <p className="mt-1 text-sm text-[#102c3d]/58">{pupil.year} - {pupil.school}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...pupil.interests, ...pupil.strengths].slice(0, 6).map((item) => <Tag key={item}>{item}</Tag>)}
              </div>
            </div>
          </div>
          {aiResponse ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <InfoCard label="Recommended industry" value={aiResponse.industry} copy={aiResponse.reason} />
              <InfoCard label="Suggested employer" value={aiResponse.employer} copy={aiResponse.employerReason} />
              <InfoCard label="Progression route" value={aiResponse.route} copy={aiResponse.nextStep} />
            </div>
          ) : null}
        </PlatformPanel>
      ) : null}
    </div>
  );
}

function CaseStudies({ employer }: { employer: EmployerProfile }) {
  return (
    <PlatformPanel eyebrow="Employee stories" title="Real career examples">
      <div className="grid gap-4 md:grid-cols-2">
        {employer.stories.map((story) => (
          <article key={story.name} className="rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-sm font-semibold">{story.name}</p>
            <p className="mt-1 text-xs font-medium text-[#102c3d]/52">{story.role} - {story.route}</p>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{story.quote}</p>
          </article>
        ))}
      </div>
    </PlatformPanel>
  );
}

function AllStories() {
  return (
    <PlatformPanel eyebrow="Employee stories" title="People behind the pathways">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {employers.flatMap((employer) => employer.stories.map((story) => ({ ...story, employer: employer.name }))).map((story) => (
          <article key={`${story.employer}-${story.name}`} className="rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{story.employer}</p>
            <p className="mt-2 text-sm font-semibold">{story.name}</p>
            <p className="mt-1 text-xs font-medium text-[#102c3d]/52">{story.role}</p>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{story.quote}</p>
          </article>
        ))}
      </div>
    </PlatformPanel>
  );
}

function PathwayMaps({ employer }: { employer: EmployerProfile }) {
  return (
    <PlatformPanel eyebrow="Career pathway maps" title="From school interest to employment">
      <div className="grid gap-4">
        {employer.pathways.map((pathway) => (
          <article key={pathway.title} className="grid gap-4 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 lg:grid-cols-[1fr_1fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold">{pathway.title}</p>
              <p className="mt-1 text-xs text-[#102c3d]/52">{pathway.progression}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#102c3d]/64">
              <span>{pathway.from}</span>
              <span className="text-[#159b8f]">-&gt;</span>
              <span>{pathway.to}</span>
            </div>
            <p className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{pathway.apprenticeship}</p>
          </article>
        ))}
      </div>
    </PlatformPanel>
  );
}

function ActivitiesPanel({ employer }: { employer: EmployerProfile }) {
  return (
    <PlatformPanel eyebrow="Challenges and quizzes" title="Skills activities">
      <div className="grid gap-4 md:grid-cols-3">
        {employer.challenges.map((challenge) => (
          <article key={challenge.title} className="rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{challenge.type}</p>
            <h3 className="mt-2 text-base font-semibold">{challenge.title}</h3>
            <p className="mt-2 text-sm text-[#102c3d]/58">{challenge.skill} - {challenge.minutes} minutes</p>
          </article>
        ))}
      </div>
    </PlatformPanel>
  );
}

function GuidePanel({ userType }: { userType: UserType }) {
  const copy: Record<UserType, string> = {
    Employer: "Employers can turn school engagement into measurable future apprenticeship demand and early talent insight.",
    School: "Schools can see which pupils are participating, what activities are being completed and which employers are building awareness.",
    Pupil: "Pupils can explore employers, complete challenges, save favourites and ask LevyTate AI for career guidance.",
  };

  return (
    <PlatformPanel eyebrow="LevyTate guide" title={`${userType} view`}>
      <p className="text-sm leading-6 text-[#102c3d]/62">{copy[userType]}</p>
    </PlatformPanel>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.06]">{children}</span>;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/36">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fbfa] px-3 py-2">
      <span className="text-xs font-medium text-[#102c3d]/54">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

function InfoCard({ label, value, copy }: { label: string; value: string; copy: string }) {
  return (
    <article className="rounded-2xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{label}</p>
      <h3 className="mt-2 text-base font-semibold">{value}</h3>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{copy}</p>
    </article>
  );
}

function buildPupilRecommendation(question: string, pupil: PupilPersona) {
  const prompt = `${question} ${pupil.interests.join(" ")} ${pupil.strengths.join(" ")}`.toLowerCase();

  if (prompt.includes("data") || prompt.includes("technology") || prompt.includes("network") || prompt.includes("digital")) {
    return {
      industry: "Digital infrastructure and data",
      employer: "Connexin",
      route: "Information Communications Technician or Data Analyst",
      reason: "Your interests point towards technology, systems, analysis and problem solving.",
      employerReason: "Connexin gives pupils a way to connect digital curiosity with real networks, data and smart technology careers.",
      nextStep: "Complete the network status challenge, then compare digital support and data analyst apprenticeship routes.",
    };
  }

  if (prompt.includes("design") || prompt.includes("customer") || prompt.includes("creative")) {
    return {
      industry: "Retail design and customer experience",
      employer: "Wren Kitchens",
      route: "Customer Service Specialist or Sales Executive",
      reason: "Your strengths suggest you may enjoy combining creativity, communication and practical customer problem solving.",
      employerReason: "Wren Kitchens shows how design, sales, production and installation can connect into one customer journey.",
      nextStep: "Complete the customer kitchen brief activity and save the Retail Sales and Design pathway.",
    };
  }

  return {
    industry: "Manufacturing, engineering and project delivery",
    employer: "Portakabin",
    route: "Team Leader or Engineering Technician",
    reason: "Your profile suggests practical problem solving, organisation and curiosity about how things are made.",
    employerReason: "Portakabin gives pupils a clear view of manufacturing, technical design, customer delivery and site operations careers.",
    nextStep: "Complete the modular classroom challenge, then explore the Production to Team Leader pathway.",
  };
}
