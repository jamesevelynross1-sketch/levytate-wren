"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

type Role = "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead";
type DemandScenario = "Low" | "Medium" | "High";
type RequestStatus = "New interest" | "Manager review" | "Lead review" | "Provider introduction" | "Enrolment" | "Live learner";
type MappingStatus = "Live" | "Ready" | "Review";

type Pathway = {
  title: string;
  standard: string;
  audience: string;
  businessBenefit: string;
  learnerBenefit: string;
  status: "Live" | "Ready";
  deliveryPartner: string;
  duration: string;
  commitment: string;
  cohort: string;
};

type RequestItem = {
  id: number;
  name: string;
  role: string;
  department: string;
  team: string;
  pathway: string;
  manager: string;
  status: RequestStatus;
  note: string;
};

type ProviderMapping = {
  roleFamily: string;
  pathway: string;
  standard: string;
  partner: string;
  deliveryModel: string;
  fit: number;
  status: MappingStatus;
  nextAction: string;
};

const requestStages: RequestStatus[] = ["New interest", "Manager review", "Lead review", "Provider introduction", "Enrolment", "Live learner"];
const publicStages = ["Interest submitted", "Manager review", "Apprenticeship lead review", "Provider introduction", "Enrolment in progress", "Live learner"];
const roles: Role[] = ["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"];

const pathways: Pathway[] = [
  {
    title: "Retail Sales & Design",
    standard: "L3 Customer Service Specialist or L4 Sales Executive",
    audience: "Showroom, kitchen design, sales support and customer-facing retail teams.",
    businessBenefit: "More consistent sales capability and stronger customer experience in showrooms.",
    learnerBenefit: "Practical customer, design and commercial skills with a clear progression route.",
    status: "Live",
    deliveryPartner: "Approved Provider A",
    duration: "15 to 18 months",
    commitment: "One learning day per week with manager supported workplace evidence.",
    cohort: "September showroom cohort",
  },
  {
    title: "Manufacturing & Engineering",
    standard: "L3 Engineering Technician",
    audience: "Manufacturing, engineering, maintenance and production support colleagues.",
    businessBenefit: "Stronger technical capability across site-based operations and quality routines.",
    learnerBenefit: "Recognised engineering skills with practical evidence from the workplace.",
    status: "Live",
    deliveryPartner: "Approved Provider B",
    duration: "36 to 42 months",
    commitment: "Site-based learning blocks, coaching and workplace assessment.",
    cohort: "October production intake",
  },
  {
    title: "Customer Service",
    standard: "L3 Customer Service Specialist",
    audience: "Customer services, contact centre, aftercare and customer operations teams.",
    businessBenefit: "Improved service consistency, resolution quality and customer confidence.",
    learnerBenefit: "A structured route to build communication, ownership and service judgement.",
    status: "Live",
    deliveryPartner: "Approved Provider A",
    duration: "15 to 18 months",
    commitment: "Monthly workshops with applied service improvement evidence.",
    cohort: "Rolling monthly starts",
  },
  {
    title: "Transport & Logistics",
    standard: "L3 Supply Chain Practitioner",
    audience: "Transport, logistics, fleet coordination and supply chain support roles.",
    businessBenefit: "Better planning discipline across delivery, capacity and customer fulfilment.",
    learnerBenefit: "Practical supply chain skills linked to the operating model.",
    status: "Ready",
    deliveryPartner: "Approved Provider E",
    duration: "18 to 24 months",
    commitment: "Hybrid learning with route planning and fulfilment evidence.",
    cohort: "November logistics group",
  },
  {
    title: "IT & Digital",
    standard: "L3 Information Communications Technician",
    audience: "IT support, digital operations, systems, reporting and technical service teams.",
    businessBenefit: "More resilient digital support and clearer progression into specialist technology roles.",
    learnerBenefit: "A practical technical toolkit with support from mentors and delivery partners.",
    status: "Ready",
    deliveryPartner: "Approved Provider C",
    duration: "18 to 24 months",
    commitment: "Remote learning, workshops and workplace systems projects.",
    cohort: "October digital start",
  },
  {
    title: "Finance & Business Support",
    standard: "L3 Business Administrator",
    audience: "Finance, compliance, administration and business support colleagues.",
    businessBenefit: "Better process consistency, documentation and cross-functional support.",
    learnerBenefit: "Professional business skills and a broader view of design, production and delivery.",
    status: "Live",
    deliveryPartner: "Approved Provider F",
    duration: "15 to 18 months",
    commitment: "Online learning with process improvement evidence.",
    cohort: "September business support cohort",
  },
  {
    title: "HR, Training & Recruitment",
    standard: "L3 Learning & Development Practitioner",
    audience: "HR, recruitment, training, onboarding and people operations teams.",
    businessBenefit: "Stronger internal capability for hiring, development and colleague support.",
    learnerBenefit: "Specialist people skills that connect learning design with business needs.",
    status: "Ready",
    deliveryPartner: "Approved Provider F",
    duration: "18 to 21 months",
    commitment: "Online learning, coaching and applied people projects.",
    cohort: "November people team cohort",
  },
  {
    title: "Leadership & Management",
    standard: "L3 Team Leader or L5 Operations Manager",
    audience: "Team leaders, operational managers and colleagues stepping into people leadership.",
    businessBenefit: "More consistent management practice across retail, manufacturing and support teams.",
    learnerBenefit: "Confident leadership, planning and performance management skills.",
    status: "Live",
    deliveryPartner: "Approved Provider D",
    duration: "15 to 27 months",
    commitment: "Blended workshops, coaching and live team improvement work.",
    cohort: "Quarterly leadership pipeline",
  },
  {
    title: "Installation & Field Operations",
    standard: "L3 Customer Service Specialist",
    audience: "Installation coordination, field support and customer operations teams.",
    businessBenefit: "Improved handoffs between planning, installation and customer aftercare.",
    learnerBenefit: "A route to build ownership, communication and operational judgement.",
    status: "Ready",
    deliveryPartner: "Approved Provider E",
    duration: "15 to 18 months",
    commitment: "Blended learning with handoff and aftercare evidence.",
    cohort: "December field operations group",
  },
];

