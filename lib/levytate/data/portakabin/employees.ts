import type { EmployeePersona, Learner } from '@/lib/levytate/domain';

export const employeeRoleOptions = [
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

export const employeePersonas: EmployeePersona[] = [
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

export const employeeRolePathwayMap: Record<string, Array<{ pathwayTitle: string; standard: string; summary: string }>> = {
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

export const advisoryPromptExamples = [
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

export const portakabinLearners: Learner[] = [
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


