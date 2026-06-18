"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { LevyTateLogo, PlatformButton, PlatformMetric, PlatformPanel, PlatformTopBar, type PlatformNavSection } from "@/components/levytate-demo/PlatformShell";
import { buildFallbackResponse } from "@/lib/levytate-ai/fallback";
import type {
  LevyTateAiRequest as ApiLevyTateAiRequest,
  LevyTateAiResponse as ApiLevyTateAiResponse,
  LevyTateConversationMessage,
} from "@/lib/levytate-ai/response-schema";

type Role = "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead" | "Admin Console";
type DemandScenario = "Low" | "Medium" | "High";
type RequestStatus = "Draft" | "Submitted to Line Manager" | "Awaiting Manager Review" | "Declined by Line Manager" | "Approved by Line Manager" | "Submitted to Apprenticeship Lead" | "Awaiting Final Approval" | "Declined by Apprenticeship Lead" | "Approved for Enrolment" | "Withdrawn" | "Completed" | "Cancelled";
type LearnerStatus = "New interest" | "Manager review" | "Lead review" | "Provider introduction" | "Enrolment" | "Live learner";
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
  careerGoal: string;
  supportRequired: string;
  submittedDate: string;
  decisionNotes: string;
};

type Learner = {
  name: string;
  role: string;
  department: string;
  site: string;
  programme: string;
  status: LearnerStatus;
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
  providerEmail: string;
  deliveryModel: string;
  fit: number;
  status: MappingStatus;
  nextAction: string;
  whyRecommended: string;
};

type EnrolmentSubmission = {
  requestId: number;
  provider: string;
  providerEmail: string;
  programme: string;
  submittedAt: string;
  emailStatus: "Sent";
};

type EmployeePersona = {
  name: string;
  role: string;
  department: string;
  site: string;
  manager: string;
  careerGoal: string;
  recommendedPathways: number;
  savedOpportunities: number;
  passportActivities: number;
  currentRange: string;
  nextRange: string;
  futureOpportunity: string;
  progression: string[];
  skills: Array<[string, number]>;
};

type AdviceStandard = {
  name: string;
  level: string;
  suitability: number;
  why: string;
  bestFor: string;
  delivery: string;
};

type ApprenticeshipAdvice = {
  interpretedRole: string;
  workforceNeed: string;
  recommendedStandards: AdviceStandard[];
  alternativeStandards: string[];
  businessRationale: string;
  fundingRoute: string;
  providerMatchingPrompt: string;
};

type ProviderMatchingRequest = {
  id: number;
  date: string;
  need: string;
  programme: string;
  sites: string;
  learners: string;
  status: "Submitted" | "Under Review" | "Provider Shortlist Being Prepared" | "Shortlist Ready";
  delivery: string;
  funding: string;
  urgency: string;
};

type ApplicationDraft = {
  name: string;
  role: string;
  department: string;
  team: string;
  site: string;
  pathway: string;
  manager: string;
  reason: string;
  careerGoal: string;
  supportRequired: string;
};

type SnapshotMetric = {
  label: string;
  value: string | number;
  copy: string;
  trend: string;
  tooltip: string;
  actionLabel: string;
  target: SectionKey;
  progress: number;
  series: number[];
  accent?: string;
};

type SectionKey =
  | "Dashboard"
  | "Recommended Pathways"
  | "Career Pathfinder"
  | "My Applications"
  | "Development Passport"
  | "My Team"
  | "Applications to Review"
  | "Team Skills"
  | "Team Development"
  | "Succession Planning"
  | "Department Analytics"
  | "Site Breakdown"
  | "Apprenticeship Participation"
  | "Department Overview"
  | "Future Demand"
  | "Site Performance"
  | "Organisation Overview"
  | "Levy Utilisation"
  | "Providers"
  | "Programmes"
  | "Compliance"
  | "Site Adoption"
  | "Applications for Final Approval"
  | "Approved for Enrolment"
  | "User Management"
  | "Role Management"
  | "Permission Management"
  | "Provider Management"
  | "Programme Catalogue"
  | "Employer Configuration"
  | "Site Configuration"
  | "Audit Logs"
  | "Platform Analytics"
  | "System Settings"
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
  | "Ask LevyTate AI"
  | "AI Assistant"
  | "Admin";

const roles: Role[] = ["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"];
const requestStages: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "Declined by Line Manager", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Declined by Apprenticeship Lead", "Approved for Enrolment", "Withdrawn", "Completed", "Cancelled"];
const publicStages: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Approved for Enrolment"];
const activeApplicationStatuses: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Awaiting Manager Review", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval", "Approved for Enrolment"];
const currentManagerName = "Ryan Booth";
const sidebarStateKey = "levytate:portakabin:sidebar-collapsed";

