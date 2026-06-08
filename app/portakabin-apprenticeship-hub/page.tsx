"use client";

import { FormEvent, useMemo, useState } from "react";
import { LevyTateLogo, PlatformButton, PlatformMetric, PlatformPanel, PlatformTopBar, type PlatformNavSection } from "@/components/levytate-demo/PlatformShell";

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
  departments: string[];
};

type RequestItem = {
  id: number;
  name: string;
  role: string;
  department: string;
  team: string;
  site: string;
  pathway: string;
  manager: string;
  status: RequestStatus;
  note: string;
};

type Learner = {
  name: string;
  role: string;
  department: string;
  site: string;
  programme: string;
  status: RequestStatus;
  progress: number;
  lineManager: string;
  startDate: string;
};

type ProviderMapping = {
  roleFamily: string;
  pathway: string;
  standard: string;
  partner: string;
  alternativePartner: string;
  deliveryModel: string;
  fit: number;
  status: MappingStatus;
  nextAction: string;
  whyRecommended: string;
};

type SectionKey =
  | "Dashboard"
  | "Explore Pathways"
  | "Recommended Programmes"
  | "Skills Analysis"
  | "Requests"
  | "Approvals"
  | "Enrolments"
  | "Skills Map"
  | "Department Demand"
  | "Future Skills"
  | "Approved Providers"
  | "Performance"
  | "Levy Position"
  | "Forecast"
  | "Reporting"
  | "Learners by Site"
  | "AI Assistant"
  | "Admin";

const roles: Role[] = ["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"];
const requestStages: RequestStatus[] = ["New interest", "Manager review", "Lead review", "Provider introduction", "Enrolment", "Live learner"];
const publicStages = ["Interest submitted", "Manager review", "Apprenticeship lead review", "Provider introduction", "Enrolment in progress", "Live learner"];

const navSections: PlatformNavSection[] = [
  { title: "Dashboard", items: ["Dashboard"] },
  { title: "Apprenticeships", items: ["Explore Pathways", "Recommended Programmes", "Skills Analysis"] },
  { title: "Applications", items: ["Requests", "Approvals", "Enrolments"] },
  { title: "Workforce Planning", items: ["Skills Map", "Department Demand", "Future Skills"] },
  { title: "Providers", items: ["Approved Providers", "Performance"] },
  { title: "Funding & Levy", items: ["Levy Position", "Forecast"] },
  { title: "Reporting", items: ["Reporting", "Learners by Site"] },
  { title: "AI Assistant", items: ["AI Assistant"] },
  { title: "Admin", items: ["Admin"] },
];

const roleSectionMap: Record<Role, SectionKey[]> = {
  Employee: ["Recommended Programmes", "Requests", "Explore Pathways"],
  "Line Manager": ["Approvals", "Requests", "Skills Analysis", "Recommended Programmes"],
  "Department Head": ["Department Demand", "Skills Map", "Future Skills", "Forecast"],
  "Apprenticeship Lead": ["Requests", "Approved Providers", "Levy Position", "Reporting", "Admin"],
};

const allSitesLabel = "All sites";

const portakabinSites = [
  "York Head Office, Visitor Centre and UK Factory",
  "Aberdeen Visitor Centre",
  "Ashford Visitor Centre",
  "Avonmouth Site Accommodation Visitor Centre",
  "Aylesbury Site Accommodation Visitor Centre",
  "Belfast Visitor Centre",
  "Blackburn Visitor Centre",
  "Bordon Site Accommodation Visitor Centre",
  "Cardiff Visitor Centre",
  "Carlisle Visitor Centre",
  "Deeside Visitor Centre",
  "Edinburgh Visitor Centre",
  "Gateshead Visitor Centre",
  "Glasgow Visitor Centre",
  "Glasgow Site Accommodation Visitor Centre",
  "Hayes London West Visitor Centre",
  "Highbridge Visitor Centre",
  "Inverness Visitor Centre",
  "Leeds Visitor Centre",
  "Lingfield London South Visitor Centre",
  "London Central Visitor Centre",
  "Merseyside Visitor Centre",
  "Northampton Visitor Centre",
  "Norwich Visitor Centre",
  "Nottingham Visitor Centre",
  "Oldham Manchester Visitor Centre",
  "Oxford Visitor Centre",
  "Peterborough Visitor Centre",
  "Plymouth Visitor Centre",
  "Purfleet London East Visitor Centre",
  "Rugby Site Accommodation Visitor Centre",
  "Sheffield Visitor Centre",
  "Sherburn-in-Elmet Site Accommodation Visitor Centre",
  "Sittingbourne Site Accommodation Visitor Centre",
  "Smethwick Visitor Centre",
  "Southampton Visitor Centre",
  "St Albans Visitor Centre",
  "Stockton Visitor Centre",
  "Stoke Visitor Centre",
  "Trafford Park Manchester Visitor Centre",
  "Warrington Site Accommodation Visitor Centre",
  "Witham Site Accommodation Visitor Centre",
];

const pathways: Pathway[] = [
  {
    title: "Manufacturing & Production",
    standard: "L3 Engineering Technician",
    audience: "Production, assembly, maintenance and modular building manufacturing colleagues.",
    businessBenefit: "Build stronger production capability, quality routines and manufacturing confidence.",
    learnerBenefit: "Recognised technical skills with evidence from live modular building work.",
    status: "Live",
    deliveryPartner: "TEC Partnership",
    duration: "36 to 42 months",
    commitment: "Site learning blocks, coaching and workplace evidence.",
    cohort: "September manufacturing intake",
    departments: ["Production", "Assembly", "Maintenance"],
  },
  {
    title: "Design & Technical",
    standard: "L3 Design and Draughting or L4 Construction Design",
    audience: "Design, technical drawing, planning and building specification teams.",
    businessBenefit: "Improve technical documentation and design to delivery handoffs.",
    learnerBenefit: "A practical route into design, standards and project evidence.",
    status: "Ready",
    deliveryPartner: "TEC Partnership",
    duration: "24 to 30 months",
    commitment: "Blended learning with applied technical project evidence.",
    cohort: "October technical design group",
    departments: ["Design", "Technical", "Planning"],
  },
  {
    title: "Installation & Site Operations",
    standard: "L3 Construction Site Supervisor",
    audience: "Installation, site coordination, project handover and field operations colleagues.",
    businessBenefit: "Strengthen site readiness, handover discipline and customer delivery confidence.",
    learnerBenefit: "Practical site leadership and coordination skills linked to live projects.",
    status: "Live",
    deliveryPartner: "Leeds College of Building",
    duration: "18 to 24 months",
    commitment: "Field evidence, site visits and coaching with manager support.",
    cohort: "November site operations cohort",
    departments: ["Installation", "Projects", "Field Operations"],
  },
  {
    title: "Hire, Sales & Customer Experience",
    standard: "L3 Customer Service Specialist or L4 Sales Executive",
    audience: "Hire, sales, account support, customer operations and service teams.",
    businessBenefit: "Create stronger customer conversations and consistent commercial follow-through.",
    learnerBenefit: "Customer, commercial and service skills with a clear progression pathway.",
    status: "Live",
    deliveryPartner: "Babington",
    duration: "15 to 18 months",
    commitment: "Monthly workshops with applied customer and sales evidence.",
    cohort: "Rolling customer experience starts",
    departments: ["Hire", "Sales", "Customer Support"],
  },
  {
    title: "Procurement & Supply Chain",
    standard: "L3 Supply Chain Practitioner",
    audience: "Procurement, logistics, transport coordination and materials planning roles.",
    businessBenefit: "Improve material availability, supplier coordination and delivery planning.",
    learnerBenefit: "Practical supply chain skills connected to modular building operations.",
    status: "Ready",
    deliveryPartner: "SR Apprenticeships",
    duration: "18 to 24 months",
    commitment: "Hybrid learning with planning and supplier evidence.",
    cohort: "January logistics group",
    departments: ["Procurement", "Logistics", "Materials"],
  },
  {
    title: "Digital, Data & AI",
    standard: "L3 Data Technician or L4 Business Analyst",
    audience: "Colleagues improving reporting, systems, planning tools and operational insight.",
    businessBenefit: "Turn operational information into clearer decisions and smarter capacity planning.",
    learnerBenefit: "Build practical digital, data and AI confidence in a work-based setting.",
    status: "Ready",
    deliveryPartner: "QA",
    duration: "18 to 24 months",
    commitment: "Remote workshops, applied data tasks and internal project evidence.",
    cohort: "Next quarter digital group",
    departments: ["Digital", "Data", "Operations"],
  },
  {
    title: "Health, Safety & Compliance",
    standard: "L3 Safety, Health and Environment Technician",
    audience: "Safety, quality, compliance and operational risk support colleagues.",
    businessBenefit: "Improve compliance routines, safer sites and stronger evidence trails.",
    learnerBenefit: "Structured safety and compliance capability with workplace application.",
    status: "Ready",
    deliveryPartner: "Learning Skills Partnership",
    duration: "18 to 24 months",
    commitment: "Online learning, site evidence and compliance projects.",
    cohort: "December compliance cohort",
    departments: ["Safety", "Quality", "Compliance"],
  },
  {
    title: "Leadership & Management",
    standard: "L3 Team Leader or L5 Operations Manager",
    audience: "Team leaders, supervisors and colleagues stepping into people leadership.",
    businessBenefit: "Create more consistent management practice across delivery and support teams.",
    learnerBenefit: "Confident leadership, planning and performance management skills.",
    status: "Live",
    deliveryPartner: "Babington",
    duration: "15 to 27 months",
    commitment: "Blended workshops, coaching and live team improvement work.",
    cohort: "Quarterly leadership pipeline",
    departments: ["Operations", "Manufacturing", "Support"],
  },
];

