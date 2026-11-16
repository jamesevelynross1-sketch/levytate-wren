"use client";

import { useRef } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { usePinnedClientMutation } from "@/components/levytate-mvp/usePinnedClientMutation";
import { decodeLearnerCommandResponse, type LearnerCommandExpectation } from "@/lib/levytate/learner-command-response";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

/** One mounted learner form retains its original identity, endpoint and command. */
export function useLearnerCommand(detail: LearnerRecordDetail, suffix: string, method: "POST" | "PATCH" = "POST") {
  const { meta } = useMvpWorkspace();
  const retained = useRef(false);
  const expected = useRef<LearnerCommandExpectation>({ learnerRecordId: detail.learnerRecordId, employeeId: detail.learner.id, applicationId: detail.programme.applicationReference, programmeId: detail.programme.programmeId, providerId: detail.programme.providerId });
  const mutation = usePinnedClientMutation(meta ? { email: meta.userEmail, organisationId: meta.organisationId } : null,
    `/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/${suffix}`,
    value => decodeLearnerCommandResponse(value, expected.current), undefined, method);
  return { ...mutation, execute: (body: unknown, confirmed: (saved: LearnerRecordDetail) => void, changedProgramme?: Pick<LearnerCommandExpectation, "applicationId" | "programmeId" | "providerId">) => {
    if (retained.current || mutation.locked) return Promise.reject(new Error("Confirm the original learner update before making another change."));
    if (detail.learnerRecordId !== expected.current.learnerRecordId || detail.learner.id !== expected.current.employeeId) return Promise.reject(new Error("Reopen this learner before making a change."));
    retained.current = true;
    expected.current = { ...expected.current, applicationId: detail.programme.applicationReference, programmeId: detail.programme.programmeId, providerId: detail.programme.providerId, ...changedProgramme };
    return mutation.execute(body, saved => { retained.current = false; confirmed(saved); });
  } };
}
