"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { LevyTateLogo, PlatformButton, PlatformMetric, PlatformPanel, PlatformTopBar, type PlatformNavSection } from "@/components/levytate-demo/PlatformShell";

type Role = "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead" | "Admin Console";
type DemandScenario = "Low" | "Medium" | "High";
type RequestStatus = "Draft" | "Submitted to Line Manager" | "Declined by Line Manager" | "Approved by Line Manager" | "Submitted to Apprenticeship Lead" | "Declined by Apprenticeship Lead" | "Approved for Enrolment";
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
  deliveryModel: string;
  fit: number;
  status: MappingStatus;
  nextAction: string;
  whyRecommended: string;
};

type EmployeePersona = {
  name: string;
  role: string;
  department: string;
  site: string;
  manager: string;
  careerGoal: string;
  recommendedPathways: number;
  applicationsInProgress: number;
  savedOpportunities: number;
  passportActivities: number;
  currentRange: string;
  nextRange: string;
  futureOpportunity: string;
  progression: string[];
  skills: Array<[string, number]>;
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
  | "AI Assistant"
  | "Admin";

const roles: Role[] = ["Employee", "Line Manager", "Department Head", "Apprenticeship Lead"];
const requestStages: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Declined by Line Manager", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Declined by Apprenticeship Lead", "Approved for Enrolment"];
const publicStages: RequestStatus[] = ["Draft", "Submitted to Line Manager", "Approved by Line Manager", "Submitted to Apprenticeship Lead", "Approved for Enrolment"];

const navSectionsByRole: Record<Role, PlatformNavSection[]> = {
  Employee: [
    { title: "Employee", items: ["Dashboard", "Recommended Pathways", "Career Pathfinder", "Skills Analysis", "My Applications", "Development Passport"] },
  ],
  "Line Manager": [
    { title: "Manager", items: ["Dashboard", "My Team", "Applications to Review", "Team Skills", "Team Development", "Reporting"] },
  ],
  "Department Head": [
    { title: "Department", items: ["Dashboard", "Department Analytics", "Site Breakdown", "Apprenticeship Participation", "Skills Map", "Future Demand", "Reporting"] },
  ],
  "Apprenticeship Lead": [
    { title: "Applications", items: ["Dashboard", "Applications for Final Approval", "Approved for Enrolment"] },
    { title: "Operations", items: ["Providers", "Programmes", "Compliance", "Site Adoption", "Reporting"] },
  ],
  "Admin Console": [
    { title: "Admin Console", items: ["Dashboard", "User Management", "Role Management", "Permission Management", "Provider Management", "Programme Catalogue"] },
    { title: "Configuration", items: ["Employer Configuration", "Site Configuration", "Audit Logs", "Platform Analytics", "System Settings"] },
  ],
};

const roleSectionMap: Record<Role, SectionKey[]> = {
  Employee: ["Recommended Pathways", "Career Pathfinder", "Skills Analysis", "My Applications"],
  "Line Manager": ["My Team", "Applications to Review", "Reporting"],
  "Department Head": ["Department Analytics", "Site Breakdown", "Reporting"],
  "Apprenticeship Lead": ["Applications for Final Approval", "Providers", "Reporting"],
  "Admin Console": ["User Management", "Provider Management", "Platform Analytics"],
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
    applicationsInProgress: 1,
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
    recommendedPathways: 6,
    applicationsInProgress: 2,
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
    { pathwayTitle: "Digital, Data & AI", standard: "Level 4 AI & Data Specialist", summary: "Apply AI, automation and data tools to operational reporting." },
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
  { id: 1, name: "Amelia Hart", role: "Production Team Member", department: "Manufacturing", team: "Assembly Line A", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Level 3 Team Leader", manager: "Ryan Booth", status: "Submitted to Line Manager", note: "I want to apply for the Level 3 Team Leader route so I can build confidence leading shift handovers and improvement work.", careerGoal: "Progress into a team leader role in production.", supportRequired: "Support with study time during shifts.", submittedDate: "2026-05-18", decisionNotes: "Awaiting Ryan Booth review." },
  { id: 12, name: "Daniel Carter", role: "Data & Reporting Analyst", department: "Business Intelligence", team: "Data & Automation", site: "York Head Office, Visitor Centre and UK Factory", pathway: "Level 4 Data Analyst", manager: "Sarah Mitchell", status: "Submitted to Line Manager", note: "I want to deepen my data analysis, insight generation and automation skills.", careerGoal: "Progress toward Head of Data & Automation.", supportRequired: "Protected time for portfolio evidence and internal reporting projects.", submittedDate: "2026-05-22", decisionNotes: "Awaiting Sarah Mitchell review." },
  { id: 13, name: "Daniel Carter", role: "Data & Reporting Analyst", department: "Business Intelligence", team: "Data & Automation", site: "York Head Office, Visitor Centre and UK Factory", pathway: "AI & Automation Workforce Programme", manager: "Sarah Mitchell", status: "Draft", note: "I am exploring how AI and automation could improve reporting workflows.", careerGoal: "Lead future automation and AI adoption across business intelligence.", supportRequired: "Needs final scope and manager input.", submittedDate: "2026-06-04", decisionNotes: "Draft not yet submitted." },
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
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [savedPathways, setSavedPathways] = useState<string[]>(["Manufacturing & Production", "Digital, Data & AI", "Leadership & Management"]);
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
  const selectedPersona = employeePersonas.find((persona) => persona.name === selectedEmployeeName) ?? employeePersonas[0];
  const employeeRequests = filteredRequests.filter((request) => request.name === selectedPersona.name);
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
      site: String(data.get("site") || (selectedSite === allSitesLabel ? "York Head Office, Visitor Centre and UK Factory" : selectedSite)),
      pathway,
      manager: String(data.get("manager") || "Line manager"),
      status: "Submitted to Line Manager",
      note: String(data.get("reason") || "New development request."),
      careerGoal: String(data.get("careerGoal") || "Progress into a future role."),
      supportRequired: String(data.get("supportRequired") || "None noted."),
      submittedDate: "2026-06-09",
      decisionNotes: "Submitted to line manager for review.",
    };

    setRequests((current) => [nextRequest, ...current]);
    setSuccess(true);
    setActiveSection("My Applications");
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
      <Sidebar role={role} activeSection={activeSection} onNavigate={openSection} />

      <div className="h-screen min-w-0 overflow-y-auto lg:ml-[296px]">
        <TopBar role={role} setRole={switchRole} selectedSite={selectedSite} selectedPersona={selectedPersona} onEmployee={switchEmployee} onSite={setSelectedSite} onOpenAdmin={() => switchRole("Admin Console")} />

        <div className="mx-auto w-full max-w-[1500px] space-y-7 px-5 py-7 sm:px-7 lg:px-9">
          {activeSection === "Dashboard" ? (
            <>
              <HeroPanel role={role} selectedSite={selectedSite} selectedPersona={selectedPersona} onEmployee={switchEmployee} onNavigate={openSection} />
              {selectedSite !== allSitesLabel ? <SiteSummary site={selectedSite} learners={filteredLearners} requests={filteredRequests} /> : null}
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
                onSubmit={handleSubmit}
                onOpenPathway={setSelectedPathway}
                onLearnerSearch={setLearnerSearch}
                selectedEmployeeRole={selectedEmployeeRole}
                onEmployeeRole={setSelectedEmployeeRole}
                onSavePathway={(title) => setSavedPathways((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]))}
                onStatus={setRequestStatus}
                onMove={moveRequest}
                onMapping={updateMapping}
                onScenario={setScenarioData}
                onSeed={seedRequest}
              />
            </>
          )}
        </div>
      </div>

      {selectedPathway && <PathwayModal pathway={selectedPathway} onClose={() => setSelectedPathway(null)} onStart={() => { setSelectedPathway(null); setActiveSection("My Applications"); }} />}
    </main>
  );
}

