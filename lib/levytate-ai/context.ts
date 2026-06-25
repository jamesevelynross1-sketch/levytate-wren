import type { LevyTateAiRequest } from "@/lib/levytate-ai/response-schema";

const approvedPathways = [
  { title: "Manufacturing & Production", standard: "L3 Engineering Technician", deliveryPartner: "TEC Partnership", status: "Live" },
  { title: "Design & Technical", standard: "L3 Design and Draughting or L4 Construction Design", deliveryPartner: "TEC Partnership", status: "Ready" },
  { title: "Installation & Site Operations", standard: "L3 Construction Site Supervisor", deliveryPartner: "Leeds College of Building", status: "Live" },
  { title: "Hire, Sales & Customer Experience", standard: "L3 Customer Service Specialist or L4 Sales Executive", deliveryPartner: "Babington", status: "Live" },
  { title: "Procurement & Supply Chain", standard: "L3 Supply Chain Practitioner", deliveryPartner: "SR Apprenticeships", status: "Ready" },
  { title: "Digital, Data & AI", standard: "L3 Data Technician or L4 Business Analyst", deliveryPartner: "QA", status: "Ready" },
  { title: "Health, Safety & Compliance", standard: "L3 Safety, Health and Environment Technician", deliveryPartner: "Learning Skills Partnership", status: "Ready" },
  { title: "Operational Improvement & Capability", standard: "L4 Improvement Practitioner", deliveryPartner: "Babington", status: "Ready" },
];

const providerMappings = [
  { pathway: "Manufacturing & Production", standard: "L3 Engineering Technician / Engineering Maintenance Technician", partner: "TEC Partnership", alternativePartner: "North Lindsey College", deliveryModel: "Site based", status: "Live" },
  { pathway: "Design & Technical", standard: "L3 Engineering Design Technician", partner: "TEC Partnership", alternativePartner: "Leeds College of Building", deliveryModel: "Blended", status: "Ready" },
  { pathway: "Installation & Site Operations", standard: "L3 Construction Site Supervisor", partner: "Leeds College of Building", alternativePartner: "Learning Skills Partnership", deliveryModel: "Field based", status: "Live" },
  { pathway: "Hire, Sales & Customer Experience", standard: "L3 Customer Service Specialist", partner: "Babington", alternativePartner: "Remit Training", deliveryModel: "Online + workshops", status: "Live" },
  { pathway: "Procurement & Supply Chain", standard: "L3 Supply Chain Practitioner", partner: "SR Apprenticeships", alternativePartner: "Apprenticeship College", deliveryModel: "Hybrid", status: "Ready" },
  { pathway: "Digital, Data & AI", standard: "L3 Data Technician", partner: "QA", alternativePartner: "Apprentify", deliveryModel: "Remote + workshops", status: "Ready" },
  { pathway: "Operational Improvement & Capability", standard: "L4 Improvement Practitioner", partner: "Babington", alternativePartner: "SR Apprenticeships", deliveryModel: "Blended", status: "Ready" },
];

const productRules = [
  "LevyTate is a role-based apprenticeship and workforce development platform.",
  "Approval flow: Employee -> Line Manager -> Apprenticeship Lead -> Approved for Enrolment.",
  "Department Head is not part of the approval workflow and must not be given approval actions.",
  "Employees may only have one active apprenticeship application at a time.",
  "If an employee has an active application, they may still ask LevyTate AI questions but may not start or submit a second application.",
  "Approved delivery partners are shown as internal mapped providers, not as an open marketplace for employees.",
  "Do not say fully funded. Use potentially levy-funded or potentially funded through levy/co-investment.",
  "Generic management apprenticeships are being withdrawn from government funding for new starts. Do not recommend Level 3 Team Leader or Level 5 Operations Manager for new applications.",
  "If a user asks for management, ask what type of management they mean: people, operations, technical, project, commercial, data or customer management. Then recommend specialist role-led pathways.",
];

export function buildLevyTateAiContext(request: LevyTateAiRequest) {
  return {
    employer: request.employerContext,
    role: request.role,
    selectedSite: request.selectedSite,
    currentSection: request.currentSection,
    selectedEmployee: request.selectedEmployee ?? request.contextData?.selectedPersona?.name ?? "Not specified",
    persona: request.contextData?.selectedPersona ?? null,
    activeApplication: request.contextData?.activeApplication ?? null,
    visibleRequests: request.contextData?.requests?.slice(0, 12) ?? [],
    productRules,
    approvedPathways,
    providerMappings,
  };
}
