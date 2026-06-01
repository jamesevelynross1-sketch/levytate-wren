"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

type Experience = "user" | "admin";

type Pathway = {
  title: string;
  standard: string;
  audience: string;
  businessBenefit: string;
  learnerBenefit: string;
  status: "Live" | "Ready" | "Draft" | "Needs provider" | "Needs approval";
  deliveryPartner: string;
  duration: string;
};

type RequestItem = {
  id: number;
  name: string;
  role: string;
  department: string;
  pathway: string;
  manager: string;
  status: string;
  note?: string;
};

const pathways: Pathway[] = [
  {
    title: "Procurement & Commercial",
    standard: "L4 Commercial Procurement & Supply",
    audience: "Framework, procurement, supplier engagement and commercial support colleagues.",
    businessBenefit: "Stronger commercial confidence and more consistent framework delivery.",
    learnerBenefit: "Recognised procurement skills with a practical progression route.",
    status: "Live",
    deliveryPartner: "Approved Provider A",
    duration: "18 to 24 months",
  },
  {
    title: "Leadership & Management",
    standard: "L3 Team Leader / L5 Operations Manager",
    audience: "People managers, operational leads and colleagues moving into team leadership.",
    businessBenefit: "More consistent management practice across delivery, product and support teams.",
    learnerBenefit: "Confident leadership, planning and performance management skills.",
    status: "Live",
    deliveryPartner: "Approved Provider B",
    duration: "15 to 27 months",
  },
  {
    title: "Project Management",
    standard: "L4 Associate Project Manager",
    audience: "Delivery coordinators, workstream owners and client programme support roles.",
    businessBenefit: "Sharper delivery governance and better stakeholder control.",
    learnerBenefit: "Practical project methods and evidence-led delivery habits.",
    status: "Live",
    deliveryPartner: "Approved Provider C",
    duration: "18 to 21 months",
  },
  {
    title: "Data & Digital",
    standard: "L4 Data Analyst / Digital pathways",
    audience: "Sypro product, reporting, platform data and operational insight roles.",
    businessBenefit: "Better reporting quality, decision data and technology adoption.",
    learnerBenefit: "Analytical confidence and a practical digital toolkit.",
    status: "Ready",
    deliveryPartner: "Approved Provider D",
    duration: "18 to 24 months",
  },
  {
    title: "Social Value & Sustainability",
    standard: "L4 Corporate Responsibility & Sustainability Practitioner",
    audience: "Loop, social value, impact reporting, sustainability and responsible procurement roles.",
    businessBenefit: "Improved social value evidence, impact measurement and client outcomes.",
    learnerBenefit: "Specialist social value and sustainability capability.",
    status: "Live",
    deliveryPartner: "Approved Provider E",
    duration: "18 to 24 months",
  },
  {
    title: "Business Administration",
    standard: "L3 Business Administrator",
    audience: "Internal process, team coordination, finance, compliance and group support colleagues.",
    businessBenefit: "Better process consistency, documentation and service quality.",
    learnerBenefit: "Professional administration skills and wider business awareness.",
    status: "Live",
    deliveryPartner: "Approved Provider F",
    duration: "15 to 18 months",
  },
  {
    title: "Technology & Systems",
    standard: "L3 Information Communications Technician",
    audience: "Platform support, technology operations, product configuration and internal systems roles.",
    businessBenefit: "More resilient platform support and clearer progression into technical capability.",
    learnerBenefit: "Practical systems skills connected to product and client delivery.",
    status: "Ready",
    deliveryPartner: "Approved Provider D",
    duration: "18 to 24 months",
  },
  {
    title: "Operations & Delivery",
    standard: "L3 Improvement Technician",
    audience: "Operational delivery, service improvement, client support and implementation teams.",
    businessBenefit: "Sharper operating rhythm across group initiatives, clients and delivery partners.",
    learnerBenefit: "A route to build operational judgement, improvement skills and delivery confidence.",
    status: "Ready",
    deliveryPartner: "Approved Provider E",
    duration: "15 to 21 months",
  },
];

