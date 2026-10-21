export async function runLiftSaveAndSubmit(save: () => Promise<boolean>, submit: () => Promise<boolean>) {
  const saved = await save();
  if (!saved) return false;
  return submit();
}

export function canManagerAccessLiftParticipant(input: {
  currentManagerEmployeeId: string;
  participantEmployeeId: string;
  participantManagerEmployeeId: string;
  observationStatus: "draft" | "submitted" | "released" | "revoked";
}) {
  return input.currentManagerEmployeeId !== input.participantEmployeeId
    && input.currentManagerEmployeeId === input.participantManagerEmployeeId
    && input.observationStatus !== "revoked";
}

export function employeeFindingsReleased(input: { employeeSubmitted: boolean; managerSubmitted: boolean }) {
  return input.employeeSubmitted && input.managerSubmitted;
}