const navSectionsByRole: Record<Role, PlatformNavSection[]> = {
  Employee: [
    { title: "Employee", items: ["Ask LevyTate AI", "Dashboard", "My Applications", "Development Passport"] },
  ],
  "Line Manager": [
    { title: "Manager", items: ["Dashboard", "Applications to Review", "Team Development", "Ask LevyTate AI"] },
  ],
  "Department Head": [
    { title: "Department", items: ["Dashboard", "Department Analytics", "Reporting", "Ask LevyTate AI"] },
  ],
  "Apprenticeship Lead": [
    { title: "Operations", items: ["Dashboard", "Applications for Final Approval", "Approved for Enrolment", "Providers", "Reporting", "Ask LevyTate AI"] },
  ],
  "Admin Console": [
    { title: "Admin Console", items: ["Dashboard", "User Management", "Role Management", "Permission Management", "Provider Management", "Programme Catalogue"] },
    { title: "Configuration", items: ["Employer Configuration", "Site Configuration", "Audit Logs", "Platform Analytics", "System Settings"] },
  ],
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

const employeeRoleOptions = [
  "Production Team Member",
  "Data & Reporting Analyst",
  "Assembly Operative",
  "Manufacturing Operative",
  "Maintenance Technician",
  "Project Coordinator",
  "Technical Design Assistant",
  "Estimator",
  "Site Supervisor",
  "Sales Executive",
  "Procurement Administrator",
  "Procurement Officer",
  "Buyer",
  "Senior Buyer",
  "Office Administrator",
  "Customer Service Advisor",
  "HR Administrator",
  "Finance Assistant",
  "Health & Safety Coordinator",
];

const employeePersonas: EmployeePersona[] = [
  {
    name: "Amelia Hart",
    role: "Production Team Member",
    department: "Manufacturing",
    site: "York Head Office, Visitor Centre and UK Factory",
    manager: "Ryan Booth",
    careerGoal: "Production Supervisor / Team Leader",
    recommendedPathways: 2,
    savedOpportunities: 1,
    passportActivities: 7,
    currentRange: "£28k",
    nextRange: "£36k",
    futureOpportunity: "High",
    progression: ["Production Team Member", "Senior Operator", "Team Leader", "Production Supervisor"],
    skills: [["Manufacturing confidence", 74], ["Leadership readiness", 58], ["Technical evidence", 68], ["Shift coordination", 61]],
  },
  {
    name: "Daniel Carter",
    role: "Data & Reporting Analyst",
    department: "Business Intelligence",
    site: "York Head Office, Visitor Centre and UK Factory",
    manager: "Sarah Mitchell",
    careerGoal: "Head of Data & Automation",
    recommendedPathways: 5,
    savedOpportunities: 3,
    passportActivities: 4,
    currentRange: "£34k",
    nextRange: "£52k",
    futureOpportunity: "Very high",
    progression: ["Data & Reporting Analyst", "Data Analyst", "Senior Data Analyst", "Head of Data & Automation"],
    skills: [["Data analysis", 72], ["Automation", 54], ["Business intelligence", 78], ["AI readiness", 48]],
  },
];

const employeeRolePathwayMap: Record<string, Array<{ pathwayTitle: string; standard: string; summary: string }>> = {
  "Production Team Member": [
    { pathwayTitle: "Manufacturing & Production", standard: "Level 3 Engineering Technician", summary: "Build technical production, maintenance and engineering confidence." },
    { pathwayTitle: "Leadership & Management", standard: "Level 3 Team Leader", summary: "Prepare for shift handovers, team coordination and improvement work." },
  ],
  "Data & Reporting Analyst": [
    { pathwayTitle: "Digital, Data & AI", standard: "Level 3 Data Technician", summary: "Build practical data handling, dashboards and reporting confidence." },
    { pathwayTitle: "Digital, Data & AI", standard: "Level 4 Data Analyst", summary: "Develop analysis, insight generation and data storytelling capability." },
    { pathwayTitle: "Digital, Data & AI", standard: "Level 4 Business Analyst", summary: "Connect business needs, systems improvement and data-led change." },
    { pathwayTitle: "Digital, Data & AI", standard: "Level 6 Data Scientist", summary: "Progress toward advanced modelling, experimentation and strategic analytics." },
    { pathwayTitle: "Digital, Data & AI", standard: "AI & Automation Workforce Programme", summary: "Build automation confidence for reporting, workflows and internal productivity." },
  ],
  "Assembly Operative": [
    { pathwayTitle: "Manufacturing & Production", standard: "Level 3 Engineering Technician", summary: "Develop practical manufacturing and assembly capability." },
    { pathwayTitle: "Health, Safety & Compliance", standard: "Level 3 Safety, Health and Environment Technician", summary: "Strengthen safe working, quality routines and evidence." },
  ],
  "Manufacturing Operative": [
    { pathwayTitle: "Manufacturing & Production", standard: "Level 3 Engineering Technician", summary: "Formalise manufacturing skills and workplace evidence." },
    { pathwayTitle: "Leadership & Management", standard: "Level 3 Team Leader", summary: "Support progression into production leadership." },
  ],
  "Maintenance Technician": [
    { pathwayTitle: "Manufacturing & Production", standard: "Level 3 Engineering Maintenance Technician", summary: "Deepen maintenance, fault finding and technical engineering skills." },
  ],
  "Project Coordinator": [
    { pathwayTitle: "Installation & Site Operations", standard: "Level 4 Associate Project Manager", summary: "Build project planning, stakeholder and delivery control skills." },
    { pathwayTitle: "Leadership & Management", standard: "Level 5 Operations Manager", summary: "Prepare for wider operational ownership and team leadership." },
  ],
  "Technical Design Assistant": [
    { pathwayTitle: "Design & Technical", standard: "Level 3 Design & Draughting", summary: "Develop technical drawing, documentation and design evidence." },
    { pathwayTitle: "Design & Technical", standard: "Level 4 Construction Design", summary: "Build construction design capability and project coordination." },
  ],
  Estimator: [
    { pathwayTitle: "Design & Technical", standard: "Level 4 Construction Design", summary: "Strengthen technical interpretation, commercial accuracy and specification work." },
  ],
  "Site Supervisor": [
    { pathwayTitle: "Installation & Site Operations", standard: "Level 3 Construction Site Supervisor", summary: "Develop site coordination, readiness and handover confidence." },
    { pathwayTitle: "Installation & Site Operations", standard: "Level 4 Construction Site Manager", summary: "Prepare for broader site management and delivery accountability." },
  ],
  "Sales Executive": [
    { pathwayTitle: "Hire, Sales & Customer Experience", standard: "Level 4 Sales Executive", summary: "Improve consultative selling, account growth and customer outcomes." },
  ],
  "Procurement Administrator": [
    { pathwayTitle: "Procurement & Supply Chain", standard: "Level 3 Supply Chain Practitioner", summary: "Build supplier coordination, purchasing support and planning skills." },
  ],
  "Procurement Officer": [
    { pathwayTitle: "Procurement & Supply Chain", standard: "Level 4 Commercial Procurement & Supply", summary: "Develop sourcing, supplier management and commercial procurement capability." },
  ],
  Buyer: [
    { pathwayTitle: "Procurement & Supply Chain", standard: "Level 4 Commercial Procurement & Supply", summary: "Build procurement practice, commercial judgement and supplier confidence." },
    { pathwayTitle: "Procurement & Supply Chain", standard: "Level 6 Senior Procurement & Supply Chain Professional", summary: "Prepare for strategic procurement and supply chain leadership." },
  ],
  "Senior Buyer": [
    { pathwayTitle: "Procurement & Supply Chain", standard: "Level 6 Senior Procurement & Supply Chain Professional", summary: "Support progression into strategic procurement leadership." },
    { pathwayTitle: "Leadership & Management", standard: "Level 5 Operations Manager", summary: "Strengthen cross-functional leadership and operating discipline." },
  ],
  "Office Administrator": [
    { pathwayTitle: "Digital, Data & AI", standard: "Level 3 Business Administrator", summary: "Develop administration, systems and process improvement capability." },
  ],
  "Customer Service Advisor": [
    { pathwayTitle: "Hire, Sales & Customer Experience", standard: "Level 3 Customer Service Specialist", summary: "Improve customer conversations, service confidence and issue resolution." },
  ],
  "HR Administrator": [
    { pathwayTitle: "Leadership & Management", standard: "Level 3 HR Support", summary: "Build HR administration, employee support and people process knowledge." },
  ],
  "Finance Assistant": [
    { pathwayTitle: "Digital, Data & AI", standard: "Level 3 Assistant Accountant", summary: "Develop finance operations, controls and reporting confidence." },
  ],
  "Health & Safety Coordinator": [
    { pathwayTitle: "Health, Safety & Compliance", standard: "Level 3 Safety, Health and Environment Technician", summary: "Strengthen safety practice, compliance evidence and risk awareness." },
  ],
};

const advisoryPromptExamples = [
  {
    label: "Maintenance Manager",
    prompt: "Which apprenticeship is suitable for a Maintenance Manager?",
  },
  {
    label: "Procurement Lead Succession",
    prompt: "Which apprenticeship would support succession planning for a Procurement Lead?",
  },
  {
    label: "AI capability in Customer Service",
    prompt: "We need future AI capability in our customer service team. What programmes should we consider?",
  },
  {
    label: "Data skills for Operations",
    prompt: "What apprenticeships would build data skills in our operations teams?",
  },
  {
    label: "Leadership pipeline for Site Supervisors",
    prompt: "Which apprenticeship standards support a leadership pipeline for Site Supervisors?",
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
  { id: 1, name: "Amelia Hart", role: "Production Team Member", department: "Manufacturing", team: "Assembly Line A", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Level 3 Team Leader", manager: "Ryan Booth", status: "Awaiting Manager Review", note: "I want to apply for the Level 3 Team Leader route so I can build confidence leading shift handovers and improvement work.", careerGoal: "Progress into a team leader role in production.", supportRequired: "Support with study time during shifts.", submittedDate: "2026-05-18", decisionNotes: "Awaiting Ryan Booth review." },
  { id: 12, name: "Daniel Carter", role: "Data & Reporting Analyst", department: "Business Intelligence", team: "Data & Automation", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Level 4 Data Analyst", manager: "Sarah Mitchell", status: "Awaiting Manager Review", note: "I want to deepen my data analysis, insight generation and automation skills.", careerGoal: "Progress toward Head of Data & Automation.", supportRequired: "Protected time for portfolio evidence and internal reporting projects.", submittedDate: "2026-05-22", decisionNotes: "Awaiting Sarah Mitchell review." },
  { id: 2, name: "Marcus Lee", role: "Technical Design Assistant", department: "Design & Technical", team: "Building Design", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Design & Technical", manager: "Priya Nair", status: "Declined by Line Manager", note: "I want to formalise my design skills and contribute to technical standards.", careerGoal: "Move into a design technician role.", supportRequired: "Mentor support from senior designer.", submittedDate: "2026-05-12", decisionNotes: "Declined because current workload needs stabilising before a new programme starts." },
  { id: 3, name: "Sophie Clarke", role: "Customer Hire Coordinator", department: "Hire & Customer", team: "Customer Support", site: "Leeds Visitor Centre", pathway: "Hire, Sales & Customer Experience", manager: "Helen Ward", status: "Approved by Line Manager", note: "I want to improve customer conversations and account confidence.", careerGoal: "Progress into account support leadership.", supportRequired: "Protected time for monthly workshops.", submittedDate: "2026-05-10", decisionNotes: "Approved by Helen Ward and ready for apprenticeship lead review." },
  { id: 4, name: "Noah Bennett", role: "Installation Coordinator", department: "Site Operations", team: "Field Delivery", site: "Sheffield Visitor Centre", pathway: "Installation & Site Operations", manager: "Sam Ellis", status: "Submitted to Apprenticeship Lead", note: "I want to strengthen site handover and supervision skills.", careerGoal: "Become a site supervisor.", supportRequired: "Access to live site evidence.", submittedDate: "2026-05-08", decisionNotes: "Line manager approved. Awaiting final approval." },
  { id: 5, name: "Grace Patel", role: "Project Coordinator", department: "Projects", team: "Delivery Office", site: "London Central Visitor Centre", pathway: "Leadership & Management", manager: "Ryan Booth", status: "Approved for Enrolment", note: "I want structured leadership development for delivery planning.", careerGoal: "Progress into project management.", supportRequired: "Coaching from project lead.", submittedDate: "2026-04-28", decisionNotes: "Final approved by apprenticeship lead. Ready for provider introduction and enrolment." },
  { id: 6, name: "Leo Morgan", role: "Materials Planner", department: "Supply Chain", team: "Materials Planning", site: "Warrington Site Accommodation Visitor Centre", pathway: "Procurement & Supply Chain", manager: "Helen Ward", status: "Declined by Apprenticeship Lead", note: "I want to improve supplier coordination and planning confidence.", careerGoal: "Move into supply chain planning.", supportRequired: "Help with evidence mapping.", submittedDate: "2026-04-21", decisionNotes: "Declined by apprenticeship lead pending a better programme match." },
  { id: 7, name: "Maya Singh", role: "Shift Supervisor", department: "Manufacturing", team: "Shift Leadership", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Leadership & Management", manager: "Priya Nair", status: "Draft", note: "I am exploring leadership development options.", careerGoal: "Build confidence as a shift leader.", supportRequired: "Not confirmed yet.", submittedDate: "2026-06-01", decisionNotes: "Draft not yet submitted." },
  { id: 8, name: "Ethan Brooks", role: "Compliance Assistant", department: "Compliance", team: "SHEQ", site: "Smethwick Visitor Centre", pathway: "Health, Safety & Compliance", manager: "Sam Ellis", status: "Submitted to Apprenticeship Lead", note: "I want to build stronger safety evidence and compliance practice.", careerGoal: "Progress into SHEQ coordinator role.", supportRequired: "Access to site audit evidence.", submittedDate: "2026-05-02", decisionNotes: "Line manager approved. Awaiting final apprenticeship lead decision." },
];

const initialMappings: ProviderMapping[] = [
  {
    roleFamily: "Manufacturing",
    pathway: "Manufacturing & Production",
    standard: "L3 Engineering Technician / Engineering Maintenance Technician",
    partner: "TEC Partnership",
    alternativePartner: "North Lindsey College",
    providerEmail: "portakabin-enrolments@tecpartnership.ac.uk",
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
    providerEmail: "portakabin-enrolments@tecpartnership.ac.uk",
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
    providerEmail: "portakabin-enrolments@lcb.ac.uk",
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
    providerEmail: "portakabin-enrolments@babington.co.uk",
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
    providerEmail: "portakabin-enrolments@srapprenticeships.co.uk",
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
    providerEmail: "portakabin-enrolments@qa.com",
    deliveryModel: "Remote + workshops",
    fit: 88,
    status: "Ready",
    nextAction: "Confirm data projects",
    whyRecommended: "Strong national data and digital apprenticeship delivery.",
  },
  {
    roleFamily: "Leadership",
    pathway: "Leadership & Management",
    standard: "L3 Team Leader / L5 Operations Manager",
    partner: "Babington",
    alternativePartner: "SR Apprenticeships",
    providerEmail: "portakabin-enrolments@babington.co.uk",
    deliveryModel: "Blended",
    fit: 90,
    status: "Live",
    nextAction: "Submit approved learners for enrolment",
    whyRecommended: "Strong national leadership and management apprenticeship delivery.",
  },
];

const scenarioSeeds: Record<DemandScenario, RequestItem[]> = {
  Low: initialRequests.slice(0, 5),
  Medium: initialRequests,
  High: [
    ...initialRequests,
    { id: 9, name: "Olivia Grant", role: "Account Support Lead", department: "Hire & Customer", team: "Commercial Support", site: "Trafford Park Manchester Visitor Centre", pathway: "Hire, Sales & Customer Experience", manager: "Ryan Booth", status: "Submitted to Line Manager", note: "Commercial progression.", careerGoal: "Move into sales leadership.", supportRequired: "Manager coaching.", submittedDate: "2026-06-03", decisionNotes: "Awaiting line manager review." },
    { id: 10, name: "Daniel Fox", role: "Site Supervisor", department: "Site Operations", team: "Field Delivery", site: "Rugby Site Accommodation Visitor Centre", pathway: "Installation & Site Operations", manager: "Sam Ellis", status: "Approved by Line Manager", note: "Site coordination.", careerGoal: "Lead complex site delivery.", supportRequired: "Site evidence access.", submittedDate: "2026-06-02", decisionNotes: "Approved by line manager." },
    { id: 11, name: "Isla Reid", role: "Quality Coordinator", department: "Manufacturing", team: "Quality", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Health, Safety & Compliance", manager: "Priya Nair", status: "Submitted to Apprenticeship Lead", note: "Compliance confidence.", careerGoal: "Progress into quality lead role.", supportRequired: "Audit evidence support.", submittedDate: "2026-05-30", decisionNotes: "Awaiting final approval." },
  ],
};

export default function PortakabinApprenticeshipHub() {
  const [role, setRole] = useState<Role>("Employee");
  const [activeSection, setActiveSection] = useState<SectionKey>("Dashboard");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("Amelia Hart");
  const [selectedEmployeeRole, setSelectedEmployeeRole] = useState("Production Team Member");
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [mappings, setMappings] = useState<ProviderMapping[]>(initialMappings);
  const [enrolmentSubmissions, setEnrolmentSubmissions] = useState<Record<number, EnrolmentSubmission>>({});
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [savedPathways, setSavedPathways] = useState<string[]>(["Manufacturing & Production", "Digital, Data & AI", "Leadership & Management"]);
  const [scenario, setScenario] = useState<DemandScenario>("Medium");
  const [selectedSite, setSelectedSite] = useState(allSitesLabel);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [success, setSuccess] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(sidebarStateKey);
    if (stored) {
      setSidebarCollapsed(stored === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(sidebarStateKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const filteredRequests = useMemo(() => filterBySite(requests, selectedSite), [requests, selectedSite]);
  const filteredLearners = useMemo(() => filterBySite(portakabinLearners, selectedSite), [selectedSite]);
  const searchedLearners = useMemo(() => {
    const query = learnerSearch.trim().toLowerCase();
    if (!query) return filteredLearners;
    return filteredLearners.filter((learner) => [learner.name, learner.role, learner.department, learner.site, learner.programme, learner.status, learner.lineManager].join(" ").toLowerCase().includes(query));
  }, [filteredLearners, learnerSearch]);
  const statusCounts = useMemo(() => countBy(filteredRequests, "status"), [filteredRequests]);
  const departmentCounts = useMemo(() => countBy(filteredRequests, "department"), [filteredRequests]);
  const selectedPersona = employeePersonas.find((persona) => persona.name === selectedEmployeeName) ?? employeePersonas[0];
  const employeeRequests = requests.filter((request) => request.name === selectedPersona.name);
  const activeEmployeeApplication = activeApplicationFor(requests, selectedPersona.name);
  const employeeRequest = employeeRequests[0] ?? filteredRequests[0] ?? requests[0];

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setActiveSection("Dashboard");
  }

  function openSection(section: SectionKey) {
    setActiveSection(section);
  }

  function switchEmployee(nextName: string) {
    const nextPersona = employeePersonas.find((persona) => persona.name === nextName);
    if (!nextPersona) return;
    setSelectedEmployeeName(nextPersona.name);
    setSelectedEmployeeRole(nextPersona.role);
  }

  function createApplication(draft: ApplicationDraft) {
    if (activeApplicationFor(requests, draft.name)) {
      setSuccess(false);
      return null;
    }

    const nextRequest: RequestItem = {
      id: Math.max(...requests.map((request) => request.id), 0) + 1,
      name: draft.name,
      role: draft.role,
      department: draft.department,
      team: draft.team,
      site: draft.site,
      pathway: draft.pathway,
      manager: draft.manager,
      status: "Submitted to Line Manager",
      note: draft.reason,
      careerGoal: draft.careerGoal,
      supportRequired: draft.supportRequired,
      submittedDate: "2026-06-11",
      decisionNotes: "Submitted to line manager for review.",
    };

    setRequests((current) => [nextRequest, ...current]);
    setSuccess(true);
    return nextRequest;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const created = createApplication({
      name: String(data.get("name") || "New colleague"),
      role: String(data.get("role") || "Internal colleague"),
      department: String(data.get("department") || "Manufacturing"),
      team: String(data.get("team") || "Internal team"),
      site: String(data.get("site") || (selectedSite === allSitesLabel ? "York Head Office, Visitor Centre and UK Factory" : selectedSite)),
      pathway: String(data.get("pathway") || pathways[0].title),
      manager: String(data.get("manager") || "Line manager"),
      reason: String(data.get("reason") || "New development request."),
      careerGoal: String(data.get("careerGoal") || "Progress into a future role."),
      supportRequired: String(data.get("supportRequired") || "None noted."),
    });
    if (created) setActiveSection("My Applications");
  }

  function setRequestStatus(id: number, status: RequestStatus) {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status, decisionNotes: decisionNoteFor(status) } : request)));
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

  function submitForProviderEnrolment(request: RequestItem) {
    const mapping = findProviderMappingForRequest(request, mappings);
    setEnrolmentSubmissions((current) => ({
      ...current,
      [request.id]: {
        requestId: request.id,
        provider: mapping?.partner ?? "Provider mapping required",
        providerEmail: mapping?.providerEmail ?? "Add provider email in settings",
        programme: mapping?.standard ?? request.pathway,
        submittedAt: "15 Jun 2026",
        emailStatus: "Sent",
      },
    }));
    setRequests((current) => current.map((item) => (
      item.id === request.id
        ? { ...item, decisionNotes: `Submitted to ${mapping?.partner ?? "provider"} for enrolment. Provider notification email sent to ${mapping?.providerEmail ?? "configured provider contact"}.` }
        : item
    )));
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
        status: "Submitted to Line Manager",
        note: "Seeded presentation request.",
        careerGoal: "Build future capability.",
        supportRequired: "Manager support for study time.",
        submittedDate: "2026-06-09",
        decisionNotes: "Submitted to line manager for review.",
      },
      ...current,
    ]);
    setActiveSection("Applications to Review");
  }

  function setScenarioData(nextScenario: DemandScenario) {
    setScenario(nextScenario);
    setRequests(scenarioSeeds[nextScenario]);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8faf8_0%,#f2f6f4_48%,#f6f8f7_100%)] text-[#102c3d]">
      <Sidebar role={role} activeSection={activeSection} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((current) => !current)} onNavigate={openSection} />

      <div className={`h-screen min-w-0 overflow-y-auto transition-[margin] duration-300 ease-out ${sidebarCollapsed ? "lg:ml-[92px]" : "lg:ml-[296px]"}`}>
        <TopBar role={role} setRole={switchRole} selectedSite={selectedSite} selectedPersona={selectedPersona} onEmployee={switchEmployee} onSite={setSelectedSite} onOpenAdmin={() => switchRole("Admin Console")} />

        <div className="mx-auto w-full max-w-[1500px] space-y-4 px-5 py-4 sm:px-7 lg:px-8">
          {activeSection === "Dashboard" ? (
            <>
              <HeroPanel
                role={role}
                selectedSite={selectedSite}
                selectedPersona={selectedPersona}
                activeApplication={activeEmployeeApplication}
                requests={filteredRequests}
                learners={filteredLearners}
                mappings={mappings}
                onNavigate={openSection}
              />
              <RoleDashboard
                role={role}
                requests={filteredRequests}
                learners={filteredLearners}
                mappings={mappings}
                departmentCounts={departmentCounts}
                savedPathways={savedPathways}
                employeeRequest={employeeRequest}
                selectedPersona={selectedPersona}
                selectedSite={selectedSite}
                activeApplication={activeEmployeeApplication}
                onNavigate={openSection}
              />
            </>
          ) : (
            <>
              <SectionHeader activeSection={activeSection} role={role} selectedSite={selectedSite} />
              <DetailSection
                role={role}
                activeSection={activeSection}
                requests={filteredRequests}
                mappings={mappings}
                statusCounts={statusCounts}
                departmentCounts={departmentCounts}
                savedPathways={savedPathways}
                employeeRequests={employeeRequests}
                selectedPersona={selectedPersona}
                selectedSite={selectedSite}
                learners={searchedLearners}
                learnerSearch={learnerSearch}
                scenario={scenario}
                success={success}
                activeApplication={activeEmployeeApplication}
                onSubmit={handleSubmit}
                onOpenPathway={setSelectedPathway}
                onLearnerSearch={setLearnerSearch}
                selectedEmployeeRole={selectedEmployeeRole}
                onEmployeeRole={setSelectedEmployeeRole}
                onSavePathway={(title) => setSavedPathways((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]))}
                onStatus={setRequestStatus}
                onMove={moveRequest}
                onMapping={updateMapping}
                enrolmentSubmissions={enrolmentSubmissions}
                onSubmitToProvider={submitForProviderEnrolment}
                onScenario={setScenarioData}
                onSeed={seedRequest}
                onNavigate={openSection}
                onCreateApplication={createApplication}
              />
            </>
          )}
        </div>
      </div>

      {selectedPathway && <PathwayModal pathway={selectedPathway} activeApplication={role === "Employee" ? activeEmployeeApplication : undefined} onClose={() => setSelectedPathway(null)} onStart={() => { setSelectedPathway(null); setActiveSection("My Applications"); }} />}
    </main>
  );
}

function Sidebar({
  role,
  activeSection,
  collapsed,
  onToggle,
  onNavigate,
}: {
  role: Role;
  activeSection: SectionKey;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (section: SectionKey) => void;
}) {
  const navSections = navSectionsByRole[role];

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r bg-white/95 py-4 shadow-[10px_0_34px_rgba(16,44,61,0.04)] backdrop-blur-xl transition-[width,padding,border-color,box-shadow] duration-300 ease-out lg:flex lg:flex-col ${collapsed ? "w-[92px] border-[#102c3d]/[0.06] px-3" : "w-[296px] border-[#102c3d]/[0.08] px-4"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-1.5"}`}>
        <LevyTateLogo className={collapsed ? "[--levytate-logo-size:1.08rem]" : "[--levytate-logo-size:2.5rem]"} />
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#102c3d]/[0.08] bg-white text-[#102c3d]/64 shadow-[0_8px_18px_rgba(16,44,61,0.06)] transition hover:-translate-y-0.5 hover:text-[#102c3d] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15 ${collapsed ? "absolute right-3 top-5" : ""}`}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path d={collapsed ? "M7.5 4.5 12.5 10l-5 5.5" : "M12.5 4.5 7.5 10l5 5.5"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {collapsed ? null : (
        <div className="mt-4 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f7faf6] px-4 py-3 text-[#102c3d] transition-all duration-300">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#102c3d]/40">Active client</p>
          <p className="mt-1 text-sm font-semibold tracking-tight">Portakabin</p>
          <p className="mt-1 text-xs font-medium text-[#102c3d]/48">{role}</p>
        </div>
      )}

      <nav className={`mt-4 min-h-0 flex-1 overflow-y-auto ${collapsed ? "space-y-3 px-0.5" : "space-y-4 pr-1"}`}>
        {navSections.map((section) => (
          <div key={section.title}>
            {collapsed ? null : <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#102c3d]/32">{section.title}</p>}
            <div className={`grid ${collapsed ? "gap-1.5" : "mt-2 gap-0.5"}`}>
              {section.items.map((item) => {
                const sectionKey = item as SectionKey;
                const active = activeSection === sectionKey;
                return (
                  <button
                    key={item}
                    onClick={() => onNavigate(sectionKey)}
                    title={item}
                    aria-label={item}
                    className={`group relative flex w-full items-center rounded-xl text-left text-sm font-medium transition duration-200 ${
                      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5"
                    } ${
                      active ? "bg-[#edf6f2] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/56 hover:bg-[#f7faf6] hover:text-[#102c3d]"
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${active ? "bg-white text-[#159b8f] shadow-[0_6px_14px_rgba(16,44,61,0.06)]" : "bg-[#f8fbfa] text-[#102c3d]/46 group-hover:bg-white"}`}>
                      <NavigationItemIcon section={sectionKey} />
                    </span>
                    {collapsed ? (
                      <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-[#102c3d]/[0.06] bg-[#102c3d] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(16,44,61,0.16)] group-hover:block">
                        {item}
                      </span>
                    ) : (
                      <span className="truncate">{item}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {collapsed ? null : (
        <div className="mt-4 rounded-2xl border border-[#102c3d]/[0.05] bg-[#f8fbfa] px-4 py-3">
          <p className="text-xs font-semibold text-[#102c3d]">Powered by LevyTate</p>
          <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">Apprenticeship operating system for workforce readiness.</p>
        </div>
      )}
    </aside>
  );
}

function NavigationItemIcon({ section }: { section: SectionKey }) {
  const kind =
    section === "Dashboard" ? "dashboard" :
    section === "Ask LevyTate AI" || section === "AI Assistant" ? "assistant" :
    ["Recommended Pathways", "Explore Pathways", "Recommended Programmes", "Career Pathfinder", "Development Passport", "Skills Analysis"].includes(section) ? "pathways" :
    ["My Applications", "Applications to Review", "Applications for Final Approval", "Approved for Enrolment", "Requests", "Approvals", "Enrolments"].includes(section) ? "workflow" :
    ["My Team", "Team Skills", "Team Development", "Succession Planning"].includes(section) ? "team" :
    ["Department Analytics", "Site Breakdown", "Apprenticeship Participation", "Department Overview", "Skills Map", "Department Demand", "Future Demand", "Future Skills", "Levy Utilisation", "Levy Position", "Forecast", "Reporting", "Site Adoption", "Platform Analytics", "Learners by Site", "Organisation Overview", "Site Performance"].includes(section) ? "analytics" :
    ["Providers", "Approved Providers", "Performance", "Provider Management"].includes(section) ? "providers" :
    ["Programmes", "Programme Catalogue"].includes(section) ? "programmes" :
    ["Compliance", "Permission Management", "Role Management", "Employer Configuration", "Site Configuration", "Audit Logs", "System Settings", "User Management", "Admin"].includes(section) ? "settings" :
    "default";

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]">
      {kind === "dashboard" ? <path d="M3.5 4.5h5v5h-5zm8 0h5v3.5h-5zm0 5.5h5v5.5h-5zm-8 1.5h5v4h-5z" fill="currentColor" /> : null}
      {kind === "assistant" ? <path d="M10 2.8 11.9 7l4.5.5-3.4 3 1 4.4-4-2.3-4 2.3 1-4.4-3.4-3L8.1 7 10 2.8Z" fill="currentColor" /> : null}
      {kind === "pathways" ? <path d="M4.2 4.5h4.8v3.1H4.2zm6.8 0h4.8v3.1H11zm-6.8 7.7h4.8v3.3H4.2zm8.9-6 2.7 1.7-2.7 1.7v1.8l4.7-3.5-4.7-3.4zM9 13.9h2.4v-1.8H9z" fill="currentColor" /> : null}
      {kind === "workflow" ? (
        <>
          <path d="M5 4.2h7l3 3v8.6H5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 8.1h4.5M8 11h4.5M8 13.9h3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : null}
      {kind === "team" ? <path d="M6.2 9.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Zm7.6 0a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM3.8 15.2c.7-2 2.1-3 4.2-3s3.5 1 4.2 3m.6 0c.5-1.4 1.7-2.2 3.4-2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {kind === "analytics" ? (
        <>
          <path d="M4 14.5V10m4 4.5V6.8m4 7.7V8.8m4 5.7V4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M3.5 15.8h13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : null}
      {kind === "providers" ? <path d="M4.5 15.5V6.7L10 3.5l5.5 3.2v8.8M7 8.5h.1m2.9 0h.1m2.9 0h.1M7 11.3h.1m2.9 0h.1m2.9 0h.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {kind === "programmes" ? <path d="M4 5.3h12v3.4H4zm0 5.1h12v4.3H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /> : null}
      {kind === "settings" ? <path d="M10 3.8 11.3 5l1.9-.2.7 1.7 1.8.8-.2 1.9 1.2 1.3-1.2 1.3.2 1.9-1.8.8-.7 1.7-1.9-.2-1.3 1.2-1.3-1.2-1.9.2-.7-1.7-1.8-.8.2-1.9L3.3 10l1.2-1.3-.2-1.9 1.8-.8.7-1.7 1.9.2L10 3.8Zm0 3.4a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /> : null}
      {kind === "default" ? <path d="M5 5.2h10v2H5zm0 3.8h10v2H5zm0 3.8h10v2H5z" fill="currentColor" /> : null}
    </svg>
  );
}

function TopBar({
  role,
  setRole,
  selectedSite,
  selectedPersona,
  onEmployee,
  onSite,
  onOpenAdmin,
}: {
  role: Role;
  setRole: (role: Role) => void;
  selectedSite: string;
  selectedPersona: EmployeePersona;
  onEmployee: (name: string) => void;
  onSite: (site: string) => void;
  onOpenAdmin: () => void;
}) {
  return (
    <PlatformTopBar tenantName="Portakabin" tenantSubtitle="Internal apprenticeship and capability hub" controlsOnly>
      <div className="grid w-full min-w-0 gap-3 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#102c3d]/34">
              <path d="m14.3 14.3 3.2 3.2M8.8 15.2a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              readOnly
              value="Search pathways, requests or teams"
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d]/58 outline-none"
            />
          </label>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          <label className="flex h-11 min-w-[210px] items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10 xl:max-w-[250px]">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Site</span>
            <select
              value={selectedSite}
              onChange={(event) => onSite(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#102c3d]/78 outline-none"
              aria-label="Site"
            >
              <option>{allSitesLabel}</option>
              {portakabinSites.map((site) => (
                <option key={site}>{site}</option>
              ))}
            </select>
          </label>
          {role === "Employee" ? (
            <label className="flex h-11 min-w-[230px] items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10 xl:max-w-[270px]">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Demo employee</span>
              <select
                value={selectedPersona.name}
                onChange={(event) => onEmployee(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#102c3d]/78 outline-none"
                aria-label="Demo Employee"
              >
                {employeePersonas.map((persona) => (
                  <option key={persona.name}>{persona.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex min-h-11 shrink-0 flex-wrap items-center rounded-full border border-[#102c3d]/[0.06] bg-[#edf5f1] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
            {roles.map((item) => (
              <button key={item} onClick={() => setRole(item)} className={`h-9 rounded-full px-3.5 text-xs font-semibold transition duration-200 ${role === item ? "bg-white text-[#102c3d] shadow-[0_8px_16px_rgba(16,44,61,0.08)]" : "text-[#102c3d]/54 hover:text-[#102c3d]"}`}>
                {item}
              </button>
            ))}
          </div>
          <PlatformButton onClick={onOpenAdmin} className="h-11 whitespace-nowrap px-5">Admin console</PlatformButton>
        </div>
      </div>
    </PlatformTopBar>
  );
}

function HeroPanel({
  role,
  selectedSite,
  selectedPersona,
  activeApplication,
  requests,
  learners,
  mappings,
  onNavigate,
}: {
  role: Role;
  selectedSite: string;
  selectedPersona: EmployeePersona;
  activeApplication?: RequestItem;
  requests: RequestItem[];
  learners: Learner[];
  mappings: ProviderMapping[];
  onNavigate: (section: SectionKey) => void;
}) {
  const primaryAction = primaryDashboardAction(role);
  const employeeSecondaryAction = activeApplication ? "My Applications" : "Recommended Pathways";
  const metricCards = operatingSnapshotMetrics({
    role,
    selectedPersona,
    activeApplication,
    requests,
    learners,
    mappings,
  });

  return (
    <section className="rounded-[1.1rem] border border-[#102c3d]/[0.06] bg-white/96 p-4 shadow-[0_14px_30px_rgba(16,44,61,0.045)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="w-fit rounded-full bg-[#fff4bd] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7b6100]">
              {role === "Employee" ? "Guided employee workspace" : "Standalone employer environment"}
            </p>
          </div>
          <h1 className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.03em] text-[#102c3d]">
            {role === "Employee" ? "What should you do next?" : "Portakabin Apprenticeship Hub"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#102c3d]/72">{role === "Employee" ? selectedPersona.role : "Internal apprenticeship and workforce readiness environment"}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/58">
            {role === "Employee"
              ? `${selectedPersona.name} has one clear next step. Start with Ask LevyTate AI to explore the best approved pathway, then track a single application from manager review to enrolment.`
              : "A focused LevyTate workspace for approved pathways, approval control, provider planning and executive workforce insight."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-[11px] font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.05]">View: {selectedSite}</span>
            {role === "Employee" ? <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-[11px] font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.05]">Goal: {selectedPersona.careerGoal}</span> : null}
            {role === "Employee" && activeApplication ? <span className="rounded-full bg-[#edf8f5] px-3 py-1.5 text-[11px] font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/15">{activeApplication.status}</span> : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PlatformButton onClick={() => onNavigate(primaryAction.target)}>{primaryAction.label}</PlatformButton>
            {role === "Employee" ? <PlatformButton variant="soft" onClick={() => onNavigate(employeeSecondaryAction)}>{
              activeApplication ? "Track current application" : "View pathways"
            }</PlatformButton> : null}
          </div>
        </div>
        <RolePurposeCard role={role} selectedPersona={selectedPersona} activeApplication={activeApplication} onNavigate={onNavigate} />
      </div>
      <div className="mt-4 border-t border-[#102c3d]/[0.055] pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Decision snapshot</p>
          <span className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-[11px] font-semibold text-[#102c3d]/48 ring-1 ring-[#102c3d]/[0.05]">{role}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {metricCards.map((metric) => (
            <DashboardSnapshotCard key={metric.label} metric={metric} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RolePurposeCard({
  role,
  selectedPersona,
  activeApplication,
  onNavigate,
}: {
  role: Role;
  selectedPersona: EmployeePersona;
  activeApplication?: RequestItem;
  onNavigate: (section: SectionKey) => void;
}) {
  const content: Record<Role, { eyebrow: string; title: string; copy: string; cta: string; target: SectionKey }> = {
    Employee: {
      eyebrow: "Start here",
      title: "Ask LevyTate AI",
      copy: activeApplication
        ? `Your application is already in motion. Use AI to understand what fits next without starting a second request.`
        : `Tell LevyTate about ${selectedPersona.role}, your goals and the support you need. It will guide you to the most relevant approved pathway.`,
      cta: activeApplication ? "Open Ask LevyTate AI" : "Start with Ask LevyTate AI",
      target: "Ask LevyTate AI",
    },
    "Line Manager": {
      eyebrow: "Manager focus",
      title: "Team development",
      copy: "See where approvals are blocked and where apprenticeships can close the next capability gap.",
      cta: "Open team development",
      target: "Team Development",
    },
    "Department Head": {
      eyebrow: "Planning focus",
      title: "Workforce readiness view",
      copy: "See future capability, site momentum and participation without being pulled into workflow admin.",
      cta: "Open analytics",
      target: "Department Analytics",
    },
    "Apprenticeship Lead": {
      eyebrow: "Command centre",
      title: "Investment control",
      copy: "See where to invest next across approvals, levy position and provider coverage.",
      cta: "Open approvals",
      target: "Applications for Final Approval",
    },
    "Admin Console": {
      eyebrow: "Platform control",
      title: "Configuration and governance",
      copy: "Maintain user access, programme configuration and audit visibility across the demo environment.",
      cta: "Open admin",
      target: "User Management",
    },
  };

  const item = content[role];

  return (
    <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">{item.eyebrow}</p>
      <h2 className="mt-1.5 text-lg font-semibold leading-6 tracking-[-0.02em] text-[#102c3d]">{item.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{item.copy}</p>
      <button
        type="button"
        onClick={() => onNavigate(item.target)}
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0b7d70]"
      >
        {item.cta}
        <span aria-hidden="true">-&gt;</span>
      </button>
    </div>
  );
}

function DashboardSnapshotCard({
  metric,
  onNavigate,
}: {
  metric: SnapshotMetric;
  onNavigate: (section: SectionKey) => void;
}) {
  return (
    <button
      type="button"
      title={metric.tooltip}
      onClick={() => onNavigate(metric.target)}
      className="group min-w-0 rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-3.5 text-left shadow-[0_8px_20px_rgba(16,44,61,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#159b8f]/20 hover:bg-white hover:shadow-[0_14px_28px_rgba(16,44,61,0.07)] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/12"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{metric.label}</p>
        <MetricSparkline series={metric.series} accent={metric.accent} />
      </div>
      <p className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] text-[#102c3d]">{metric.value}</p>
      <p className="mt-1.5 min-h-[34px] text-xs leading-5 text-[#102c3d]/58">{metric.copy}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-[#102c3d]/[0.04]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(12, metric.progress)}%`, backgroundColor: metric.accent ?? "#159b8f" }} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-semibold" style={{ color: metric.accent ?? "#0b7d70" }}>{metric.trend}</p>
        <span className="shrink-0 text-[11px] font-semibold text-[#102c3d]">{metric.actionLabel}</span>
      </div>
    </button>
  );
}

function MetricSparkline({ series, accent = "#159b8f" }: { series: number[]; accent?: string }) {
  const points = toChartPoints(series);

  return (
    <svg viewBox="0 0 320 140" aria-hidden="true" className="h-7 w-20 shrink-0 overflow-visible">
      <polyline points={points} fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompactSignalMetric({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-lg font-semibold tracking-[-0.02em] text-[#102c3d]">{value}</p>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    </div>
  );
}

function operatingSnapshotMetrics({
  role,
  selectedPersona,
  activeApplication,
  requests,
  learners,
  mappings,
}: {
  role: Role;
  selectedPersona: EmployeePersona;
  activeApplication?: RequestItem;
  requests: RequestItem[];
  learners: Learner[];
  mappings: ProviderMapping[];
}): SnapshotMetric[] {
  const managerRequests = requests.filter((request) => request.manager === currentManagerName && (request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review"));
  const managerLearners = learners.filter((learner) => learner.lineManager === currentManagerName);
  const liveLearners = learners.filter((learner) => learner.status === "Live learner" || learner.status === "Enrolment");
  const sitesWithLearners = new Set(learners.map((learner) => learner.site)).size;
  const leadQueue = requests.filter((request) => request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval" || request.status === "Approved by Line Manager");
  const readiness = readinessScore(learners, requests);
  const employeeProgress = activeApplication ? Math.round(((publicStages.indexOf(activeApplication.status) + 1) / publicStages.length) * 100) : 14;
  const teamHighPotential = managerLearners.filter((learner) => learner.progress >= 70 || learner.programme === "Leadership & Management").length || 3;
  const departmentParticipation = `${Math.max(12, Math.min(28, Math.round((liveLearners.length / Math.max(learners.length || 1, 8)) * 100)))}%`;
  const providerCoverage = `${Math.max(68, Math.min(96, Math.round((mappings.filter((mapping) => mapping.status === "Live").length / Math.max(mappings.length, 1)) * 100)))}%`;

  const snapshots: Record<Role, SnapshotMetric[]> = {
    Employee: [
      {
        label: "Current application",
        value: activeApplication ? 1 : 0,
        copy: activeApplication ? "Your active application awaiting manager review." : "No active apprenticeship application yet.",
        trend: activeApplication ? activeApplication.pathway : "Ready to start",
        tooltip: activeApplication ? `Shows ${selectedPersona.name}'s active application and who is reviewing it.` : `Shows whether ${selectedPersona.name} already has an active apprenticeship application.`,
        actionLabel: activeApplication ? "Track" : "Start",
        target: activeApplication ? "My Applications" : "Ask LevyTate AI",
        progress: activeApplication ? employeeProgress : 14,
        series: activeApplication ? [18, 26, 34, 42, 48, 56, 52] : [8, 10, 12, 14, 14, 14, 14],
        accent: "#159b8f",
      },
      {
        label: "Recommended pathways",
        value: selectedPersona.recommendedPathways,
        copy: "Approved pathways matched to your role and progression goal.",
        trend: selectedPersona.careerGoal,
        tooltip: `Shows approved pathways matched to ${selectedPersona.name}'s role, site and stated progression goal.`,
        actionLabel: "Explore",
        target: "Recommended Pathways",
        progress: Math.min(100, selectedPersona.recommendedPathways * 30),
        series: [20, 24, 30, 36, 42, 48, 54],
      },
      {
        label: "Development passport",
        value: selectedPersona.passportActivities,
        copy: "Learning evidence and internal development already logged.",
        trend: `${selectedPersona.savedOpportunities} saved for later`,
        tooltip: `Shows learning evidence already captured in ${selectedPersona.name}'s development passport. It matters because this supports progression and application decisions.`,
        actionLabel: "Open",
        target: "Development Passport",
        progress: Math.min(100, selectedPersona.passportActivities * 11),
        series: [14, 18, 22, 27, 31, 38, 45],
        accent: "#df5f73",
      },
    ],
    "Line Manager": [
      {
        label: "Awaiting review",
        value: managerRequests.length,
        copy: "Direct-report applications waiting for a manager decision.",
        trend: managerRequests.length ? `${managerRequests.length} ready now` : "Queue clear",
        tooltip: "Shows the number of direct-report applications waiting for manager review.",
        actionLabel: "Review",
        target: "Applications to Review",
        progress: Math.min(100, managerRequests.length * 18),
        series: [2, 2, 3, 3, 4, 4, Math.max(1, managerRequests.length)],
      },
      {
        label: "Team readiness",
        value: `${Math.max(58, readiness - 8)}%`,
        copy: "Current capability coverage across the manager's team.",
        trend: `${teamHighPotential} high potential`,
        tooltip: "Shows a readiness signal across the manager's team. It matters because managers need to know where development investment will have the most impact.",
        actionLabel: "Open",
        target: "Team Development",
        progress: Math.max(58, readiness - 8),
        series: [52, 54, 56, 58, 60, 62, Math.max(58, readiness - 8)],
        accent: "#7b61ff",
      },
      {
        label: "Active team learners",
        value: managerLearners.filter((learner) => learner.status === "Live learner" || learner.status === "Enrolment").length,
        copy: "Team members currently building capability through live programmes.",
        trend: "Use to plan cover",
        tooltip: "Shows the team members already active on programme. It matters because managers need to plan support and cover alongside approvals.",
        actionLabel: "View",
        target: "Team Development",
        progress: 68,
        series: [4, 5, 6, 7, 8, 10, 12],
        accent: "#df5f73",
      },
    ],
    "Department Head": [
      {
        label: "Workforce readiness",
        value: `${readiness}%`,
        copy: "Overall capability readiness across the visible workforce.",
        trend: "+4 year on year",
        tooltip: "Shows the department's workforce readiness by combining participation, live learners, demand and pathway coverage.",
        actionLabel: "Open",
        target: "Department Analytics",
        progress: readiness,
        series: [68, 70, 71, 74, 76, 79, readiness],
      },
      {
        label: "Participation",
        value: departmentParticipation,
        copy: "Visible workforce currently using apprenticeship routes.",
        trend: "Up from last quarter",
        tooltip: "Shows the share of visible workforce currently engaged in apprenticeship development.",
        actionLabel: "Report",
        target: "Reporting",
        progress: Number.parseInt(departmentParticipation, 10),
        series: [12, 13, 15, 15, 16, 17, Number.parseInt(departmentParticipation, 10)],
        accent: "#7b61ff",
      },
      {
        label: "Future skills risk",
        value: 4,
        copy: "Capability areas that need intervention or stronger succession cover.",
        trend: `${sitesWithLearners} sites active`,
        tooltip: "Shows how many future capability areas need action. It matters because department heads need to decide where development investment should go next.",
        actionLabel: "Plan",
        target: "Future Demand",
        progress: 62,
        series: [7, 7, 6, 6, 5, 4, 4],
        accent: "#df5f73",
      },
    ],
    "Apprenticeship Lead": [
      {
        label: "Final approvals",
        value: leadQueue.length,
        copy: "Applications waiting for final apprenticeship lead approval.",
        trend: leadQueue.length ? `${leadQueue.length} need decision` : "Queue clear",
        tooltip: "Shows the number of applications that have passed line manager review and now need final approval.",
        actionLabel: "Review",
        target: "Applications for Final Approval",
        progress: Math.min(100, leadQueue.length * 16),
        series: [3, 4, 5, 6, 6, 7, Math.max(1, leadQueue.length)],
      },
      {
        label: "Levy utilisation",
        value: "82%",
        copy: "Forecast levy use against approved demand and live routes.",
        trend: "+6 this quarter",
        tooltip: "Shows forecast levy drawdown against approved demand.",
        actionLabel: "Report",
        target: "Reporting",
        progress: 82,
        series: [58, 61, 67, 70, 74, 79, 82],
        accent: "#159b8f",
      },
      {
        label: "Provider coverage",
        value: providerCoverage,
        copy: "Approved pathways with live delivery coverage in place.",
        trend: `${mappings.filter((mapping) => mapping.status === "Live").length} live mappings`,
        tooltip: "Shows how much of the approved pathway catalogue is covered by live provider mappings.",
        actionLabel: "Manage",
        target: "Providers",
        progress: Number.parseInt(providerCoverage, 10),
        series: [62, 66, 68, 72, 78, 82, Number.parseInt(providerCoverage, 10)],
        accent: "#7b61ff",
      },
    ],
    "Admin Console": [
      {
        label: "Active employers",
        value: 4,
        copy: "Employer environments currently configured in the platform.",
        trend: "Multi-tenant ready",
        tooltip: "Shows how many employer environments are configured.",
        actionLabel: "Open",
        target: "Employer Configuration",
        progress: 80,
        series: [1, 1, 2, 2, 3, 4, 4],
        accent: "#159b8f",
      },
      {
        label: "Programmes available",
        value: 42,
        copy: "Approved programmes currently available across the catalogue.",
        trend: "6 added this quarter",
        tooltip: "Shows catalogue breadth across the platform.",
        actionLabel: "View",
        target: "Programme Catalogue",
        progress: 84,
        series: [28, 30, 33, 36, 38, 40, 42],
        accent: "#7b61ff",
      },
      {
        label: "Platform health",
        value: "99.8%",
        copy: "Demo environment uptime and operational readiness.",
        trend: "No critical alerts",
        tooltip: "Shows platform uptime and service status.",
        actionLabel: "Open settings",
        target: "System Settings",
        progress: 100,
        series: [97, 97.5, 98, 98.6, 99, 99.4, 99.8],
        accent: "#df5f73",
      },
    ],
  };

  return snapshots[role];
}

function primaryDashboardAction(role: Role): { label: string; target: SectionKey } {
  const actions: Record<Role, { label: string; target: SectionKey }> = {
    Employee: { label: "Start with Ask LevyTate AI", target: "Ask LevyTate AI" },
    "Line Manager": { label: "Review applications", target: "Applications to Review" },
    "Department Head": { label: "View department analytics", target: "Department Analytics" },
    "Apprenticeship Lead": { label: "Review approval queue", target: "Applications for Final Approval" },
    "Admin Console": { label: "Open admin console", target: "User Management" },
  };

  return actions[role];
}

function SectionHeader({ activeSection, role, selectedSite }: { activeSection: SectionKey; role: Role; selectedSite: string }) {
  return (
    <section className="rounded-[1.1rem] border border-[#102c3d]/[0.06] bg-white/96 p-4 shadow-[0_12px_30px_rgba(16,44,61,0.045)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="w-fit rounded-full bg-[#fff4bd] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7b6100]">{role}</p>
          <h1 className="mt-2 text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#102c3d]">{activeSection}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#102c3d]/58">{sectionDescription(activeSection)}</p>
        </div>
        <div className="w-fit rounded-xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-3 py-2 text-xs font-semibold text-[#102c3d]/60">
          View: {selectedSite}
        </div>
      </div>
    </section>
  );
}

function RoleDashboard({
  role,
  requests,
  learners,
  mappings,
  departmentCounts,
  selectedPersona,
  selectedSite,
  activeApplication,
  onNavigate,
}: {
  role: Role;
  requests: RequestItem[];
  learners: Learner[];
  mappings: ProviderMapping[];
  departmentCounts: Record<string, number>;
  savedPathways: string[];
  employeeRequest: RequestItem;
  selectedPersona: EmployeePersona;
  selectedSite: string;
  activeApplication?: RequestItem;
  onNavigate: (section: SectionKey) => void;
}) {
  const managerRequests = requests.filter((request) => request.manager === currentManagerName && (request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review"));
  const leadRequests = requests.filter((request) => request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval" || request.status === "Approved by Line Manager");
  const featuredPathway = matchedPathwaysForRole(selectedPersona.role)[0];
  const readiness = readinessScore(learners, requests);
  const activeTeamLearners = learners.filter((learner) => learner.lineManager === currentManagerName && (learner.status === "Live learner" || learner.status === "Enrolment")).length;
  const liveMappings = mappings.filter((mapping) => mapping.status === "Live").length;

  if (role === "Employee") {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <PlatformPanel eyebrow="Next step" title="Start with Ask LevyTate AI">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div>
              <p className="text-sm leading-6 text-[#102c3d]/58">LevyTate guides the employee to one approved route at a time, so the next step is clear and the application journey stays simple.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "I want to become a team leader",
                  "What apprenticeship fits my role?",
                  "Help me with my application",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onNavigate("Ask LevyTate AI")}
                    className="rounded-full border border-[#102c3d]/[0.06] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#102c3d]/62 transition hover:border-[#159b8f]/20 hover:text-[#102c3d]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {featuredPathway ? (
                <div className="mt-4 rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Recommended now</p>
                      <h3 className="mt-1 text-base font-semibold tracking-[-0.015em] text-[#102c3d]">{featuredPathway.standard}</h3>
                      <p className="mt-1 text-sm text-[#159b8f]">{featuredPathway.title}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.05]">Best fit</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">{featuredPathway.learnerBenefit}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <PlatformButton onClick={() => onNavigate("Ask LevyTate AI")}>Open Ask LevyTate AI</PlatformButton>
                    <PlatformButton variant="soft" onClick={() => onNavigate("Recommended Pathways")}>View pathways</PlatformButton>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3">
              <SubtleRow label="Career goal" value={selectedPersona.careerGoal} />
              <SubtleRow label="Current focus" value={activeApplication ? "One active application is already in motion. Use AI for guidance, not a second request." : "Use AI to explore one best-fit pathway, then start a single application."} />
            </div>
          </div>
        </PlatformPanel>
        <PlatformPanel eyebrow="Where you are now" title="Current application and readiness">
          <div className="grid gap-4">
            {activeApplication ? <CompactApplicationTimeline request={activeApplication} /> : <p className="text-sm text-[#102c3d]/56">No active application yet.</p>}
            <div className="grid gap-3">
              {selectedPersona.skills.slice(0, 3).map(([label, value]) => (
                <SkillBar key={label} label={label} value={value} />
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SubtleRow label="Saved opportunities" value={`${selectedPersona.savedOpportunities} shortlisted pathway${selectedPersona.savedOpportunities === 1 ? "" : "s"}`} />
              <SubtleRow label="Development evidence" value={`${selectedPersona.passportActivities} learning items already logged`} />
            </div>
          </div>
        </PlatformPanel>
      </section>
    );
  }

  if (role === "Line Manager") {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(320px,0.94fr)]">
        <PlatformPanel eyebrow="Team capability" title="How do I develop my team?">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <YearOnYearParticipationChart compact />
            <CompactSkillsHeatmap
              title="Team skills heatmap"
              rows={[
                ["Assembly", [72, 61, 44, 58]],
                ["Hire", [64, 57, 48, 63]],
                ["Projects", [69, 54, 56, 60]],
                ["Support", [58, 62, 73, 71]],
              ]}
              columns={["Leadership", "Technical", "Data", "Digital"]}
            />
          </div>
        </PlatformPanel>
        <PlatformPanel eyebrow="Manager action" title="What needs attention now?">
          <div className="grid gap-4">
            <ApprovalQueuePreview requests={managerRequests} emptyCopy="No direct-report applications are awaiting review right now." />
            <div className="grid gap-3 md:grid-cols-2">
              <CompactSignalMetric label="Active team learners" value={activeTeamLearners} accent="#159b8f" />
              <CompactSignalMetric label="High potential" value={Math.max(2, Math.round((readiness - 48) / 6))} accent="#7b61ff" />
            </div>
            <div className="flex flex-wrap gap-2">
              <PlatformButton onClick={() => onNavigate("Applications to Review")}>Review applications</PlatformButton>
              <PlatformButton variant="soft" onClick={() => onNavigate("Team Development")}>Open team development</PlatformButton>
            </div>
          </div>
        </PlatformPanel>
      </section>
    );
  }

  if (role === "Department Head") {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <PlatformPanel eyebrow="Future capability" title="Do we have future capability?">
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
            <ReadinessIndex label={selectedSite === allSitesLabel ? "Portakabin capability" : selectedSite} score={readiness} />
            <LineChart
              series={[11, 12, 13, 14, 15, 16, 17, 18]}
              secondary={[9, 10, 10, 11, 12, 13, 14, 15]}
              labels={["2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4"]}
              primaryLabel="Participation"
              secondaryLabel="Last year"
            />
          </div>
        </PlatformPanel>
        <PlatformPanel eyebrow="Where to intervene" title="Participation, demand and site pressure">
          <div className="grid gap-4">
            <BarChart rows={Object.entries(departmentCounts).map(([label, value]) => [label, value] as [string, number]).slice(0, 4)} />
            <div className="grid gap-3">
              <SkillBar label="Supervisor pipeline" value={78} />
              <SkillBar label="Digital capability" value={62} />
              <SkillBar label="Site leadership cover" value={71} />
            </div>
            <div className="flex flex-wrap gap-2">
              <PlatformButton onClick={() => onNavigate("Reporting")}>Open reporting</PlatformButton>
              <PlatformButton variant="soft" onClick={() => onNavigate("Future Demand")}>Plan future demand</PlatformButton>
            </div>
          </div>
        </PlatformPanel>
      </section>
    );
  }

  if (role === "Apprenticeship Lead") {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
        <PlatformPanel eyebrow="Command centre" title="Where should we invest?">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <GaugeChart value={82} />
            <ApprovalPipelineBars requests={requests} />
          </div>
        </PlatformPanel>
        <PlatformPanel eyebrow="Delivery readiness" title="Provider coverage and next actions">
          <div className="grid gap-4">
            <BarChart rows={mappings.slice(0, 4).map((mapping) => [mapping.roleFamily, mapping.fit])} />
            <div className="grid gap-3 md:grid-cols-2">
              <CompactSignalMetric label="Live mappings" value={liveMappings} accent="#159b8f" />
              <CompactSignalMetric label="Ready for enrolment" value={requests.filter((request) => request.status === "Approved for Enrolment").length} accent="#7b61ff" />
            </div>
            <ApprovalQueuePreview requests={leadRequests.slice(0, 3)} emptyCopy="No applications are waiting for final approval." />
            <div className="flex flex-wrap gap-2">
              <PlatformButton onClick={() => onNavigate("Applications for Final Approval")}>Review approvals</PlatformButton>
              <PlatformButton variant="soft" onClick={() => onNavigate("Providers")}>Manage providers</PlatformButton>
            </div>
          </div>
        </PlatformPanel>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <PlatformPanel eyebrow="Platform health" title="Administration overview">
        <LineChart series={[98, 98, 99, 99, 99, 100, 99, 100]} labels={["Q1", "Q2", "Q3", "Q4"]} primaryLabel="Platform health" />
      </PlatformPanel>
      <PlatformPanel eyebrow="Admin focus" title="Configuration">
        <div className="grid gap-3">
          <SignalRow label="Configured users" value={824} />
          <SignalRow label="Departments" value={Object.keys(departmentCounts).length} />
          <SignalRow label="Programmes" value={42} />
        </div>
      </PlatformPanel>
    </section>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function EmployeeDashboard({ employeeRequest, savedPathways, onNavigate }: { employeeRequest: RequestItem; savedPathways: string[]; onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <PlatformPanel eyebrow="My development profile" title="Personal growth workspace">
        <div className="grid gap-4 md:grid-cols-2">
          <ProfileRow label="Name" value={employeeRequest.name} />
          <ProfileRow label="Role" value={employeeRequest.role} />
          <ProfileRow label="Department" value={employeeRequest.department} />
          <ProfileRow label="Site" value={employeeRequest.site} />
          <ProfileRow label="Manager" value={employeeRequest.manager} />
          <ProfileRow label="Career aspiration" value="Move into project and operational leadership." />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <RecommendationCard title="Team Leader L3" score="94%" />
          <RecommendationCard title="Data Technician L3" score="87%" />
          <RecommendationCard title="Business Administrator L3" score="83%" />
        </div>
      </PlatformPanel>
      <PlatformPanel eyebrow="Career pathfinder" title="Estimated progression pathway">
        <ProgressionPath roles={["Project Coordinator", "Project Manager", "Senior Project Manager", "Programme Manager"]} />
        <div className="mt-5 grid gap-3">
          <SkillBar label="Existing capability" value={68} />
          <SkillBar label="Target role readiness" value={54} />
          <SkillBar label="Recommended action coverage" value={82} />
        </div>
      </PlatformPanel>
      <PlatformPanel eyebrow="My applications" title="Request and passport">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <RequestTracker request={employeeRequest} />
          <div className="grid gap-3">
            <MetricTile label="Saved pathways" value={savedPathways.length} />
            <MetricTile label="Completed learning" value="7" />
            <MetricTile label="CPD activity" value="18 hrs" />
            <PlatformButton onClick={() => onNavigate("My Applications")}>View current application</PlatformButton>
          </div>
        </div>
      </PlatformPanel>
      <PlatformPanel eyebrow="Salary and career potential" title="Progression outlook">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Current range" value="£28k" copy="Role benchmark" />
          <MetricCard label="Next role range" value="£36k" copy="Estimated internal benchmark" />
          <MetricCard label="Future opportunity" value="High" copy="Based on skills trajectory" />
        </div>
      </PlatformPanel>
    </div>
  );
}

function ManagerDashboard({ requests, learners, onNavigate }: { requests: RequestItem[]; learners: Learner[]; onNavigate: (section: SectionKey) => void }) {
  const teamLearners = learners.filter((learner) => learner.lineManager === "Ryan Booth").slice(0, 8);
  const teamApplications = requests.filter((request) => request.manager === "Ryan Booth");
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="My team overview" title="Direct report development needs">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Team members" value={teamLearners.length} />
          <MetricTile label="Active apprentices" value={teamLearners.filter((learner) => learner.status === "Live learner").length} />
          <MetricTile label="Applications to review" value={teamApplications.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review").length} />
          <MetricTile label="Succession risk" value="Medium" />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <TeamMemberList learners={teamLearners} />
          <div className="grid gap-3">
            <SkillBar label="Leadership" value={64} />
            <SkillBar label="Technical" value={72} />
            <SkillBar label="Data" value={48} />
            <SkillBar label="Commercial" value={58} />
            <SkillBar label="Digital" value={52} />
          </div>
        </div>
      </PlatformPanel>
      <PlatformPanel eyebrow="Applications awaiting review" title="Manager approval queue">
        <div className="grid gap-4 lg:grid-cols-2">
          {teamApplications.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review").slice(0, 4).map((request) => (
            <ApplicationCard key={request.id} request={request} scope="manager" onStatus={() => onNavigate("Applications to Review")} />
          ))}
        </div>
      </PlatformPanel>
    </div>
  );
}

function DepartmentHeadDashboard({ requests, learners, departmentCounts, selectedSite, onNavigate }: { requests: RequestItem[]; learners: Learner[]; departmentCounts: Record<string, number>; selectedSite: string; onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Department overview" title="Workforce capability and succession planning">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Headcount in view" value={learners.length} />
          <MetricTile label="Learners" value={learners.filter((learner) => learner.status === "Live learner").length} />
          <MetricTile label="Pending applications" value={requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review" || request.status === "Approved by Line Manager" || request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval").length} />
          <MetricTile label="Completion rate" value="86%" />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ReadinessIndex label={selectedSite === allSitesLabel ? "Portakabin capability" : selectedSite} score={readinessScore(learners, requests)} />
          <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
        </div>
      </PlatformPanel>
      <div className="grid gap-5 xl:grid-cols-3">
        <StrategyPanel title="Future skills demand" items={["Digital reporting", "Site delivery confidence", "Supply chain resilience"]} action="Open future demand" onClick={() => onNavigate("Future Demand")} />
        <StrategyPanel title="Skills gaps" items={["Ready now: 6", "Ready soon: 11", "High potential: 14"]} action="Open skills map" onClick={() => onNavigate("Skills Map")} />
        <StrategyPanel title="Site breakdown" items={["York: 84/100", "Leeds: 72/100", "Manchester: 69/100"]} action="Compare sites" onClick={() => onNavigate("Site Breakdown")} />
      </div>
    </div>
  );
}

function ApprenticeshipLeadDashboard({ requests, learners, mappings, selectedSite, onNavigate }: { requests: RequestItem[]; learners: Learner[]; mappings: ProviderMapping[]; selectedSite: string; onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Organisation overview" title="Apprenticeship operating command centre">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Total learners" value={learners.length} />
          <MetricTile label="Active programmes" value={new Set(learners.map((learner) => learner.programme)).size} />
          <MetricTile label="Applications" value={requests.length} />
          <MetricTile label="Providers" value={mappings.length} />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ReadinessIndex label={selectedSite === allSitesLabel ? "Organisation readiness" : selectedSite} score={readinessScore(learners, requests)} />
          <Kanban requests={requests} compact />
        </div>
      </PlatformPanel>
      <div className="grid gap-5 xl:grid-cols-3">
        <StrategyPanel title="Levy utilisation" items={["Used: 73%", "Available: 27%", "Transfer opportunity: 8%"]} action="View levy" onClick={() => onNavigate("Levy Utilisation")} />
        <StrategyPanel title="Provider performance" items={["Completion: 86%", "Satisfaction: 91%", "Attendance: 88%"]} action="Manage providers" onClick={() => onNavigate("Providers")} />
        <StrategyPanel title="Compliance dashboard" items={["Evidence status: healthy", "Reviews due: 5", "Risk indicators: 2"]} action="Open compliance" onClick={() => onNavigate("Compliance")} />
      </div>
    </div>
  );
}

function AdminConsoleDashboard({ mappings, onNavigate }: { mappings: ProviderMapping[]; onNavigate: (section: SectionKey) => void }) {
  const adminCards: LaunchCardProps[] = [
    { title: "User management", value: "148", copy: "Users, roles and permissions.", action: "Manage users", section: "User Management" },
    { title: "Provider management", value: mappings.length, copy: "Approved delivery partner setup.", action: "Open providers", section: "Provider Management" },
    { title: "Programme catalogue", value: pathways.length, copy: "Internal pathway catalogue.", action: "View catalogue", section: "Programme Catalogue" },
    { title: "Platform analytics", value: "Live", copy: "Usage, adoption and audit signals.", action: "View analytics", section: "Platform Analytics" },
  ];
  return (
    <PlatformPanel eyebrow="Admin console" title="Platform administration and configuration">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => (
          <LaunchCard key={card.title} {...card} onNavigate={onNavigate} />
        ))}
      </div>
    </PlatformPanel>
  );
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#102c3d]">{value}</p>
    </div>
  );
}

function RecommendationCard({ title, score }: { title: string; score: string }) {
  return (
    <article className="rounded-2xl border border-[#159b8f]/[0.12] bg-white p-4 shadow-[0_10px_24px_rgba(16,44,61,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#102c3d]">{title}</p>
        <span className="rounded-full bg-[#edf8f5] px-2.5 py-1 text-[11px] font-semibold text-[#0b6f63]">{score}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#102c3d]/54">Matched to role, aspiration and development profile.</p>
    </article>
  );
}

function ProgressionPath({ roles: pathRoles }: { roles: string[] }) {
  return (
    <div className="grid gap-3">
      {pathRoles.map((item, index) => (
        <div key={item} className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#102c3d] text-xs font-semibold text-white">{index + 1}</span>
          <div className="flex-1 rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] px-4 py-3">
            <p className="text-sm font-semibold text-[#102c3d]">{item}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-[#102c3d]/60">{label}</p>
        <p className="text-xs font-semibold text-[#102c3d]">{value}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ecf6f2]">
        <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TeamMemberList({ learners }: { learners: Learner[] }) {
  return (
    <div className="grid gap-2">
      {learners.map((learner) => (
        <div key={`${learner.name}-${learner.site}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[#102c3d]/[0.045] bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#102c3d]">{learner.name}</p>
            <p className="mt-1 text-xs text-[#102c3d]/50">{learner.role}</p>
          </div>
          <span className="rounded-full bg-[#f8fbfa] px-3 py-1 text-xs font-semibold text-[#102c3d]/56">{learner.progress}%</span>
        </div>
      ))}
    </div>
  );
}

function ReadinessIndex({ label, score }: { label: string; score: number }) {
  const tone = score >= 78 ? "Green" : score >= 62 ? "Amber" : "Red";
  const toneClass = tone === "Green" ? "text-[#0b6f63] bg-[#edf8f5]" : tone === "Amber" ? "text-[#7b6100] bg-[#fff4bd]" : "text-[#ad344e] bg-[#ffe4e9]";
  return (
    <article className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Workforce Readiness Index</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#102c3d]">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">{score}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClass}`}>{tone}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2.5 text-xs leading-5 text-[#102c3d]/54">Skills, succession, participation and demand alignment.</p>
    </article>
  );
}

function StrategyPanel({ title, items, action, onClick }: { title: string; items: string[]; action: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 text-left shadow-[0_10px_24px_rgba(16,44,61,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(16,44,61,0.075)]">
      <p className="text-base font-semibold text-[#102c3d]">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <p key={item} className="rounded-2xl bg-[#f8fbfa] px-3 py-2 text-xs font-medium text-[#102c3d]/62">{item}</p>
        ))}
      </div>
      <span className="mt-3 inline-flex rounded-full bg-[#102c3d] px-3.5 py-1.5 text-xs font-semibold text-white">{action}</span>
    </button>
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
    <button onClick={() => onNavigate(section)} className="group min-h-[164px] rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 text-left shadow-[0_8px_22px_rgba(16,44,61,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#159b8f]/20 hover:bg-white hover:shadow-[0_14px_32px_rgba(16,44,61,0.075)]">
      <p className="text-xs font-semibold text-[#102c3d]/48">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-[#102c3d]/58">{copy}</p>
      <span className="mt-4 inline-flex h-8 items-center rounded-full bg-white px-3.5 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06] transition group-hover:bg-[#102c3d] group-hover:text-white group-hover:ring-[#102c3d]">{action}</span>
    </button>
  );
}

function matchedPathwaysForRole(roleName: string): Pathway[] {
  const matches = employeeRolePathwayMap[roleName] ?? [];

  return matches.flatMap((match) => {
    const basePathway = pathways.find((pathway) => pathway.title === match.pathwayTitle);
    if (!basePathway) return [];

    return [{
      ...basePathway,
      title: match.standard.replace(/^Level \d+\s/, ""),
      standard: match.standard,
      audience: `${roleName}: ${match.summary}`,
      learnerBenefit: match.summary,
    }];
  });
}

function roleSummaryFor(roleName: string) {
  const matches = employeeRolePathwayMap[roleName] ?? [];
  if (!matches.length) return "No approved apprenticeship mapping is currently available for this role.";

  const areas = Array.from(new Set(matches.map((match) => match.pathwayTitle.toLowerCase()))).join(", ");
  return `${roleName} is currently mapped to ${matches.length} approved development route${matches.length === 1 ? "" : "s"} across ${areas}.`;
}

function DetailSection({
  role,
  activeSection,
  requests,
  mappings,
  statusCounts,
  departmentCounts,
  savedPathways,
  employeeRequests,
  selectedPersona,
  selectedSite,
  learners,
  learnerSearch,
  selectedEmployeeRole,
  scenario,
  success,
  activeApplication,
  onSubmit,
  onOpenPathway,
  onLearnerSearch,
  onEmployeeRole,
  onSavePathway,
  onStatus,
  onMove,
  onMapping,
  enrolmentSubmissions,
  onSubmitToProvider,
  onScenario,
  onSeed,
  onNavigate,
  onCreateApplication,
}: {
  role: Role;
  activeSection: SectionKey;
  requests: RequestItem[];
  mappings: ProviderMapping[];
  statusCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
  savedPathways: string[];
  employeeRequests: RequestItem[];
  selectedPersona: EmployeePersona;
  selectedSite: string;
  learners: Learner[];
  learnerSearch: string;
  selectedEmployeeRole: string;
  scenario: DemandScenario;
  success: boolean;
  activeApplication?: RequestItem;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPathway: (pathway: Pathway) => void;
  onLearnerSearch: (query: string) => void;
  onEmployeeRole: (role: string) => void;
  onSavePathway: (title: string) => void;
  onStatus: (id: number, status: RequestStatus) => void;
  onMove: (id: number, direction: 1 | -1) => void;
  onMapping: (index: number, status: MappingStatus, nextAction: string) => void;
  enrolmentSubmissions: Record<number, EnrolmentSubmission>;
  onSubmitToProvider: (request: RequestItem) => void;
  onScenario: (scenario: DemandScenario) => void;
  onSeed: () => void;
  onNavigate: (section: SectionKey) => void;
  onCreateApplication: (draft: ApplicationDraft) => RequestItem | null;
}) {
  if (activeSection === "Dashboard") {
    return <DashboardGuide />;
  }

  if (activeSection === "Recommended Programmes" || activeSection === "Explore Pathways" || activeSection === "Recommended Pathways") {
    const roleMatchedPathways = matchedPathwaysForRole(selectedEmployeeRole);
    const visiblePathways = role === "Employee" ? roleMatchedPathways : pathways.slice(0, activeSection === "Explore Pathways" ? pathways.length : 6);

    return (
      <PlatformPanel eyebrow="Approved pathways" title={activeSection === "Explore Pathways" ? "Explore pathways" : "My recommended pathways"}>
        {role === "Employee" ? (
          <div className="mb-5 grid gap-4 rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_160px] lg:items-end">
            <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/60">
              Select Role
              <select value={selectedEmployeeRole} onChange={(event) => onEmployeeRole(event.target.value)} className="h-11 rounded-2xl border border-[#102c3d]/[0.08] bg-white px-4 text-sm font-semibold text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
                {employeeRoleOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Role summary</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{selectedPersona.name}: {roleSummaryFor(selectedEmployeeRole)}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-[0_8px_18px_rgba(16,44,61,0.035)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/36">Matched pathways</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{roleMatchedPathways.length}</p>
            </div>
          </div>
        ) : null}

        {visiblePathways.length ? (
          <div className="grid gap-3">
            {visiblePathways.map((pathway) => (
              <ExpandablePathwayCard key={`${pathway.title}-${pathway.standard}`} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-5">
            <p className="text-sm font-semibold text-[#102c3d]">No mapped pathways yet</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">This role does not currently have an approved pathway mapping. The apprenticeship lead can review future fit in the programme catalogue.</p>
          </div>
        )}
      </PlatformPanel>
    );
  }

  if (activeSection === "Career Pathfinder") {
    return (
      <PlatformPanel eyebrow="Career pathfinder" title="Progression map and recommended development">
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ProgressionPath roles={selectedPersona.progression} />
          <div className="grid gap-3 content-start">
            <p className="text-sm leading-6 text-[#102c3d]/62">{selectedPersona.role} to {selectedPersona.careerGoal}</p>
            {selectedPersona.progression.map((stage, index) => (
              <details key={stage} className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">Stage {index + 1}: {stage}</summary>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{index === 0 ? "Current role and evidence base." : index === selectedPersona.progression.length - 1 ? "Longer-term target role for future progression planning." : "Progression step supported by workplace evidence, manager coaching and pathway planning."}</p>
              </details>
            ))}
          </div>
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Development Passport") {
    return (
      <PlatformPanel eyebrow="Development passport" title="Completed learning and evidence record">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <ReadinessIndex label="Passport progress" score={Math.min(96, selectedPersona.passportActivities * 11)} />
          <div className="grid gap-3">
            {["Workplace learning", "Manager feedback", "Skills evidence", "Career conversation"].map((group, index) => (
              <details key={group} className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3" open={index === 0}>
                <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">{group}</summary>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{selectedPersona.passportActivities - index > 0 ? `${Math.max(1, selectedPersona.passportActivities - index)} activities logged. Evidence supports progression toward ${selectedPersona.careerGoal}.` : "No evidence logged yet."}</p>
              </details>
            ))}
          </div>
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "My Applications") {
    const currentApplication = activeApplication ?? employeeRequests.find((request) => isActiveApplicationStatus(request.status)) ?? employeeRequests[0];
    return (
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <PlatformPanel eyebrow="Current application" title={currentApplication ? currentApplication.pathway : "No active application"}>
          {currentApplication ? (
            <div className="grid gap-4">
              <CompactApplicationTimeline request={currentApplication} />
              <details className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">Application notes and approval history</summary>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-[#102c3d]/62">
                  <p>Reason: {currentApplication.note}</p>
                  <p>Career goal: {currentApplication.careerGoal}</p>
                  <p>Support required: {currentApplication.supportRequired}</p>
                  <p>Decision notes: {currentApplication.decisionNotes}</p>
                </div>
              </details>
            </div>
          ) : <p className="text-sm text-[#102c3d]/56">No current application.</p>}
        </PlatformPanel>
        <PlatformPanel eyebrow="Expression of interest" title={activeApplication ? "One active application only" : "Start expression of interest"}>
          <RequestForm key={selectedPersona.name} onSubmit={onSubmit} selectedPersona={selectedPersona} activeApplication={activeApplication} onViewApplication={() => onNavigate("My Applications")} />
          {success && <p className="mt-4 rounded-2xl bg-[#eff8f4] px-4 py-3 text-sm font-semibold text-[#102c3d]">Application submitted to line manager.</p>}
        </PlatformPanel>
      </section>
    );
  }

  if (activeSection === "Applications to Review" || activeSection === "Requests") {
    const managerRequests = requests.filter((request) => request.manager === "Ryan Booth" && (request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review"));
    return (
      <PlatformPanel eyebrow="Line manager review" title="Applications to review">
        <div className="grid gap-3">
          {managerRequests.map((request) => (
            <ApplicationCard key={request.id} request={request} scope="manager" onStatus={onStatus} />
          ))}
          {managerRequests.length === 0 ? <p className="rounded-2xl bg-[#f8fbfa] p-4 text-sm text-[#102c3d]/56">No direct-report applications awaiting review.</p> : null}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "My Team") {
    return (
      <PlatformPanel eyebrow="My team" title="Team development status">
        <div className="mb-4 flex flex-wrap gap-2">
          {["All sites", "Live learner", "Manager review", "Leadership"].map((item) => <span key={item} className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/54 ring-1 ring-[#102c3d]/[0.05]">{item}</span>)}
        </div>
        <TeamMemberList learners={learners.filter((learner) => learner.lineManager === "Ryan Booth").slice(0, 12)} />
      </PlatformPanel>
    );
  }

  if (activeSection === "Approvals") {
    const managerRequests = requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review");
    return (
      <PlatformPanel eyebrow="Manager approvals" title="Applications awaiting line manager approval">
        <div className="grid gap-4 lg:grid-cols-2">
          {managerRequests.map((request) => (
            <ApplicationCard key={request.id} request={request} scope="manager" onStatus={onStatus} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Skills Analysis" || activeSection === "Skills Map" || activeSection === "Future Skills" || activeSection === "Team Skills" || activeSection === "Team Development" || activeSection === "Future Demand") {
    if (role === "Employee") {
      return (
        <PlatformPanel eyebrow="Skills analysis" title={`${selectedPersona.name.split(" ")[0]}'s capability profile`}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <RadarChart rows={selectedPersona.skills.map(([label, value]) => [label.split(" ")[0], value])} />
            <div className="grid gap-3 content-start">
              {selectedPersona.skills.map(([label, value]) => (
                <SkillBar key={label} label={label} value={value} />
              ))}
              <details className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">Evidence and development detail</summary>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">Mapped to {selectedPersona.careerGoal}. Sponsored by {selectedPersona.manager}.</p>
              </details>
            </div>
          </div>
        </PlatformPanel>
      );
    }

    return (
      <PlatformPanel eyebrow="Workforce planning" title={activeSection}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Heatmap teams={["Manufacturing", "Hire", "Site Ops", "Digital"]} skills={["Lead", "Tech", "Data", "Ops"]} />
          <div className="grid gap-3 content-start">
            {["Leadership pipeline", "Digital reporting", "Site delivery confidence"].map((item) => (
              <details key={item} className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">{item}</summary>
                <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">Recommended pathway available. Use cohort planning to confirm demand and timing.</p>
              </details>
            ))}
          </div>
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Succession Planning") {
    return (
      <PlatformPanel eyebrow="Succession planning" title="Readiness and critical role coverage">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Ready now" value="6" copy="Colleagues prepared for next role" />
          <MetricCard label="Ready soon" value="11" copy="Likely ready within 6 to 12 months" />
          <MetricCard label="High potential" value="14" copy="Priority development conversations" />
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Department Demand" || activeSection === "Department Overview" || activeSection === "Department Analytics" || activeSection === "Apprenticeship Participation") {
    return (
      <PlatformPanel eyebrow="Department analytics" title="Management data and reporting">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
          <div className="grid gap-3">
            <MetricCard label="Participation rate" value="34%" copy="Department colleagues on programme" />
            <MetricCard label="Demand in workflow" value={requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review" || request.status === "Approved by Line Manager" || request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval").length} copy="Reporting only" />
            <MetricCard label="Approved enrolment demand" value={requests.filter((request) => request.status === "Approved for Enrolment").length} copy="Ready for enrolment" />
          </div>
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Site Performance" || activeSection === "Site Adoption" || activeSection === "Site Breakdown") {
    return (
      <PlatformPanel eyebrow="Site intelligence" title="Site adoption and readiness">
        <div className="grid gap-4 md:grid-cols-3">
          {["York Head Office, Visitor Centre and UK Factory", "Leeds Visitor Centre", "Trafford Park Manchester Visitor Centre"].map((site, index) => (
            <details key={site} className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#102c3d]">{site}</summary>
              <div className="mt-3"><ReadinessIndex label="Readiness" score={[84, 72, 69][index]} /></div>
            </details>
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Approved Providers" || activeSection === "Performance" || activeSection === "Providers" || activeSection === "Provider Management") {
    return <ProviderMappingTable mappings={mappings} onMapping={onMapping} />;
  }

  if (activeSection === "Programmes" || activeSection === "Programme Catalogue") {
    return (
      <PlatformPanel eyebrow="Programme catalogue" title="Approved apprenticeship programmes">
        <div className="grid gap-3">
          {pathways.map((pathway) => (
            <ExpandablePathwayCard key={pathway.title} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Applications for Final Approval") {
    const leadRequests = requests.filter((request) => request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval" || request.status === "Approved by Line Manager");
    return (
      <PlatformPanel eyebrow="Apprenticeship lead approval" title="Applications for final approval">
        <div className="grid gap-3">
          {leadRequests.map((request) => (
            <ApplicationCard key={request.id} request={request} scope="lead" onStatus={onStatus} />
          ))}
          {leadRequests.length === 0 ? <p className="rounded-2xl bg-[#f8fbfa] p-4 text-sm text-[#102c3d]/56">No applications awaiting final approval.</p> : null}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Approved for Enrolment") {
    const approvedRequests = requests.filter((request) => request.status === "Approved for Enrolment");
    return (
      <PlatformPanel eyebrow="Final approved" title="Approved for enrolment">
        <div className="grid gap-4 lg:grid-cols-2">
          {approvedRequests.map((request) => (
            <EnrolmentSubmissionCard
              key={request.id}
              request={request}
              mapping={findProviderMappingForRequest(request, mappings)}
              submission={enrolmentSubmissions[request.id]}
              onSubmit={() => onSubmitToProvider(request)}
            />
          ))}
          {approvedRequests.length === 0 ? <p className="rounded-2xl bg-[#f8fbfa] p-4 text-sm text-[#102c3d]/56">No applications are approved for enrolment yet.</p> : null}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Levy Position" || activeSection === "Forecast" || activeSection === "Levy Utilisation") {
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

  if (activeSection === "Organisation Overview") {
    return (
      <PlatformPanel eyebrow="Organisation overview" title="Enterprise apprenticeship performance">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Learners" value={learners.length} />
          <MetricTile label="Applications" value={requests.length} />
          <MetricTile label="Provider mappings" value={mappings.length} />
          <MetricTile label="Readiness Index" value={readinessScore(learners, requests)} />
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Compliance") {
    return (
      <PlatformPanel eyebrow="Compliance dashboard" title="Evidence, review dates and risk indicators">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Evidence status" value="92%" copy="Records complete across live learners" />
          <MetricCard label="Reviews due" value="5" copy="Next 30 days" />
          <MetricCard label="Risk indicators" value="2" copy="Require apprenticeship lead review" />
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Reporting" || activeSection === "Platform Analytics") {
    return <ReportingPage role={role} requests={requests} mappings={mappings} statusCounts={statusCounts} learners={learners} selectedSite={selectedSite} learnerSearch={learnerSearch} onLearnerSearch={onLearnerSearch} />;
  }

  if (activeSection === "Learners by Site") {
    return <LearnersBySite selectedSite={selectedSite} learners={learners} learnerSearch={learnerSearch} onLearnerSearch={onLearnerSearch} />;
  }

  if (activeSection === "AI Assistant") {
    return <AssistantPrompt />;
  }

  if (activeSection === "Ask LevyTate AI") {
    return (
      <AskLevyTateAIPage
        role={role}
        selectedSite={selectedSite}
        selectedPersona={selectedPersona}
        requests={requests}
        onStatus={onStatus}
        onNavigate={onNavigate}
        onCreateApplication={onCreateApplication}
        activeApplication={activeApplication}
      />
    );
  }

  if (activeSection === "Enrolments") {
    return (
      <PlatformPanel eyebrow="Enrolments" title="Learner progress">
        <Kanban requests={requests} onMove={onMove} compact />
      </PlatformPanel>
    );
  }

  if (activeSection === "System Settings") {
    return (
      <PlatformPanel eyebrow="Settings" title="Provider enrolment notification settings">
        <div className="grid gap-3">
          {mappings.map((mapping) => (
            <article key={`${mapping.partner}-${mapping.pathway}`} className="grid gap-3 rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold text-[#102c3d]">{mapping.partner}</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{mapping.pathway}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.05]">{mapping.providerEmail}</div>
              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.05]">Configured</span>
            </article>
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (["User Management", "Role Management", "Permission Management", "Employer Configuration", "Site Configuration", "Audit Logs", "Admin"].includes(activeSection)) {
    return (
      <PlatformPanel eyebrow="Admin console" title={activeSection}>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Configured users" value="148" copy="Demo users across employee and manager roles" />
          <MetricCard label="Permission groups" value="5" copy="Employee, manager, department, lead and admin" />
          <MetricCard label="Audit events" value="312" copy="Configuration and demo activity log" />
        </div>
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

function DashboardGuide() {
  return null;
}

function ApplicationCard({ request, scope, onStatus }: { request: RequestItem; scope: "manager" | "lead" | "readonly"; onStatus: (id: number, status: RequestStatus) => void }) {
  const awaitingManager = request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review";
  const awaitingLead = request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval" || request.status === "Approved by Line Manager";
  const currentApprover = awaitingManager ? request.manager : awaitingLead ? "Apprenticeship Lead" : "None";
  const actionRequired = awaitingManager ? "Line manager decision" : awaitingLead ? "Final approval" : "No action";

  return (
    <article className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-3.5 shadow-[0_8px_20px_rgba(16,44,61,0.035)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold">{request.name}</h3>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{request.role} - {request.team}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.05]">{request.status}</span>
      </div>
      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        <InfoBox label="Programme" value={request.pathway} />
        <InfoBox label="Site" value={request.site} />
        <InfoBox label="Submitted date" value={formatShortDate(request.submittedDate)} />
      </div>
      <details className="mt-3 rounded-xl border border-[#102c3d]/[0.05] bg-white px-3 py-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/44">View application detail</summary>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-[#102c3d]/64">
          <p>Department: {request.department}</p>
          <p>Current approver: {currentApprover}</p>
          <p>Action required: {actionRequired}</p>
          <p>Reason: {request.note}</p>
          <p>Career goal: {request.careerGoal}</p>
          <p>Support required: {request.supportRequired}</p>
          <p className="text-xs leading-5 text-[#102c3d]/46">Decision notes: {request.decisionNotes}</p>
        </div>
      </details>
      {scope !== "readonly" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {scope === "manager" ? (
            <>
              <SmallButton label="Approve and send to lead" onClick={() => onStatus(request.id, "Approved by Line Manager")} />
              <SmallButton label="Request more information" onClick={() => onStatus(request.id, "Draft")} variant="mint" />
              <SmallButton label="Decline with reason" onClick={() => onStatus(request.id, "Declined by Line Manager")} variant="coral" />
            </>
          ) : (
            <>
              <SmallButton label="Final approve" onClick={() => onStatus(request.id, "Approved for Enrolment")} />
              <SmallButton label="Mark ready for enrolment" onClick={() => onStatus(request.id, "Approved for Enrolment")} variant="mint" />
              <SmallButton label="Decline with reason" onClick={() => onStatus(request.id, "Declined by Apprenticeship Lead")} variant="coral" />
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function EnrolmentSubmissionCard({
  request,
  mapping,
  submission,
  onSubmit,
}: {
  request: RequestItem;
  mapping?: ProviderMapping;
  submission?: EnrolmentSubmission;
  onSubmit: () => void;
}) {
  const provider = mapping?.partner ?? "Provider mapping required";
  const providerEmail = mapping?.providerEmail ?? "Add provider email in settings";
  const canSubmit = Boolean(mapping?.providerEmail) && !submission;

  return (
    <article className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-3.5 shadow-[0_8px_20px_rgba(16,44,61,0.035)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold">{request.name}</h3>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{request.role} - {request.team}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.05]">
          {submission ? "Submitted to provider" : request.status}
        </span>
      </div>
      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        <InfoBox label="Programme" value={request.pathway} />
        <InfoBox label="Approved delivery partner" value={provider} />
        <InfoBox label="Provider email" value={providerEmail} />
      </div>
      <div className="mt-3 rounded-xl border border-[#102c3d]/[0.05] bg-white px-3 py-3">
        <div className="grid gap-2 text-sm leading-6 text-[#102c3d]/64">
          <p>Standard: {mapping?.standard ?? request.pathway}</p>
          <p>Delivery model: {mapping?.deliveryModel ?? "Confirm provider mapping"}</p>
          <p>Site: {request.site}</p>
          <p>Line manager: {request.manager}</p>
        </div>
      </div>
      {submission ? (
        <div className="mt-3 rounded-xl border border-[#159b8f]/[0.16] bg-[#edf8f5] px-3.5 py-3">
          <p className="text-sm font-semibold text-[#0b6f63]">Submitted to {submission.provider} for enrolment</p>
          <p className="mt-1 text-xs leading-5 text-[#102c3d]/58">Email notification sent to {submission.providerEmail} on {submission.submittedAt}.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#102c3d]/[0.05] bg-white px-3.5 py-3">
          <p className="max-w-md text-sm leading-6 text-[#102c3d]/58">Submit this approved application to the mapped provider and send the configured enrolment notification email.</p>
          <PlatformButton onClick={onSubmit} className={canSubmit ? "whitespace-nowrap" : "pointer-events-none whitespace-nowrap opacity-50"}>
            Submit to provider for enrolment
          </PlatformButton>
        </div>
      )}
      <details className="mt-3 rounded-xl border border-[#102c3d]/[0.05] bg-white px-3 py-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/44">View application detail</summary>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-[#102c3d]/64">
          <p>Department: {request.department}</p>
          <p>Reason: {request.note}</p>
          <p>Career goal: {request.careerGoal}</p>
          <p>Support required: {request.supportRequired}</p>
          <p className="text-xs leading-5 text-[#102c3d]/46">Decision notes: {request.decisionNotes}</p>
        </div>
      </details>
    </article>
  );
}

function ExpandablePathwayCard({ pathway, saved, onOpen, onSave }: { pathway: Pathway; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <article className="rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[0_8px_20px_rgba(16,44,61,0.03)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-[-0.01em] text-[#102c3d]">{pathway.title}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#7b6100] ring-1 ring-[#102c3d]/[0.05]">{pathway.status}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#159b8f]">{pathway.standard}</p>
          <p className="mt-2 line-clamp-1 text-sm text-[#102c3d]/58">{pathway.businessBenefit}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PlatformButton onClick={onOpen}>View detail</PlatformButton>
          <PlatformButton onClick={onSave} variant="soft">{saved ? "Saved" : "Save"}</PlatformButton>
        </div>
      </div>
      <details className="mt-3 rounded-xl bg-white px-3 py-2 ring-1 ring-[#102c3d]/[0.05]">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Pathway detail</summary>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-[#102c3d]/62 md:grid-cols-2">
          <InfoBox label="Who it is for" value={pathway.audience} />
          <InfoBox label="Learner benefit" value={pathway.learnerBenefit} />
          <InfoBox label="Commitment" value={pathway.commitment} />
          <InfoBox label="Next cohort" value={pathway.cohort} />
        </div>
      </details>
    </article>
  );
}

function RequestForm({ onSubmit, selectedPersona, activeApplication, onViewApplication }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; selectedPersona: EmployeePersona; activeApplication?: RequestItem; onViewApplication: () => void }) {
  const matchedOptions = matchedPathwaysForRole(selectedPersona.role);
  const defaultPathway = selectedPersona.name === "Daniel Carter" ? "Level 4 Data Analyst" : "Level 3 Team Leader";
  const defaultReason = selectedPersona.name === "Daniel Carter"
    ? "I want to deepen my data analysis, automation and AI confidence so I can improve reporting workflows."
    : "I want to build stronger manufacturing, team coordination and delivery confidence.";
  const defaultSupport = selectedPersona.name === "Daniel Carter"
    ? "Protected time for portfolio evidence and internal reporting projects."
    : "Support with study time and evidence collection.";
  const defaultTeam = selectedPersona.department === "Business Intelligence" ? "Data & Automation" : "Assembly Line A";

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      {activeApplication ? (
        <div className="md:col-span-2">
          <ActiveApplicationNotice application={activeApplication} onView={onViewApplication} />
        </div>
      ) : null}
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
        Selected apprenticeship
        <select name="pathway" defaultValue={defaultPathway} disabled={Boolean(activeApplication)} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:text-[#102c3d]/38 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
          {matchedOptions.map((pathway) => (
            <option key={`${pathway.title}-${pathway.standard}`} value={pathway.standard}>{pathway.standard}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
        Reason for interest
        <textarea name="reason" rows={3} disabled={Boolean(activeApplication)} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm leading-6 outline-none transition disabled:cursor-not-allowed disabled:text-[#102c3d]/38 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue={defaultReason} />
      </label>
      <Field name="careerGoal" label="Career goal" defaultValue={selectedPersona.careerGoal} />
      <Field name="role" label="Role" defaultValue={selectedPersona.role} />
      <Field name="site" label="Site" defaultValue={selectedPersona.site} />
      <Field name="department" label="Department" defaultValue={selectedPersona.department} />
      <Field name="manager" label="Line manager" defaultValue={selectedPersona.manager} />
      <Field name="name" label="Employee name" defaultValue={selectedPersona.name} />
      <Field name="team" label="Team" defaultValue={defaultTeam} />
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
        Any support required
        <textarea name="supportRequired" rows={3} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue={defaultSupport} />
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-3.5 text-sm leading-6 text-[#102c3d]/62 md:col-span-2">
        <input name="confirm" type="checkbox" required disabled={Boolean(activeApplication)} className="mt-1 h-4 w-4 accent-[#159b8f] disabled:cursor-not-allowed" />
        I confirm this expression of interest can be shared with my line manager and the apprenticeship lead for approval.
      </label>
      <div className="mt-1 flex flex-col gap-3 rounded-xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-3.5 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-[#102c3d]/54">This sends the application to your line manager.</p>
        <button disabled={Boolean(activeApplication)} className={`inline-flex h-10 w-fit items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${activeApplication ? "cursor-not-allowed bg-[#f2f5f3] text-[#102c3d]/38 ring-1 ring-[#102c3d]/[0.06]" : "bg-[#102c3d] text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)] hover:-translate-y-0.5 hover:bg-[#17394d]"}`}>Submit expression of interest</button>
      </div>
    </form>
  );
}

function RequestTracker({ request }: { request: RequestItem }) {
  const activeIndex = requestStages.indexOf(request.status);
  const declined = request.status.includes("Declined");
  return (
    <div className="grid gap-2">
      {publicStages.map((stage, index) => (
        <div key={stage} className="flex items-center gap-3 rounded-xl bg-[#f8fbfa] px-3.5 py-2.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!declined && index <= activeIndex ? "bg-[#159b8f]" : "bg-[#d9e8e2]"}`} />
          <span className={`text-sm font-medium ${!declined && index <= activeIndex ? "text-[#102c3d]" : "text-[#102c3d]/42"}`}>{stage}</span>
        </div>
      ))}
      {declined ? (
        <div className="rounded-xl bg-[#ffe4e9] px-3.5 py-2.5 text-sm font-semibold text-[#ad344e]">
          {request.status}: {request.decisionNotes}
        </div>
      ) : null}
    </div>
  );
}

function CompactApplicationTimeline({ request }: { request: RequestItem }) {
  const stages: Array<{ label: string; statuses: RequestStatus[] }> = [
    { label: "Submitted", statuses: ["Draft", "Submitted to Line Manager"] },
    { label: "Manager Review", statuses: ["Awaiting Manager Review", "Approved by Line Manager"] },
    { label: "Lead Approval", statuses: ["Submitted to Apprenticeship Lead", "Awaiting Final Approval"] },
    { label: "Enrolment", statuses: ["Approved for Enrolment"] },
  ];
  const activeStage = Math.max(0, stages.findIndex((stage) => stage.statuses.includes(request.status)));

  return (
    <div>
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex min-w-0 flex-1 items-center gap-2">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${index <= activeStage ? "bg-[#159b8f] text-white" : "bg-[#e6f0ec] text-[#102c3d]/42"}`}>{index + 1}</div>
            {index < stages.length - 1 ? <div className={`h-1 min-w-0 flex-1 rounded-full ${index < activeStage ? "bg-[#159b8f]" : "bg-[#e6f0ec]"}`} /> : null}
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="min-w-0">
            <p className={`text-xs font-semibold ${index <= activeStage ? "text-[#102c3d]" : "text-[#102c3d]/42"}`}>{stage.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-[#f8fbfa] px-4 py-3">
        <p className="text-sm font-semibold text-[#102c3d]">{request.pathway}</p>
        <p className="mt-1 text-sm text-[#102c3d]/58">{request.status}. {request.manager} reviewing.</p>
      </div>
    </div>
  );
}

function ActiveApplicationNotice({ application, onView }: { application: RequestItem; onView: () => void }) {
  return (
    <div className="mt-4 rounded-[1rem] border border-[#fff4bd] bg-[#fff9dc] p-4 shadow-[0_8px_18px_rgba(123,97,0,0.055)]">
      <p className="text-sm font-semibold text-[#102c3d]">You already have an active apprenticeship application in progress.</p>
      <p className="mt-1.5 text-sm leading-6 text-[#102c3d]/62">You can track this in My Applications.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{application.pathway}</span>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{application.status}</span>
        <button type="button" onClick={onView} className="rounded-full bg-[#102c3d] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#17394d]">View My Application</button>
      </div>
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
      <div className="grid gap-3">
        {mappings.map((row, index) => (
          <article key={row.roleFamily} className="rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[0_8px_20px_rgba(16,44,61,0.03)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-base font-semibold">{row.roleFamily}: {row.pathway}</h3>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{row.partner} - {row.deliveryModel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.05]">{row.fit}% fit</span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.05]">{row.status}</span>
              </div>
            </div>
            <details className="mt-3 rounded-xl bg-white px-3 py-3 ring-1 ring-[#102c3d]/[0.05]">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Provider mapping detail</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <InfoBox label="Standard" value={row.standard} />
                <InfoBox label="Alternative provider" value={row.alternativePartner} />
                <InfoBox label="Enrolment email" value={row.providerEmail} />
                <InfoBox label="Why recommended" value={row.whyRecommended} />
                <InfoBox label="Next action" value={row.nextAction} />
              </div>
            </details>
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

function ReportingPage({
  role,
  requests,
  mappings,
  statusCounts,
  learners,
  selectedSite,
  learnerSearch,
  onLearnerSearch,
}: {
  role: Role;
  requests: RequestItem[];
  mappings: ProviderMapping[];
  statusCounts: Record<string, number>;
  learners: Learner[];
  selectedSite: string;
  learnerSearch: string;
  onLearnerSearch: (query: string) => void;
}) {
  if (role === "Line Manager") return <LineManagerReports learners={learners} requests={requests} />;
  if (role === "Department Head") return <DepartmentHeadReports learners={learners} requests={requests} selectedSite={selectedSite} />;
  if (role === "Apprenticeship Lead") return <ApprenticeshipLeadReports learners={learners} requests={requests} mappings={mappings} />;

  return (
    <div className="grid gap-5">
      <ExecutiveSummary requests={requests} mappings={mappings} statusCounts={statusCounts} />
      <LearnersBySite selectedSite={selectedSite} learners={learners} learnerSearch={learnerSearch} onLearnerSearch={onLearnerSearch} />
    </div>
  );
}

function ReportActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {["Export PDF", "Export Excel", "Export PowerPoint"].map((label) => (
        <button key={label} className="h-9 rounded-full border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-3.5 text-xs font-semibold text-[#102c3d]/66 transition hover:bg-white hover:text-[#102c3d]">
          {label}
        </button>
      ))}
    </div>
  );
}

function ReportCard({ title, eyebrow, children, className = "" }: { title: string; eyebrow: string; children: ReactNode; className?: string }) {
  return (
    <article className={`min-w-0 rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_10px_26px_rgba(16,44,61,0.045)] ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">{eyebrow}</p>
      <h3 className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-[#102c3d]">{title}</h3>
      <div className="mt-3">{children}</div>
    </article>
  );
}

const chartPalette = ["#159b8f", "#df5f73", "#7b61ff", "#f0b429", "#102c3d", "#38a169"];

function YearOnYearParticipationChart({ compact = false }: { compact?: boolean }) {
  const rows = [
    { year: "2024", participation: 11, learners: 5, applications: 7, colour: "#7b61ff" },
    { year: "2025", participation: 18, learners: 9, applications: 13, colour: "#df5f73" },
    { year: "2026", participation: 24, learners: 12, applications: 16, colour: "#159b8f" },
  ];
  const max = Math.max(...rows.map((row) => row.participation), 1);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.year} className="rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#102c3d]/42">{row.year}</p>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.colour }} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#102c3d]">{row.participation}%</p>
            <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{row.learners} active learners, {row.applications} applications</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={`${row.year}-bar`} className="grid gap-1.5">
            <div className="flex justify-between gap-3 text-xs font-semibold text-[#102c3d]/58">
              <span>{row.year} team participation</span>
              <span>{row.participation}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#eef3f0]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(10, (row.participation / max) * 100)}%`, backgroundColor: row.colour }} />
            </div>
          </div>
        ))}
      </div>
      {!compact ? <p className="text-xs leading-5 text-[#102c3d]/48">Shows the share of Ryan Booth&apos;s direct-report team with an active apprenticeship or approved application, compared year on year.</p> : null}
    </div>
  );
}

function LineChart({
  series,
  secondary,
  labels,
  primaryLabel = "Current",
  secondaryLabel = "Previous",
}: {
  series: number[];
  secondary?: number[];
  labels?: string[];
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const points = toChartPoints(series);
  const secondaryPoints = secondary ? toChartPoints(secondary) : "";
  return (
    <div className="grid gap-3">
      <svg viewBox="0 0 320 170" role="img" aria-label="Trend chart" className="h-40 w-full overflow-visible">
        {[30, 70, 110].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="#102c3d" strokeOpacity="0.08" />)}
        {secondaryPoints ? <polyline points={secondaryPoints} fill="none" stroke="#df5f73" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" /> : null}
        <polyline points={points} fill="none" stroke="#159b8f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.split(" ").map((point) => {
          const [cx, cy] = point.split(",");
          return <circle key={point} cx={cx} cy={cy} r="3.2" fill="#159b8f" />;
        })}
        {labels ? labels.map((label, index) => {
          const x = (index / Math.max(labels.length - 1, 1)) * 300 + 10;
          return <text key={label} x={x} y="158" textAnchor="middle" className="fill-[#102c3d]/45 text-[9px] font-semibold">{label}</text>;
        }) : null}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs font-semibold text-[#102c3d]/58">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#159b8f]" />{primaryLabel}</span>
        {secondary ? <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#df5f73]" />{secondaryLabel}</span> : null}
      </div>
    </div>
  );
}

function toChartPoints(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 300 + 10;
    const y = 130 - ((value - min) / range) * 110;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function BarChart({ rows }: { rows: Array<[string, number]> }) {
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return (
    <div className="grid gap-3">
      {rows.map(([label, value], index) => (
        <div key={label}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs font-semibold text-[#102c3d]/58">
            <span>{label}</span>
            <span>{value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#eef3f0]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: chartPalette[index % chartPalette.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ rows, centerLabel }: { rows: Array<[string, number, string]>; centerLabel: string }) {
  let cursor = 0;
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const gradient = rows.map(([, value, color]) => {
    const start = cursor;
    cursor += (value / total) * 100;
    return `${color} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <div className="grid aspect-square w-[130px] place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="grid h-[80px] w-[80px] place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(16,44,61,0.06)]">
          <p className="text-sm font-semibold text-[#102c3d]">{centerLabel}</p>
        </div>
      </div>
      <div className="grid gap-2">
        {rows.map(([label, value, color]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-[#102c3d]/62"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
            <span className="font-semibold text-[#102c3d]">{value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ rows }: { rows: Array<[string, number]> }) {
  const size = 180;
  const center = size / 2;
  const radius = 72;
  const points = rows.map(([, value], index) => {
    const angle = (Math.PI * 2 * index) / rows.length - Math.PI / 2;
    const scale = value / 100;
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
  }).join(" ");

  return (
    <div className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)] md:items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-48 w-full">
        {[0.35, 0.7, 1].map((scale) => (
          <circle key={scale} cx={center} cy={center} r={radius * scale} fill="none" stroke="#102c3d" strokeOpacity="0.08" />
        ))}
        {rows.map(([,], index) => {
          const angle = (Math.PI * 2 * index) / rows.length - Math.PI / 2;
          return <line key={index} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="#102c3d" strokeOpacity="0.08" />;
        })}
        <polygon points={points} fill="#7b61ff" fillOpacity="0.16" stroke="#7b61ff" strokeWidth="3" />
      </svg>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 rounded-2xl bg-[#f8fbfa] px-3 py-2 text-xs font-semibold text-[#102c3d]/62">
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaugeChart({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 52;
  const colour = value >= 80 ? "#159b8f" : value >= 65 ? "#f0b429" : "#df5f73";
  return (
    <div className="grid place-items-center">
      <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
        <circle cx="70" cy="70" r="52" fill="none" stroke="#ecf6f2" strokeWidth="16" />
        <circle cx="70" cy="70" r="52" fill="none" stroke={colour} strokeWidth="16" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
      </svg>
      <div className="-mt-32 mb-12 text-center">
        <p className="text-3xl font-semibold tracking-[-0.03em] text-[#102c3d]">{value}%</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">Utilised</p>
      </div>
    </div>
  );
}

function ApprovalPipelineBars({ requests }: { requests: RequestItem[] }) {
  const columns: Array<[string, RequestStatus[]]> = [
    ["Manager review", ["Submitted to Line Manager", "Awaiting Manager Review"]],
    ["Lead approval", ["Approved by Line Manager", "Submitted to Apprenticeship Lead", "Awaiting Final Approval"]],
    ["Enrolment ready", ["Approved for Enrolment"]],
    ["Provider ready", ["Approved for Enrolment"]],
  ];
  const counts = columns.map(([label, statuses]) => ({
    label,
    value: requests.filter((request) => statuses.includes(request.status)).length,
  }));
  const max = Math.max(...counts.map((item) => item.value), 1);

  return (
    <div className="grid gap-3">
      {counts.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs font-semibold text-[#102c3d]/58">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#eef3f0]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(10, (item.value / max) * 100)}%`, backgroundColor: chartPalette[index % chartPalette.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalQueuePreview({ requests, emptyCopy }: { requests: RequestItem[]; emptyCopy: string }) {
  if (requests.length === 0) {
    return <p className="rounded-xl bg-[#f8fbfa] p-3.5 text-sm leading-6 text-[#102c3d]/56">{emptyCopy}</p>;
  }

  return (
    <div className="grid gap-2.5">
      {requests.slice(0, 3).map((request) => (
        <article key={request.id} className="rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#102c3d]">{request.name}</p>
              <p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{request.pathway}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#102c3d]/54 ring-1 ring-[#102c3d]/[0.05]">{request.status}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompactSkillsHeatmap({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Array<[string, number[]]>;
  columns: string[];
}) {
  return (
    <div className="rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{title}</p>
      <div className="mt-3 grid gap-2">
        <div className="grid grid-cols-[84px_repeat(4,minmax(0,1fr))] gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/36">
          <span>Team</span>
          {columns.map((column) => <span key={column} className="text-center">{column}</span>)}
        </div>
        {rows.map(([team, values]) => (
          <div key={team} className="grid grid-cols-[84px_repeat(4,minmax(0,1fr))] gap-2">
            <span className="self-center text-xs font-semibold text-[#102c3d]/62">{team}</span>
            {values.map((value, index) => {
              const tone = value >= 70 ? "bg-[#dff3ec] text-[#0b6f63]" : value >= 58 ? "bg-[#fff4bd] text-[#7b6100]" : "bg-[#ffe4e9] text-[#ad344e]";
              return <span key={`${team}-${columns[index]}`} className={`rounded-lg px-2 py-2 text-center text-[11px] font-semibold ${tone}`}>{value}</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ teams, skills }: { teams: string[]; skills: string[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.055]">
      <div className="grid bg-[#f8fbfa]" style={{ gridTemplateColumns: `150px repeat(${skills.length}, minmax(92px, 1fr))` }}>
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/36">Team</div>
        {skills.map((skill) => <div key={skill} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/36">{skill}</div>)}
      </div>
      {teams.map((team, teamIndex) => (
        <div key={team} className="grid border-t border-[#102c3d]/[0.05]" style={{ gridTemplateColumns: `150px repeat(${skills.length}, minmax(92px, 1fr))` }}>
          <div className="px-3 py-3 text-xs font-semibold text-[#102c3d]">{team}</div>
          {skills.map((skill, skillIndex) => {
            const value = 52 + ((teamIndex * 13 + skillIndex * 9) % 39);
            const tone = value > 78 ? "bg-[#dff3ec] text-[#0b6f63]" : value > 64 ? "bg-[#fff4bd] text-[#7b6100]" : "bg-[#ffe4e9] text-[#ad344e]";
            return <div key={`${team}-${skill}`} className={`m-1 rounded-xl px-3 py-2 text-center text-xs font-semibold ${tone}`}>{value}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

function WorkforceReadinessReport({ scope, score }: { scope: string; score: number }) {
  const tone = score >= 78 ? "Green" : score >= 62 ? "Amber" : "Red";
  return (
    <ReportCard eyebrow="Flagship metric" title={`${scope} Workforce Readiness Index`}>
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center">
        <ReadinessIndex label={scope} score={score} />
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Skills coverage", "82%", "+4 pts"],
            ["Succession readiness", "71%", "Amber"],
            ["Participation", "18%", "+1 pt"],
            ["Leadership pipeline", "74%", "Stable"],
            ["Future demand alignment", "79%", "Green"],
            ["Benchmark", "Top quartile", tone],
          ].map(([label, value, trend]) => (
            <MetricTile key={label} label={label} value={value} trend={trend} copy="Executive signal" />
          ))}
        </div>
      </div>
    </ReportCard>
  );
}

function LineManagerReports({ learners, requests }: { learners: Learner[]; requests: RequestItem[] }) {
  const teamLearners = learners.filter((learner) => learner.lineManager === "Ryan Booth").slice(0, 8);
  const teamRequests = requests.filter((request) => request.manager === "Ryan Booth");
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Reports" title="Line manager reporting" actions={<ReportActions />}>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile label="Applications" value={teamRequests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review").length} copy="Direct reports awaiting review" />
          <MetricTile label="Active learners" value={teamLearners.length} copy="Team programmes" />
          <MetricTile label="Participation" value="24%" copy="Team on programme" />
        </div>
      </PlatformPanel>
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportCard eyebrow="Participation" title="Team participation year on year"><YearOnYearParticipationChart compact /></ReportCard>
        <ReportCard eyebrow="Skills" title="Team skills profile"><RadarChart rows={[["Leadership", 68], ["Technical", 74], ["Data", 56], ["Commercial", 61], ["Digital", 59]]} /></ReportCard>
        <ReportCard eyebrow="Participation" title="Apprenticeship participation"><DonutChart centerLabel="24%" rows={[["On programme", 24, "#159b8f"], ["Not on programme", 76, "#ecf6f2"]]} /></ReportCard>
        <ReportCard eyebrow="Report" title="Team progress report"><ProgressReport learners={teamLearners} /></ReportCard>
      </div>
    </div>
  );
}

function DepartmentHeadReports({ learners, requests, selectedSite }: { learners: Learner[]; requests: RequestItem[]; selectedSite: string }) {
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Reports" title="Department reporting" actions={<ReportActions />}>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Participation" value="18%" copy="Department rate" />
          <MetricTile label="Active learners" value={learners.length} copy="In selected view" />
          <MetricTile label="Demand signal" value={requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review").length} copy="Applications in workflow" />
          <MetricTile label="Readiness" value={readinessScore(learners, requests)} copy="Index score" />
        </div>
      </PlatformPanel>
      <WorkforceReadinessReport scope={selectedSite === allSitesLabel ? "Department" : selectedSite} score={readinessScore(learners, requests)} />
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportCard eyebrow="Site view" title="Participation by site"><BarChart rows={[["York", 27], ["Leeds", 18], ["Manchester", 14], ["Bristol", 11]]} /></ReportCard>
        <ReportCard eyebrow="Trend" title="Workforce readiness trend"><LineChart series={[67, 68, 69, 70, 70, 72, 74, 75, 76, 78, 80, 82]} secondary={[61, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73]} labels={["2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4", "2026 Q1", "2026 Q2"]} primaryLabel="Portakabin" secondaryLabel="Benchmark" /></ReportCard>
        <ReportCard eyebrow="Skills" title="Skills gap analysis" className="xl:col-span-2"><Heatmap teams={["Manufacturing", "Hire", "Site Ops", "Digital"]} skills={["Lead", "Tech", "Data", "Digital"]} /></ReportCard>
        <ReportCard eyebrow="Distribution" title="Learner distribution"><DonutChart centerLabel="Portfolio" rows={[["Leadership", 34, "#159b8f"], ["Engineering", 26, "#102c3d"], ["Data", 18, "#df5f73"], ["Customer", 22, "#fff4bd"]]} /></ReportCard>
        <ReportCard eyebrow="Executive view" title="Department workforce report"><ExecutiveBrief rows={[["Participation", "18%", "Up 1 pt"], ["Completion risk", "Low", "2 learners"], ["Priority demand", "Leadership", "Next cohort"], ["Board signal", "Improving", "Green"]]} /></ReportCard>
      </div>
    </div>
  );
}

function ApprenticeshipLeadReports({ learners, requests, mappings }: { learners: Learner[]; requests: RequestItem[]; mappings: ProviderMapping[] }) {
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Reports" title="Apprenticeship lead reporting" actions={<ReportActions />}>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Final approvals" value={requests.filter((request) => request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval" || request.status === "Approved by Line Manager").length} copy="Awaiting decision" />
          <MetricTile label="Active learners" value={learners.length} copy="Organisation view" />
          <MetricTile label="Provider partners" value={mappings.length} copy="Mapped partners" />
          <MetricTile label="Levy utilisation" value="82%" copy="Forecast committed" />
        </div>
      </PlatformPanel>
      <WorkforceReadinessReport scope="Organisation" score={84} />
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportCard eyebrow="Funding" title="Levy utilisation"><GaugeChart value={82} /></ReportCard>
        <ReportCard eyebrow="Sites" title="Active learners by site"><BarChart rows={[["York", 16], ["Leeds", 8], ["Manchester", 7], ["Bristol", 5], ["London", 4]]} /></ReportCard>
        <ReportCard eyebrow="Providers" title="Provider performance"><BarChart rows={[["Completion", 86], ["Attendance", 91], ["Satisfaction", 88]]} /></ReportCard>
        <ReportCard eyebrow="Trend" title="Starts vs completions"><LineChart series={[3, 4, 6, 5, 7, 8, 9, 9, 10, 12, 11, 13]} secondary={[2, 3, 3, 4, 5, 6, 6, 7, 8, 8, 9, 10]} labels={["2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4", "2026 Q1", "2026 Q2"]} primaryLabel="Starts" secondaryLabel="Completions" /></ReportCard>
        <ReportCard eyebrow="Portfolio" title="Programme portfolio"><DonutChart centerLabel="42" rows={[["Leadership", 30, "#159b8f"], ["Procurement", 16, "#102c3d"], ["Data", 22, "#df5f73"], ["AI", 12, "#fff4bd"], ["Engineering", 20, "#9bd9d0"]]} /></ReportCard>
        <ReportCard eyebrow="Executive view" title="Workforce readiness report"><ExecutiveBrief rows={[["Organisation", "84", "Green"], ["Department", "78", "Green"], ["Site benchmark", "72", "Amber"], ["Risk focus", "Data", "Next quarter"]]} /></ReportCard>
      </div>
    </div>
  );
}

function ProgressReport({ learners }: { learners: Learner[] }) {
  const rows = learners.length ? learners : portakabinLearners.slice(0, 5);
  return (
    <div className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.055]">
      {rows.slice(0, 5).map((learner) => (
        <div key={`${learner.name}-${learner.programme}`} className="grid gap-2 border-b border-[#102c3d]/[0.05] px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1.2fr_0.7fr_0.8fr] md:items-center">
          <p className="font-semibold text-[#102c3d]">{learner.name}</p>
          <p className="text-[#102c3d]/60">{learner.programme}</p>
          <p className="font-semibold text-[#102c3d]">{learner.progress}%</p>
          <p className="text-[#102c3d]/58">{learner.status}</p>
        </div>
      ))}
    </div>
  );
}

function ExecutiveBrief({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="grid gap-3">
      {rows.map(([label, value, signal]) => (
        <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#102c3d]">{value}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.05]">{signal}</span>
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
    ["Bottlenecks reduced", `${Math.max(0, 8 - ((statusCounts["Submitted to Line Manager"] ?? 0) + (statusCounts["Awaiting Manager Review"] ?? 0) + (statusCounts["Approved by Line Manager"] ?? 0) + (statusCounts["Submitted to Apprenticeship Lead"] ?? 0) + (statusCounts["Awaiting Final Approval"] ?? 0)))}`],
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
        <button onClick={onSeed} className="rounded-full bg-[#102c3d] px-3.5 py-2 text-xs font-semibold text-white">Seed application</button>
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

async function requestLevyTateAI(payload: ApiLevyTateAiRequest): Promise<ApiLevyTateAiResponse> {
  try {
    const response = await fetch("/api/levytate-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`LevyTate AI request failed with status ${response.status}.`);
    }

    return (await response.json()) as ApiLevyTateAiResponse;
  } catch (error) {
    console.error("Falling back to deterministic LevyTate AI guidance.", error);
    return buildFallbackResponse(payload);
  }
}

function AIGuidanceCallout({ result }: { result: ApiLevyTateAiResponse }) {
  const sourceLabel = result.employeeGuidance
    ? result.source === "openai"
      ? "Good question"
      : "Here's what I'd suggest"
    : result.source === "openai"
      ? "Live GenAI guidance"
      : "Guided response";
  const showEmployeeExtras = Boolean(result.employeeGuidance || result.applicationWarning || result.managerMessageDraft);

  return (
    <div className="rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">{sourceLabel}</p>
        {!result.employeeGuidance && result.safetyNotes[0] ? <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-[#102c3d]/52 ring-1 ring-[#102c3d]/[0.06]">{result.safetyNotes[0]}</span> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#102c3d]/66">{result.assistantMessage}</p>
      {showEmployeeExtras && result.recommendedPathways.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {result.recommendedPathways.slice(0, 3).map((pathway) => (
            <span key={pathway.title} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#102c3d]/60 ring-1 ring-[#102c3d]/[0.06]">
              {pathway.title}
            </span>
          ))}
        </div>
      ) : null}
      {result.applicationWarning ? (
        <div className="mt-3 rounded-xl border border-[#102c3d]/[0.055] bg-white px-3.5 py-2.5 text-xs leading-5 text-[#102c3d]/58">
          {result.applicationWarning}
        </div>
      ) : null}
      {result.managerMessageDraft ? (
        <div className="mt-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-[#102c3d]/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Optional manager note</p>
          <p className="mt-1.5 text-sm leading-6 text-[#102c3d]/66">{result.managerMessageDraft}</p>
        </div>
      ) : null}
    </div>
  );
}

function AskLevyTateAIPage({
  role,
  selectedSite,
  selectedPersona,
  requests,
  onStatus,
  onNavigate,
  onCreateApplication,
  activeApplication,
}: {
  role: Role;
  selectedSite: string;
  selectedPersona: EmployeePersona;
  requests: RequestItem[];
  onStatus: (id: number, status: RequestStatus) => void;
  onNavigate: (section: SectionKey) => void;
  onCreateApplication: (draft: ApplicationDraft) => RequestItem | null;
  activeApplication?: RequestItem;
}) {
  if (role === "Employee") {
    return <EmployeeAIPage key={selectedPersona.name} selectedPersona={selectedPersona} requests={requests} activeApplication={activeApplication} onNavigate={onNavigate} onCreateApplication={onCreateApplication} />;
  }

  if (role === "Line Manager") {
    return <LineManagerAIPage requests={requests} selectedSite={selectedSite} onStatus={onStatus} onNavigate={onNavigate} />;
  }

  if (role === "Department Head") {
    return <DepartmentHeadAIPage requests={requests} selectedSite={selectedSite} onNavigate={onNavigate} />;
  }

  return <ApprenticeshipLeadAIPage selectedSite={selectedSite} />;
}

function EmployeeAIStepper({ current }: { current: "Ask" | "Explore" | "Plan" | "Act" }) {
  const steps: Array<"Ask" | "Explore" | "Plan" | "Act"> = ["Ask", "Explore", "Plan", "Act"];
  const activeIndex = steps.indexOf(current);

  return (
    <div className="mb-5 grid gap-2 rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-2.5 sm:grid-cols-4">
      {steps.map((step, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div key={step} className={`rounded-xl px-3 py-2.5 transition ${active ? "bg-white shadow-[0_8px_18px_rgba(16,44,61,0.055)]" : completed ? "bg-[#edf8f5]" : "bg-transparent"}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${active || completed ? "bg-[#159b8f] text-white" : "bg-[#102c3d]/[0.08] text-[#102c3d]/42"}`}>{index + 1}</span>
              <p className={`text-xs font-semibold ${active ? "text-[#102c3d]" : completed ? "text-[#0b6f63]" : "text-[#102c3d]/38"}`}>{step}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CurrentApplicationReminder({ application, onView }: { application: RequestItem; onView: () => void }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.055] bg-white px-3.5 py-3 text-sm leading-6 text-[#102c3d]/62">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p><span className="font-semibold text-[#102c3d]">Current application:</span> {application.pathway} is {application.status.toLowerCase()}.</p>
        <button type="button" onClick={onView} className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06] transition hover:text-[#102c3d]">View application</button>
      </div>
    </div>
  );
}

type EmployeeChatAction = {
  label: string;
  type: "compare" | "save" | "manager" | "view_application" | "start_application";
  target?: string;
};

type EmployeeChatMessage = {
  id: number;
  sender: "assistant" | "user";
  content: string;
  quickReplies?: string[];
  actions?: EmployeeChatAction[];
  result?: ApiLevyTateAiResponse | null;
};

type EmployeeConversationState = {
  turns: number;
  inferredIntent: "data_automation" | "management" | "application" | "general" | null;
  selectedInterest: string | null;
  selectedGoal: "data_role" | "current_role_automation" | "not_sure" | "management" | null;
  suggestedPathway: string | null;
  hasActiveApplication: boolean;
  nextRecommendedAction: string | null;
};

function createEmployeeConversationState(hasActiveApplication = false): EmployeeConversationState {
  return {
    turns: 0,
    inferredIntent: null,
    selectedInterest: null,
    selectedGoal: null,
    suggestedPathway: null,
    hasActiveApplication,
    nextRecommendedAction: null,
  };
}

function employeeChatFallback(
  selectedPersona: EmployeePersona,
  requests: RequestItem[],
  activeApplication: RequestItem | undefined,
  promptText: string,
) {
  return buildFallbackResponse({
    role: "Employee",
    selectedEmployee: selectedPersona.name,
    selectedSite: selectedPersona.site,
    currentSection: "Ask LevyTate AI",
    userMessage: promptText,
    conversationHistory: [{ role: "user", content: promptText }],
    employerContext: "Portakabin",
    contextData: {
      selectedPersona,
      activeApplication: activeApplication ?? null,
      requests,
    },
  }) as ApiLevyTateAiResponse;
}

function actionSetForEmployee(result: ApiLevyTateAiResponse | null, activeApplication?: RequestItem): EmployeeChatAction[] {
  if (activeApplication) {
    return [
      { label: "Compare with current application", type: "compare", target: activeApplication.pathway },
      { label: "Save this interest", type: "save", target: result?.employeeGuidance?.primary.programme },
      { label: "Prepare manager message", type: "manager", target: activeApplication.manager },
      { label: "View My Application", type: "view_application", target: "My Applications" },
    ];
  }

  return [
    { label: "Compare routes", type: "compare", target: result?.employeeGuidance?.primary.programme },
    { label: "Save this interest", type: "save", target: result?.employeeGuidance?.primary.programme },
    { label: "Start application", type: "start_application", target: result?.employeeGuidance?.primary.programme },
  ];
}

function handleEmployeeConversation(
  message: string,
  state: EmployeeConversationState,
  selectedPersona: EmployeePersona,
  requests: RequestItem[],
  activeApplication?: RequestItem,
): { state: EmployeeConversationState; assistant: EmployeeChatMessage; result: ApiLevyTateAiResponse | null } {
  const normalised = message.toLowerCase();
  const firstName = selectedPersona.name.split(" ")[0];
  const isDaniel = selectedPersona.name === "Daniel Carter";
  const nextState: EmployeeConversationState = { ...state, turns: state.turns + 1, hasActiveApplication: Boolean(activeApplication) };
  const nextIdBase = Date.now();

  const makeAssistant = (
    content: string,
    options?: {
      quickReplies?: string[];
      actions?: EmployeeChatAction[];
      result?: ApiLevyTateAiResponse | null;
    },
  ): EmployeeChatMessage => ({
    id: nextIdBase + 1,
    sender: "assistant",
    content,
    quickReplies: options?.quickReplies,
    actions: options?.actions,
    result: options?.result ?? null,
  });

  const wantsDataAutomation =
    normalised.includes("data") ||
    normalised.includes("automation") ||
    normalised.includes("automate") ||
    normalised.includes("ai");
  const wantsManagement =
    normalised.includes("manager") ||
    normalised.includes("management") ||
    normalised.includes("leader") ||
    normalised.includes("supervisor");
  const choseDataRole = normalised.includes("move into a data role") || normalised.includes("data-focused role");
  const choseCurrentAutomation = normalised.includes("current role") || normalised.includes("production role") || normalised.includes("use automation");
  const choseNotSure = normalised.includes("not sure");

  if ((state.inferredIntent === "data_automation" && (choseDataRole || choseCurrentAutomation || choseNotSure)) || wantsDataAutomation) {
    nextState.inferredIntent = "data_automation";
    nextState.selectedInterest = "Data and automation";

    if (!state.selectedGoal && !choseDataRole && !choseCurrentAutomation && !choseNotSure) {
      return {
        state: nextState,
        result: null,
        assistant: makeAssistant(
          "That's a good area to explore.\n\nDo you mean you'd like to move into a data-focused role in the future, or are you more interested in using data and automation in your current role?",
          {
            quickReplies: ["Move into a data role", "Use automation in my current role", "Not sure yet"],
          },
        ),
      };
    }

    const selectedGoal = choseDataRole ? "data_role" : choseCurrentAutomation ? "current_role_automation" : "not_sure";
    nextState.selectedGoal = selectedGoal;
    const promptForResult = selectedGoal === "data_role"
      ? "I want to move into a data role"
      : selectedGoal === "current_role_automation"
        ? "I want to use automation in my current role"
        : "I am interested in data and automation but not sure yet";
    const result = employeeChatFallback(selectedPersona, requests, activeApplication, promptForResult);
    nextState.suggestedPathway = result.employeeGuidance?.primary.programme ?? null;
    nextState.nextRecommendedAction = activeApplication ? "compare_current_application" : "compare_or_apply";

    const content = selectedGoal === "data_role"
      ? isDaniel
        ? "That makes sense. Because your current route is already data-focused, I'd treat your Level 4 Data Analyst application as the main route and use the conversation with your manager to shape it toward data leadership, reporting ownership and automation work."
        : "That makes sense. If the goal is a future data role, we can look at data routes as a future interest. For now, it would be worth checking whether your current role can give you enough data evidence before you move toward a formal data pathway."
      : selectedGoal === "current_role_automation"
        ? "That makes sense. In that case, we'd probably look at routes that support process improvement, digital confidence and better use of data in production rather than jumping straight to a full data analyst route.\n\nYou've already got an application in progress, so we wouldn't start another one right now, but we can compare this interest with your current application or prepare a note for your manager."
        : "That's completely fine. We can keep this as an exploration thread for now. A useful next step would be to decide whether this is about a future data role, or about using better data and digital tools in the work you already do.";

    return {
      state: nextState,
      result,
      assistant: makeAssistant(content, {
        result,
        actions: actionSetForEmployee(result, activeApplication),
        quickReplies: selectedGoal === "not_sure" ? ["Move into a data role", "Use automation in my current role", "Prepare a manager question"] : undefined,
      }),
    };
  }

  if (wantsManagement) {
    nextState.inferredIntent = "management";
    nextState.selectedInterest = "Leadership progression";
    nextState.selectedGoal = "management";
    const result = employeeChatFallback(selectedPersona, requests, activeApplication, "I want to become a manager");
    nextState.suggestedPathway = result.employeeGuidance?.primary.programme ?? null;
    nextState.nextRecommendedAction = activeApplication ? "compare_current_application" : "compare_or_apply";

    return {
      state: nextState,
      result,
      assistant: makeAssistant(
        isDaniel
          ? "That makes sense. Your current Level 4 Data Analyst application could still support a management route if your future role is data leadership rather than general people management.\n\nIf you want broader people or operational management, we'd compare that with a leadership route and prepare a clear manager conversation."
          : `That makes sense, ${firstName}. Are you thinking about leading people day to day, building technical confidence first, or using your current role as a step toward production supervision?`,
        {
          result,
          actions: actionSetForEmployee(result, activeApplication),
          quickReplies: isDaniel ? ["Compare routes", "Prepare manager conversation", "View current application"] : ["Lead people day to day", "Build technical confidence first", "Move toward production supervisor"],
        },
      ),
    };
  }

  if (normalised.includes("apply") || normalised.includes("application")) {
    nextState.inferredIntent = "application";
    nextState.selectedInterest = "Application support";
    const result = employeeChatFallback(selectedPersona, requests, activeApplication, message);
    nextState.suggestedPathway = result.employeeGuidance?.primary.programme ?? null;
    nextState.nextRecommendedAction = activeApplication ? "view_current_application" : "start_application";

    return {
      state: nextState,
      result,
      assistant: makeAssistant(
        activeApplication
          ? "I can help you think it through, but I can't start a second application while your current one is active.\n\nWhat we can do is review the current application, compare this interest with it, or prepare a short note for your manager."
          : "Yes. Before starting an application, let's make sure the route fits your goal and the support you need. Would you like to compare the route first, or start a draft application?",
        {
          result,
          actions: actionSetForEmployee(result, activeApplication),
          quickReplies: activeApplication ? ["View My Application", "Compare with current application", "Prepare manager message"] : ["Compare routes first", "Start application", "Ask another question"],
        },
      ),
    };
  }

  nextState.inferredIntent = "general";
  return {
    state: nextState,
    result: null,
    assistant: makeAssistant(
      `Let's work through it, ${firstName}. Is this mainly about a new role, getting better in your current role, or understanding what options exist at Portakabin?`,
      {
        quickReplies: ["A new role", "Develop in my current role", "Understand my options"],
      },
    ),
  };
}

function EmployeeInlineResult({ result }: { result: ApiLevyTateAiResponse }) {
  const guidance = result.employeeGuidance;
  if (!guidance) return null;

  return (
    <div className="mt-4 grid gap-3">
      {guidance.availableNow?.length ? (
        <div className="rounded-xl border border-[#102c3d]/[0.055] bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Available now</p>
          <div className="mt-2 grid gap-2">
            {guidance.availableNow.slice(0, 2).map((item) => (
              <div key={item.programme} className="rounded-lg bg-[#f8fbfa] px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#102c3d]">{item.programme}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0b6f63]">{item.fit}%</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/58">{item.why}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {guidance.futureInterests?.length ? (
        <div className="rounded-xl border border-[#102c3d]/[0.055] bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Worth discussing later</p>
          <div className="mt-2 grid gap-2">
            {guidance.futureInterests.slice(0, 3).map((item) => (
              <div key={item.programme} className="rounded-lg bg-[#fff9dc] px-3 py-2">
                <p className="text-sm font-semibold text-[#102c3d]">{item.programme}</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/58">{item.why}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApprenticeshipLeadAIPage({ selectedSite }: { selectedSite: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ApiLevyTateAiResponse | null>(null);
  const [history, setHistory] = useState<LevyTateConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchingOpen, setMatchingOpen] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<ProviderMatchingRequest | null>(null);
  const [matchingRequests, setMatchingRequests] = useState<ProviderMatchingRequest[]>([
    { id: 1, date: "11 Jun 2026", need: "Procurement Lead succession", programme: "Level 4 Commercial Procurement and Supply", sites: "York Head Office", learners: "3", status: "Under Review", delivery: "Blended", funding: "Levy", urgency: "Within 6 months" },
    { id: 2, date: "10 Jun 2026", need: "Data skills in Operations", programme: "Level 3 Data Technician", sites: "All sites", learners: "8", status: "Provider Shortlist Being Prepared", delivery: "Flexible", funding: "Unsure", urgency: "Within 3 months" },
  ]);
  const advice = result?.leadGuidance ?? null;

  async function runLeadQuery(promptText: string) {
    if (!promptText.trim()) return;

    setLoading(true);
    const nextHistory: LevyTateConversationMessage[] = [...history, { role: "user", content: promptText }];
    const aiResult = await requestLevyTateAI({
      role: "Apprenticeship Lead",
      selectedSite,
      currentSection: "Ask LevyTate AI",
      userMessage: promptText,
      conversationHistory: nextHistory,
      employerContext: "Portakabin",
    });
    setResult(aiResult);
    setHistory([...nextHistory, { role: "assistant", content: aiResult.assistantMessage }]);
    setSubmittedSummary(null);
    setMatchingOpen(false);
    setLoading(false);
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runLeadQuery(query);
  }

  async function applyPrompt(prompt: string) {
    setQuery(prompt);
    await runLeadQuery(prompt);
  }

  function submitProviderMatching(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!advice) return;
    const data = new FormData(event.currentTarget);
    const newRequest: ProviderMatchingRequest = {
      id: matchingRequests.length + 1,
      date: "11 Jun 2026",
      need: String(data.get("need") || advice.interpretedRole),
      programme: String(data.get("programme") || advice.recommendedStandards[0].name),
      sites: String(data.get("sites") || "All sites"),
      learners: String(data.get("learners") || "1"),
      status: "Submitted",
      delivery: String(data.get("delivery") || "Flexible"),
      funding: String(data.get("funding") || "Unsure"),
      urgency: String(data.get("urgency") || "Exploring"),
    };
    setMatchingRequests((current) => [newRequest, ...current]);
    setSubmittedSummary(newRequest);
    setMatchingOpen(false);
  }

  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="AI advisory workspace" title="Ask LevyTate AI">
        <GuidedAIStepper current={submittedSummary ? "Submitted" : matchingOpen ? "Application" : advice ? "Recommendation" : "Ask"} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form onSubmit={submitQuestion} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <p className="max-w-2xl text-sm leading-6 text-[#102c3d]/62">Tell LevyTate about your role, goals or interests and we will guide you towards the most relevant approved pathway.</p>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">
              Advisory question
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={5}
                placeholder="Which apprenticeship is suitable for a Maintenance Manager?"
                className="min-h-[132px] rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 py-3 text-base font-medium normal-case leading-7 tracking-normal text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/32 focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PlatformButton>{loading ? "Generating guidance..." : "Generate recommendation"}</PlatformButton>
              <button type="button" onClick={() => setQuery("")} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06] transition hover:text-[#102c3d]">Clear</button>
            </div>
          </form>

          <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_10px_26px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Example prompts</p>
            <div className="mt-3 grid gap-2">
              {advisoryPromptExamples.map((example) => (
                <button key={example.label} type="button" onClick={() => void applyPrompt(example.prompt)} className="rounded-xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-3.5 py-2.5 text-left text-sm font-semibold text-[#102c3d]/70 transition hover:border-[#159b8f]/25 hover:bg-white hover:text-[#102c3d]">
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PlatformPanel>

      {advice ? (
      <PlatformPanel eyebrow="Structured recommendation" title="Programme fit review">
        {result ? <div className="mb-4"><AIGuidanceCallout result={result} /></div> : null}
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="grid gap-3">
            <InfoBox label="Role" value={advice.interpretedRole} />
            <InfoBox label="Workforce need" value={advice.workforceNeed} />
            <div className="rounded-xl border border-[#159b8f]/[0.16] bg-[#edf8f5] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Funding route</p>
              <p className="mt-1.5 text-sm leading-6 text-[#102c3d]/68">{advice.fundingRoute}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Recommended standards</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {advice.recommendedStandards.map((standard) => (
                <article key={`${standard.level}-${standard.name}`} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4 shadow-[0_8px_20px_rgba(16,44,61,0.035)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#102c3d]/44">{standard.level}</p>
                      <h3 className="mt-1 text-base font-semibold leading-6 text-[#102c3d]">{standard.name}</h3>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.06]">{standard.suitability}%</span>
                  </div>
                  <p className="mt-3 text-sm leading-5 text-[#102c3d]/62">{standard.why}</p>
                  <div className="mt-3 grid gap-2">
                    <InfoBox label="Best for" value={standard.bestFor} />
                    <InfoBox label="Delivery considerations" value={standard.delivery} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Business rationale</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/66">{advice.businessRationale}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {advice.alternativeStandards.map((item) => (
                <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/58 ring-1 ring-[#102c3d]/[0.06]">{item}</span>
              ))}
            </div>
          </div>

          <div className="rounded-[1rem] border border-[#159b8f]/[0.18] bg-white p-4 shadow-[0_12px_28px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0b6f63]">Request Provider Matching</p>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/62">LevyTate can review this requirement and identify suitable training providers based on programme fit, location, delivery model and employer priorities.</p>
            <p className="mt-3 rounded-xl bg-[#f8fbfa] px-3 py-2 text-xs leading-5 text-[#102c3d]/58">{advice.providerMatchingPrompt}</p>
            <PlatformButton onClick={() => setMatchingOpen(true)} className="mt-4 w-full">Submit provider matching request</PlatformButton>
          </div>
        </div>
      </PlatformPanel>
      ) : null}

      {submittedSummary ? (
        <PlatformPanel eyebrow="Submitted" title="Provider matching request submitted">
          <p className="max-w-3xl text-sm leading-6 text-[#102c3d]/62">Your request has been sent to the LevyTate team. We will review the requirement and identify suitable provider options based on programme fit, delivery model, geography and employer priorities.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MetricTile label="Programme" value={submittedSummary.programme} />
            <MetricTile label="Sites" value={submittedSummary.sites} />
            <MetricTile label="Learners" value={submittedSummary.learners} />
            <MetricTile label="Status" value={submittedSummary.status} />
          </div>
        </PlatformPanel>
      ) : null}

      {advice ? <ProviderMatchingRequestsTable requests={matchingRequests} /> : null}

      {matchingOpen && advice ? (
        <ProviderMatchingModal
          advice={advice}
          query={query}
          onClose={() => setMatchingOpen(false)}
          onSubmit={submitProviderMatching}
        />
      ) : null}
    </div>
  );
}

function EmployeeAIPage({
  selectedPersona,
  requests,
  activeApplication,
  onNavigate,
  onCreateApplication,
}: {
  selectedPersona: EmployeePersona;
  requests: RequestItem[];
  activeApplication?: RequestItem;
  onNavigate: (section: SectionKey) => void;
  onCreateApplication: (draft: ApplicationDraft) => RequestItem | null;
}) {
  const examples = ["I want to become a team leader.", "I work in production. What apprenticeships suit me?", "I'm interested in data and automation.", "Which pathway would help me progress at Portakabin?", "Can you help me apply?"];
  const firstName = selectedPersona.name.split(" ")[0];
  const [query, setQuery] = useState("");
  const [conversationState, setConversationState] = useState<EmployeeConversationState>(() => createEmployeeConversationState(Boolean(activeApplication)));
  const [messages, setMessages] = useState<EmployeeChatMessage[]>(() => [
    {
      id: 1,
      sender: "assistant",
      content: `Hi ${firstName}. What would you like to explore today?`,
      quickReplies: ["I'm interested in data and automation.", "I want to become a manager.", "Can you help me apply?"],
    },
  ]);
  const [latestResult, setLatestResult] = useState<ApiLevyTateAiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<RequestItem | null>(null);
  const employeeApplications = requests.filter((request) => request.name === selectedPersona.name);
  const response = latestResult?.employeeGuidance ?? null;
  const employeeStep = confirmation || applicationOpen ? "Act" : latestResult || compareOpen || savedMessage ? "Plan" : messages.length > 1 ? "Explore" : "Ask";

  useEffect(() => {
    setConversationState(createEmployeeConversationState(Boolean(activeApplication)));
    setMessages([
      {
        id: 1,
        sender: "assistant",
        content: `Hi ${firstName}. What would you like to explore today?`,
        quickReplies: ["I'm interested in data and automation.", "I want to become a manager.", "Can you help me apply?"],
      },
    ]);
    setLatestResult(null);
    setSavedMessage("");
    setCompareOpen(false);
    setApplicationOpen(false);
    setConfirmation(null);
    setQuery("");
  }, [activeApplication, firstName, selectedPersona.name]);

  function handleChatAction(action: EmployeeChatAction) {
    if (action.type === "view_application") {
      onNavigate("My Applications");
      return;
    }

    if (action.type === "compare") {
      setCompareOpen(true);
      setSavedMessage("Route comparison noted in this conversation.");
      return;
    }

    if (action.type === "save") {
      setSavedMessage(`${action.target ?? "This interest"} saved for later.`);
      return;
    }

    if (action.type === "manager") {
      setSavedMessage("Manager conversation note prepared in the chat.");
      return;
    }

    if (action.type === "start_application") {
      if (!activeApplication) {
        setApplicationOpen(true);
      }
    }
  }

  function runEmployeeQuery(promptText: string) {
    if (!promptText.trim()) return;

    setLoading(true);
    const userMessage: EmployeeChatMessage = {
      id: Date.now(),
      sender: "user",
      content: promptText,
    };
    const turn = handleEmployeeConversation(promptText, conversationState, selectedPersona, requests, activeApplication);
    setConversationState(turn.state);
    setMessages((current) => [...current, userMessage, turn.assistant]);
    if (turn.result) {
      setLatestResult(turn.result);
    }
    setQuery("");
    setApplicationOpen(false);
    setConfirmation(null);
    setLoading(false);
  }

  function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runEmployeeQuery(query);
  }

  function applyPrompt(prompt: string) {
    setQuery(prompt);
    runEmployeeQuery(prompt);
  }

  function submitAIApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!response) return;
    const data = new FormData(event.currentTarget);
    const created = onCreateApplication({
      name: selectedPersona.name,
      role: selectedPersona.role,
      department: selectedPersona.department,
      team: selectedPersona.department === "Business Intelligence" ? "Data & Automation" : "Assembly Line A",
      site: selectedPersona.site,
      pathway: String(data.get("pathway") || response.primary.programme),
      manager: selectedPersona.manager,
      reason: String(data.get("reason") || response.primary.draftReason),
      careerGoal: String(data.get("careerGoal") || selectedPersona.careerGoal),
      supportRequired: String(data.get("supportRequired") || response.supportRequired),
    });
    if (created) {
      setConfirmation(created);
      setApplicationOpen(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="AI pathway assistant" title="Ask LevyTate AI">
        <EmployeeAIStepper current={employeeStep} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((message) => (
                <article key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[86%] rounded-[1rem] px-4 py-3 shadow-[0_8px_20px_rgba(16,44,61,0.04)] ${message.sender === "user" ? "bg-[#102c3d] text-white" : "bg-white text-[#102c3d] ring-1 ring-[#102c3d]/[0.055]"}`}>
                    <p className={`whitespace-pre-line text-sm leading-6 ${message.sender === "user" ? "text-white/92" : "text-[#102c3d]/68"}`}>{message.content}</p>
                    {message.sender === "assistant" && message.quickReplies?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.quickReplies.map((reply) => (
                          <button key={reply} type="button" onClick={() => applyPrompt(reply)} className="rounded-full bg-[#f8fbfa] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/64 ring-1 ring-[#102c3d]/[0.06] transition hover:bg-white hover:text-[#102c3d]">
                            {reply}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {message.sender === "assistant" && message.actions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button key={`${message.id}-${action.type}-${action.label}`} type="button" onClick={() => handleChatAction(action)} className="rounded-full bg-[#102c3d] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#17394d]">
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {message.sender === "assistant" && message.result ? <EmployeeInlineResult result={message.result} /> : null}
                  </div>
                </article>
              ))}
            </div>
            <form onSubmit={askQuestion} className="border-t border-[#102c3d]/[0.055] bg-white p-3">
              <label className="sr-only" htmlFor="employee-ai-message">Message Ask LevyTate AI</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="employee-ai-message"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask about a role, interest or next step"
                  className="min-h-11 flex-1 rounded-full border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 text-sm font-medium text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/34 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10"
                />
                <PlatformButton>{loading ? "Thinking..." : "Send"}</PlatformButton>
              </div>
            </form>
          </section>

          <aside className="grid content-start gap-3">
            <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_10px_26px_rgba(16,44,61,0.045)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Try asking</p>
              <div className="mt-3 grid gap-2">
                {examples.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => applyPrompt(prompt)} className="rounded-xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-3.5 py-2.5 text-left text-sm font-semibold text-[#102c3d]/70 transition hover:border-[#159b8f]/25 hover:bg-white hover:text-[#102c3d]">
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_10px_26px_rgba(16,44,61,0.045)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0b6f63]">Conversation state</p>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-[#102c3d]/62">
                <p><span className="font-semibold text-[#102c3d]">Intent:</span> {conversationState.inferredIntent ?? "Exploring"}</p>
                <p><span className="font-semibold text-[#102c3d]">Interest:</span> {conversationState.selectedInterest ?? "Not selected yet"}</p>
                <p><span className="font-semibold text-[#102c3d]">Goal:</span> {conversationState.selectedGoal ?? "Not selected yet"}</p>
                <p><span className="font-semibold text-[#102c3d]">Active application:</span> {conversationState.hasActiveApplication ? "Yes" : "No"}</p>
                <p><span className="font-semibold text-[#102c3d]">Next step:</span> {conversationState.nextRecommendedAction ?? "Ask a follow-up"}</p>
              </div>
              {activeApplication ? <div className="mt-3"><CurrentApplicationReminder application={activeApplication} onView={() => onNavigate("My Applications")} /></div> : null}
              {savedMessage ? <p className="mt-3 rounded-xl bg-[#edf8f5] px-3 py-2 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.08]">{savedMessage}</p> : null}
            </div>
          </aside>
        </div>
      </PlatformPanel>

      {applicationOpen && response && !activeApplication ? (
        <PlatformPanel eyebrow="AI prepared application" title="Review and submit to line manager">
          <form onSubmit={submitAIApplication} className="grid gap-4 md:grid-cols-2">
            <Field name="pathway" label="Selected apprenticeship" defaultValue={latestResult?.applicationPrefill?.selectedApprenticeship ?? response.primary.programme} />
            <Field name="careerGoal" label="Career goal" defaultValue={latestResult?.applicationPrefill?.careerGoal ?? selectedPersona.careerGoal} />
            <Field name="role" label="Role" defaultValue={selectedPersona.role} />
            <Field name="manager" label="Line manager" defaultValue={selectedPersona.manager} />
            <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
              Reason for interest
              <textarea name="reason" rows={4} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue={latestResult?.applicationPrefill?.reasonForInterest ?? response.primary.draftReason} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
              Any support required
              <textarea name="supportRequired" rows={3} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue={latestResult?.applicationPrefill?.supportRequired ?? response.supportRequired} />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-3.5 text-sm leading-6 text-[#102c3d]/62 md:col-span-2">
              <input type="checkbox" required className="mt-1 h-4 w-4 accent-[#159b8f]" />
              I confirm this expression of interest can be shared with my line manager and the apprenticeship lead.
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-3.5 md:col-span-2">
              <p className="text-sm leading-6 text-[#102c3d]/54">This sends the application to {selectedPersona.manager} for review.</p>
              <PlatformButton>Submit to Line Manager</PlatformButton>
            </div>
          </form>
        </PlatformPanel>
      ) : null}

      {confirmation ? (
        <PlatformPanel eyebrow="Application submitted" title="Application submitted to your Line Manager">
          <p className="text-sm leading-6 text-[#102c3d]/62">Your {confirmation.pathway} application has been submitted to {confirmation.manager} for review.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MetricTile label="Programme" value={confirmation.pathway} />
            <MetricTile label="Line manager" value={confirmation.manager} />
            <MetricTile label="Submitted date" value={formatShortDate(confirmation.submittedDate)} />
            <MetricTile label="Current status" value={confirmation.status} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <PlatformButton onClick={() => onNavigate("My Applications")}>View My Applications</PlatformButton>
            <PlatformButton variant="soft" onClick={() => onNavigate("Recommended Pathways")}>Explore more pathways</PlatformButton>
          </div>
        </PlatformPanel>
      ) : null}

      {response || confirmation ? (
      <PlatformPanel eyebrow="Recent activity" title="Current application">
        <div className="grid gap-3 md:grid-cols-2">
          {employeeApplications.length ? employeeApplications.slice(0, 4).map((request) => (
            <ApplicationCard key={request.id} request={request} scope="readonly" onStatus={() => undefined} />
          )) : <p className="rounded-xl bg-[#f8fbfa] p-4 text-sm text-[#102c3d]/58">No current application yet. Ask LevyTate AI can help you start one.</p>}
        </div>
      </PlatformPanel>
      ) : null}
    </div>
  );
}

function LineManagerAIPage({ requests, selectedSite, onStatus, onNavigate }: { requests: RequestItem[]; selectedSite: string; onStatus: (id: number, status: RequestStatus) => void; onNavigate: (section: SectionKey) => void }) {
  const examples = ["Should I approve Amelia's Team Leader application?", "Which members of my team could benefit from leadership development?", "Where are the biggest skills gaps in my team?", "What apprenticeship pathways suit my production team?"];
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ApiLevyTateAiResponse | null>(null);
  const [history, setHistory] = useState<LevyTateConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const teamRequests = requests.filter((request) => request.manager === "Ryan Booth");
  const pending = teamRequests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review");
  const target = pending[0];
  const response = result?.managerGuidance ?? null;

  async function runManagerQuery(promptText: string) {
    if (!promptText.trim()) return;

    setLoading(true);
    const nextHistory: LevyTateConversationMessage[] = [...history, { role: "user", content: promptText }];
    const aiResult = await requestLevyTateAI({
      role: "Line Manager",
      selectedSite,
      currentSection: "Ask LevyTate AI",
      userMessage: promptText,
      conversationHistory: nextHistory,
      employerContext: "Portakabin",
      contextData: {
        requests,
      },
    });
    setResult(aiResult);
    setHistory([...nextHistory, { role: "assistant", content: aiResult.assistantMessage }]);
    setLoading(false);
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runManagerQuery(query);
  }

  async function applyPrompt(prompt: string) {
    setQuery(prompt);
    await runManagerQuery(prompt);
  }

  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Manager AI support" title="Ask LevyTate AI">
        <GuidedAIStepper current={response ? "Recommendation" : "Ask"} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form onSubmit={askQuestion} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-sm leading-6 text-[#102c3d]/62">Get support developing your team and reviewing apprenticeship requests.</p>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} placeholder="Should I approve Amelia's Team Leader application?" className="mt-4 min-h-[112px] w-full rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 py-3 text-base font-medium leading-7 text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/32 focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
            <PlatformButton className="mt-4">{loading ? "Generating guidance..." : "Generate manager guidance"}</PlatformButton>
          </form>
          <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_10px_26px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Example prompts</p>
            <div className="mt-3 grid gap-2">
              {examples.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void applyPrompt(prompt)} className="rounded-xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-3.5 py-2.5 text-left text-sm font-semibold text-[#102c3d]/70 transition hover:border-[#159b8f]/25 hover:bg-white hover:text-[#102c3d]">{prompt}</button>
              ))}
            </div>
          </div>
        </div>
      </PlatformPanel>

      {response ? (
      <PlatformPanel eyebrow="AI recommendation" title={response.title}>
        {result ? <div className="mb-4"><AIGuidanceCallout result={result} /></div> : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-sm leading-6 text-[#102c3d]/64">{response.summary}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {response.signals.map(([label, value]) => <InfoBox key={label} label={label} value={value} />)}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <PlatformButton onClick={() => onNavigate("Applications to Review")}>Review application</PlatformButton>
              <PlatformButton variant="soft" onClick={() => target && onStatus(target.id, "Approved by Line Manager")}>Approve application</PlatformButton>
              <PlatformButton variant="coral" onClick={() => target && onStatus(target.id, "Declined by Line Manager")}>Decline with reason</PlatformButton>
              <button onClick={() => target && onStatus(target.id, "Draft")} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06] transition hover:text-[#102c3d]">Request more information</button>
              <button onClick={() => onNavigate("Team Skills")} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06] transition hover:text-[#102c3d]">View team skills gaps</button>
            </div>
          </div>
          <div className="grid gap-3">
            <MetricTile label="Applications awaiting review" value={pending.length} copy="Direct reports requiring manager approval." />
            <MetricTile label="Recommended team pathway" value="Level 3 Team Leader" copy="Best current fit for production progression." />
            <MetricTile label="Business benefit" value="Strong" copy="Leadership, handover and quality confidence." />
          </div>
        </div>
      </PlatformPanel>
      ) : null}
    </div>
  );
}

function DepartmentHeadAIPage({ requests, selectedSite, onNavigate }: { requests: RequestItem[]; selectedSite: string; onNavigate: (section: SectionKey) => void }) {
  const examples = ["What percentage of my department is on an apprenticeship?", "Which sites have the lowest apprenticeship participation?", "Where are our future skills risks?", "What should I include in a department workforce plan?"];
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ApiLevyTateAiResponse | null>(null);
  const [history, setHistory] = useState<LevyTateConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const response = result?.departmentGuidance ?? null;

  async function runDepartmentQuery(promptText: string) {
    if (!promptText.trim()) return;

    setLoading(true);
    const nextHistory: LevyTateConversationMessage[] = [...history, { role: "user", content: promptText }];
    const aiResult = await requestLevyTateAI({
      role: "Department Head",
      selectedSite,
      currentSection: "Ask LevyTate AI",
      userMessage: promptText,
      conversationHistory: nextHistory,
      employerContext: "Portakabin",
      contextData: {
        requests,
      },
    });
    setResult(aiResult);
    setHistory([...nextHistory, { role: "assistant", content: aiResult.assistantMessage }]);
    setExported(false);
    setLoading(false);
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runDepartmentQuery(query);
  }

  async function applyPrompt(prompt: string) {
    setQuery(prompt);
    await runDepartmentQuery(prompt);
  }

  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Workforce intelligence" title="Ask LevyTate AI">
        <GuidedAIStepper current={response ? "Recommendation" : "Ask"} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form onSubmit={askQuestion} className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-sm leading-6 text-[#102c3d]/62">Understand department capability, participation and workforce risk. This role has no individual approval actions.</p>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} placeholder="Where are our future skills risks?" className="mt-4 min-h-[112px] w-full rounded-xl border border-[#102c3d]/[0.09] bg-white px-4 py-3 text-base font-medium leading-7 text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/32 focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
            <PlatformButton className="mt-4">{loading ? "Generating insight..." : "Generate workforce insight"}</PlatformButton>
          </form>
          <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-4 shadow-[0_10px_26px_rgba(16,44,61,0.045)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Example prompts</p>
            <div className="mt-3 grid gap-2">
              {examples.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void applyPrompt(prompt)} className="rounded-xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-3.5 py-2.5 text-left text-sm font-semibold text-[#102c3d]/70 transition hover:border-[#159b8f]/25 hover:bg-white hover:text-[#102c3d]">{prompt}</button>
              ))}
            </div>
          </div>
        </div>
      </PlatformPanel>

      {response ? (
      <PlatformPanel eyebrow="Department insight" title={response.title}>
        {result ? <div className="mb-4"><AIGuidanceCallout result={result} /></div> : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[1rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
            <p className="text-sm leading-6 text-[#102c3d]/64">{response.summary}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {response.signals.map(([label, value]) => <InfoBox key={label} label={label} value={value} />)}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <PlatformButton onClick={() => onNavigate("Department Analytics")}>View department report</PlatformButton>
              <PlatformButton variant="soft" onClick={() => onNavigate("Site Breakdown")}>View site breakdown</PlatformButton>
              <PlatformButton variant="amber" onClick={() => onNavigate("Skills Map")}>View skills gap analysis</PlatformButton>
              <button onClick={() => setExported(true)} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06] transition hover:text-[#102c3d]">Export report</button>
            </div>
            {exported ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#102c3d]/[0.05]">Executive report prepared for demo export.</p> : null}
          </div>
          <div className="grid gap-3">
            <MetricTile label="Department participation" value="18%" copy="Percentage of department currently on programme." />
            <MetricTile label="Active learners" value="27" copy="Employees currently enrolled." />
            <MetricTile label="Future skills risks" value="4" copy="Capability areas requiring attention." />
          </div>
        </div>
      </PlatformPanel>
      ) : null}
    </div>
  );
}

function GuidedAIStepper({ current }: { current: "Ask" | "Recommendation" | "Application" | "Submitted" }) {
  const steps: Array<"Ask" | "Recommendation" | "Application" | "Submitted"> = ["Ask", "Recommendation", "Application", "Submitted"];
  const activeIndex = steps.indexOf(current);

  return (
    <div className="mb-5 grid gap-2 rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-2.5 sm:grid-cols-4">
      {steps.map((step, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div key={step} className={`rounded-xl px-3 py-2.5 transition ${active ? "bg-white shadow-[0_8px_18px_rgba(16,44,61,0.055)]" : completed ? "bg-[#edf8f5]" : "bg-transparent"}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${active || completed ? "bg-[#159b8f] text-white" : "bg-[#102c3d]/[0.08] text-[#102c3d]/42"}`}>{index + 1}</span>
              <p className={`text-xs font-semibold ${active ? "text-[#102c3d]" : completed ? "text-[#0b6f63]" : "text-[#102c3d]/38"}`}>{step}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProviderMatchingRequestsTable({ requests }: { requests: ProviderMatchingRequest[] }) {
  return (
    <PlatformPanel eyebrow="Commercial workflow" title="Recent provider matching requests">
      <div className="overflow-hidden rounded-[1rem] border border-[#102c3d]/[0.06]">
        <div className="hidden grid-cols-[0.75fr_1.25fr_1.3fr_1fr_0.6fr_1fr] gap-3 bg-[#f8fbfa] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38 xl:grid">
          <span>Date</span>
          <span>Role / need</span>
          <span>Recommended programme</span>
          <span>Sites</span>
          <span>Learners</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-[#102c3d]/[0.055] bg-white">
          {requests.map((request) => (
            <article key={request.id} className="grid gap-3 px-4 py-3 text-sm xl:grid-cols-[0.75fr_1.25fr_1.3fr_1fr_0.6fr_1fr] xl:items-center">
              <p className="text-[#102c3d]/56">{request.date}</p>
              <p className="font-semibold text-[#102c3d]">{request.need}</p>
              <p className="text-[#102c3d]/66">{request.programme}</p>
              <p className="text-[#102c3d]/58">{request.sites}</p>
              <p className="font-semibold text-[#102c3d]">{request.learners}</p>
              <span className="w-fit rounded-full bg-[#edf8f5] px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">{request.status}</span>
            </article>
          ))}
        </div>
      </div>
    </PlatformPanel>
  );
}

function ProviderMatchingModal({
  advice,
  query,
  onClose,
  onSubmit,
}: {
  advice: ApprenticeshipAdvice;
  query: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c3d]/30 px-5 py-8 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] bg-white p-5 shadow-[0_30px_90px_rgba(16,44,61,0.24)]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Provider matching request</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-[#102c3d]">Submit to LevyTate Team</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#f8faf4] px-4 py-2 text-sm font-semibold text-[#102c3d]">Close</button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field name="employer" label="Employer" defaultValue="Portakabin" />
          <Field name="need" label="Role or workforce need" defaultValue={advice.interpretedRole || query} />
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
            Recommended programme
            <select name="programme" defaultValue={`${advice.recommendedStandards[0].level} ${advice.recommendedStandards[0].name}`} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
              {advice.recommendedStandards.map((standard) => (
                <option key={`${standard.level}-${standard.name}`}>{standard.level} {standard.name}</option>
              ))}
            </select>
          </label>
          <Field name="learners" label="Number of learners" defaultValue="3" />
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#102c3d]/62">
            Preferred sites
            <select name="sites" defaultValue="York Head Office, Visitor Centre and UK Factory" className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
              <option>All sites</option>
              {portakabinSites.map((site) => (
                <option key={site}>{site}</option>
              ))}
            </select>
          </label>
          <ChoiceSelect name="delivery" label="Delivery preference" options={["Online", "Face-to-face", "Blended", "Flexible"]} defaultValue="Blended" />
          <ChoiceSelect name="funding" label="Funding position" options={["Levy", "Co-investment", "Unsure"]} defaultValue="Levy" />
          <ChoiceSelect name="urgency" label="Urgency" options={["Exploring", "Within 3 months", "Within 6 months", "Immediate"]} defaultValue="Within 3 months" />
          <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
            Additional notes
            <textarea name="notes" rows={3} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue="Please review programme fit, provider capability, delivery model suitability and employer priority matching." />
          </label>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#102c3d]/[0.05] bg-[#f8fbfa] p-3.5 md:col-span-2">
            <p className="text-sm leading-6 text-[#102c3d]/58">Creates a qualified provider matching request for LevyTate review.</p>
            <PlatformButton className="whitespace-nowrap">Send to LevyTate Team</PlatformButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function ChoiceSelect({ name, label, options, defaultValue }: { name: string; label: string; options: string[]; defaultValue: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#102c3d]/62">
      {label}
      <select name={name} defaultValue={defaultValue} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
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

function PathwayModal({ pathway, activeApplication, onClose, onStart }: { pathway: Pathway; activeApplication?: RequestItem; onClose: () => void; onStart: () => void }) {
  const details = [
    ["Overview", pathway.standard],
    ["Who it is for", pathway.audience],
    ["Business benefit", pathway.businessBenefit],
    ["Learner benefit", pathway.learnerBenefit],
    ["Duration", pathway.duration],
    ["Commitment", pathway.commitment],
    ["Approval route", "Employee application, line manager review, apprenticeship lead final approval."],
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
        {activeApplication ? (
          <ActiveApplicationNotice application={activeApplication} onView={onStart} />
        ) : (
          <button onClick={onStart} className="mt-8 rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white">Apply</button>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return <PlatformMetric label={label} value={value} copy={copy} />;
}

function MetricTile({
  label,
  value,
  copy,
  trend,
  actionLabel,
  tooltip,
  onClick,
}: {
  label: string;
  value: string | number;
  copy?: string;
  trend?: string;
  actionLabel?: string;
  tooltip?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[#102c3d]/50">{label}</p>
        {tooltip ? (
          <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#102c3d]/[0.06] text-[10px] font-semibold text-[#102c3d]/54 transition group-hover:bg-[#159b8f]/10 group-hover:text-[#0b6f63] group-focus-visible:bg-[#159b8f]/10 group-focus-visible:text-[#0b6f63]" aria-hidden="true">
            i
            <span className="pointer-events-none absolute right-0 top-7 z-20 hidden w-64 rounded-2xl border border-[#102c3d]/[0.08] bg-white p-3 text-left text-xs font-medium leading-5 text-[#102c3d]/66 shadow-[0_18px_40px_rgba(16,44,61,0.14)] group-hover:block group-focus-visible:block">
              {tooltip}
            </span>
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      {copy ? <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#102c3d]/58">{copy}</p> : null}
      {trend ? <p className="mt-2.5 text-xs font-semibold text-[#0b7d70]">{trend}</p> : null}
      {actionLabel ? <p className="mt-2.5 text-xs font-semibold text-[#102c3d]">{actionLabel} <span aria-hidden="true">-&gt;</span></p> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tooltip}
        className="group min-w-0 rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-3.5 text-left shadow-[0_8px_20px_rgba(16,44,61,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#159b8f]/25 hover:shadow-[0_14px_28px_rgba(16,44,61,0.075)] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/12"
      >
        {content}
      </button>
    );
  }

  return (
    <article title={tooltip} className="group min-w-0 rounded-[1rem] border border-[#102c3d]/[0.06] bg-white p-3.5 shadow-[0_8px_20px_rgba(16,44,61,0.04)]">
      {content}
    </article>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.05] bg-white px-3.5 py-2.5 shadow-[0_6px_16px_rgba(16,44,61,0.03)]">
      <p className="text-xs font-semibold text-[#102c3d]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#102c3d]/56">{value}</p>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.045]">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</span>
      <span className="text-sm font-semibold text-[#102c3d]">{value}</span>
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
      <input name={name} defaultValue={defaultValue} className="min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3.5 py-3 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
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

function sectionDescription(section: SectionKey) {
  const descriptions: Partial<Record<SectionKey, string>> = {
    "Recommended Pathways": "View apprenticeship pathways matched to your role, site and development goals.",
    "Recommended Programmes": "Review approved programmes matched to current workforce needs.",
    "Explore Pathways": "Browse approved apprenticeship routes available in the Portakabin environment.",
    "Career Pathfinder": "Explore potential progression routes and the apprenticeships that support them.",
    "Skills Analysis": "Understand skills gaps, competency strengths and recommended development actions.",
    "My Applications": "Track your one active apprenticeship application and the next approval step.",
    "Development Passport": "Review the learning evidence and development activity that supports your next move.",
    "My Team": "View direct report development status, active apprentices and progression signals.",
    "Team Skills": "Explore team skills coverage across leadership, technical, data, commercial and digital capability.",
    Requests: "Review apprenticeship applications and manage the approval workflow for your permitted scope.",
    "Applications to Review": "Review applications from direct reports and approve, decline or request more information.",
    Approvals: "Review apprenticeship applications awaiting line manager approval.",
    Enrolments: "Track learner movement through provider introduction, enrolment and live learning.",
    "Succession Planning": "Identify ready now, ready soon and high potential colleagues for critical roles.",
    "Department Overview": "See department headcount, learner activity, applications and completion signals.",
    "Department Analytics": "Review workforce readiness, participation and where future capability needs attention.",
    "Site Breakdown": "Compare learner activity, applications and readiness by site.",
    "Apprenticeship Participation": "Analyse department participation rates, programme usage and approved applications.",
    "Skills Map": "View capability coverage and priority skill gaps across your permitted workforce view.",
    "Department Demand": "Analyse development demand by team, department and capability area.",
    "Future Demand": "Plan future skills demand and predicted workforce capability shortages.",
    "Future Skills": "Plan future skills demand and priority development routes.",
    "Site Performance": "Compare participation, learner progress and readiness across Portakabin sites.",
    "Organisation Overview": "Monitor organisation-wide apprenticeship activity, learners, providers and readiness.",
    "Applications for Final Approval": "Review applications approved by line managers and make the final apprenticeship decision.",
    "Approved for Enrolment": "View applications approved for enrolment and ready for provider introduction.",
    "Levy Utilisation": "Review levy usage, available funding and planning opportunities.",
    "Levy Position": "Review levy usage, available funding and planning opportunities.",
    Forecast: "Review forecast apprenticeship demand and funding utilisation.",
    Providers: "Manage approved delivery partner mappings and provider performance.",
    "Approved Providers": "Manage approved delivery partner mappings and provider performance.",
    Performance: "Review provider fit, delivery performance and mapping actions.",
    Programmes: "Manage the approved apprenticeship programme catalogue.",
    Compliance: "Monitor evidence status, review dates and apprenticeship risk indicators.",
    "Site Adoption": "Compare site adoption, participation and Workforce Readiness Index signals.",
    Reporting: "Open the executive pack for workforce readiness, participation and investment decisions.",
    "Learners by Site": "Review learners, roles, programmes, status and progress by selected site.",
    "Ask LevyTate AI": "Use LevyTate's guided AI to identify the best next pathway, decision or workforce action.",
    "AI Assistant": "Generate capability plans and concise workforce development recommendations.",
    "User Management": "Manage users and stakeholder access across the platform.",
    "Role Management": "Configure stakeholder roles and inherited visibility.",
    "Permission Management": "Review permission groups and access boundaries.",
    "Provider Management": "Administer approved delivery partners and provider setup.",
    "Programme Catalogue": "Configure the internal apprenticeship catalogue.",
    "Employer Configuration": "Manage employer environment settings and branding.",
    "Site Configuration": "Maintain site records and site-level visibility.",
    "Audit Logs": "Review configuration, permission and workflow activity.",
    "Platform Analytics": "Analyse adoption, engagement and platform usage.",
    "System Settings": "Manage platform-level settings for the demo environment.",
    Admin: "Open platform administration controls and demo operating actions.",
  };

  return descriptions[section] ?? "Open the selected workforce development workspace.";
}

function filterBySite<T extends { site: string }>(items: T[], selectedSite: string) {
  if (selectedSite === allSitesLabel) return items;
  return items.filter((item) => item.site === selectedSite);
}

function isActiveApplicationStatus(status: RequestStatus) {
  return activeApplicationStatuses.includes(status);
}

function activeApplicationFor(requests: RequestItem[], employeeName: string) {
  return requests.find((request) => request.name === employeeName && isActiveApplicationStatus(request.status));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

function decisionNoteFor(status: RequestStatus) {
  const notes: Record<RequestStatus, string> = {
    Draft: "More information requested before this can progress.",
    "Submitted to Line Manager": "Submitted to line manager for review.",
    "Awaiting Manager Review": "Awaiting line manager review.",
    "Declined by Line Manager": "Declined by line manager. Reason captured in review notes.",
    "Approved by Line Manager": "Approved by line manager and ready for apprenticeship lead review.",
    "Submitted to Apprenticeship Lead": "Approved by line manager and sent for final approval.",
    "Awaiting Final Approval": "Awaiting final apprenticeship lead approval.",
    "Declined by Apprenticeship Lead": "Declined by apprenticeship lead. Programme fit to be reviewed.",
    "Approved for Enrolment": "Final approved and ready for provider introduction and enrolment.",
    Withdrawn: "Application withdrawn by the employee.",
    Completed: "Application workflow completed.",
    Cancelled: "Application cancelled.",
  };
  return notes[status];
}

function findProviderMappingForRequest(request: RequestItem, mappings: ProviderMapping[]) {
  const source = normaliseMatchText(`${request.pathway} ${request.department} ${request.role}`);

  return mappings.find((mapping) => {
    const pathway = normaliseMatchText(mapping.pathway);
    const family = normaliseMatchText(mapping.roleFamily);
    const standard = normaliseMatchText(mapping.standard);

    if (source.includes(pathway) || source.includes(family) || standard.includes(source)) return true;
    if ((source.includes("team leader") || source.includes("operations manager") || source.includes("leadership")) && pathway.includes("leadership")) return true;
    if ((source.includes("data") || source.includes("digital") || source.includes("analyst")) && pathway.includes("digital")) return true;
    if ((source.includes("customer") || source.includes("hire") || source.includes("sales")) && pathway.includes("customer")) return true;
    if ((source.includes("site") || source.includes("installation") || source.includes("construction")) && pathway.includes("installation")) return true;
    if ((source.includes("supply") || source.includes("procurement")) && pathway.includes("supply")) return true;
    return false;
  });
}

function normaliseMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readinessScore(learners: Learner[], requests: RequestItem[]) {
  if (learners.length === 0) return 52;
  const participation = Math.min(100, Math.round((learners.filter((learner) => learner.status === "Live learner" || learner.status === "Enrolment").length / learners.length) * 100));
  const completion = Math.round(learners.reduce((sum, learner) => sum + learner.progress, 0) / learners.length);
  const demandAlignment = Math.min(100, 58 + requests.length * 4);
  const leadershipPipeline = learners.filter((learner) => learner.programme === "Leadership & Management").length * 7 + 55;
  return Math.min(96, Math.max(42, Math.round((participation + completion + demandAlignment + leadershipPipeline) / 4)));
}

function countBy<T, K extends keyof T>(items: T[], key: K) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