const initialRequests: RequestItem[] = [
  { id: 1, name: "Amelia Hart", role: "Framework Coordinator", department: "Pagabo", pathway: "Procurement & Commercial", manager: "Ryan Booth", status: "Manager review", note: "Framework confidence." },
  { id: 2, name: "Marcus Lee", role: "Product Support Lead", department: "Sypro", pathway: "Data & Digital", manager: "Priya Nair", status: "Manager review", note: "Reporting capability." },
  { id: 3, name: "Sophie Clarke", role: "Social Value Coordinator", department: "Loop", pathway: "Social Value & Sustainability", manager: "Helen Ward", status: "Manager review", note: "Impact reporting." },
  { id: 4, name: "Noah Bennett", role: "Operations Manager", department: "Group Operations", pathway: "Leadership & Management", manager: "Sam Ellis", status: "Manager review", note: "Collaborative growth." },
  { id: 5, name: "Grace Patel", role: "Project Coordinator", department: "Delivery", pathway: "Project Management", manager: "Ryan Booth", status: "Manager review", note: "Client programme support." },
  { id: 6, name: "Leo Morgan", role: "Systems Analyst", department: "Technology", pathway: "Technology & Systems", manager: "Helen Ward", status: "Manager review", note: "Platform support." },
  { id: 7, name: "Maya Singh", role: "Delivery Lead", department: "Group Operations", pathway: "Operations & Delivery", manager: "Priya Nair", status: "Provider introduction", note: "Operational excellence." },
  { id: 8, name: "Ethan Brooks", role: "Business Support Officer", department: "Group Services", pathway: "Business Administration", manager: "Sam Ellis", status: "Live learner", note: "Process improvement." },
];

const providerRows = [
  ["Procurement & Commercial", "L4 Commercial Procurement & Supply", "Approved Provider A", "Blended", "94%", "Live"],
  ["Leadership & Management", "L3 Team Leader / L5 Operations Manager", "Approved Provider B", "Online + workshops", "92%", "Live"],
  ["Project Management", "L4 Associate Project Manager", "Approved Provider C", "Hybrid", "90%", "Live"],
  ["Data & Digital", "L4 Data Analyst / Digital pathways", "Approved Provider D", "Remote + workshops", "89%", "Ready"],
  ["Social Value & Sustainability", "ESG aligned pathway", "Approved Provider E", "Online + coaching", "88%", "Ready"],
  ["Operations & Delivery", "L3 Improvement Technician", "Approved Provider F", "Blended", "87%", "Ready"],
];

const userViews = ["Hub", "Pathways", "Expression", "Manager", "Department", "Guidance"];
const adminViews = ["Console", "Pipeline", "Mappings", "Pathways", "Insights", "Engagement", "Roadmap"];
const pipelineColumns = ["New interest", "Manager review", "Apprenticeship lead review", "Provider introduction", "Enrolment in progress", "Live learner"];