const initialRequests: RequestItem[] = [
  { id: 1, name: "Amelia Hart", role: "Kitchen Designer", department: "Retail", team: "Showroom North", pathway: "Retail Sales & Design", manager: "Ryan Booth", status: "Manager review", note: "Showroom progression." },
  { id: 2, name: "Marcus Lee", role: "Maintenance Technician", department: "Manufacturing", team: "Production Line A", pathway: "Manufacturing & Engineering", manager: "Priya Nair", status: "Manager review", note: "Technical upskilling." },
  { id: 3, name: "Sophie Clarke", role: "Customer Operations Advisor", department: "Customer Services", team: "Aftercare", pathway: "Customer Service", manager: "Helen Ward", status: "Lead review", note: "Service ownership." },
  { id: 4, name: "Noah Bennett", role: "Transport Coordinator", department: "Transport", team: "Fleet Planning", pathway: "Transport & Logistics", manager: "Sam Ellis", status: "New interest", note: "Route planning capability." },
  { id: 5, name: "Grace Patel", role: "IT Support Analyst", department: "IT", team: "Service Desk", pathway: "IT & Digital", manager: "Ryan Booth", status: "Provider introduction", note: "Digital support skills." },
  { id: 6, name: "Leo Morgan", role: "Recruitment Coordinator", department: "HR, Training & Recruitment", team: "Recruitment", pathway: "HR, Training & Recruitment", manager: "Helen Ward", status: "Manager review", note: "Training delivery." },
  { id: 7, name: "Maya Singh", role: "Team Leader", department: "Manufacturing", team: "Shift Leadership", pathway: "Leadership & Management", manager: "Priya Nair", status: "Enrolment", note: "New shift leadership." },
  { id: 8, name: "Ethan Brooks", role: "Finance Assistant", department: "Finance", team: "Business Support", pathway: "Finance & Business Support", manager: "Sam Ellis", status: "Live learner", note: "Business process confidence." },
];

const initialMappings: ProviderMapping[] = [
  { roleFamily: "Retail Sales & Design", pathway: "Retail Sales & Design", standard: "L3 Customer Service Specialist or L4 Sales Executive", partner: "Approved Provider A", deliveryModel: "Blended", fit: 92, status: "Live", nextAction: "Prepare next cohort" },
  { roleFamily: "Manufacturing & Engineering", pathway: "Manufacturing & Engineering", standard: "L3 Engineering Technician", partner: "Approved Provider B", deliveryModel: "Site based", fit: 91, status: "Live", nextAction: "Confirm site timetable" },
  { roleFamily: "IT & Digital", pathway: "IT & Digital", standard: "L3 Information Communications Technician", partner: "Approved Provider C", deliveryModel: "Remote + workshops", fit: 89, status: "Ready", nextAction: "Mark as live" },
  { roleFamily: "Leadership & Management", pathway: "Leadership & Management", standard: "L3 Team Leader or L5 Operations Manager", partner: "Approved Provider D", deliveryModel: "Blended", fit: 94, status: "Live", nextAction: "Review next cohort" },
  { roleFamily: "Transport & Logistics", pathway: "Transport & Logistics", standard: "L3 Supply Chain Practitioner", partner: "Approved Provider E", deliveryModel: "Hybrid", fit: 87, status: "Ready", nextAction: "Validate manager demand" },
  { roleFamily: "HR, Training & Recruitment", pathway: "HR, Training & Recruitment", standard: "L3 Learning & Development Practitioner", partner: "Approved Provider F", deliveryModel: "Online + coaching", fit: 88, status: "Ready", nextAction: "Flag for people team review" },
];