function Sidebar({ role, activeSection, onNavigate }: { role: Role; activeSection: SectionKey; onNavigate: (section: SectionKey) => void }) {
  const navSections = navSectionsByRole[role];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[296px] border-r border-[#102c3d]/[0.08] bg-white/95 px-4 py-5 shadow-[8px_0_32px_rgba(16,44,61,0.035)] backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex items-center px-2">
        <LevyTateLogo className="[--levytate-logo-size:2.65rem]" />
      </div>

      <div className="mt-5 rounded-2xl border border-[#102c3d]/[0.06] bg-[#f7faf6] px-4 py-3 text-[#102c3d]">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#102c3d]/40">Active client</p>
        <p className="mt-1 text-sm font-semibold tracking-tight">Portakabin</p>
        <p className="mt-1 text-xs font-medium text-[#102c3d]/48">{role}</p>
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#102c3d]/32">{section.title}</p>
            <div className="mt-2 grid gap-0.5">
              {section.items.map((item) => {
                const sectionKey = item as SectionKey;
                const active = activeSection === sectionKey;
                return (
                  <button
                    key={item}
                    onClick={() => onNavigate(sectionKey)}
                    className={`flex w-full items-center rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition duration-200 ${
                      active ? "bg-[#edf6f2] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/56 hover:bg-[#f7faf6] hover:text-[#102c3d]"
                    }`}
                  >
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
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap">
        <div className="flex h-10 min-w-[220px] flex-1 items-center rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm text-[#102c3d]/44 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">Search pathways, requests or teams</div>
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10 xl:max-w-[280px]">
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
        {role === "Employee" ? (
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10 xl:max-w-[280px]">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Demo Employee</span>
            <select
              value={selectedPersona.name}
              onChange={(event) => onEmployee(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102c3d]/74 outline-none"
              aria-label="Demo Employee"
            >
              {employeePersonas.map((persona) => (
                <option key={persona.name}>{persona.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex min-h-10 shrink-0 flex-wrap items-center rounded-[1.25rem] border border-[#102c3d]/[0.06] bg-[#edf5f1] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] 2xl:h-10 2xl:flex-nowrap 2xl:rounded-full">
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
  selectedSite,
  selectedPersona,
  onEmployee,
  onNavigate,
}: {
  role: Role;
  selectedSite: string;
  selectedPersona: EmployeePersona;
  onEmployee: (name: string) => void;
  onNavigate: (section: SectionKey) => void;
}) {
  const primaryAction = primaryDashboardAction(role);
  const metricCards = operatingSnapshotMetrics(role, selectedPersona);

  return (
    <section className="rounded-[1.45rem] border border-[#102c3d]/[0.06] bg-white/96 p-5 shadow-[0_18px_44px_rgba(16,44,61,0.05)] xl:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="w-fit rounded-full bg-[#fff4bd] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7b6100]">Standalone employer environment</p>
            {role === "Employee" ? (
              <label className="grid w-full max-w-[240px] gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">
                Demo Employee
                <select value={selectedPersona.name} onChange={(event) => onEmployee(event.target.value)} className="h-10 rounded-full border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-semibold normal-case tracking-normal text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
                  {employeePersonas.map((persona) => (
                    <option key={persona.name}>{persona.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.04] tracking-[-0.025em] text-[#102c3d] md:text-4xl">{role === "Employee" ? `Welcome ${selectedPersona.name}` : "Portakabin Apprenticeship Hub"}</h1>
          <p className="mt-2 text-sm font-semibold text-[#102c3d]/72">{role === "Employee" ? selectedPersona.role : "Internal apprenticeship and capability hub"}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#102c3d]/62">{role === "Employee" ? `${selectedPersona.department} at ${selectedPersona.site}. Career goal: ${selectedPersona.careerGoal}.` : "A focused LevyTate workspace for approved pathways, development demand and apprenticeship operations."}</p>
          <p className="mt-2 text-xs font-medium text-[#102c3d]/48">View: {selectedSite}</p>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Operating snapshot</p>
            <p className="text-xs font-medium text-[#102c3d]/44">{role}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {metricCards.map((metric) => (
              <DashboardSnapshotCard key={metric.label} metric={metric} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-[#102c3d]/[0.06] pt-4">
        <div className="flex flex-wrap gap-2.5">
          <PlatformButton onClick={() => onNavigate(primaryAction.target)}>
            {primaryAction.label}
          </PlatformButton>
          {roleSectionMap[role].map((section) => (
            <PlatformButton key={section} onClick={() => onNavigate(section)} variant="soft">
              {section}
            </PlatformButton>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardSnapshotCard({
  metric,
  onNavigate,
}: {
  metric: {
    label: string;
    value: string | number;
    copy: string;
    trend: string;
    tooltip: string;
    actionLabel: string;
    target: SectionKey;
  };
  onNavigate: (section: SectionKey) => void;
}) {
  return (
    <button
      type="button"
      title={metric.tooltip}
      onClick={() => onNavigate(metric.target)}
      className="group min-w-0 rounded-[1rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-3.5 text-left shadow-[0_8px_18px_rgba(16,44,61,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#159b8f]/20 hover:bg-white hover:shadow-[0_14px_30px_rgba(16,44,61,0.065)] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/12"
    >
      <p className="truncate text-[11px] font-medium text-[#102c3d]/48">{metric.label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">{metric.value}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#102c3d]/58">{metric.copy}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-semibold text-[#0b7d70]">{metric.trend}</p>
        <span className="shrink-0 text-[11px] font-semibold text-[#102c3d]">View</span>
      </div>
    </button>
  );
}

function operatingSnapshotMetrics(role: Role, selectedPersona: EmployeePersona): Array<{
  label: string;
  value: string | number;
  copy: string;
  trend: string;
  tooltip: string;
  actionLabel: string;
  target: SectionKey;
}> {
  const snapshots: Record<Role, Array<{ label: string; value: string | number; copy: string; trend: string; tooltip: string; actionLabel: string; target: SectionKey }>> = {
    Employee: [
      {
        label: "Recommended pathways",
        value: selectedPersona.recommendedPathways,
        copy: `Apprenticeships matched to ${selectedPersona.name.split(" ")[0]}'s role and career goals.`,
        trend: `${selectedPersona.role} profile`,
        tooltip: `Measures approved pathways matched to ${selectedPersona.name}'s current role, site and career goal. It matters because employees see relevant options without provider confusion.`,
        actionLabel: "Explore pathways",
        target: "Recommended Pathways",
      },
      {
        label: "Applications in progress",
        value: selectedPersona.applicationsInProgress,
        copy: "Requests currently progressing through approval.",
        trend: `${selectedPersona.manager} review`,
        tooltip: `Measures ${selectedPersona.name}'s active applications that are not yet final approved or declined. It matters because they can track what is moving and who has the next decision.`,
        actionLabel: "Track applications",
        target: "My Applications",
      },
      {
        label: "Saved opportunities",
        value: selectedPersona.savedOpportunities,
        copy: "Pathways shortlisted for future consideration.",
        trend: `${selectedPersona.savedOpportunities} shortlisted`,
        tooltip: `Measures pathways ${selectedPersona.name} has saved for later review. It matters because development planning can happen before a formal application is submitted.`,
        actionLabel: "View saved pathways",
        target: "Recommended Pathways",
      },
      {
        label: "Development passport",
        value: selectedPersona.passportActivities,
        copy: "Completed training activities and qualifications.",
        trend: `${selectedPersona.passportActivities} activities logged`,
        tooltip: `Measures completed learning evidence in ${selectedPersona.name}'s development passport. It matters because prior learning helps shape the right pathway and support plan.`,
        actionLabel: "View passport",
        target: "Development Passport",
      },
    ],
    "Line Manager": [
      {
        label: "Applications awaiting review",
        value: 4,
        copy: "Direct reports requiring manager approval.",
        trend: "Amelia Hart needs review",
        tooltip: "Measures applications from direct reports waiting for the line manager decision. It matters because manager approval is the first control point in the workflow.",
        actionLabel: "Review applications",
        target: "Applications to Review",
      },
      {
        label: "Active team learners",
        value: 12,
        copy: "Team members currently on programme.",
        trend: "+3 this quarter",
        tooltip: "Measures direct reports already enrolled on apprenticeship programmes. It matters because managers need to plan time, cover and coaching.",
        actionLabel: "View team learners",
        target: "My Team",
      },
      {
        label: "High potential employees",
        value: 5,
        copy: "Employees identified for future progression.",
        trend: "2 ready for leadership route",
        tooltip: "Measures team members flagged for progression based on role, performance signals and skills readiness. It matters because managers can build a stronger internal pipeline.",
        actionLabel: "Open team development",
        target: "Team Development",
      },
      {
        label: "Team skills gaps",
        value: 3,
        copy: "Critical capability gaps requiring development.",
        trend: "Leadership is priority",
        tooltip: "Measures team-level gaps in priority capability areas. It matters because apprenticeship demand should map to real operational need.",
        actionLabel: "View team skills",
        target: "Team Skills",
      },
    ],
    "Department Head": [
      {
        label: "Department participation",
        value: "18%",
        copy: "Percentage of department currently on programme.",
        trend: "Up from 17% after manager approvals",
        tooltip: "Measures the share of department employees enrolled on apprenticeships. It matters because department heads need participation trends, not individual approval actions.",
        actionLabel: "View department analytics",
        target: "Department Analytics",
      },
      {
        label: "Active learners",
        value: 27,
        copy: "Employees currently enrolled.",
        trend: "+4 this quarter",
        tooltip: "Measures active learners in the department. It matters because it shows development adoption and operational capacity impact.",
        actionLabel: "View participation",
        target: "Apprenticeship Participation",
      },
      {
        label: "Sites with learners",
        value: 6,
        copy: "Locations currently using apprenticeships.",
        trend: "+1 site this month",
        tooltip: "Measures the number of department locations with active learners. It matters because adoption should be visible across Portakabin sites.",
        actionLabel: "View site breakdown",
        target: "Site Breakdown",
      },
      {
        label: "Future skills risks",
        value: 4,
        copy: "Capability areas requiring attention.",
        trend: "Digital and leadership highest",
        tooltip: "Measures priority capability risks for the next planning cycle. It matters because department heads use this to plan demand, not approve individual requests.",
        actionLabel: "View skills demand",
        target: "Future Demand",
      },
    ],
    "Apprenticeship Lead": [
      {
        label: "Applications awaiting final approval",
        value: 7,
        copy: "Line-manager-approved requests ready for final apprenticeship decision.",
        trend: "Amelia appears here after manager approval",
        tooltip: "Measures applications that have passed manager review and need apprenticeship lead approval. It matters because this is the final internal decision before enrolment preparation.",
        actionLabel: "Review approval queue",
        target: "Applications for Final Approval",
      },
      {
        label: "Active learners",
        value: 48,
        copy: "Employees currently enrolled across Portakabin.",
        trend: "+12% this month",
        tooltip: "Measures all active learner records across the selected Portakabin view. It matters because it shows the scale of live apprenticeship adoption.",
        actionLabel: "View learners",
        target: "Learners by Site",
      },
      {
        label: "Provider partners",
        value: 6,
        copy: "Approved delivery partners mapped to Portakabin programmes.",
        trend: "3 live, 3 ready",
        tooltip: "Measures approved delivery partners in provider mappings. It matters because every pathway should have a delivery partner before launch.",
        actionLabel: "Manage providers",
        target: "Providers",
      },
      {
        label: "Levy utilisation",
        value: "82%",
        copy: "Forecast apprenticeship levy committed to approved activity.",
        trend: "+9% forecast this quarter",
        tooltip: "Measures forecast levy commitment across active learners, approved starts and planned cohorts. It matters because levy funding should support priority workforce capability.",
        actionLabel: "View levy reporting",
        target: "Levy Utilisation",
      },
    ],
    "Admin Console": [
      {
        label: "Total users",
        value: 824,
        copy: "User accounts available in the LevyTate platform.",
        trend: "+38 added this month",
        tooltip: "Measures all active and invited users in the platform. It matters because admins manage access, roles and adoption.",
        actionLabel: "Manage users",
        target: "User Management",
      },
      {
        label: "Active employers",
        value: 4,
        copy: "Employer environments currently configured.",
        trend: "All healthy",
        tooltip: "Measures configured employer environments in the platform. It matters because admins need tenant-level oversight.",
        actionLabel: "Open configuration",
        target: "Employer Configuration",
      },
      {
        label: "Programmes available",
        value: 42,
        copy: "Approved apprenticeship programmes available across environments.",
        trend: "+6 in catalogue",
        tooltip: "Measures available programmes in the platform catalogue. It matters because programme availability powers matching, mapping and approvals.",
        actionLabel: "View catalogue",
        target: "Programme Catalogue",
      },
      {
        label: "Platform health",
        value: "99.8%",
        copy: "Current platform availability and operational health.",
        trend: "No critical alerts",
        tooltip: "Measures uptime and platform service status for the demo environment. It matters because enterprise users expect reliable operations.",
        actionLabel: "Open settings",
        target: "System Settings",
      },
    ],
  };

  return snapshots[role];
}

function primaryDashboardAction(role: Role): { label: string; target: SectionKey } {
  const actions: Record<Role, { label: string; target: SectionKey }> = {
    Employee: { label: "Explore pathways", target: "Recommended Pathways" },
    "Line Manager": { label: "Review applications", target: "Applications to Review" },
    "Department Head": { label: "View department analytics", target: "Department Analytics" },
    "Apprenticeship Lead": { label: "Review approval queue", target: "Applications for Final Approval" },
    "Admin Console": { label: "Open admin console", target: "User Management" },
  };

  return actions[role];
}

function SiteSummary({ site, learners, requests }: { site: string; learners: Learner[]; requests: RequestItem[] }) {
  const programmes = new Set(learners.map((learner) => learner.programme));
  const risk = learners.filter((learner) => learner.progress < 25 && learner.status !== "New interest").length;
  const demand = topEntry(countBy([...learners.map((learner) => ({ programme: learner.programme })), ...requests.map((request) => ({ programme: request.pathway }))], "programme"));

  return (
    <PlatformPanel eyebrow="Site view" title={site}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Active learners" value={learners.length} />
        <MetricTile label="Pending applications" value={requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Approved by Line Manager" || request.status === "Submitted to Apprenticeship Lead").length} />
        <MetricTile label="Programmes in use" value={programmes.size} />
        <MetricTile label="Completion risk" value={risk} />
        <MetricTile label="Main pathway demand" value={demand || "No signal"} />
      </div>
    </PlatformPanel>
  );
}

function SectionHeader({ activeSection, role, selectedSite }: { activeSection: SectionKey; role: Role; selectedSite: string }) {
  return (
    <section className="rounded-[1.6rem] border border-[#102c3d]/[0.06] bg-white/96 p-6 shadow-[0_22px_60px_rgba(16,44,61,0.055)] xl:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="w-fit rounded-full bg-[#fff4bd] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7b6100]">{role}</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.025em] text-[#102c3d] md:text-4xl">{activeSection}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#102c3d]/62 md:text-base">{sectionDescription(activeSection)}</p>
        </div>
        <div className="w-fit rounded-2xl border border-[#102c3d]/[0.055] bg-[#f8fbfa] px-4 py-3 text-sm font-semibold text-[#102c3d]/66">
          View: {selectedSite}
        </div>
      </div>
    </section>
  );
}

function RoleDashboard({
  role,
  selectedPersona,
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
  onNavigate: (section: SectionKey) => void;
}) {
  return <DashboardSummaryGrid role={role} selectedPersona={selectedPersona} onNavigate={onNavigate} />;
}

function DashboardSummaryGrid({ role, selectedPersona, onNavigate }: { role: Role; selectedPersona: EmployeePersona; onNavigate: (section: SectionKey) => void }) {
  const cards: Record<Role, LaunchCardProps[]> = {
    Employee: [
      { title: "Recommended Pathways", value: selectedPersona.recommendedPathways, copy: `Role-matched apprenticeship routes for ${selectedPersona.name.split(" ")[0]}.`, action: "Explore", section: "Recommended Pathways" },
      { title: "Applications In Progress", value: selectedPersona.applicationsInProgress, copy: `Requests moving through ${selectedPersona.manager}'s review and lead approval.`, action: "Track", section: "My Applications" },
      { title: "Saved Opportunities", value: selectedPersona.savedOpportunities, copy: "Shortlisted routes for future consideration.", action: "Review", section: "Recommended Pathways" },
      { title: "Development Passport", value: selectedPersona.passportActivities, copy: "Completed learning and qualifications.", action: "Open", section: "Development Passport" },
    ],
    "Line Manager": [
      { title: "Applications Awaiting Review", value: 4, copy: "Direct reports needing manager approval.", action: "Review", section: "Applications to Review" },
      { title: "Active Team Learners", value: 12, copy: "Team members currently on programme.", action: "View team", section: "My Team" },
      { title: "High Potential Employees", value: 5, copy: "People ready for future progression.", action: "Plan", section: "Team Development" },
      { title: "Skills Gaps", value: 3, copy: "Priority capability gaps to address.", action: "Open", section: "Team Skills" },
    ],
    "Department Head": [
      { title: "Participation Rate", value: "18%", copy: "Current department apprenticeship participation.", action: "Analyse", section: "Department Analytics" },
      { title: "Active Learners", value: 27, copy: "Employees enrolled across the department.", action: "View", section: "Apprenticeship Participation" },
      { title: "Sites With Learners", value: 6, copy: "Locations currently using apprenticeships.", action: "Compare", section: "Site Breakdown" },
      { title: "Future Skills Risks", value: 4, copy: "Capability areas needing attention.", action: "Plan", section: "Future Demand" },
    ],
    "Apprenticeship Lead": [
      { title: "Awaiting Final Approval", value: 7, copy: "Manager-approved requests ready for final decision.", action: "Review", section: "Applications for Final Approval" },
      { title: "Active Learners", value: 48, copy: "Learners live across Portakabin.", action: "View", section: "Learners by Site" },
      { title: "Provider Partners", value: 6, copy: "Approved partners mapped to programmes.", action: "Manage", section: "Providers" },
      { title: "Levy Utilisation", value: "82%", copy: "Forecast levy committed to approved activity.", action: "Report", section: "Levy Utilisation" },
    ],
    "Admin Console": [
      { title: "Total Users", value: 824, copy: "Active and invited platform users.", action: "Manage", section: "User Management" },
      { title: "Active Employers", value: 4, copy: "Configured employer environments.", action: "Configure", section: "Employer Configuration" },
      { title: "Programmes Available", value: 42, copy: "Approved programmes in the catalogue.", action: "Open", section: "Programme Catalogue" },
      { title: "Platform Health", value: "99.8%", copy: "Availability and operational status.", action: "Settings", section: "System Settings" },
    ],
  };

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards[role].map((card) => (
        <DashboardLaunchCard key={card.title} {...card} onNavigate={onNavigate} />
      ))}
    </section>
  );
}

function DashboardLaunchCard({ title, value, copy, action, section, onNavigate }: LaunchCardProps & { onNavigate: (section: SectionKey) => void }) {
  return (
    <button onClick={() => onNavigate(section)} className="group min-h-[142px] rounded-[1.1rem] border border-[#102c3d]/[0.055] bg-white p-4 text-left shadow-[0_10px_24px_rgba(16,44,61,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#159b8f]/20 hover:shadow-[0_16px_34px_rgba(16,44,61,0.07)]">
      <p className="text-xs font-semibold text-[#102c3d]/48">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">{copy}</p>
      <span className="mt-3 inline-flex text-xs font-semibold text-[#0b7d70]">{action} -&gt;</span>
    </button>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function EmployeeDashboard({ employeeRequest, savedPathways, onNavigate }: { employeeRequest: RequestItem; savedPathways: string[]; onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
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
            <PlatformButton onClick={() => onNavigate("My Applications")}>Start new application</PlatformButton>
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
    <div className="grid gap-6">
      <PlatformPanel eyebrow="My team overview" title="Direct report development needs">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Team members" value={teamLearners.length} />
          <MetricTile label="Active apprentices" value={teamLearners.filter((learner) => learner.status === "Live learner").length} />
          <MetricTile label="Applications to review" value={teamApplications.filter((request) => request.status === "Submitted to Line Manager").length} />
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
          {teamApplications.filter((request) => request.status === "Submitted to Line Manager").slice(0, 4).map((request) => (
            <ApplicationCard key={request.id} request={request} scope="manager" onStatus={() => onNavigate("Applications to Review")} />
          ))}
        </div>
      </PlatformPanel>
    </div>
  );
}

function DepartmentHeadDashboard({ requests, learners, departmentCounts, selectedSite, onNavigate }: { requests: RequestItem[]; learners: Learner[]; departmentCounts: Record<string, number>; selectedSite: string; onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="grid gap-6">
      <PlatformPanel eyebrow="Department overview" title="Workforce capability and succession planning">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Headcount in view" value={learners.length} />
          <MetricTile label="Learners" value={learners.filter((learner) => learner.status === "Live learner").length} />
          <MetricTile label="Pending applications" value={requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Approved by Line Manager" || request.status === "Submitted to Apprenticeship Lead").length} />
          <MetricTile label="Completion rate" value="86%" />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ReadinessIndex label={selectedSite === allSitesLabel ? "Portakabin capability" : selectedSite} score={readinessScore(learners, requests)} />
          <InsightBars rows={Object.entries(departmentCounts).map(([label, value]) => [label, value])} />
        </div>
      </PlatformPanel>
      <div className="grid gap-6 xl:grid-cols-3">
        <StrategyPanel title="Future skills demand" items={["Digital reporting", "Site delivery confidence", "Supply chain resilience"]} action="Open future demand" onClick={() => onNavigate("Future Demand")} />
        <StrategyPanel title="Skills gaps" items={["Ready now: 6", "Ready soon: 11", "High potential: 14"]} action="Open skills map" onClick={() => onNavigate("Skills Map")} />
        <StrategyPanel title="Site breakdown" items={["York: 84/100", "Leeds: 72/100", "Manchester: 69/100"]} action="Compare sites" onClick={() => onNavigate("Site Breakdown")} />
      </div>
    </div>
  );
}

function ApprenticeshipLeadDashboard({ requests, learners, mappings, selectedSite, onNavigate }: { requests: RequestItem[]; learners: Learner[]; mappings: ProviderMapping[]; selectedSite: string; onNavigate: (section: SectionKey) => void }) {
  return (
    <div className="grid gap-6">
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
      <div className="grid gap-6 xl:grid-cols-3">
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
    <article className="rounded-[1.35rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Workforce Readiness Index</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#102c3d]">{label}</p>
          <p className="mt-2 text-5xl font-semibold tracking-[-0.04em] text-[#102c3d]">{score}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClass}`}>{tone}</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#102c3d]/54">Blends skills coverage, succession readiness, participation, pipeline strength and completion signals.</p>
    </article>
  );
}

function StrategyPanel({ title, items, action, onClick }: { title: string; items: string[]; action: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-[1.25rem] border border-[#102c3d]/[0.06] bg-white p-5 text-left shadow-[0_12px_30px_rgba(16,44,61,0.04)] transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(16,44,61,0.08)]">
      <p className="text-base font-semibold text-[#102c3d]">{title}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <p key={item} className="rounded-2xl bg-[#f8fbfa] px-3 py-2 text-xs font-medium text-[#102c3d]/62">{item}</p>
        ))}
      </div>
      <span className="mt-4 inline-flex rounded-full bg-[#102c3d] px-4 py-2 text-xs font-semibold text-white">{action}</span>
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
    <button onClick={() => onNavigate(section)} className="group min-h-[198px] rounded-[1.25rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-5 text-left shadow-[0_8px_22px_rgba(16,44,61,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#159b8f]/20 hover:bg-white hover:shadow-[0_18px_42px_rgba(16,44,61,0.08)]">
      <p className="text-xs font-semibold text-[#102c3d]/48">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      <p className="mt-3 min-h-[44px] text-sm leading-6 text-[#102c3d]/58">{copy}</p>
      <span className="mt-5 inline-flex h-9 items-center rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.06] transition group-hover:bg-[#102c3d] group-hover:text-white group-hover:ring-[#102c3d]">{action}</span>
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
  onSubmit,
  onOpenPathway,
  onLearnerSearch,
  onEmployeeRole,
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
  employeeRequests: RequestItem[];
  selectedPersona: EmployeePersona;
  selectedSite: string;
  learners: Learner[];
  learnerSearch: string;
  selectedEmployeeRole: string;
  scenario: DemandScenario;
  success: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPathway: (pathway: Pathway) => void;
  onLearnerSearch: (query: string) => void;
  onEmployeeRole: (role: string) => void;
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
          <>
            {role === "Employee" ? <h3 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-[#102c3d]">Recommended Development Routes</h3> : null}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visiblePathways.map((pathway) => (
                <PathwayCard key={`${pathway.title}-${pathway.standard}`} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
              ))}
            </div>
          </>
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
        <div className="mb-5 rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4">
          <p className="text-sm font-semibold text-[#102c3d]">{selectedPersona.name}</p>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{selectedPersona.role} to {selectedPersona.careerGoal}</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ProgressionPath roles={selectedPersona.progression} />
          <div className="grid gap-3">
            {selectedPersona.skills.map(([label, value]) => (
              <SkillBar key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Development Passport") {
    return (
      <PlatformPanel eyebrow="Development passport" title="Completed learning and evidence record">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricTile label="Completed activities" value={selectedPersona.passportActivities} />
          <MetricTile label="Current role" value={selectedPersona.role} />
          <MetricTile label="Target role" value={selectedPersona.careerGoal} />
          <MetricTile label="Future opportunity" value={selectedPersona.futureOpportunity} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <MetricCard label="Current range" value={selectedPersona.currentRange} copy="Role benchmark" />
          <MetricCard label="Next range" value={selectedPersona.nextRange} copy="Estimated progression benchmark" />
          <MetricCard label="Manager" value={selectedPersona.manager} copy="Development sponsor" />
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "My Applications") {
    return (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <PlatformPanel eyebrow="Expression of interest" title="Start expression of interest">
          <RequestForm key={selectedPersona.name} onSubmit={onSubmit} selectedPersona={selectedPersona} />
          {success && <p className="mt-4 rounded-2xl bg-[#eff8f4] px-4 py-3 text-sm font-semibold text-[#102c3d]">Application submitted to line manager.</p>}
        </PlatformPanel>
        <PlatformPanel eyebrow="Application status" title={`${selectedPersona.name.split(" ")[0]}'s applications`}>
          {employeeRequests.length ? (
            <div className="grid gap-5">
              {employeeRequests.map((request) => (
                <div key={request.id} className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#102c3d]">{request.pathway}</p>
                      <p className="mt-1 text-xs font-medium text-[#102c3d]/50">{request.manager} is the current line manager</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{request.status}</span>
                  </div>
                  <RequestTracker request={request} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-5">
              <p className="text-sm font-semibold text-[#102c3d]">No applications for this site view</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{`${selectedPersona.name}'s applications remain private to their own profile and selected site context.`}</p>
            </div>
          )}
        </PlatformPanel>
      </section>
    );
  }

  if (activeSection === "Applications to Review" || activeSection === "Requests") {
    const managerRequests = requests.filter((request) => request.status === "Submitted to Line Manager");
    return (
      <PlatformPanel eyebrow="Line manager review" title="Applications to review">
        <div className="grid gap-4 lg:grid-cols-2">
          {managerRequests.map((request) => (
            <ApplicationCard key={request.id} request={request} scope="manager" onStatus={onStatus} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "My Team") {
    return (
      <PlatformPanel eyebrow="My team" title="Team development status">
        <TeamMemberList learners={learners.slice(0, 12)} />
      </PlatformPanel>
    );
  }

  if (activeSection === "Approvals") {
    const managerRequests = requests.filter((request) => request.status === "Submitted to Line Manager");
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-3">
              {selectedPersona.skills.map(([label, value]) => (
                <SkillBar key={label} label={label} value={value} />
              ))}
            </div>
            <div className="grid gap-3">
              <MetricCard label="Recommended routes" value={selectedPersona.recommendedPathways} copy="Matched to role and career goal" />
              <MetricCard label="Career goal" value={selectedPersona.careerGoal} copy="Target progression pathway" />
              <MetricCard label="Manager" value={selectedPersona.manager} copy="Development sponsor" />
            </div>
          </div>
        </PlatformPanel>
      );
    }

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
            <MetricCard label="Pending applications" value={requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Approved by Line Manager" || request.status === "Submitted to Apprenticeship Lead").length} copy="No approval action required" />
            <MetricCard label="Approved applications" value={requests.filter((request) => request.status === "Approved for Enrolment").length} copy="Ready for enrolment" />
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
            <ReadinessIndex key={site} label={site} score={[84, 72, 69][index]} />
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pathways.map((pathway) => (
            <PathwayCard key={pathway.title} pathway={pathway} saved={savedPathways.includes(pathway.title)} onOpen={() => onOpenPathway(pathway)} onSave={() => onSavePathway(pathway.title)} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Applications for Final Approval") {
    const leadRequests = requests.filter((request) => request.status === "Submitted to Apprenticeship Lead" || request.status === "Approved by Line Manager");
    return (
      <PlatformPanel eyebrow="Apprenticeship lead approval" title="Applications for final approval">
        <div className="grid gap-4 lg:grid-cols-2">
          {leadRequests.map((request) => (
            <ApplicationCard key={request.id} request={request} scope="lead" onStatus={onStatus} />
          ))}
        </div>
      </PlatformPanel>
    );
  }

  if (activeSection === "Approved for Enrolment") {
    return (
      <PlatformPanel eyebrow="Final approved" title="Approved for enrolment">
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.filter((request) => request.status === "Approved for Enrolment").map((request) => (
            <ApplicationCard key={request.id} request={request} scope="readonly" onStatus={onStatus} />
          ))}
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

  if (activeSection === "Enrolments") {
    return (
      <PlatformPanel eyebrow="Enrolments" title="Learner progress">
        <Kanban requests={requests} onMove={onMove} compact />
      </PlatformPanel>
    );
  }

  if (["User Management", "Role Management", "Permission Management", "Employer Configuration", "Site Configuration", "Audit Logs", "System Settings", "Admin"].includes(activeSection)) {
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

function DashboardGuide({ role }: { role: Role }) {
  return (
    <PlatformPanel eyebrow="Launchpad" title="Select a card or sidebar item to open detail">
      <p className="max-w-3xl text-sm leading-6 text-[#102c3d]/58">{dashboardGuide(role)}</p>
    </PlatformPanel>
  );
}

function ApplicationCard({ request, scope, onStatus }: { request: RequestItem; scope: "manager" | "lead" | "readonly"; onStatus: (id: number, status: RequestStatus) => void }) {
  const currentApprover = request.status === "Submitted to Line Manager" ? request.manager : request.status === "Submitted to Apprenticeship Lead" || request.status === "Approved by Line Manager" ? "Apprenticeship Lead" : "None";
  const actionRequired = request.status === "Submitted to Line Manager" ? "Line manager decision" : request.status === "Submitted to Apprenticeship Lead" || request.status === "Approved by Line Manager" ? "Final approval" : "No action";

  return (
    <article className="rounded-[1.2rem] border border-[#102c3d]/[0.055] bg-[#f8fbfa] p-4 shadow-[0_8px_22px_rgba(16,44,61,0.035)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{request.name}</h3>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/60">{request.role} - {request.team}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#102c3d]/56 ring-1 ring-[#102c3d]/[0.05]">{request.status}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoBox label="Programme" value={request.pathway} />
        <InfoBox label="Site" value={request.site} />
        <InfoBox label="Department" value={request.department} />
        <InfoBox label="Submitted date" value={formatShortDate(request.submittedDate)} />
        <InfoBox label="Current approver" value={currentApprover} />
        <InfoBox label="Action required" value={actionRequired} />
      </div>
      <div className="mt-4 rounded-2xl border border-[#102c3d]/[0.045] bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/38">Application detail</p>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/64">{request.note}</p>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/64">Career goal: {request.careerGoal}</p>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/64">Support required: {request.supportRequired}</p>
        <p className="mt-2 text-xs leading-5 text-[#102c3d]/46">Decision notes: {request.decisionNotes}</p>
      </div>
      {scope !== "readonly" ? (
        <div className="mt-4 flex flex-wrap gap-2">
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

function RequestForm({ onSubmit, selectedPersona }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; selectedPersona: EmployeePersona }) {
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
    <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
        Selected apprenticeship
        <select name="pathway" defaultValue={defaultPathway} className="min-w-0 rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3.5 text-sm outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10">
          {matchedOptions.map((pathway) => (
            <option key={`${pathway.title}-${pathway.standard}`} value={pathway.standard}>{pathway.standard}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#102c3d]/62 md:col-span-2">
        Reason for interest
        <textarea name="reason" rows={3} className="min-w-0 rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3.5 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue={defaultReason} />
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
        <textarea name="supportRequired" rows={3} className="min-w-0 rounded-2xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-4 py-3.5 text-sm leading-6 outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" defaultValue={defaultSupport} />
      </label>
      <label className="flex items-start gap-3 rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-4 text-sm leading-6 text-[#102c3d]/62 md:col-span-2">
        <input name="confirm" type="checkbox" required className="mt-1 h-4 w-4 accent-[#159b8f]" />
        I confirm this expression of interest can be shared with my line manager and the apprenticeship lead for approval.
      </label>
      <div className="mt-1 flex flex-col gap-4 rounded-2xl border border-[#102c3d]/[0.045] bg-[#f8fbfa] p-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-[#102c3d]/54">This sends the application to your line manager.</p>
        <PlatformButton className="w-fit px-5 py-2.5 text-sm">Submit expression of interest</PlatformButton>
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
        <div key={stage} className="flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-4 py-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!declined && index <= activeIndex ? "bg-[#159b8f]" : "bg-[#d9e8e2]"}`} />
          <span className={`text-sm font-medium ${!declined && index <= activeIndex ? "text-[#102c3d]" : "text-[#102c3d]/42"}`}>{stage}</span>
        </div>
      ))}
      {declined ? (
        <div className="rounded-2xl bg-[#ffe4e9] px-4 py-3 text-sm font-semibold text-[#ad344e]">
          {request.status}: {request.decisionNotes}
        </div>
      ) : null}
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
    <article className={`min-w-0 rounded-[1.25rem] border border-[#102c3d]/[0.055] bg-white p-5 shadow-[0_12px_32px_rgba(16,44,61,0.045)] ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">{eyebrow}</p>
      <h3 className="mt-1.5 text-base font-semibold leading-6 tracking-[-0.01em] text-[#102c3d]">{title}</h3>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function LineChart({ series, secondary }: { series: number[]; secondary?: number[] }) {
  const points = toChartPoints(series);
  const secondaryPoints = secondary ? toChartPoints(secondary) : "";
  return (
    <svg viewBox="0 0 320 150" role="img" aria-label="Trend chart" className="h-44 w-full overflow-visible">
      {[30, 70, 110].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="#102c3d" strokeOpacity="0.08" />)}
      {secondaryPoints ? <polyline points={secondaryPoints} fill="none" stroke="#df5f73" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" /> : null}
      <polyline points={points} fill="none" stroke="#159b8f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((point) => {
        const [cx, cy] = point.split(",");
        return <circle key={point} cx={cx} cy={cy} r="3.2" fill="#159b8f" />;
      })}
    </svg>
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
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs font-semibold text-[#102c3d]/58">
            <span>{label}</span>
            <span>{value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#ecf6f2]">
            <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
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
      <div className="grid aspect-square w-[150px] place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="grid h-[92px] w-[92px] place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(16,44,61,0.06)]">
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
        <polygon points={points} fill="#159b8f" fillOpacity="0.2" stroke="#159b8f" strokeWidth="3" />
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
  return (
    <div className="grid place-items-center">
      <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
        <circle cx="70" cy="70" r="52" fill="none" stroke="#ecf6f2" strokeWidth="16" />
        <circle cx="70" cy="70" r="52" fill="none" stroke="#159b8f" strokeWidth="16" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
      </svg>
      <div className="-mt-32 mb-12 text-center">
        <p className="text-4xl font-semibold tracking-[-0.03em] text-[#102c3d]">{value}%</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/40">Utilised</p>
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
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
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
  return (
    <div className="grid gap-5">
      <PlatformPanel eyebrow="Reports" title="Line manager reporting" actions={<ReportActions />}>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile label="Applications" value={requests.filter((request) => request.status === "Submitted to Line Manager").length} copy="Awaiting review" />
          <MetricTile label="Active learners" value={teamLearners.length} copy="Team programmes" />
          <MetricTile label="Participation" value="24%" copy="Team on programme" />
        </div>
      </PlatformPanel>
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportCard eyebrow="Trend" title="Team development trend"><LineChart series={[5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 12, 12]} /></ReportCard>
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
          <MetricTile label="Pending" value={requests.filter((request) => request.status === "Submitted to Line Manager").length} copy="Applications in approval" />
          <MetricTile label="Readiness" value={readinessScore(learners, requests)} copy="Index score" />
        </div>
      </PlatformPanel>
      <WorkforceReadinessReport scope={selectedSite === allSitesLabel ? "Department" : selectedSite} score={readinessScore(learners, requests)} />
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportCard eyebrow="Site view" title="Participation by site"><BarChart rows={[["York", 27], ["Leeds", 18], ["Manchester", 14], ["Bristol", 11]]} /></ReportCard>
        <ReportCard eyebrow="Trend" title="Workforce readiness trend"><LineChart series={[67, 68, 69, 70, 70, 72, 74, 75, 76, 78, 80, 82]} /></ReportCard>
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
          <MetricTile label="Final approvals" value={requests.filter((request) => request.status === "Submitted to Apprenticeship Lead" || request.status === "Approved by Line Manager").length} copy="Awaiting decision" />
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
        <ReportCard eyebrow="Trend" title="Starts vs completions"><LineChart series={[3, 4, 6, 5, 7, 8, 9, 9, 10, 12, 11, 13]} secondary={[2, 3, 3, 4, 5, 6, 6, 7, 8, 8, 9, 10]} /></ReportCard>
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
    ["Bottlenecks reduced", `${Math.max(0, 8 - ((statusCounts["Submitted to Line Manager"] ?? 0) + (statusCounts["Approved by Line Manager"] ?? 0) + (statusCounts["Submitted to Apprenticeship Lead"] ?? 0)))}`],
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
        <button onClick={onStart} className="mt-8 rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white">Apply</button>
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
      <p className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      {copy ? <p className="mt-2 text-xs leading-5 text-[#102c3d]/58">{copy}</p> : null}
      {trend ? <p className="mt-3 text-xs font-semibold text-[#0b7d70]">{trend}</p> : null}
      {actionLabel ? <p className="mt-3 text-xs font-semibold text-[#102c3d]">{actionLabel} <span aria-hidden="true">-&gt;</span></p> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tooltip}
        className="group min-w-0 rounded-[1.1rem] border border-[#102c3d]/[0.055] bg-white p-4 text-left shadow-[0_10px_24px_rgba(16,44,61,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#159b8f]/25 hover:shadow-[0_16px_34px_rgba(16,44,61,0.075)] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/12"
      >
        {content}
      </button>
    );
  }

  return (
    <article title={tooltip} className="group min-w-0 rounded-[1.1rem] border border-[#102c3d]/[0.055] bg-white p-4 shadow-[0_10px_24px_rgba(16,44,61,0.04)]">
      {content}
    </article>
  );
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

function dashboardGuide(role: Role) {
  const copy: Record<Role, string> = {
    Employee: "This dashboard is intentionally focused on pathways, saved options and starting an application.",
    "Line Manager": "This dashboard keeps approvals and team capability signals separate from operational admin.",
    "Department Head": "This dashboard is a planning view for demand, skills gaps, priority roles and forecast demand.",
    "Apprenticeship Lead": "This dashboard launches the core operating areas without showing dense tables by default.",
    "Admin Console": "This dashboard is reserved for platform administration, configuration and audit activity.",
  };
  return copy[role];
}

function sectionDescription(section: SectionKey) {
  const descriptions: Partial<Record<SectionKey, string>> = {
    "Recommended Pathways": "View apprenticeship pathways matched to your role, site and development goals.",
    "Recommended Programmes": "Review approved programmes matched to current workforce needs.",
    "Explore Pathways": "Browse approved apprenticeship routes available in the Portakabin environment.",
    "Career Pathfinder": "Explore potential progression routes and the apprenticeships that support them.",
    "Skills Analysis": "Understand skills gaps, competency strengths and recommended development actions.",
    "My Applications": "Track your apprenticeship applications from submission through final approval.",
    "Development Passport": "Review completed learning, qualifications, CPD activity and internal training.",
    "My Team": "View direct report development status, active apprentices and progression signals.",
    "Team Skills": "Explore team skills coverage across leadership, technical, data, commercial and digital capability.",
    Requests: "Review apprenticeship applications and manage the approval workflow for your permitted scope.",
    "Applications to Review": "Review applications from direct reports and approve, decline or request more information.",
    Approvals: "Review apprenticeship applications awaiting line manager approval.",
    Enrolments: "Track learner movement through provider introduction, enrolment and live learning.",
    "Succession Planning": "Identify ready now, ready soon and high potential colleagues for critical roles.",
    "Department Overview": "See department headcount, learner activity, applications and completion signals.",
    "Department Analytics": "Review department participation, active learners, pending applications and readiness signals.",
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
    Reporting: "Open executive reporting, learner visibility and platform performance summaries.",
    "Learners by Site": "Review learners, roles, programmes, status and progress by selected site.",
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

function topEntry(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value));
}

function decisionNoteFor(status: RequestStatus) {
  const notes: Record<RequestStatus, string> = {
    Draft: "More information requested before this can progress.",
    "Submitted to Line Manager": "Submitted to line manager for review.",
    "Declined by Line Manager": "Declined by line manager. Reason captured in review notes.",
    "Approved by Line Manager": "Approved by line manager and ready for apprenticeship lead review.",
    "Submitted to Apprenticeship Lead": "Approved by line manager and sent for final approval.",
    "Declined by Apprenticeship Lead": "Declined by apprenticeship lead. Programme fit to be reviewed.",
    "Approved for Enrolment": "Final approved and ready for provider introduction and enrolment.",
  };
  return notes[status];
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