export default function Home() {
  const [experience, setExperience] = useState<Experience>("user");
  const [activeUserView, setActiveUserView] = useState("Hub");
  const [activeAdminView, setActiveAdminView] = useState("Console");
  const [requests, setRequests] = useState(initialRequests);
  const [selectedPathway, setSelectedPathway] = useState(pathways[0].title);
  const [success, setSuccess] = useState(false);

  const statusCounts = useMemo(
    () =>
      requests.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {}),
    [requests],
  );

  const departmentCounts = useMemo(
    () =>
      requests.reduce<Record<string, number>>((acc, item) => {
        acc[item.department] = (acc[item.department] ?? 0) + 1;
        return acc;
      }, {}),
    [requests],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextRequest: RequestItem = {
      id: requests.length + 1,
      name: String(data.get("name") || "New colleague"),
      role: String(data.get("role") || "Internal colleague"),
      department: String(data.get("department") || "Group team"),
      pathway: String(data.get("pathway") || selectedPathway),
      manager: String(data.get("manager") || "Line manager"),
      status: "Sent to manager review",
      note: String(data.get("need") || "New development request."),
    };

    setRequests((current) => [nextRequest, ...current]);
    setSuccess(true);
    event.currentTarget.reset();
    setSelectedPathway(nextRequest.pathway);
  }

  function setRequestStatus(id: number, status: string) {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status } : request)));
  }

  const activeViews = experience === "user" ? userViews : adminViews;
  const activeView = experience === "user" ? activeUserView : activeAdminView;
  const setActiveView = experience === "user" ? setActiveUserView : setActiveAdminView;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fffc_0%,#effaf6_44%,#f8fbfa_100%)] text-[#102c3d]">
      <header className="border-b border-[#102c3d]/8 bg-white/72 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div className="levytate-wordmark" aria-label="LevyTate">
              <span>Levy</span>
              <span>Tate</span>
            </div>
            <div className="h-8 w-px bg-[#102c3d]/10" />
            <div className="flex items-center gap-3">
              <span className="overflow-hidden rounded-xl bg-[#001831] shadow-[0_8px_18px_rgba(0,24,49,0.14)]" aria-label="PAGABO Group">
                <Image src="/brand/pagabo-group-logo.svg" alt="PAGABO Group" width={126} height={16} priority className="h-8 w-auto" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#df5f73]">Employer environment</p>
                <p className="text-sm font-medium text-[#102c3d]/54">Powered by LevyTate</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 rounded-full bg-[#eef8f5] p-1">
              {[
                ["user", "User Hub"],
                ["admin", "Admin Console"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setExperience(key as Experience)}
                  className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
                    experience === key ? "bg-white text-[#102c3d] shadow-[0_10px_24px_rgba(16,44,61,0.10)]" : "text-[#102c3d]/54"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => (experience === "user" ? setActiveUserView("Expression") : setActiveAdminView("Console"))}
              className="rounded-full bg-[#102c3d] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(16,44,61,0.16)]"
            >
              {experience === "user" ? "Start request" : "Open console"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-8 pt-12 lg:px-8 lg:pb-12 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
          <div>
            <p className="mb-5 w-fit rounded-full bg-[#dff7ef] px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#146b66]">
              Internal apprenticeship and capability hub powered by LevyTate.
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-[#102c3d] md:text-7xl">
              PAGABO Apprenticeship Hub
            </h1>
            <p className="mt-6 max-w-3xl text-xl font-normal leading-9 text-[#102c3d]/68">
              A simpler way to scale apprenticeship adoption, manage approvals and connect approved pathways to the right delivery partners.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setActiveUserView("Pathways")} className="rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.16)]">
                Explore pathways
              </button>
              <button onClick={() => { setExperience("admin"); setActiveAdminView("Console"); }} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102c3d] shadow-[0_14px_30px_rgba(16,44,61,0.10)]">
                Open admin console
              </button>
            </div>
          </div>

          <OperatingSnapshot requests={requests} statusCounts={statusCounts} />
        </div>

        <div className="mt-10 rounded-3xl bg-white/74 p-4 shadow-[0_18px_48px_rgba(16,44,61,0.08)]">
          <div className="grid gap-3 text-center text-sm font-medium text-[#102c3d]/62 sm:grid-cols-5">
            {["Role", "Pathway", "Approval", "Provider", "Enrolment"].map((step, index) => (
              <div key={step} className="rounded-2xl bg-[#f4fbf8] px-4 py-4">
                <span className="mr-2 text-[#159b8f]">{String(index + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#df5f73]">
              {experience === "user" ? "User Hub" : "Admin Console"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#102c3d] md:text-4xl">
              {experience === "user" ? "Guided access for colleagues and managers" : "A control centre for apprenticeship leads"}
            </h2>
          </div>
          <nav className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-white/72 p-1 shadow-[0_10px_24px_rgba(16,44,61,0.08)]">
            {activeViews.map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeView === view ? "bg-[#102c3d] text-white" : "text-[#102c3d]/54 hover:bg-[#dff7ef]"
                }`}
              >
                {view}
              </button>
            ))}
          </nav>
        </div>

        {experience === "user" ? (
          <UserHub
            activeView={activeUserView}
            requests={requests}
            selectedPathway={selectedPathway}
            setActiveView={setActiveUserView}
            setRequestStatus={setRequestStatus}
            setSelectedPathway={setSelectedPathway}
            handleSubmit={handleSubmit}
            success={success}
            departmentCounts={departmentCounts}
          />
        ) : (
          <AdminConsole
            activeView={activeAdminView}
            requests={requests}
            statusCounts={statusCounts}
            departmentCounts={departmentCounts}
          />
        )}
      </section>
    </main>
  );
}

function OperatingSnapshot({ requests, statusCounts }: { requests: RequestItem[]; statusCounts: Record<string, number> }) {
  const items = [
    ["Requests in progress", requests.length],
    ["Awaiting approval", (statusCounts["Manager review"] ?? 0) + (statusCounts["Apprenticeship lead review"] ?? 0)],
    ["Live pathways", pathways.filter((item) => item.status === "Live").length],
    ["Active learners", statusCounts["Live learner"] ?? 1],
    ["Forecast levy utilisation", "73%"],
  ];

  return (
    <aside className="rounded-[2rem] bg-white p-6 shadow-[0_24px_70px_rgba(16,44,61,0.12)]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#df5f73]">Operational Skills Snapshot</p>
          <h2 className="mt-2 text-3xl font-semibold">Live view of apprenticeship demand</h2>
        </div>
        <div className="rounded-full bg-[#dff7ef] px-4 py-2 text-sm font-medium text-[#146b66]">Demo data</div>
      </div>
      <div className="mt-7 divide-y divide-[#102c3d]/8">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-5 py-4">
            <p className="text-sm font-medium text-[#102c3d]/58">{label}</p>
            <p className="text-2xl font-semibold text-[#102c3d]">{value}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function UserHub({
  activeView,
  requests,
  selectedPathway,
  setActiveView,
  setRequestStatus,
  setSelectedPathway,
  handleSubmit,
  success,
  departmentCounts,
}: {
  activeView: string;
  requests: RequestItem[];
  selectedPathway: string;
  setActiveView: (view: string) => void;
  setRequestStatus: (id: number, status: string) => void;
  setSelectedPathway: (pathway: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  success: boolean;
  departmentCounts: Record<string, number>;
}) {
  if (activeView === "Hub") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <PanelShell title="Approved development pathways" eyebrow="Internal Capability Hub">
          <p className="max-w-2xl text-base leading-7 text-[#102c3d]/64">
            Explore approved development pathways, understand what fits your role or team, and start a request in minutes.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ["Explore approved pathways", "Find the right development route."],
              ["Start an expression of interest", "Send a simple request for review."],
              ["Review manager guidance", "Understand time, fit and responsibilities."],
              ["View my/team requests", "Track progress without spreadsheets."],
            ].map(([title, copy]) => (
              <button key={title} onClick={() => setActiveView(title.includes("Explore") ? "Pathways" : title.includes("expression") ? "Expression" : title.includes("manager") ? "Guidance" : "Manager")} className="rounded-3xl bg-[#f4fbf8] p-6 text-left transition hover:bg-[#e7f7f1]">
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#102c3d]/58">{copy}</p>
              </button>
            ))}
          </div>
        </PanelShell>
        <div className="grid gap-4">
          <MiniInsight title="Current team interest" value={requests.length} copy="Requests across the internal environment" />
          <MiniInsight title="Most active area" value="Pagabo" copy="Strong demand for commercial and framework skills" />
          <MiniInsight title="Next action" value="Manager review" copy="A clear approval route is already in place" />
        </div>
      </div>
    );
  }

  if (activeView === "Pathways") {
    return (
      <div className="grid gap-6">
        <PanelShell title="Choose the route that fits the work" eyebrow="Approved Development Pathways">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Develop myself", "Routes for personal growth and role progression."],
              ["Manage a team member", "Options to support a colleague with confidence."],
              ["Build department capability", "Pathways aligned to business priorities."],
              ["Plan future workforce needs", "Cohorts for the skills teams will need next."],
            ].map(([title, copy]) => (
              <article key={title} className="rounded-3xl bg-[#f4fbf8] p-5">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#102c3d]/58">{copy}</p>
              </article>
            ))}
          </div>
        </PanelShell>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pathways.map((pathway) => (
            <article key={pathway.title} className="rounded-3xl bg-white p-6 shadow-[0_16px_46px_rgba(16,44,61,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-semibold">{pathway.title}</h3>
                <span className="rounded-full bg-[#dff7ef] px-3 py-1 text-xs font-medium text-[#146b66]">{pathway.deliveryPartner}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-[#159b8f]">{pathway.standard}</p>
              <p className="mt-5 text-sm leading-7 text-[#102c3d]/62">{pathway.audience}</p>
              <div className="mt-5 grid gap-3 border-t border-[#102c3d]/8 pt-5">
                <SubtleRow label="Business benefit" value={pathway.businessBenefit} />
                <SubtleRow label="Learner benefit" value={pathway.learnerBenefit} />
              </div>
              <button
                onClick={() => {
                  setSelectedPathway(pathway.title);
                  setActiveView("Expression");
                }}
                className="mt-6 rounded-full bg-[#102c3d] px-4 py-2 text-sm font-semibold text-white"
              >
                View pathway
              </button>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (activeView === "Expression") {
    return (
      <PanelShell title="Start an expression of interest" eyebrow="Low friction request">
        {success && (
          <p className="mb-6 rounded-2xl bg-[#dff7ef] p-4 text-sm font-medium text-[#146b66]">
            Request created with status: Sent to manager review.
          </p>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <Field name="name" label="Name" />
          <Field name="role" label="Role" />
          <Field name="department" label="Department" />
          <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70">
            Applying for
            <select name="requestType" className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]">
              <option>For myself</option>
              <option>For a team member</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70">
            Selected pathway
            <select
              name="pathway"
              value={selectedPathway}
              onChange={(event) => setSelectedPathway(event.target.value)}
              className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]"
            >
              {pathways.map((pathway) => (
                <option key={pathway.title}>{pathway.title}</option>
              ))}
            </select>
          </label>
          <Field name="manager" label="Line manager" />
          <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70 md:col-span-2">
            Why is this needed?
            <textarea name="need" rows={4} className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]" />
          </label>
          <Field name="startWindow" label="Preferred start window" />
          <button className="w-fit rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white md:col-span-2">
            Submit request
          </button>
        </form>
      </PanelShell>
    );
  }

  if (activeView === "Manager") {
    return (
      <PanelShell title="Manager action area" eyebrow="Development Requests">
        <div className="grid gap-4">
          {requests.slice(0, 4).map((request) => (
            <article key={request.id} className="rounded-3xl bg-[#f8fbfa] p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-lg font-semibold">{request.name}</p>
                  <p className="mt-1 text-sm font-medium text-[#102c3d]/56">{request.role} | {request.department} | {request.pathway}</p>
                  <textarea placeholder="Add business case note" className="mt-4 w-full rounded-2xl border border-[#102c3d]/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#159b8f]" />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <SmallButton label="Approve" onClick={() => setRequestStatus(request.id, "Manager approved")} />
                  <SmallButton label="More info" onClick={() => setRequestStatus(request.id, "More information requested")} variant="mint" />
                  <SmallButton label="Decline" onClick={() => setRequestStatus(request.id, "Declined")} variant="coral" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </PanelShell>
    );
  }

  if (activeView === "Department") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <PanelShell title="Department planning view" eyebrow="Capability Demand">
          <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
        </PanelShell>
        <div className="grid gap-4">
          <MiniInsight title="Team members interested" value={requests.length} copy="Visible demand for future cohorts" />
          <MiniInsight title="Recommended priorities" value="4" copy="Procurement, social value, digital and leadership" />
          <MiniInsight title="Next cohort" value="Commercial" copy="Prepare the next framework delivery group" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {[
        ["How apprenticeships work", "Clear route from request to enrolment."],
        ["Time commitment", "Designed around role fit and manager support."],
        ["Eligibility", "Checked during internal approval."],
        ["Manager responsibilities", "Review fit, workload and business need."],
        ["After approval", "The apprenticeship lead confirms next steps."],
      ].map(([title, copy]) => (
        <article key={title} className="rounded-3xl bg-white p-6 shadow-[0_16px_46px_rgba(16,44,61,0.08)]">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-[#102c3d]/60">{copy}</p>
        </article>
      ))}
    </div>
  );
}

function AdminConsole({
  activeView,
  requests,
  statusCounts,
  departmentCounts,
}: {
  activeView: string;
  requests: RequestItem[];
  statusCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
}) {
  if (activeView === "Console") {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <PanelShell title="Admin Console" eyebrow="Operational landing">
          <p className="max-w-2xl text-base leading-7 text-[#102c3d]/64">
            LevyTate gives apprenticeship leads one place to manage demand, approvals, provider mappings and internal rollout.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <ConsoleMetric title="Development pipeline" value={requests.length} copy="Live requests across the employer environment" />
            <ConsoleMetric title="Approval queue" value={(statusCounts["Manager review"] ?? 0) + (statusCounts["Apprenticeship lead review"] ?? 0)} copy="Items needing human review" />
            <ConsoleMetric title="Provider mapping health" value="92%" copy="Delivery fit across live pathways" />
            <ConsoleMetric title="Department engagement" value="6" copy="Teams with active demand signals" />
            <ConsoleMetric title="Levy forecast" value="73%" copy="Estimated utilisation this year" />
            <ConsoleMetric title="Pathways live" value={pathways.filter((item) => item.status === "Live").length} copy="Approved internal routes" />
          </div>
        </PanelShell>
        <PanelShell title="Suggested actions" eyebrow="Next best moves">
          <div className="grid gap-3">
            {["Review 6 manager approvals", "Confirm provider mapping for Social Value & Sustainability", "Nudge teams with low engagement", "Prepare next Procurement & Commercial cohort"].map((action) => (
              <div key={action} className="rounded-2xl bg-[#f4fbf8] p-4 text-sm font-medium text-[#102c3d]/72">{action}</div>
            ))}
          </div>
        </PanelShell>
      </div>
    );
  }

  if (activeView === "Pipeline") {
    return (
      <PanelShell title="Team development pipeline" eyebrow="Approval flow">
        <div className="grid gap-4 xl:grid-cols-6">
          {pipelineColumns.map((column) => (
            <div key={column} className="rounded-3xl bg-[#f8fbfa] p-4">
              <h3 className="text-sm font-semibold text-[#102c3d]">{column}</h3>
              <div className="mt-4 grid gap-3">
                {requests.filter((request) => request.status === column).map((request) => (
                  <article key={request.id} className="rounded-2xl bg-white p-4 shadow-[0_8px_18px_rgba(16,44,61,0.06)]">
                    <p className="text-sm font-semibold">{request.name}</p>
                    <p className="mt-1 text-xs font-medium text-[#102c3d]/54">{request.pathway}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PanelShell>
    );
  }

  if (activeView === "Mappings") {
    return (
      <PanelShell title="Provider mapping" eyebrow="Delivery control">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#102c3d]/10 text-[#102c3d]/50">
                {["Role family", "Apprenticeship standard", "Recommended provider", "Delivery model", "Delivery fit", "Mapping status", "Actions"].map((heading) => (
                  <th key={heading} className="px-4 py-4 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providerRows.map((row) => (
                <tr key={row.join("")} className="border-b border-[#102c3d]/6">
                  {row.map((cell) => (
                    <td key={cell} className="px-4 py-5 text-[#102c3d]/68">{cell}</td>
                  ))}
                  <td className="px-4 py-5">
                    <div className="flex gap-2">
                      {["View", "Edit", "Replace"].map((action) => (
                        <button key={action} className="rounded-full bg-[#f4fbf8] px-3 py-2 text-xs font-medium text-[#102c3d]">{action}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelShell>
    );
  }

  if (activeView === "Pathways") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pathways.map((pathway) => (
          <article key={pathway.title} className="rounded-3xl bg-white p-6 shadow-[0_16px_46px_rgba(16,44,61,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold">{pathway.title}</h2>
              <span className="rounded-full bg-[#f4fbf8] px-3 py-1 text-xs font-medium text-[#102c3d]/58">{pathway.status}</span>
            </div>
            <p className="mt-3 text-sm font-medium text-[#159b8f]">{pathway.standard}</p>
            <p className="mt-5 text-sm leading-6 text-[#102c3d]/58">{pathway.duration}</p>
          </article>
        ))}
      </div>
    );
  }

  if (activeView === "Insights") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelShell title="Demand by department" eyebrow="Operational Insights">
          <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
        </PanelShell>
        <PanelShell title="Request status" eyebrow="Bottlenecks">
          <InsightBars rows={Object.entries(statusCounts).map(([label, value]) => [label, value])} />
        </PanelShell>
        <PanelShell title="Pathway popularity" eyebrow="Demand signal">
          <InsightBars rows={[["Procurement & Commercial", 9], ["Social Value & Sustainability", 8], ["Leadership & Management", 7], ["Data & Digital", 6], ["Project Management", 5]]} />
        </PanelShell>
        <PanelShell title="Levy forecast" eyebrow="Finance view">
          <InsightBars rows={[["Current forecast", 73], ["Target", 85], ["At risk", 12]]} />
        </PanelShell>
      </div>
    );
  }

  if (activeView === "Engagement") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelShell title="Department engagement" eyebrow="Rollout">
          <InsightBars rows={[["Pagabo", 92], ["Sypro", 76], ["Loop", 68], ["Group Operations", 61], ["Technology", 54], ["Finance", 24]]} />
        </PanelShell>
        <PanelShell title="Suggested nudges" eyebrow="Activation">
          <div className="grid gap-3">
            {["Send procurement pathway reminder", "Invite Sypro managers to digital briefing", "Share manager approval guidance", "Confirm Loop social value cohort demand"].map((item) => (
              <div key={item} className="rounded-2xl bg-[#f4fbf8] p-4 text-sm font-medium text-[#102c3d]/70">{item}</div>
            ))}
          </div>
        </PanelShell>
      </div>
    );
  }

  return (
    <PanelShell title="Integration roadmap" eyebrow="Future links">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["Provider LMS", "HRIS", "Finance / levy reporting", "SSO"].map((item) => (
          <div key={item} className="rounded-3xl bg-[#f4fbf8] p-6 text-sm font-medium text-[#102c3d]/70">{item}</div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <CopyList title="What LevyTate removes" items={["Repeated provider searches", "Reactive apprenticeship requests", "Spreadsheet tracking", "Unclear approval routes"]} />
        <CopyList title="What the employer gains" items={["Clear internal pathways", "Faster approvals", "Better manager engagement", "Consistent delivery partners"]} />
      </div>
    </PanelShell>
  );
}

function PanelShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_54px_rgba(16,44,61,0.08)] lg:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#df5f73]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold text-[#102c3d]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MiniInsight({ title, value, copy }: { title: string; value: string | number; copy: string }) {
  return (
    <article className="rounded-3xl bg-white p-6 shadow-[0_16px_46px_rgba(16,44,61,0.08)]">
      <p className="text-sm font-medium text-[#102c3d]/50">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-7 text-[#102c3d]/58">{copy}</p>
    </article>
  );
}

function ConsoleMetric({ title, value, copy }: { title: string; value: string | number; copy: string }) {
  return (
    <article className="rounded-3xl bg-[#f8fbfa] p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-[#102c3d]/62">{title}</p>
        <p className="text-2xl font-semibold text-[#102c3d]">{value}</p>
      </div>
      <p className="mt-4 text-sm leading-7 text-[#102c3d]/56">{copy}</p>
    </article>
  );
}

function SubtleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</p>
      <p className="mt-1 text-sm leading-7 text-[#102c3d]/64">{value}</p>
    </div>
  );
}

function Field({ name, label }: { name: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70">
      {label}
      <input name={name} className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]" />
    </label>
  );
}

function SmallButton({ label, onClick, variant = "dark" }: { label: string; onClick: () => void; variant?: "dark" | "mint" | "coral" }) {
  const classes = {
    dark: "bg-[#102c3d] text-white",
    mint: "bg-[#dff7ef] text-[#146b66]",
    coral: "bg-[#ffe3e8] text-[#bf4159]",
  };

  return <button onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-semibold ${classes[variant]}`}>{label}</button>;
}

function InsightBars({ rows }: { rows: Array<[string, number]> }) {
  const max = Math.max(...rows.map(([, value]) => value), 1);

  return (
    <div className="grid gap-5">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="flex justify-between gap-4 text-sm font-medium text-[#102c3d]/64">
            <span>{label}</span>
            <span>{value}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ecf6f2]">
            <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${Math.max(10, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl bg-[#f8fbfa] p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <p key={item} className="text-sm font-medium text-[#102c3d]/62">{item}</p>
        ))}
      </div>
    </div>
  );
}
