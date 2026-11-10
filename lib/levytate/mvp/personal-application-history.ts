import { activeApplicationStatuses, type MvpApplication, type MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";

export function closedApplicationOutcome(application: MvpApplication | null) {
  switch (application?.status) {
    case "Declined by Line Manager":
    case "Declined by Apprenticeship Lead": {
      const decision = [...(application.workflow?.events ?? [])].filter((event) => event.applicationId === application.id && event.action === "decline")
        .sort((left, right) => recordedTime(right.createdAt) - recordedTime(left.createdAt))[0];
      const decisionMaker = decision && ["Line Manager", "Apprenticeship Lead", "Employer Admin"].includes(decision.actorRole)
        ? decision.actorRole : application.status === "Declined by Line Manager" ? "Line Manager" : "Apprenticeship Lead";
      return { state: "declined", label: "Declined", decisionMaker, title: "Your application has been declined.", copy: "Review the recorded feedback before discussing another pathway with your manager." } as const;
    }
    case "Completed": return { state: "completed", label: "Completed", decisionMaker: null, title: "This application is recorded as completed.", copy: "Your application record remains available. View your programme records and explore future development in My Programme." } as const;
    case "Withdrawn": return { state: "withdrawn", label: "Withdrawn", decisionMaker: null, title: "This application has been withdrawn.", copy: "No further review is pending for this application. Its answers and history remain available for reference." } as const;
    case "Cancelled": return { state: "cancelled", label: "Cancelled", decisionMaker: null, title: "This application has been cancelled.", copy: "No further review is pending for this application. Review its recorded history before exploring another pathway." } as const;
    default: return null;
  }
}

function recordedTime(value: string) { const time = Date.parse(value); return Number.isFinite(time) ? time : 0; }
function latestFirst(left: MvpApplication, right: MvpApplication) {
  return (recordedTime(right.updatedAt) || recordedTime(right.submittedAt)) - (recordedTime(left.updatedAt) || recordedTime(left.submittedAt))
    || left.id.localeCompare(right.id);
}

/** Display selection only. Creation guards continue to use active applications. */
export function personalApplicationRecord(data: MvpWorkspaceData, employeeId: string): MvpApplication | null {
  const own = data.applications.filter((application) => application.employeeId === employeeId);
  const active = new Set(activeApplicationStatuses());
  return own.filter((application) => active.has(application.status)).sort(latestFirst)[0]
    ?? own.filter((application) => closedApplicationOutcome(application)).sort(latestFirst)[0]
    ?? null;
}

/** Preserve every recorded entry, including repeated requests for information. */
export function personalApplicationHistory(application: MvpApplication) {
  return [...application.history].sort((left, right) => recordedTime(left.createdAt) - recordedTime(right.createdAt));
}
