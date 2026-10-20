export const demoPerspectiveOptions = [
  {
    id: "apprenticeship_lead",
    role: "Apprenticeship Lead",
    label: "Apprenticeship Lead",
    description: "Employer operations, assessments, approvals and Insights.",
  },
  {
    id: "line_manager",
    role: "Line Manager",
    label: "Line Manager",
    description: "Direct reports and manager approvals.",
  },
  {
    id: "employee",
    role: "Employee",
    label: "Employee",
    description: "Personal assessments, development and applications.",
  },
] as const;

export type DemoPerspectiveId = (typeof demoPerspectiveOptions)[number]["id"];
export type DemoPerspectiveRole = (typeof demoPerspectiveOptions)[number]["role"];

export type DemoRoleSwitcherState = {
  enabled: true;
  currentPerspective: DemoPerspectiveId;
  currentRole: DemoPerspectiveRole;
  expiresAt: number;
  options: typeof demoPerspectiveOptions;
};

export function isDemoPerspectiveId(value: unknown): value is DemoPerspectiveId {
  return demoPerspectiveOptions.some((option) => option.id === value);
}