const portakabinLearners: Learner[] = [
  { name: "Amelia Hart", role: "Production Team Member", department: "Manufacturing", site: "York Head Office, Visitor Centre and UK Factory", programme: "Manufacturing & Production", status: "Manager review", progress: 18, lineManager: "Ryan Booth", startDate: "2026-03-04" },
  { name: "Maya Singh", role: "Shift Supervisor", department: "Manufacturing", site: "York Head Office, Visitor Centre and UK Factory", programme: "Leadership & Management", status: "Enrolment", progress: 42, lineManager: "Priya Nair", startDate: "2025-11-12" },
  { name: "Isla Reid", role: "Quality Coordinator", department: "Manufacturing", site: "York Head Office, Visitor Centre and UK Factory", programme: "Health, Safety & Compliance", status: "Lead review", progress: 24, lineManager: "Priya Nair", startDate: "2026-01-19" },
  { name: "Tom Harrison", role: "Maintenance Technician", department: "Manufacturing", site: "York Head Office, Visitor Centre and UK Factory", programme: "Manufacturing & Production", status: "Live learner", progress: 67, lineManager: "Ryan Booth", startDate: "2025-08-05" },
  { name: "Marcus Lee", role: "Technical Design Assistant", department: "Design & Technical", site: "York Head Office, Visitor Centre and UK Factory", programme: "Design & Technical", status: "Manager review", progress: 16, lineManager: "Priya Nair", startDate: "2026-02-23" },
  { name: "Sophie Clarke", role: "Customer Hire Coordinator", department: "Hire & Customer", site: "Leeds Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Lead review", progress: 28, lineManager: "Helen Ward", startDate: "2026-01-08" },
  { name: "Noah Bennett", role: "Installation Coordinator", department: "Site Operations", site: "Sheffield Visitor Centre", programme: "Installation & Site Operations", status: "New interest", progress: 8, lineManager: "Sam Ellis", startDate: "2026-04-15" },
  { name: "Grace Patel", role: "Project Coordinator", department: "Projects", site: "London Central Visitor Centre", programme: "Leadership & Management", status: "Provider introduction", progress: 35, lineManager: "Ryan Booth", startDate: "2025-12-02" },
  { name: "Leo Morgan", role: "Materials Planner", department: "Supply Chain", site: "Warrington Site Accommodation Visitor Centre", programme: "Procurement & Supply Chain", status: "Manager review", progress: 21, lineManager: "Helen Ward", startDate: "2026-03-11" },
  { name: "Ethan Brooks", role: "Compliance Assistant", department: "Compliance", site: "Smethwick Visitor Centre", programme: "Health, Safety & Compliance", status: "Live learner", progress: 74, lineManager: "Sam Ellis", startDate: "2025-07-21" },
  { name: "Olivia Grant", role: "Account Support Lead", department: "Hire & Customer", site: "Trafford Park Manchester Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "New interest", progress: 5, lineManager: "Ryan Booth", startDate: "2026-05-06" },
  { name: "Daniel Fox", role: "Site Supervisor", department: "Site Operations", site: "Rugby Site Accommodation Visitor Centre", programme: "Installation & Site Operations", status: "Manager review", progress: 19, lineManager: "Sam Ellis", startDate: "2026-02-04" },
  { name: "Ruby Carter", role: "Hire Controller", department: "Hire & Customer", site: "Aberdeen Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 58, lineManager: "Helen Ward", startDate: "2025-09-10" },
  { name: "Jack Wilson", role: "Field Coordinator", department: "Site Operations", site: "Ashford Visitor Centre", programme: "Installation & Site Operations", status: "Enrolment", progress: 39, lineManager: "Sam Ellis", startDate: "2025-12-14" },
  { name: "Ava Mitchell", role: "Customer Support Advisor", department: "Hire & Customer", site: "Avonmouth Site Accommodation Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 62, lineManager: "Helen Ward", startDate: "2025-10-02" },
  { name: "Harry Thompson", role: "Yard Operations Lead", department: "Operations", site: "Aylesbury Site Accommodation Visitor Centre", programme: "Leadership & Management", status: "Lead review", progress: 25, lineManager: "Ryan Booth", startDate: "2026-01-27" },
  { name: "Freya Evans", role: "Sales Coordinator", department: "Hire & Customer", site: "Belfast Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Manager review", progress: 22, lineManager: "Helen Ward", startDate: "2026-03-02" },
  { name: "Joshua Green", role: "Service Planner", department: "Operations", site: "Blackburn Visitor Centre", programme: "Procurement & Supply Chain", status: "Provider introduction", progress: 33, lineManager: "Sam Ellis", startDate: "2025-12-08" },
  { name: "Lily Walker", role: "Site Accommodation Coordinator", department: "Site Operations", site: "Bordon Site Accommodation Visitor Centre", programme: "Installation & Site Operations", status: "Live learner", progress: 71, lineManager: "Sam Ellis", startDate: "2025-06-18" },
  { name: "Oscar Hall", role: "Customer Experience Advisor", department: "Hire & Customer", site: "Cardiff Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 64, lineManager: "Helen Ward", startDate: "2025-08-29" },
  { name: "Mia Allen", role: "Operations Assistant", department: "Operations", site: "Carlisle Visitor Centre", programme: "Leadership & Management", status: "New interest", progress: 6, lineManager: "Ryan Booth", startDate: "2026-05-20" },
  { name: "George Young", role: "Transport Coordinator", department: "Supply Chain", site: "Deeside Visitor Centre", programme: "Procurement & Supply Chain", status: "Manager review", progress: 17, lineManager: "Helen Ward", startDate: "2026-02-09" },
  { name: "Ella King", role: "Hire Controller", department: "Hire & Customer", site: "Edinburgh Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Lead review", progress: 29, lineManager: "Helen Ward", startDate: "2026-01-15" },
  { name: "Charlie Wright", role: "Project Support Officer", department: "Projects", site: "Gateshead Visitor Centre", programme: "Leadership & Management", status: "Enrolment", progress: 45, lineManager: "Ryan Booth", startDate: "2025-11-25" },
  { name: "Zara Scott", role: "Data Coordinator", department: "Digital", site: "Glasgow Visitor Centre", programme: "Digital, Data & AI", status: "Live learner", progress: 69, lineManager: "Priya Nair", startDate: "2025-07-03" },
  { name: "Finley Adams", role: "Accommodation Planner", department: "Site Operations", site: "Glasgow Site Accommodation Visitor Centre", programme: "Installation & Site Operations", status: "Provider introduction", progress: 31, lineManager: "Sam Ellis", startDate: "2025-12-18" },
  { name: "Hannah Baker", role: "Customer Account Assistant", department: "Hire & Customer", site: "Hayes London West Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 76, lineManager: "Helen Ward", startDate: "2025-05-14" },
  { name: "Archie Morris", role: "Site Supervisor", department: "Site Operations", site: "Highbridge Visitor Centre", programme: "Installation & Site Operations", status: "Manager review", progress: 20, lineManager: "Sam Ellis", startDate: "2026-03-18" },
  { name: "Niamh Cooper", role: "Hire Administrator", department: "Hire & Customer", site: "Inverness Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "New interest", progress: 4, lineManager: "Helen Ward", startDate: "2026-05-28" },
  { name: "Theo Richardson", role: "Technical Coordinator", department: "Design & Technical", site: "Lingfield London South Visitor Centre", programme: "Design & Technical", status: "Lead review", progress: 27, lineManager: "Priya Nair", startDate: "2026-01-30" },
  { name: "Millie Cox", role: "Operations Coordinator", department: "Operations", site: "Merseyside Visitor Centre", programme: "Leadership & Management", status: "Enrolment", progress: 48, lineManager: "Ryan Booth", startDate: "2025-10-19" },
  { name: "Jacob Ward", role: "Customer Service Specialist", department: "Hire & Customer", site: "Northampton Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 66, lineManager: "Helen Ward", startDate: "2025-08-12" },
  { name: "Erin Hughes", role: "Systems Assistant", department: "Digital", site: "Norwich Visitor Centre", programme: "Digital, Data & AI", status: "Manager review", progress: 18, lineManager: "Priya Nair", startDate: "2026-03-09" },
  { name: "Logan Turner", role: "Sales Support Advisor", department: "Hire & Customer", site: "Nottingham Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 72, lineManager: "Helen Ward", startDate: "2025-06-02" },
  { name: "Phoebe Phillips", role: "Customer Coordinator", department: "Hire & Customer", site: "Oldham Manchester Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Lead review", progress: 26, lineManager: "Helen Ward", startDate: "2026-02-01" },
  { name: "Max Campbell", role: "Business Support Assistant", department: "Operations", site: "Oxford Visitor Centre", programme: "Leadership & Management", status: "New interest", progress: 7, lineManager: "Ryan Booth", startDate: "2026-04-22" },
  { name: "Daisy Parker", role: "Hire Desk Advisor", department: "Hire & Customer", site: "Peterborough Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 61, lineManager: "Helen Ward", startDate: "2025-09-17" },
  { name: "Toby Edwards", role: "Installation Planner", department: "Site Operations", site: "Plymouth Visitor Centre", programme: "Installation & Site Operations", status: "Provider introduction", progress: 34, lineManager: "Sam Ellis", startDate: "2025-12-21" },
  { name: "Maisie Collins", role: "Site Accommodation Assistant", department: "Site Operations", site: "Purfleet London East Visitor Centre", programme: "Installation & Site Operations", status: "Manager review", progress: 19, lineManager: "Sam Ellis", startDate: "2026-03-22" },
  { name: "Ben Stewart", role: "Stores Coordinator", department: "Supply Chain", site: "Sherburn-in-Elmet Site Accommodation Visitor Centre", programme: "Procurement & Supply Chain", status: "Live learner", progress: 57, lineManager: "Helen Ward", startDate: "2025-10-24" },
  { name: "Imogen Russell", role: "Site Support Coordinator", department: "Site Operations", site: "Sittingbourne Site Accommodation Visitor Centre", programme: "Installation & Site Operations", status: "Enrolment", progress: 44, lineManager: "Sam Ellis", startDate: "2025-11-03" },
  { name: "Lucas Price", role: "Hire Controller", department: "Hire & Customer", site: "Smethwick Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 68, lineManager: "Helen Ward", startDate: "2025-07-29" },
  { name: "Alice Bennett", role: "Customer Support Advisor", department: "Hire & Customer", site: "Southampton Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Manager review", progress: 23, lineManager: "Helen Ward", startDate: "2026-02-16" },
  { name: "Sam Roberts", role: "Operations Team Leader", department: "Operations", site: "St Albans Visitor Centre", programme: "Leadership & Management", status: "Lead review", progress: 30, lineManager: "Ryan Booth", startDate: "2026-01-22" },
  { name: "Harriet James", role: "Hire Coordinator", department: "Hire & Customer", site: "Stockton Visitor Centre", programme: "Hire, Sales & Customer Experience", status: "Live learner", progress: 63, lineManager: "Helen Ward", startDate: "2025-08-21" },
  { name: "Nathan Wood", role: "Yard Supervisor", department: "Operations", site: "Stoke Visitor Centre", programme: "Leadership & Management", status: "Provider introduction", progress: 36, lineManager: "Ryan Booth", startDate: "2025-12-05" },
  { name: "Chloe Watson", role: "Logistics Assistant", department: "Supply Chain", site: "Trafford Park Manchester Visitor Centre", programme: "Procurement & Supply Chain", status: "Manager review", progress: 22, lineManager: "Helen Ward", startDate: "2026-03-13" },
  { name: "Owen Brooks", role: "Accommodation Coordinator", department: "Site Operations", site: "Witham Site Accommodation Visitor Centre", programme: "Installation & Site Operations", status: "Live learner", progress: 59, lineManager: "Sam Ellis", startDate: "2025-09-05" },
];

const initialRequests: RequestItem[] = [
  { id: 1, name: "Amelia Hart", role: "Production Team Member", department: "Manufacturing", team: "Assembly Line A", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Manufacturing & Production", manager: "Ryan Booth", status: "Manager review", note: "Technical progression." },
  { id: 2, name: "Marcus Lee", role: "Technical Design Assistant", department: "Design & Technical", team: "Building Design", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Design & Technical", manager: "Priya Nair", status: "Manager review", note: "Design capability." },
  { id: 3, name: "Sophie Clarke", role: "Customer Hire Coordinator", department: "Hire & Customer", team: "Customer Support", site: "Leeds Visitor Centre", pathway: "Hire, Sales & Customer Experience", manager: "Helen Ward", status: "Lead review", note: "Customer confidence." },
  { id: 4, name: "Noah Bennett", role: "Installation Coordinator", department: "Site Operations", team: "Field Delivery", site: "Sheffield Visitor Centre", pathway: "Installation & Site Operations", manager: "Sam Ellis", status: "New interest", note: "Site handover skills." },
  { id: 5, name: "Grace Patel", role: "Project Coordinator", department: "Projects", team: "Delivery Office", site: "London Central Visitor Centre", pathway: "Leadership & Management", manager: "Ryan Booth", status: "Provider introduction", note: "Planning discipline." },
  { id: 6, name: "Leo Morgan", role: "Materials Planner", department: "Supply Chain", team: "Materials Planning", site: "Warrington Site Accommodation Visitor Centre", pathway: "Procurement & Supply Chain", manager: "Helen Ward", status: "Manager review", note: "Supplier coordination." },
  { id: 7, name: "Maya Singh", role: "Shift Supervisor", department: "Manufacturing", team: "Shift Leadership", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Leadership & Management", manager: "Priya Nair", status: "Enrolment", note: "New supervisor." },
  { id: 8, name: "Ethan Brooks", role: "Compliance Assistant", department: "Compliance", team: "SHEQ", site: "Smethwick Visitor Centre", pathway: "Health, Safety & Compliance", manager: "Sam Ellis", status: "Live learner", note: "Safety evidence." },
];

const initialMappings: ProviderMapping[] = [
  {
    roleFamily: "Manufacturing",
    pathway: "Manufacturing & Production",
    standard: "L3 Engineering Technician / Engineering Maintenance Technician",
    partner: "TEC Partnership",
    alternativePartner: "North Lindsey College",
    deliveryModel: "Site based",
    fit: 93,
    status: "Live",
    nextAction: "Confirm workshop timetable",
    whyRecommended: "Regional engineering and technical training fit.",
  },
  {
    roleFamily: "Design & Technical",
    pathway: "Design & Technical",
    standard: "L3 Engineering Design Technician",
    partner: "TEC Partnership",
    alternativePartner: "Leeds College of Building",
    deliveryModel: "Blended",
    fit: 89,
    status: "Ready",
    nextAction: "Validate technical mentors",
    whyRecommended: "Relevant engineering design technician apprenticeship coverage.",
  },
  {
    roleFamily: "Site Operations",
    pathway: "Installation & Site Operations",
    standard: "L3 Construction Site Supervisor",
    partner: "Leeds College of Building",
    alternativePartner: "Learning Skills Partnership",
    deliveryModel: "Field based",
    fit: 91,
    status: "Live",
    nextAction: "Prepare site cohort",
    whyRecommended: "Construction and site supervision training fit.",
  },
  {
    roleFamily: "Hire & Customer",
    pathway: "Hire, Sales & Customer Experience",
    standard: "L3 Customer Service Specialist",
    partner: "Babington",
    alternativePartner: "Remit Training",
    deliveryModel: "Online + workshops",
    fit: 92,
    status: "Live",
    nextAction: "Review customer cohort",
    whyRecommended: "National customer service apprenticeship delivery.",
  },
  {
    roleFamily: "Supply Chain",
    pathway: "Procurement & Supply Chain",
    standard: "L3 Supply Chain Practitioner",
    partner: "SR Apprenticeships",
    alternativePartner: "Apprenticeship College",
    deliveryModel: "Hybrid",
    fit: 87,
    status: "Ready",
    nextAction: "Review delivery fit",
    whyRecommended: "Specific supply chain practitioner apprenticeship delivery.",
  },
  {
    roleFamily: "Digital",
    pathway: "Digital, Data & AI",
    standard: "L3 Data Technician",
    partner: "QA",
    alternativePartner: "Apprentify",
    deliveryModel: "Remote + workshops",
    fit: 88,
    status: "Ready",
    nextAction: "Confirm data projects",
    whyRecommended: "Strong national data and digital apprenticeship delivery.",
  },
];

const scenarioSeeds: Record<DemandScenario, RequestItem[]> = {
  Low: initialRequests.slice(0, 5),
  Medium: initialRequests,
  High: [
    ...initialRequests,
    { id: 9, name: "Olivia Grant", role: "Account Support Lead", department: "Hire & Customer", team: "Commercial Support", site: "Trafford Park Manchester Visitor Centre", pathway: "Hire, Sales & Customer Experience", manager: "Ryan Booth", status: "New interest", note: "Commercial progression." },
    { id: 10, name: "Daniel Fox", role: "Site Supervisor", department: "Site Operations", team: "Field Delivery", site: "Rugby Site Accommodation Visitor Centre", pathway: "Installation & Site Operations", manager: "Sam Ellis", status: "Manager review", note: "Site coordination." },
    { id: 11, name: "Isla Reid", role: "Quality Coordinator", department: "Manufacturing", team: "Quality", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Health, Safety & Compliance", manager: "Priya Nair", status: "Lead review", note: "Compliance confidence." },
  ],
};

export default function PortakabinApprenticeshipHub() {
  const [role, setRole] = useState<Role>("Employee");
  const [activeSection, setActiveSection] = useState<SectionKey>("Dashboard");
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [mappings, setMappings] = useState<ProviderMapping[]>(initialMappings);
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [savedPathways, setSavedPathways] = useState<string[]>(["Manufacturing & Production", "Digital, Data & AI"]);
  const [scenario, setScenario] = useState<DemandScenario>("Medium");
  const [selectedSite, setSelectedSite] = useState(allSitesLabel);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [success, setSuccess] = useState(false);

  const filteredRequests = useMemo(() => filterBySite(requests, selectedSite), [requests, selectedSite]);
  const filteredLearners = useMemo(() => filterBySite(portakabinLearners, selectedSite), [selectedSite]);
  const searchedLearners = useMemo(() => {
    const query = learnerSearch.trim().toLowerCase();
    if (!query) return filteredLearners;
    return filteredLearners.filter((learner) => [learner.name, learner.role, learner.department, learner.site, learner.programme, learner.status, learner.lineManager].join(" ").toLowerCase().includes(query));
  }, [filteredLearners, learnerSearch]);
  const statusCounts = useMemo(() => countBy(filteredRequests, "status"), [filteredRequests]);
  const departmentCounts = useMemo(() => countBy(filteredRequests, "department"), [filteredRequests]);
  const employeeRequest = filteredRequests.find((request) => request.name === "Amelia Hart") ?? filteredRequests[0] ?? requests[0];

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setActiveSection("Dashboard");
  }

  function openSection(section: SectionKey) {
    setActiveSection(section);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const pathway = String(data.get("pathway") || pathways[0].title);
    const nextRequest: RequestItem = {
      id: Math.max(...requests.map((request) => request.id), 0) + 1,
      name: String(data.get("name") || "New colleague"),
      role: String(data.get("role") || "Internal colleague"),
      department: String(data.get("department") || "Manufacturing"),
      team: String(data.get("team") || "Internal team"),
      site: selectedSite === allSitesLabel ? "York Head Office, Visitor Centre and UK Factory" : selectedSite,
      pathway,
      manager: String(data.get("manager") || "Line manager"),
      status: "New interest",
      note: String(data.get("need") || "New development request."),
    };

    setRequests((current) => [nextRequest, ...current]);
    setSuccess(true);
    setActiveSection("Requests");
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
        department: seed.departments[0],
        team: "Presentation demo",
        site: selectedSite === allSitesLabel ? portakabinSites[current.length % portakabinSites.length] : selectedSite,
        pathway: seed.title,
        manager: "Demo manager",
        status: "New interest",
        note: "Seeded presentation request.",
      },
      ...current,
    ]);
    setActiveSection("Requests");
  }

  function setScenarioData(nextScenario: DemandScenario) {
    setScenario(nextScenario);
    setRequests(scenarioSeeds[nextScenario]);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8faf8_0%,#f2f6f4_48%,#f6f8f7_100%)] text-[#102c3d]">
      <Sidebar activeSection={activeSection} onNavigate={openSection} />

      <div className="h-screen min-w-0 overflow-y-auto lg:ml-[296px]">
        <TopBar role={role} setRole={switchRole} selectedSite={selectedSite} onSite={setSelectedSite} onOpenAdmin={() => switchRole("Apprenticeship Lead")} />

        <div className="mx-auto w-full max-w-[1500px] space-y-7 px-5 py-7 sm:px-7 lg:px-9">
          <HeroPanel role={role} requests={filteredRequests} learners={filteredLearners} mappings={mappings} statusCounts={statusCounts} selectedSite={selectedSite} onNavigate={openSection} />
          {selectedSite !== allSitesLabel ? <SiteSummary site={selectedSite} learners={filteredLearners} requests={filteredRequests} /> : null}
          <RoleDashboard
            role={role}
            requests={filteredRequests}
            mappings={mappings}
            statusCounts={statusCounts}
            departmentCounts={departmentCounts}
            savedPathways={savedPathways}
            onNavigate={openSection}
          />
          <DetailSection
            role={role}
            activeSection={activeSection}
            requests={filteredRequests}
            mappings={mappings}
            statusCounts={statusCounts}
            departmentCounts={departmentCounts}
            savedPathways={savedPathways}
            employeeRequest={employeeRequest}
            selectedSite={selectedSite}
            learners={searchedLearners}
            learnerSearch={learnerSearch}
            scenario={scenario}
            success={success}
            onSubmit={handleSubmit}
            onOpenPathway={setSelectedPathway}
            onLearnerSearch={setLearnerSearch}
            onSavePathway={(title) => setSavedPathways((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]))}
            onStatus={setRequestStatus}
            onMove={moveRequest}
            onMapping={updateMapping}
            onScenario={setScenarioData}
            onSeed={seedRequest}
          />
        </div>
      </div>

      {selectedPathway && <PathwayModal pathway={selectedPathway} onClose={() => setSelectedPathway(null)} onStart={() => setSelectedPathway(null)} />}
    </main>
  );
}

function Sidebar({ activeSection, onNavigate }: { activeSection: SectionKey; onNavigate: (section: SectionKey) => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[296px] border-r border-[#102c3d]/[0.08] bg-white/95 px-4 py-5 shadow-[8px_0_32px_rgba(16,44,61,0.035)] backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex items-center px-2">
        <LevyTateLogo className="h-[44px]" />
      </div>

      <div className="mt-5 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f7faf6] px-4 py-3 text-[#102c3d]">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#102c3d]/40">Active client</p>
        <p className="mt-1 text-sm font-semibold tracking-tight">Portakabin</p>
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#102c3d]/32">{section.title}</p>
            <div className="mt-1.5 grid gap-1">
              {section.items.map((item) => {
                const sectionKey = item as SectionKey;
                const active = activeSection === sectionKey;
                return (
                  <button
                    key={item}
                    onClick={() => onNavigate(sectionKey)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium transition duration-200 ${
                      active ? "bg-[#edf6f2] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/56 hover:bg-[#f7faf6] hover:text-[#102c3d]"
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold ${active ? "bg-white text-[#159b8f]" : "bg-[#f8faf4] text-[#102c3d]/46"}`}>
                      {item.split(" ").map((word) => word[0]).join("").slice(0, 2)}
                    </span>
                    <span className="truncate">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({
  role,
  setRole,
  selectedSite,
  onSite,
  onOpenAdmin,
}: {
  role: Role;
  setRole: (role: Role) => void;
  selectedSite: string;
  onSite: (site: string) => void;
  onOpenAdmin: () => void;
}) {
  return (
    <PlatformTopBar tenantName="Portakabin" tenantSubtitle="Internal apprenticeship and capability hub">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(220px,300px)_minmax(190px,250px)] md:items-center 2xl:grid-cols-[minmax(260px,320px)_minmax(210px,270px)_auto_auto]">
        <div className="hidden h-10 items-center rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm text-[#102c3d]/44 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] xl:flex">Search pathways, requests or teams</div>
        <label className="flex h-10 min-w-0 items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Site</span>
          <select
            value={selectedSite}
            onChange={(event) => onSite(event.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d]/74 outline-none"
            aria-label="Site"
          >
            <option>{allSitesLabel}</option>
            {portakabinSites.map((site) => (
              <option key={site}>{site}</option>
            ))}
          </select>
        </label>
        <div className="flex min-h-10 flex-wrap items-center rounded-[1.25rem] border border-[#102c3d]/[0.06] bg-[#edf5f1] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] 2xl:h-10 2xl:flex-nowrap 2xl:rounded-full">
          {roles.map((item) => (
            <button key={item} onClick={() => setRole(item)} className={`h-8 rounded-full px-3 text-xs font-semibold transition duration-200 ${role === item ? "bg-white text-[#102c3d] shadow-[0_6px_16px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/52 hover:text-[#102c3d]"}`}>
              {item}
            </button>
          ))}
        </div>
        <PlatformButton onClick={onOpenAdmin} className="h-10 whitespace-nowrap">Admin console</PlatformButton>
      </div>
    </PlatformTopBar>
  );
}

function HeroPanel({
  role,
  requests,
  learners,
  mappings,
  statusCounts,
  selectedSite,
  onNavigate,
}: {
  role: Role;
  requests: RequestItem[];
  learners: Learner[];
  mappings: ProviderMapping[];
  statusCounts: Record<string, number>;
  selectedSite: string;
  onNavigate: (section: SectionKey) => void;
}) {
  const awaiting = (statusCounts["Manager review"] ?? 0) + (statusCounts["Lead review"] ?? 0);
  const liveRoutes = new Set(learners.map((learner) => learner.programme)).size || pathways.filter((item) => item.status === "Live").length;
  return (
    <section className="grid gap-6 rounded-[1.6rem] border border-[#102c3d]/[0.06] bg-white/96 p-6 shadow-[0_22px_60px_rgba(16,44,61,0.055)] xl:grid-cols-[minmax(0,1fr)_390px] xl:p-7">
      <div className="min-w-0">
        <p className="w-fit rounded-full bg-[#fff4bd] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7b6100]">Standalone employer environment</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.025em] text-[#102c3d] md:text-5xl xl:text-6xl">Portakabin Apprenticeship Hub</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#102c3d]/64 md:text-lg">A focused LevyTate workspace for approved pathways, development demand and apprenticeship operations.</p>
        <p className="mt-3 text-sm font-medium text-[#102c3d]/54">View: {selectedSite}</p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          {roleSectionMap[role].map((section) => (
            <PlatformButton key={section} onClick={() => onNavigate(section)} variant="soft">
              {section}
            </PlatformButton>
          ))}
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Operating snapshot</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricTile label="Requests" value={requests.length} />
          <MetricTile label="Awaiting" value={awaiting} />
          <MetricTile label="Live routes" value={liveRoutes} />
          <MetricTile label="Mappings" value={mappings.filter((item) => item.status === "Live").length} />
          <MetricTile label="Active learners" value={learners.length} />
        </div>
      </div>
    </section>
  );
}

function SiteSummary({ site, learners, requests }: { site: string; learners: Learner[]; requests: RequestItem[] }) {
  const programmes = new Set(learners.map((learner) => learner.programme));
  const risk = learners.filter((learner) => learner.progress < 25 && learner.status !== "New interest").length;
  const demand = topEntry(countBy([...learners.map((learner) => ({ programme: learner.programme })), ...requests.map((request) => ({ programme: request.pathway }))], "programme"));

  return (
    <PlatformPanel eyebrow="Site view" title={site}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Active learners" value={learners.length} />
        <MetricTile label="Pending requests" value={requests.filter((request) => request.status === "New interest" || request.status === "Manager review").length} />
        <MetricTile label="Programmes in use" value={programmes.size} />
        <MetricTile label="Completion risk" value={risk} />
        <MetricTile label="Main pathway demand" value={demand || "No signal"} />
      </div>
    </PlatformPanel>
  );
}

function RoleDashboard({
  role,
  requests,
  mappings,
  statusCounts,
  departmentCounts,
  savedPathways,
  onNavigate,
}: {
  role: Role;
  requests: RequestItem[];
  mappings: ProviderMapping[];
  statusCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
  savedPathways: string[];
  onNavigate: (section: SectionKey) => void;
}) {
  const cards: Record<Role, LaunchCardProps[]> = {
    Employee: [
      { title: "My recommended pathways", value: "6", copy: "Approved routes matched to role family.", action: "View pathways", section: "Recommended Programmes" },
      { title: "My request status", value: statusCounts["Manager review"] ?? 0, copy: "Current expression of interest progress.", action: "View status", section: "Requests" },
      { title: "Saved pathways", value: savedPathways.length, copy: "Shortlist for manager conversation.", action: "Open saved", section: "Explore Pathways" },
      { title: "Start expression of interest", value: "2 min", copy: "Submit a clean internal request.", action: "Start request", section: "Requests" },
    ],
    "Line Manager": [
      { title: "Pending approvals", value: statusCounts["Manager review"] ?? 0, copy: "Requests needing manager review.", action: "Review requests", section: "Approvals" },
      { title: "Team development requests", value: requests.filter((request) => request.manager === "Ryan Booth").length, copy: "Open demand across direct teams.", action: "Open requests", section: "Requests" },
      { title: "Skills priorities", value: "4", copy: "Common capability areas to support.", action: "Open skills map", section: "Skills Analysis" },
      { title: "Approved team pathways", value: pathways.filter((pathway) => pathway.status === "Live").length, copy: "Available routes for team development.", action: "View pathways", section: "Recommended Programmes" },
    ],
    "Department Head": [
      { title: "Department demand snapshot", value: Object.keys(departmentCounts).length, copy: "Teams with active apprenticeship signals.", action: "View demand", section: "Department Demand" },
      { title: "Skills gaps", value: "6", copy: "Priority capability gaps across the operation.", action: "Open skills map", section: "Skills Map" },
      { title: "Priority roles", value: "9", copy: "Roles suitable for funded development.", action: "View roles", section: "Future Skills" },
      { title: "Forecast demand", value: "Q3", copy: "Next quarter planning forecast.", action: "View forecast", section: "Forecast" },
    ],
    "Apprenticeship Lead": [
      { title: "Live requests", value: requests.length, copy: "Total demand moving through the process.", action: "Open requests", section: "Requests" },
      { title: "Provider mappings", value: mappings.length, copy: "Approved delivery partner coverage.", action: "Manage providers", section: "Approved Providers" },
      { title: "Levy utilisation", value: "73%", copy: "Forecast utilisation across live routes.", action: "View levy forecast", section: "Levy Position" },
      { title: "Reporting snapshot", value: "Ready", copy: "Executive summary and performance view.", action: "Open reporting", section: "Reporting" },
      { title: "Admin actions", value: "5", copy: "Controls for setup, demo data and rollout.", action: "Open admin", section: "Admin" },
    ],
  };

  return (
    <PlatformPanel eyebrow={`${role} dashboard`} title={dashboardPurpose(role)}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards[role].map((card) => (
          <LaunchCard key={card.title} {...card} onNavigate={onNavigate} />
        ))}
      </div>
    </PlatformPanel>
  );
}

type LaunchCardProps = {
  title: string;
  value: string | number;
  copy: string;
  action: string;
  section: SectionKey;
};

function LaunchCard({ title, value, copy, action, section, onNavigate }: LaunchCardProps & { onNavigate: (section: SectionKey) => void }) {
  return (
    <button onClick={() => onNavigate(section)} className="group min-h-[198px] rounded-[1.25rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-5 text-left shadow-[0_8px_22px_rgba(16,44,61,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#159b8f]/20 hover:bg-white hover:shadow-[0_18px_42px_rgba(16,44,61,0.08)]">
      <p className="text-xs font-semibold text-[#102c3d]/48">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      <p className="mt-3 min-h-[44px] text-sm leading-6 text-[#102c3d]/58">{copy}</p>
      <span className="mt-5 inline-flex h-9 items-center rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06] transition group-hover:bg-[#102c3d] group-hover:text-white group-hover:ring-[#102c3d]">{action}</span>
    </button>
  );
}

function DetailSection({
  role,
  activeSection,
  requests,
  mappings,
  statusCounts,
  departmentCounts,
  savedPathways,
  employeeRequest,
  selectedSite,
  learners,
  learnerSearch,
  scenario,
  success,
  onSubmit,
  onOpenPathway,
  onLearnerSearch,
  onSavePathway,
  onStatus,
  onMove,
  onMapping,
  onScenario,
  onSeed,
}: {
  role: Role;
  activeSection: SectionKey;
  requests: RequestItem[];
  mappings: ProviderMapping[];
  statusCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
  savedPathways: string[];
  employeeRequest: RequestItem;
  selectedSite: string;
  learners: Learner[];
  learnerSearch: string;
  scenario: DemandScenario;
  success: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPathway: (pathway: Pathway) => void;
  onLearnerSearch: (query: string) => void;
  onSavePathway: (title: string) => void;
  onStatus: (id: number, status: RequestStatus) => void;
  onMove: (id: number, direction: 1 | -1) => void;
  onMapping: (index: number, status: MappingStatus, nextAction: string) => void;
  onScenario: (scenario: DemandScenario) => void;
  onSeed: () => void;
}) {
  if (activeSection === "Dashboard") {
    return <DashboardGuide role={role} />;
  }

  if (activeSection === "Recommended Programmes" || activeSection === "Explore Pathways") {
    return (
      <PlatformPanel eyebrow="Approved pathways" title={activeSection === "Explore Pathways" ? "Explore pathways" : "My recommended pathways"}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pathways.slice(0, activeSection === "Explore Pathways" ? pathways.length : 6).map((pathway) => (
            <PathwayCard key={pathway.title} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Requests") {
    return (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <PlatformPanel eyebrow="Expression of interest" title="Start expression of interest">
          <RequestForm onSubmit={onSubmit} />
          {success && <p className="mt-4 rounded-2xl bg-[#eff8f4] px-4 py-3 text-sm font-semibold text-[#102c3d]">Request created and moved to internal review.</p>}
        </PlatformPanel>
        <PlatformPanel eyebrow="Request status" title="My request status">
          <RequestTracker request={employeeRequest} />
        </PlatformPanel>
      </section>
    );
  }

  if (activeSection === "Approvals") {
    const managerRequests = requests.filter((request) => request.status === "Manager review");
    return (
      <PlatformPanel eyebrow="Manager approvals" title="Pending approvals">
        <div className="grid gap-4 lg:grid-cols-2">
          {managerRequests.map((request) => (
            <ApprovalCard key={request.id} request={request} onStatus={onStatus} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Skills Analysis" || activeSection === "Skills Map" || activeSection === "Future Skills") {
    return (
      <PlatformPanel eyebrow="Workforce planning" title={activeSection}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {["Manufacturing excellence", "Customer experience", "Digital reporting", "Site delivery confidence", "Leadership pipeline", "Supply chain resilience"].map((item) => (
            <InfoBox key={item} label={item} value="Recommended pathway available" />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Department Demand") {
    return (
      <PlatformPanel eyebrow="Demand snapshot" title="Department demand">
        <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
      </PlatformPanel>
    );
  }

  if (activeSection === "Approved Providers" || activeSection === "Performance") {
    return <ProviderMappingTable mappings={mappings} onMapping={onMapping} />;
  }

  if (activeSection === "Levy Position" || activeSection === "Forecast") {
    return (
      <PlatformPanel eyebrow="Funding and levy" title={activeSection === "Forecast" ? "Forecast apprenticeship demand" : "Levy utilisation"}>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Forecast utilisation" value="73%" copy="Estimated current year position" />
          <MetricCard label="Target utilisation" value="85%" copy="Planning target for next quarter" />
          <MetricCard label="At risk value" value="12%" copy="Potential unused funding to review" />
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Reporting") {
    return (
      <div className="grid gap-6">
        <ExecutiveSummary requests={requests} mappings={mappings} statusCounts={statusCounts} />
        <LearnersBySite selectedSite={selectedSite} learners={learners} learnerSearch={learnerSearch} onLearnerSearch={onLearnerSearch} />
      </div>
    );
  }

  if (activeSection === "Learners by Site") {
    return <LearnersBySite selectedSite={selectedSite} learners={learners} learnerSearch={learnerSearch} onLearnerSearch={onLearnerSearch} />;
  }

  if (activeSection === "AI Assistant") {
    return <AssistantPrompt />;
  }

  if (activeSection === "Enrolments") {
    return (
      <PlatformPanel eyebrow="Enrolments" title="Learner progress">
        <Kanban requests={requests} onMove={onMove} compact />
      </PlatformPanel>
    );
  }

  return (
    <PlatformPanel eyebrow="Admin actions" title="Demo controls and operating actions">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DemoControls scenario={scenario} onScenario={onScenario} onSeed={onSeed} onReset={() => onScenario("Medium")} />
        <ActionCard title="Prepare provider review" action="Manage providers" />
        <ActionCard title="Export reporting pack" action="Open reporting" />
        <ActionCard title="Review rollout settings" action="Open admin" />
      </div>
    </PlatformPanel>
  );
}

function DashboardGuide({ role }: { role: Role }) {
  return (
    <PlatformPanel eyebrow="Launchpad" title="Select a card or sidebar item to open detail">
      <p className="max-w-3xl text-sm leading-6 text-[#102c3d]/58">{dashboardGuide(role)}</p>
    </PlatformPanel>
  );
}

function ApprovalCard({ request, onStatus }: { request: RequestItem; onStatus: (id: number, status: RequestStatus) => void }) {
  return (
    <article className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[0_8px_22px_rgba(16,44,61,0.035)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{request.name}</h3>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{request.role} - {request.team}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.05]">{request.pathway}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoBox label="Time commitment" value="Planned learning time agreed with manager" />
        <InfoBox label="Business benefit" value="Supports capability growth and operational development" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <SmallButton label="Approve request" onClick={() => onStatus(request.id, "Lead review")} />
        <SmallButton label="Request more information" onClick={() => onStatus(request.id, "New interest")} variant="mint" />
        <SmallButton label="Decline request" onClick={() => onStatus(request.id, "New interest")} variant="coral" />
      </div>
    </article>
  );
}

function PathwayCard({ pathway, saved, onOpen, onSave }: { pathway: Pathway; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <article className="group flex min-h-[310px] min-w-0 flex-col rounded-[1.25rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-5 shadow-[0_8px_22px_rgba(16,44,61,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#159b8f]/20 hover:bg-white hover:shadow-[0_18px_42px_rgba(16,44,61,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-xl font-semibold leading-7 tracking-[-0.01em] text-[#102c3d]">{pathway.title}</h3>
        <span className="shrink-0 rounded-full bg-[#fff4bd] px-2.5 py-1 text-[11px] font-semibold text-[#7b6100] ring-1 ring-[#8a6a00]/[0.08]">{pathway.status}</span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#159b8f]">{pathway.standard}</p>
      <p className="mt-4 text-sm leading-6 text-[#102c3d]/62">{pathway.audience}</p>
      <div className="mt-4 rounded-2xl border border-[#102c3d]/[0.045] bg-white/78 p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#102c3d]/38">Business outcome</p>
        <p className="mt-1.5 text-sm leading-6 text-[#102c3d]/66">{pathway.businessBenefit}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {pathway.departments.map((item) => (
          <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#102c3d]/54 ring-1 ring-[#102c3d]/[0.045]">{item}</span>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <PlatformButton onClick={onOpen}>View detail</PlatformButton>
        <PlatformButton onClick={onSave} variant="soft">{saved ? "Saved" : "Save"}</PlatformButton>
      </div>
    </article>
  );
}

function RequestForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue="Amelia Hart" />
      <Field name="role" label="Role" defaultValue="Production Team Member" />
      <Field name="department" label="Department" defaultValue="Manufacturing" />
      <Field name="team" label="Team" defaultValue="Assembly Line A" />
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62">
        Selected pathway
        <select name="pathway" className="min-w-0 rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3.5 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
          {pathways.map((pathway) => (
            <option key={pathway.title}>{pathway.title}</option>
          ))}
        </select>
      </label>
      <Field name="manager" label="Line manager" defaultValue="Ryan Booth" />
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
        Why is this needed?
        <textarea name="need" rows={4} className="min-w-0 rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3.5 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue="I want to build stronger manufacturing and delivery confidence." />
      </label>
      <div className="mt-1 flex flex-col gap-4 rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-[#102c3d]/54">This creates an internal request for manager review.</p>
        <PlatformButton className="w-fit px-5 py-2.5 text-sm">Submit request</PlatformButton>
      </div>
    </form>
  );
}

function RequestTracker({ request }: { request: RequestItem }) {
  const activeIndex = requestStages.indexOf(request.status);
  return (
    <div className="grid gap-2">
      {publicStages.map((stage, index) => (
        <div key={stage} className="flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-4 py-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${index <= activeIndex ? "bg-[#159b8f]" : "bg-[#d9e8e2]"}`} />
          <span className={`text-sm font-medium ${index <= activeIndex ? "text-[#102c3d]" : "text-[#102c3d]/42"}`}>{stage}</span>
        </div>
      ))}
    </div>
  );
}

function Kanban({ requests, onMove, compact = false }: { requests: RequestItem[]; onMove?: (id: number, direction: 1 | -1) => void; compact?: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {requestStages.map((column) => {
        const columnRequests = requests.filter((request) => request.status === column);
        return (
          <div key={column} className="rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-[#102c3d]">{column}</h3>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[#102c3d]/54 ring-1 ring-[#102c3d]/[0.04]">{columnRequests.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {columnRequests.slice(0, compact ? 1 : 3).map((request) => (
                <article key={request.id} className="rounded-2xl bg-white p-3 shadow-[0_8px_18px_rgba(16,44,61,0.04)]">
                  <p className="text-sm font-semibold">{request.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{request.pathway}</p>
                  {onMove && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => onMove(request.id, -1)} className="rounded-full bg-[#f8faf4] px-3 py-1.5 text-xs font-medium text-[#102c3d]">Back</button>
                      <button onClick={() => onMove(request.id, 1)} className="rounded-full bg-[#102c3d] px-3 py-1.5 text-xs font-medium text-white">Next</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProviderMappingTable({ mappings, onMapping }: { mappings: ProviderMapping[]; onMapping: (index: number, status: MappingStatus, nextAction: string) => void }) {
  return (
    <PlatformPanel title="Provider mappings" eyebrow="Approved providers">
      <div className="grid gap-4 lg:grid-cols-2">
        {mappings.map((row, index) => (
          <article key={row.roleFamily} className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[0_8px_22px_rgba(16,44,61,0.035)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{row.pathway}</h3>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{row.standard}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.05]">{row.fit}% fit</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoBox label="Recommended provider" value={row.partner} />
              <InfoBox label="Alternative provider" value={row.alternativePartner} />
              <InfoBox label="Delivery model" value={row.deliveryModel} />
              <InfoBox label="Why recommended" value={row.whyRecommended} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SmallButton label="Mark live" onClick={() => onMapping(index, "Live", "Monitor cohort")} />
              <SmallButton label="Flag review" onClick={() => onMapping(index, "Review", "Review delivery fit")} variant="coral" />
              <SmallButton label="Replace" onClick={() => onMapping(index, "Review", "Replace provider")} variant="mint" />
            </div>
          </article>
        ))}
      </div>
    </PlatformPanel>
  );
}

function LearnersBySite({
  selectedSite,
  learners,
  learnerSearch,
  onLearnerSearch,
}: {
  selectedSite: string;
  learners: Learner[];
  learnerSearch: string;
  onLearnerSearch: (query: string) => void;
}) {
  return (
    <PlatformPanel
      title="Learners by site"
      eyebrow="Site visibility"
      actions={
        <input
          value={learnerSearch}
          onChange={(event) => onLearnerSearch(event.target.value)}
          placeholder="Search learners"
          className="h-10 w-full min-w-0 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/36 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10 sm:w-[240px]"
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[#102c3d]/58">{selectedSite === allSitesLabel ? "Organisation-wide learner visibility across Portakabin UK sites." : `Learner visibility for ${selectedSite}.`}</p>
        <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.05]">{learners.length} learners</span>
      </div>
      <div className="overflow-hidden rounded-[1.2rem] border border-[#102c3d]/[0.055]">
        <div className="hidden grid-cols-[1.1fr_1fr_1.35fr_1.2fr_0.8fr_0.75fr_1fr] gap-3 bg-[#f8fbfa] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38 xl:grid">
          <span>Learner</span>
          <span>Role</span>
          <span>Site</span>
          <span>Programme</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Line Manager</span>
        </div>
        <div className="divide-y divide-[#102c3d]/[0.055] bg-white">
          {learners.slice(0, 18).map((learner) => (
            <article key={`${learner.name}-${learner.site}`} className="grid gap-3 px-4 py-4 text-sm xl:grid-cols-[1.1fr_1fr_1.35fr_1.2fr_0.8fr_0.75fr_1fr] xl:items-center">
              <div>
                <p className="font-semibold text-[#102c3d]">{learner.name}</p>
                <p className="mt-1 text-xs text-[#102c3d]/42">Started {formatShortDate(learner.startDate)}</p>
              </div>
              <p className="text-[#102c3d]/62">{learner.role}</p>
              <p className="text-[#102c3d]/62">{learner.site}</p>
              <p className="font-medium text-[#102c3d]/72">{learner.programme}</p>
              <span className="w-fit rounded-full bg-[#f8fbfa] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.05]">{learner.status}</span>
              <div>
                <p className="text-xs font-semibold text-[#102c3d]/58">{learner.progress}%</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ecf6f2]">
                  <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${learner.progress}%` }} />
                </div>
              </div>
              <p className="text-[#102c3d]/62">{learner.lineManager}</p>
            </article>
          ))}
          {learners.length === 0 ? <p className="px-4 py-6 text-sm text-[#102c3d]/56">No learners match this search or site selection.</p> : null}
        </div>
      </div>
      {learners.length > 18 ? <p className="mt-3 text-xs text-[#102c3d]/44">Showing first 18 results for demo clarity. Search or select a specific site to narrow the list.</p> : null}
    </PlatformPanel>
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
    <PlatformPanel title="Reporting snapshot" eyebrow="Executive summary">
      <div className="grid gap-3 md:grid-cols-3">
        {summary.map(([label, value]) => (
          <MetricTile key={label} label={label} value={value} />
        ))}
      </div>
    </PlatformPanel>
  );
}

function DemoControls({ scenario, onScenario, onSeed, onReset }: { scenario: DemandScenario; onScenario: (scenario: DemandScenario) => void; onSeed: () => void; onReset: () => void }) {
  return (
    <section className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[0_8px_22px_rgba(16,44,61,0.035)]">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#df5f73]">Demo Mode</p>
      <div className="mt-3 grid gap-2">
        <button onClick={onReset} className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-[#102c3d]">Reset data</button>
        <button onClick={onSeed} className="rounded-full bg-[#102c3d] px-3.5 py-2 text-xs font-semibold text-white">Seed request</button>
        <div className="grid grid-cols-3 rounded-full bg-[#eef8f5] p-1">
          {(["Low", "Medium", "High"] as DemandScenario[]).map((item) => (
            <button key={item} onClick={() => onScenario(item)} className={`rounded-full px-2 py-1.5 text-[11px] font-medium ${scenario === item ? "bg-white text-[#102c3d] shadow-[0_8px_18px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/54"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssistantPrompt() {
  return (
    <PlatformPanel eyebrow="Ask LevyTate AI" title="Build a capability plan">
      <p className="max-w-2xl text-sm leading-6 text-[#102c3d]/62">Generate a concise apprenticeship strategy from demand, roles and approved pathways.</p>
      <PlatformButton className="mt-4">Open assistant</PlatformButton>
    </PlatformPanel>
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
          <button onClick={onClose} className="rounded-full bg-[#f8faf4] px-4 py-2 text-sm font-semibold text-[#102c3d]">Close</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {details.map(([label, value]) => (
            <SubtleRow key={label} label={label} value={value} />
          ))}
        </div>
        <button onClick={onStart} className="mt-8 rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white">Start request</button>
      </section>
    </div>
  );
}

function MetricCard({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return <PlatformMetric label={label} value={value} copy={copy} />;
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return <PlatformMetric label={label} value={value} />;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#102c3d]/[0.045] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(16,44,61,0.035)]">
      <p className="text-xs font-semibold text-[#102c3d]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{value}</p>
    </div>
  );
}

function ActionCard({ title, action }: { title: string; action: string }) {
  return (
    <button className="rounded-2xl border border-[#102c3d]/[0.045] bg-white px-4 py-5 text-left shadow-[0_8px_18px_rgba(16,44,61,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(16,44,61,0.07)]">
      <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
      <p className="mt-3 text-xs font-semibold text-[#159b8f]">{action}</p>
    </button>
  );
}

function SubtleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#102c3d]/38">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/66">{value}</p>
    </div>
  );
}

function Field({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#102c3d]/62">
      {label}
      <input name={name} defaultValue={defaultValue} className="min-w-0 rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3.5 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
    </label>
  );
}

function SmallButton({ label, onClick, variant = "dark" }: { label: string; onClick: () => void; variant?: "dark" | "mint" | "coral" }) {
  const platformVariant = variant === "mint" ? "amber" : variant;
  return <PlatformButton onClick={onClick} variant={platformVariant}>{label}</PlatformButton>;
}

function InsightBars({ rows }: { rows: Array<[string, number]> }) {
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return (
    <div className="grid gap-4">
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

function dashboardPurpose(role: Role) {
  const purpose: Record<Role, string> = {
    Employee: "Explore development options and submit interest.",
    "Line Manager": "Manage team requests and development priorities.",
    "Department Head": "See demand and workforce planning signals.",
    "Apprenticeship Lead": "Manage the apprenticeship operation.",
  };
  return purpose[role];
}

function dashboardGuide(role: Role) {
  const copy: Record<Role, string> = {
    Employee: "This dashboard is intentionally focused on pathways, saved options and starting a request.",
    "Line Manager": "This dashboard keeps approvals and team capability signals separate from operational admin.",
    "Department Head": "This dashboard is a planning view for demand, skills gaps, priority roles and forecast demand.",
    "Apprenticeship Lead": "This dashboard launches the core operating areas without showing dense tables by default.",
  };
  return copy[role];
}

function filterBySite<T extends { site: string }>(items: T[], selectedSite: string) {
  if (selectedSite === allSitesLabel) return items;
  return items.filter((item) => item.site === selectedSite);
}

function topEntry(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

function countBy<T, K extends keyof T>(items: T[], key: K) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