const scenarioSeeds: Record<DemandScenario, RequestItem[]> = {
  Low: initialRequests.slice(0, 5),
  Medium: initialRequests,
  High: [
    ...initialRequests,
    { id: 9, name: "Olivia Grant", role: "Showroom Manager", department: "Retail", team: "Showroom South", pathway: "Leadership & Management", manager: "Ryan Booth", status: "New interest", note: "Leadership pipeline." },
    { id: 10, name: "Daniel Fox", role: "Installation Planner", department: "Installation", team: "Field Operations", pathway: "Installation & Field Operations", manager: "Sam Ellis", status: "Manager review", note: "Better handoffs." },
    { id: 11, name: "Isla Reid", role: "Quality Coordinator", department: "Manufacturing", team: "Quality", pathway: "Manufacturing & Engineering", manager: "Priya Nair", status: "Lead review", note: "Production quality." },
  ],
};

export default function Home() {
  const [role, setRole] = useState<Role>("Employee");
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [mappings, setMappings] = useState<ProviderMapping[]>(initialMappings);
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [savedPathways, setSavedPathways] = useState<string[]>(["Retail Sales & Design", "IT & Digital"]);
  const [scenario, setScenario] = useState<DemandScenario>("Medium");
  const [success, setSuccess] = useState(false);

  const statusCounts = useMemo(() => countBy(requests, "status"), [requests]);
  const departmentCounts = useMemo(() => countBy(requests, "department"), [requests]);
  const employeeRequest = requests.find((request) => request.name === "Amelia Hart") ?? requests[0];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const pathway = String(data.get("pathway") || pathways[0].title);
    const nextRequest: RequestItem = {
      id: Math.max(...requests.map((request) => request.id), 0) + 1,
      name: String(data.get("name") || "New colleague"),
      role: String(data.get("role") || "Internal colleague"),
      department: String(data.get("department") || "Retail"),
      team: String(data.get("team") || "Internal team"),
      pathway,
      manager: String(data.get("manager") || "Line manager"),
      status: "New interest",
      note: String(data.get("need") || "New development request."),
    };

    setRequests((current) => [nextRequest, ...current]);
    setSuccess(true);
  }

  function setRequestStatus(id: number, status: RequestStatus) {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status } : request)));
  }

  function moveRequest(id: number, direction: 1 | -1) {
    const request = requests.find((item) => item.id === id);
    if (!request) return;
    const currentIndex = requestStages.indexOf(request.status);
    const nextStatus = requestStages[Math.min(requestStages.length - 1, Math.max(0, currentIndex + direction))];
    setRequestStatus(id, nextStatus);
  }

  function updateMapping(index: number, status: MappingStatus, nextAction: string) {
    setMappings((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, status, nextAction } : item)));
  }

  function seedRequest() {
    const seed = pathways[(requests.length + 1) % pathways.length];
    setRequests((current) => [
      {
        id: Math.max(...current.map((request) => request.id), 0) + 1,
        name: "Seeded colleague",
        role: "Internal colleague",
        department: seed.title.includes("Manufacturing") ? "Manufacturing" : "Retail",
        team: "Presentation demo",
        pathway: seed.title,
        manager: "Demo manager",
        status: "New interest",
        note: "Seeded presentation request.",
      },
      ...current,
    ]);
  }

  function setScenarioData(nextScenario: DemandScenario) {
    setScenario(nextScenario);
    setRequests(scenarioSeeds[nextScenario]);
  }

  const guideCopy: Record<Role, string> = {
    Employee: "Employees can explore only approved pathways, save options and start a request without searching across providers.",
    "Line Manager": "Managers can review business benefit, time commitment and team impact before approving demand.",
    "Department Head": "Department leaders can see demand, engagement and cohort planning across priority capability areas.",
    "Apprenticeship Lead": "Apprenticeship leads can manage approvals, provider mappings, bottlenecks and levy forecast in one place.",
  };

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
            <div className="flex items-center gap-4">
              <Image src="/brand/wren-kitchens-logo.png" alt="Wren Kitchens" width={112} height={44} priority className="h-[44px] w-auto rounded-xl object-contain" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#1D864A]">Employer environment</p>
                <p className="text-sm font-medium text-[#102c3d]/54">Powered by LevyTate</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button onClick={() => setSelectedPathway(pathways[0])} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#102c3d] shadow-[0_14px_30px_rgba(16,44,61,0.10)]">
              Explore pathways
            </button>
            <button onClick={() => setRole("Apprenticeship Lead")} className="rounded-full bg-[#102c3d] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(16,44,61,0.16)]">
              Open admin console
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
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-[#102c3d] md:text-7xl">Wren Apprenticeship Hub</h1>
            <p className="mt-6 max-w-3xl text-xl font-normal leading-9 text-[#102c3d]/68">
              A simpler way to scale apprenticeship adoption, manage approvals and connect approved pathways to the right delivery partners.
            </p>
            <RoleSwitcher role={role} setRole={setRole} />
          </div>

          <OperatingSnapshot requests={requests} mappings={mappings} statusCounts={statusCounts} />
        </div>

        <div className="mt-10 rounded-3xl bg-white/74 p-4 shadow-[0_18px_48px_rgba(16,44,61,0.08)]">
          <div className="grid gap-3 text-center text-sm font-medium text-[#102c3d]/62 sm:grid-cols-6">
            {publicStages.map((step, index) => (
              <div key={step} className="rounded-2xl bg-[#f4fbf8] px-4 py-4">
                <span className="mr-2 text-[#159b8f]">{String(index + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-16 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="grid gap-6">
          {role === "Employee" && (
            <EmployeeDashboard
              savedPathways={savedPathways}
              selectedRequest={employeeRequest}
              onSubmit={handleSubmit}
              onOpenPathway={setSelectedPathway}
              onSavePathway={(title) => setSavedPathways((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]))}
              success={success}
            />
          )}
          {role === "Line Manager" && <ManagerDashboard requests={requests} onStatus={setRequestStatus} onOpenPathway={setSelectedPathway} />}
          {role === "Department Head" && <DepartmentDashboard requests={requests} departmentCounts={departmentCounts} onOpenPathway={setSelectedPathway} />}
          {role === "Apprenticeship Lead" && (
            <AdminDashboard
              requests={requests}
              mappings={mappings}
              statusCounts={statusCounts}
              departmentCounts={departmentCounts}
              onMove={moveRequest}
              onMapping={updateMapping}
              onOpenPathway={setSelectedPathway}
            />
          )}
          <ExecutiveSummary requests={requests} mappings={mappings} statusCounts={statusCounts} />
        </div>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-6">
          <GuidePanel role={role} copy={guideCopy[role]} />
          <DemoControls scenario={scenario} onScenario={setScenarioData} onSeed={seedRequest} onReset={() => setScenarioData("Medium")} />
        </aside>
      </section>

      {selectedPathway && (
        <PathwayModal
          pathway={selectedPathway}
          onClose={() => setSelectedPathway(null)}
          onStart={() => {
            setSelectedPathway(null);
            setRole("Employee");
          }}
        />
      )}
    </main>
  );
}

function RoleSwitcher({ role, setRole }: { role: Role; setRole: (role: Role) => void }) {
  return (
    <div className="mt-8 w-fit max-w-full overflow-x-auto rounded-full bg-white/72 p-1 shadow-[0_10px_24px_rgba(16,44,61,0.08)]">
      <div className="flex gap-1">
        {roles.map((item) => (
          <button
            key={item}
            onClick={() => setRole(item)}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition ${
              role === item ? "bg-[#102c3d] text-white shadow-[0_10px_24px_rgba(16,44,61,0.12)]" : "text-[#102c3d]/58 hover:bg-[#dff7ef]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmployeeDashboard({
  savedPathways,
  selectedRequest,
  success,
  onSubmit,
  onOpenPathway,
  onSavePathway,
}: {
  savedPathways: string[];
  selectedRequest: RequestItem;
  success: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPathway: (pathway: Pathway) => void;
  onSavePathway: (title: string) => void;
}) {
  return (
    <div className="grid gap-6">
      <PanelShell title="Welcome back, Amelia" eyebrow="Employee Dashboard">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="max-w-2xl text-base leading-7 text-[#102c3d]/64">
              Explore approved development pathways across Wren, understand what fits your role or team, and start a request in minutes.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Recommended" value="3" copy="Best fit pathways" />
              <MiniMetric label="Saved" value={savedPathways.length} copy="Ready to revisit" />
              <MiniMetric label="My status" value={selectedRequest.status} copy="Latest request stage" />
            </div>
          </div>
          <RequestTracker request={selectedRequest} />
        </div>
      </PanelShell>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <PanelShell title="Recommended pathways" eyebrow="Approved Development Pathways">
          <div className="grid gap-4 md:grid-cols-2">
            {pathways.slice(0, 4).map((pathway) => (
              <PathwayCard key={pathway.title} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
            ))}
          </div>
        </PanelShell>
        <PanelShell title="Start an expression of interest" eyebrow="Low friction request">
          {success && <p className="mb-5 rounded-2xl bg-[#dff7ef] p-4 text-sm font-medium text-[#146b66]">Request created with status: Interest submitted.</p>}
          <RequestForm onSubmit={onSubmit} />
        </PanelShell>
      </div>

      <PanelShell title="Explore all pathways" eyebrow="Capability Growth">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pathways.map((pathway) => (
            <PathwayCard key={pathway.title} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

function ManagerDashboard({ requests, onStatus, onOpenPathway }: { requests: RequestItem[]; onStatus: (id: number, status: RequestStatus) => void; onOpenPathway: (pathway: Pathway) => void }) {
  const managerRequests = requests.filter((request) => request.status === "Manager review").slice(0, 5);
  return (
    <div className="grid gap-6">
      <PanelShell title="Team requests awaiting review" eyebrow="Line Manager Dashboard">
        <div className="grid gap-4">
          {managerRequests.map((request) => {
            const pathway = pathways.find((item) => item.title === request.pathway) ?? pathways[0];
            return (
              <article key={request.id} className="rounded-3xl bg-[#f8fbfa] p-5">
                <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr_auto]">
                  <div>
                    <p className="text-lg font-semibold">{request.name}</p>
                    <p className="mt-1 text-sm font-medium text-[#102c3d]/56">{request.role} | {request.team} | {request.pathway}</p>
                    <textarea placeholder="Add business case note" className="mt-4 w-full rounded-2xl border border-[#102c3d]/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#159b8f]" />
                  </div>
                  <div className="grid gap-3">
                    <SubtleRow label="Time commitment" value={pathway.commitment} />
                    <SubtleRow label="Business benefit" value={pathway.businessBenefit} />
                    <button onClick={() => onOpenPathway(pathway)} className="w-fit rounded-full bg-white px-4 py-2 text-xs font-medium text-[#102c3d] shadow-[0_8px_18px_rgba(16,44,61,0.06)]">View pathway detail</button>
                  </div>
                  <div className="flex flex-wrap content-start gap-2 xl:justify-end">
                    <SmallButton label="Approve" onClick={() => onStatus(request.id, "Lead review")} />
                    <SmallButton label="More info" onClick={() => onStatus(request.id, "New interest")} variant="mint" />
                    <SmallButton label="Decline" onClick={() => onStatus(request.id, "New interest")} variant="coral" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </PanelShell>
      <PanelShell title="Team development pipeline" eyebrow="Manager View">
        <Kanban requests={requests.filter((request) => ["Retail", "Manufacturing", "Customer Services"].includes(request.department))} compact />
      </PanelShell>
    </div>
  );
}

function DepartmentDashboard({ requests, departmentCounts, onOpenPathway }: { requests: RequestItem[]; departmentCounts: Record<string, number>; onOpenPathway: (pathway: Pathway) => void }) {
  const suggested = ["Review upcoming leadership cohort", "Nudge managers with pending approvals", "Identify roles suitable for data pathway", "Plan next quarter's apprenticeship demand"];
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <PanelShell title="Demand by department" eyebrow="Department Head Dashboard">
          <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
        </PanelShell>
        <PanelShell title="Operational skills snapshot" eyebrow="Priority Areas">
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniMetric label="Engagement score" value="82%" copy="Across priority departments" />
            <MiniMetric label="Skills gaps" value="4" copy="Digital, leadership, engineering, service" />
            <MiniMetric label="Recommended cohorts" value="3" copy="Retail, manufacturing, leadership" />
            <MiniMetric label="Next planning window" value="Q4" copy="Cohort demand review" />
          </div>
        </PanelShell>
      </div>
      <PanelShell title="Upcoming cohort planning" eyebrow="Capability Growth">
        <div className="grid gap-4 md:grid-cols-3">
          {pathways.slice(0, 3).map((pathway) => (
            <button key={pathway.title} onClick={() => onOpenPathway(pathway)} className="rounded-3xl bg-[#f4fbf8] p-5 text-left transition hover:bg-[#e7f7f1]">
              <h3 className="text-lg font-semibold">{pathway.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#102c3d]/58">{pathway.cohort}</p>
            </button>
          ))}
        </div>
      </PanelShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <PanelShell title="Requests grouped by team" eyebrow="Team Development Pipeline">
          <div className="grid gap-3">
            {Object.entries(countBy(requests, "team")).map(([team, value]) => (
              <div key={team} className="flex items-center justify-between rounded-2xl bg-[#f8fbfa] p-4 text-sm font-medium text-[#102c3d]/70">
                <span>{team}</span>
                <span>{value} requests</span>
              </div>
            ))}
          </div>
        </PanelShell>
        <PanelShell title="Suggested actions" eyebrow="Next Best Moves">
          <div className="grid gap-3">
            {suggested.map((item) => (
              <div key={item} className="rounded-2xl bg-[#f4fbf8] p-4 text-sm font-medium text-[#102c3d]/72">{item}</div>
            ))}
          </div>
        </PanelShell>
      </div>
    </div>
  );
}

function AdminDashboard({
  requests,
  mappings,
  statusCounts,
  departmentCounts,
  onMove,
  onMapping,
  onOpenPathway,
}: {
  requests: RequestItem[];
  mappings: ProviderMapping[];
  statusCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
  onMove: (id: number, direction: 1 | -1) => void;
  onMapping: (index: number, status: MappingStatus, nextAction: string) => void;
  onOpenPathway: (pathway: Pathway) => void;
}) {
  return (
    <div className="grid gap-6">
      <PanelShell title="Advanced operating snapshot" eyebrow="Apprenticeship Lead Console">
        <p className="max-w-2xl text-base leading-7 text-[#102c3d]/64">
          LevyTate gives Wren apprenticeship leads one place to manage demand, approvals, provider mappings and internal rollout.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ConsoleMetric title="Development pipeline" value={requests.length} copy="Live requests across the employer environment" />
          <ConsoleMetric title="Approval queue" value={(statusCounts["Manager review"] ?? 0) + (statusCounts["Lead review"] ?? 0)} copy="Items needing review" />
          <ConsoleMetric title="Provider mapping health" value="92%" copy="Delivery fit across live pathways" />
          <ConsoleMetric title="Department engagement" value={Object.keys(departmentCounts).length} copy="Teams with active demand signals" />
          <ConsoleMetric title="Levy forecast" value="73%" copy="Estimated utilisation this year" />
          <ConsoleMetric title="Bottleneck alerts" value="2" copy="Manager review and provider introduction" />
        </div>
      </PanelShell>

      <PanelShell title="Approval pipeline Kanban" eyebrow="Approval Flow">
        <Kanban requests={requests} onMove={onMove} />
      </PanelShell>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <ProviderMappingTable mappings={mappings} onMapping={onMapping} />
        <PanelShell title="Engagement and levy forecast" eyebrow="Operating Rhythm">
          <div className="grid gap-6">
            <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
            <InsightBars rows={[["Current forecast", 73], ["Target utilisation", 85], ["At risk", 12]]} />
          </div>
        </PanelShell>
      </div>

      <PanelShell title="Pathway management" eyebrow="Approved Routes">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#102c3d]/10 text-[#102c3d]/50">
                {["Pathway", "Standard", "Status", "Cohort", "Approved delivery partner", "Action"].map((heading) => (
                  <th key={heading} className="px-4 py-4 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pathways.map((pathway) => (
                <tr key={pathway.title} className="border-b border-[#102c3d]/6">
                  <td className="px-4 py-5 font-medium text-[#102c3d]">{pathway.title}</td>
                  <td className="px-4 py-5 text-[#102c3d]/64">{pathway.standard}</td>
                  <td className="px-4 py-5 text-[#102c3d]/64">{pathway.status}</td>
                  <td className="px-4 py-5 text-[#102c3d]/64">{pathway.cohort}</td>
                  <td className="px-4 py-5 text-[#102c3d]/64">{pathway.deliveryPartner}</td>
                  <td className="px-4 py-5"><SmallButton label="View details" onClick={() => onOpenPathway(pathway)} variant="mint" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelShell>

      <PanelShell title="Bottleneck alerts and suggested actions" eyebrow="Next Best Moves">
        <div className="grid gap-3 md:grid-cols-2">
          {["Review 6 manager approvals", "Confirm provider mapping for Manufacturing & Engineering", "Nudge departments with low engagement", "Prepare next Retail Sales & Design cohort"].map((action) => (
            <div key={action} className="rounded-2xl bg-[#f4fbf8] p-4 text-sm font-medium text-[#102c3d]/72">{action}</div>
          ))}
        </div>
      </PanelShell>
    </div>
  );
}

function ProviderMappingTable({ mappings, onMapping }: { mappings: ProviderMapping[]; onMapping: (index: number, status: MappingStatus, nextAction: string) => void }) {
  return (
    <PanelShell title="Provider mapping management" eyebrow="Delivery Control">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#102c3d]/10 text-[#102c3d]/50">
              {["Role family", "Apprenticeship pathway", "Standard", "Approved delivery partner", "Delivery model", "Fit score", "Mapping status", "Next action", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-4 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappings.map((row, index) => (
              <tr key={row.roleFamily} className="border-b border-[#102c3d]/6">
                <td className="px-4 py-5 text-[#102c3d]/68">{row.roleFamily}</td>
                <td className="px-4 py-5 font-medium text-[#102c3d]">{row.pathway}</td>
                <td className="px-4 py-5 text-[#102c3d]/68">{row.standard}</td>
                <td className="px-4 py-5 text-[#102c3d]/68">{row.partner}</td>
                <td className="px-4 py-5 text-[#102c3d]/68">{row.deliveryModel}</td>
                <td className="px-4 py-5 text-[#102c3d]/68">{row.fit}%</td>
                <td className="px-4 py-5 text-[#102c3d]/68">{row.status}</td>
                <td className="px-4 py-5 text-[#102c3d]/68">{row.nextAction}</td>
                <td className="px-4 py-5">
                  <div className="flex gap-2">
                    <SmallButton label="View details" onClick={() => onMapping(index, row.status, "Details reviewed")} variant="mint" />
                    <SmallButton label="Mark as live" onClick={() => onMapping(index, "Live", "Monitor cohort")} />
                    <SmallButton label="Flag review" onClick={() => onMapping(index, "Review", "Review delivery fit")} variant="coral" />
                    <SmallButton label="Replace" onClick={() => onMapping(index, "Review", "Replace provider")} variant="mint" />
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

function OperatingSnapshot({ requests, mappings, statusCounts }: { requests: RequestItem[]; mappings: ProviderMapping[]; statusCounts: Record<string, number> }) {
  const items = [
    ["Requests in progress", requests.length],
    ["Awaiting approval", (statusCounts["Manager review"] ?? 0) + (statusCounts["Lead review"] ?? 0)],
    ["Live pathways", pathways.filter((item) => item.status === "Live").length],
    ["Active mappings", mappings.filter((item) => item.status === "Live").length],
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

function PathwayCard({ pathway, saved, onOpen, onSave }: { pathway: Pathway; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <article className="rounded-3xl bg-white p-6 shadow-[0_16px_46px_rgba(16,44,61,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-xl font-semibold">{pathway.title}</h3>
        <span className="rounded-full bg-[#dff7ef] px-3 py-1 text-xs font-medium text-[#146b66]">{pathway.status}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-[#159b8f]">{pathway.standard}</p>
      <p className="mt-5 text-sm leading-7 text-[#102c3d]/62">{pathway.audience}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={onOpen} className="rounded-full bg-[#102c3d] px-4 py-2 text-sm font-semibold text-white">View details</button>
        <button onClick={onSave} className="rounded-full bg-[#f4fbf8] px-4 py-2 text-sm font-semibold text-[#102c3d]">{saved ? "Saved" : "Save"}</button>
      </div>
    </article>
  );
}

function RequestForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field name="name" label="Name" defaultValue="Amelia Hart" />
      <Field name="role" label="Role" defaultValue="Kitchen Designer" />
      <Field name="department" label="Department" defaultValue="Retail" />
      <Field name="team" label="Team" defaultValue="Showroom North" />
      <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70">
        Selected pathway
        <select name="pathway" className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]">
          {pathways.map((pathway) => (
            <option key={pathway.title}>{pathway.title}</option>
          ))}
        </select>
      </label>
      <Field name="manager" label="Line manager" defaultValue="Ryan Booth" />
      <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70">
        Why is this needed?
        <textarea name="need" rows={4} className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]" defaultValue="I want to build stronger customer and design confidence." />
      </label>
      <button className="w-fit rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white">Submit request</button>
    </form>
  );
}

function RequestTracker({ request }: { request: RequestItem }) {
  const activeIndex = requestStages.indexOf(request.status);
  return (
    <div className="rounded-3xl bg-[#f8fbfa] p-5">
      <p className="text-sm font-medium text-[#102c3d]/50">My request status</p>
      <h3 className="mt-2 text-xl font-semibold">{request.pathway}</h3>
      <div className="mt-5 grid gap-3">
        {publicStages.map((stage, index) => (
          <div key={stage} className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${index <= activeIndex ? "bg-[#159b8f]" : "bg-[#d9e8e2]"}`} />
            <span className={`text-sm font-medium ${index <= activeIndex ? "text-[#102c3d]" : "text-[#102c3d]/42"}`}>{stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kanban({ requests, onMove, compact = false }: { requests: RequestItem[]; onMove?: (id: number, direction: 1 | -1) => void; compact?: boolean }) {
  return (
    <div className="grid gap-4 xl:grid-cols-6">
      {requestStages.map((column) => (
        <div key={column} className="rounded-3xl bg-[#f8fbfa] p-4">
          <h3 className="text-sm font-semibold text-[#102c3d]">{column}</h3>
          <div className="mt-4 grid gap-3">
            {requests.filter((request) => request.status === column).slice(0, compact ? 2 : 8).map((request) => (
              <article key={request.id} className="rounded-2xl bg-white p-4 shadow-[0_8px_18px_rgba(16,44,61,0.06)]">
                <p className="text-sm font-semibold">{request.name}</p>
                <p className="mt-1 text-xs font-medium text-[#102c3d]/54">{request.pathway}</p>
                {onMove && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onMove(request.id, -1)} className="rounded-full bg-[#f4fbf8] px-3 py-1.5 text-xs font-medium text-[#102c3d]">Back</button>
                    <button onClick={() => onMove(request.id, 1)} className="rounded-full bg-[#102c3d] px-3 py-1.5 text-xs font-medium text-white">Next</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutiveSummary({ requests, mappings, statusCounts }: { requests: RequestItem[]; mappings: ProviderMapping[]; statusCounts: Record<string, number> }) {
  const summary = [
    ["Admin time saved", "14 hrs/mo"],
    ["Live pathway coverage", `${pathways.filter((item) => item.status === "Live").length}/${pathways.length}`],
    ["Departments engaged", String(new Set(requests.map((request) => request.department)).size)],
    ["Provider mappings active", String(mappings.filter((mapping) => mapping.status === "Live").length)],
    ["Forecast levy utilisation", "73%"],
    ["Bottlenecks reduced", `${Math.max(0, 8 - (statusCounts["Manager review"] ?? 0))}`],
  ];
  return (
    <PanelShell title="Executive summary" eyebrow="Stakeholder View">
      <div className="grid gap-4 md:grid-cols-3">
        {summary.map(([label, value]) => (
          <MiniMetric key={label} label={label} value={value} copy="Mock presentation data" />
        ))}
      </div>
    </PanelShell>
  );
}

function GuidePanel({ role, copy }: { role: Role; copy: string }) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_54px_rgba(16,44,61,0.08)]">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#df5f73]">LevyTate Guide</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#102c3d]">{role} view</h2>
      <p className="mt-4 text-sm leading-7 text-[#102c3d]/62">{copy}</p>
    </section>
  );
}

function DemoControls({ scenario, onScenario, onSeed, onReset }: { scenario: DemandScenario; onScenario: (scenario: DemandScenario) => void; onSeed: () => void; onReset: () => void }) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_54px_rgba(16,44,61,0.08)]">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#df5f73]">Demo Mode</p>
      <div className="mt-5 grid gap-3">
        <button onClick={onReset} className="rounded-full bg-[#f4fbf8] px-4 py-2.5 text-sm font-semibold text-[#102c3d]">Reset demo data</button>
        <button onClick={onSeed} className="rounded-full bg-[#102c3d] px-4 py-2.5 text-sm font-semibold text-white">Seed new request</button>
        <div className="grid grid-cols-3 rounded-full bg-[#eef8f5] p-1">
          {(["Low", "Medium", "High"] as DemandScenario[]).map((item) => (
            <button key={item} onClick={() => onScenario(item)} className={`rounded-full px-3 py-2 text-xs font-medium ${scenario === item ? "bg-white text-[#102c3d] shadow-[0_8px_18px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/54"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function PathwayModal({ pathway, onClose, onStart }: { pathway: Pathway; onClose: () => void; onStart: () => void }) {
  const details = [
    ["Overview", pathway.standard],
    ["Who it is for", pathway.audience],
    ["Business benefit", pathway.businessBenefit],
    ["Learner benefit", pathway.learnerBenefit],
    ["Duration", pathway.duration],
    ["Commitment", pathway.commitment],
    ["Approval route", "Employee request, manager review, apprenticeship lead review, provider introduction."],
    ["Approved delivery partner", pathway.deliveryPartner],
    ["Next cohort window", pathway.cohort],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c3d]/30 px-5 py-8 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-[0_30px_90px_rgba(16,44,61,0.24)] lg:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#df5f73]">Pathway detail</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#102c3d]">{pathway.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#f4fbf8] px-4 py-2 text-sm font-semibold text-[#102c3d]">Close</button>
        </div>
        <div className="mt-6 grid gap-4">
          {details.map(([label, value]) => (
            <SubtleRow key={label} label={label} value={value} />
          ))}
        </div>
        <button onClick={onStart} className="mt-8 rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white">Start request</button>
      </section>
    </div>
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

function MiniMetric({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return (
    <article className="rounded-3xl bg-[#f8fbfa] p-5">
      <p className="text-sm font-medium text-[#102c3d]/50">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">{copy}</p>
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

function Field({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#102c3d]/70">
      {label}
      <input name={name} defaultValue={defaultValue} className="rounded-2xl border border-[#102c3d]/10 bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#159b8f]" />
    </label>
  );
}

function SmallButton({ label, onClick, variant = "dark" }: { label: string; onClick: () => void; variant?: "dark" | "mint" | "coral" }) {
  const classes = {
    dark: "bg-[#102c3d] text-white",
    mint: "bg-[#dff7ef] text-[#146b66]",
    coral: "bg-[#ffe3e8] text-[#bf4159]",
  };

  return <button onClick={onClick} className={`rounded-full px-4 py-2 text-xs font-semibold ${classes[variant]}`}>{label}</button>;
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

function countBy<T, K extends keyof T>(items: T[], key: K) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
