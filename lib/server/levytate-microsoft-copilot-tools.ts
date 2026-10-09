import {
  MicrosoftCopilotConnectorError,
  type MicrosoftCopilotActor,
  type MicrosoftCopilotToolName,
} from "@/lib/levytate/microsoft-copilot";
import { buildMicrosoftCopilotOperationsPortfolio } from "@/lib/levytate/microsoft-copilot-portfolio";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";
import { hasMvpPermission } from "@/lib/levytate/mvp/rbac";
import { deriveApplicationWorkflowCompatibility } from "@/lib/levytate/application-workflows/compatibility";
import { getAutopilotWorkspaceForMicrosoftCopilotActor } from "@/lib/server/levytate-autopilot";
import { getOrganisationFinanceState } from "@/lib/server/levytate-finance";
import { getOrganisationLearnerLifecycleRecordDetail } from "@/lib/server/levytate-learner-lifecycle";
import {
  listManagerDirectReportOperationalActionsReadOnly,
  listOperationalActions,
} from "@/lib/server/levytate-operational-actions";
import { microsoftCopilotCanonicalUrl } from "@/lib/server/levytate-microsoft-copilot-config";
import { recordMicrosoftCopilotAudit } from "@/lib/server/levytate-microsoft-copilot-identity";
import {
  getWorkspaceBootstrapForMicrosoftCopilotActor,
  microsoftCopilotActorSession,
} from "@/lib/server/levytate-workspace";

type ToolArguments = Record<string, unknown>;

export async function executeMicrosoftCopilotTool(input: {
  actor: MicrosoftCopilotActor;
  toolName: MicrosoftCopilotToolName;
  arguments: ToolArguments;
  correlationId: string;
}) {
  const started = performance.now();
  try {
    const result = await dispatchTool(input.actor, input.toolName, input.arguments);
    await recordMicrosoftCopilotAudit({
      actor: input.actor,
      correlationId: input.correlationId,
      eventType: "microsoft_copilot.tool_called",
      toolName: input.toolName,
      outcome: "allowed",
      resultCount: resultCount(result),
      durationMs: performance.now() - started,
    });
    return result;
  } catch (error) {
    const connectorError = normaliseToolError(error);
    await recordMicrosoftCopilotAudit({
      actor: input.actor,
      correlationId: input.correlationId,
      eventType: "microsoft_copilot.tool_denied",
      toolName: input.toolName,
      outcome: connectorError.status >= 500 ? "error" : "denied",
      errorCode: connectorError.code,
      durationMs: performance.now() - started,
    });
    throw connectorError;
  }
}

async function dispatchTool(actor: MicrosoftCopilotActor, toolName: MicrosoftCopilotToolName, args: ToolArguments) {
  const session = microsoftCopilotActorSession(actor);
  switch (toolName) {
    case "get_operations_brief": {
      requireOrganisationOperationsRole(actor);
      const [workspace, { data }] = await Promise.all([
        getAutopilotWorkspaceForMicrosoftCopilotActor(actor),
        getWorkspaceBootstrapForMicrosoftCopilotActor(actor),
      ]);
      const topAttention = Object.values(workspace.lanes)
        .flat()
        .filter((signal) => !["resolved", "dismissed"].includes(signal.status))
        .slice(0, 5)
        .map((signal) => ({ title: signal.title, priority: signal.priority, nextStep: signal.recommendedAction }));
      return {
        generatedAt: workspace.generatedAt,
        portfolio: buildMicrosoftCopilotOperationsPortfolio(data, workspace.generatedAt.slice(0, 10)),
        brief: workspace.brief,
        topAttention,
        openSignalCount: Object.values(workspace.lanes).flat().filter((signal) => !["resolved", "dismissed"].includes(signal.status)).length,
        link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "Operations" }),
      };
    }
    case "list_autopilot_signals": {
      requireOrganisationOperationsRole(actor);
      const workspace = await getAutopilotWorkspaceForMicrosoftCopilotActor(actor);
      const lane = optionalText(args.lane);
      const priority = optionalText(args.priority);
      const limit = boundedLimit(args.limit, 20, 50);
      const signals = Object.entries(workspace.lanes)
        .flatMap(([laneName, items]) => items.map((signal) => ({ lane: laneName, signal })))
        .filter((entry) => !lane || entry.lane === lane)
        .filter((entry) => !priority || entry.signal.priority === priority)
        .slice(0, limit)
        .map(({ lane: laneName, signal }) => ({
          id: signal.id,
          lane: laneName,
          priority: signal.priority,
          title: signal.title,
          summary: signal.summary,
          recommendedAction: signal.recommendedAction,
          status: signal.status,
          lastEvaluatedAt: signal.lastEvaluatedAt,
          link: signal.evidence.find((item) => item.url)?.url
            ? microsoftCopilotCanonicalUrl(signal.evidence.find((item) => item.url)!.url)
            : microsoftCopilotCanonicalUrl("/levytate/app", { module: "Operations" }),
        }));
      return { generatedAt: workspace.generatedAt, count: signals.length, signals };
    }
    case "list_upcoming_reviews": {
      requirePermission(actor, "learnerLifecycle:read");
      const [{ data }, actions] = await Promise.all([
        getWorkspaceBootstrapForMicrosoftCopilotActor(actor),
        actor.role === "Line Manager"
          ? listManagerDirectReportOperationalActionsReadOnly(session).then((result) => result.actions)
          : hasMvpPermission(actor.role, "operationalActions:read")
            ? listOperationalActions(session)
            : Promise.resolve([]),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const days = boundedLimit(args.days, 30, 90);
      const throughDate = new Date(`${today}T00:00:00.000Z`);
      throughDate.setUTCDate(throughDate.getUTCDate() + days);
      const through = throughDate.toISOString().slice(0, 10);
      const status = optionalText(args.status);
      const limit = boundedLimit(args.limit, 20, 50);
      const learners = new Map(data.learnerRecords.map((record) => [record.id, record]));
      const employees = new Map(data.employees.map((employee) => [employee.id, employee]));
      const reviews = [...data.learnerReviews]
        .filter((review) => review.nextReviewDate && review.nextReviewDate >= today && review.nextReviewDate <= through)
        .filter((review) => !status || review.status === status)
        .sort((left, right) => left.nextReviewDate.localeCompare(right.nextReviewDate))
        .slice(0, limit)
        .map((review) => {
          const learner = learners.get(review.learnerRecordId);
          const employee = learner ? employees.get(learner.employeeId) : undefined;
          return {
            id: review.id,
            learnerRecordId: review.learnerRecordId,
            learnerName: employee?.name ?? "Learner",
            reviewType: review.reviewType,
            nextReviewDate: review.nextReviewDate,
            status: review.status,
            supportRequired: review.supportRequired,
            unresolvedActionCount: actions.filter((action) => action.learnerRecordId === review.learnerRecordId).length,
            link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "Learners", learner: review.learnerRecordId }),
          };
        });
      return { asOf: today, count: reviews.length, reviews };
    }
    case "list_operational_actions": {
      const limit = boundedLimit(args.limit, 20, 50);
      const status = optionalText(args.status);
      const owner = optionalText(args.owner).toLowerCase();
      const dueThrough = dateAfterDays(optionalBoundedInteger(args.dueWithinDays, 90));
      let actions;
      if (actor.role === "Line Manager") {
        actions = (await listManagerDirectReportOperationalActionsReadOnly(session)).actions;
      } else {
        requirePermission(actor, "operationalActions:read");
        actions = await listOperationalActions(session);
      }
      const visible = actions
        .filter((action) => !status || action.status === status)
        .filter((action) => !owner || action.ownerType.toLowerCase() === owner || action.ownerDisplayName.toLowerCase() === owner)
        .filter((action) => !dueThrough || Boolean(action.dueDate && action.dueDate <= dueThrough))
        .slice(0, limit)
        .map((action) => ({
          id: action.id,
          title: action.title,
          description: action.description,
          priority: action.priority,
          status: action.status,
          ownerType: action.ownerType,
          ownerDisplayName: action.ownerDisplayName,
          dueDate: action.dueDate,
          learnerRecordId: action.learnerRecordId,
          applicationId: action.applicationId,
          link: microsoftCopilotCanonicalUrl(action.sourceUrl || "/levytate/app?module=Operations"),
        }));
      return { count: visible.length, actions: visible };
    }
    case "get_learner_summary": {
      requirePermission(actor, "learnerLifecycle:read");
      const learnerRecordId = requiredText(args.learnerRecordId, "learnerRecordId");
      const [detail, actions] = await Promise.all([
        getOrganisationLearnerLifecycleRecordDetail(session, learnerRecordId),
        actor.role === "Line Manager"
          ? listManagerDirectReportOperationalActionsReadOnly(session).then((result) => result.actions)
          : hasMvpPermission(actor.role, "operationalActions:read")
            ? listOperationalActions(session, { learnerRecordId })
            : Promise.resolve([]),
      ]);
      const latestProgress = detail.latestProgress ? {
        updateDate: detail.latestProgress.updateDate,
        targetProgressPercentage: detail.latestProgress.targetProgressPercentage,
        actualProgressPercentage: detail.latestProgress.actualProgressPercentage,
        variancePercentage: detail.latestProgress.variancePercentage,
        progressSource: detail.latestProgress.progressSource,
      } : null;
      return {
        learnerRecordId: detail.learnerRecordId,
        learner: {
          name: detail.learner.name,
          jobTitle: detail.learner.jobTitle,
          department: detail.learner.department,
          site: detail.learner.site,
        },
        programme: {
          name: detail.programme.programmeName,
          provider: detail.programme.providerName,
        },
        lifecycleStatus: detail.lifecycleStatus,
        expectedStartDate: detail.expectedStartDate,
        actualStartDate: detail.actualStartDate,
        expectedEndDate: detail.expectedEndDate,
        latestProgress,
        progressPosition: detail.progressPosition,
        reviews: {
          provider: { nextDate: detail.reviewSummaries.provider.nextDate, overdue: detail.reviewSummaries.provider.overdue },
          lAndD: { nextDate: detail.reviewSummaries.lAndD.nextDate, overdue: detail.reviewSummaries.lAndD.overdue },
          manager: { nextDate: detail.reviewSummaries.manager.nextDate, overdue: detail.reviewSummaries.manager.overdue },
        },
        openOperationalActions: actions
          .filter((action) => action.learnerRecordId === learnerRecordId)
          .slice(0, 10)
          .map((action) => ({ id: action.id, title: action.title, status: action.status, dueDate: action.dueDate })),
        attention: detail.attention,
        link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "Learners", learner: learnerRecordId }),
      };
    }
    case "list_applications": {
      requirePermission(actor, "applications:read");
      const { data } = await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
      const status = optionalText(args.status);
      const owner = optionalText(args.owner).toLowerCase();
      const attentionOnly = args.attentionOnly === true;
      const limit = boundedLimit(args.limit, 20, 50);
      const employees = new Map(data.employees.map((employee) => [employee.id, employee]));
      const applications = data.applications
        .filter((application) => !status || deriveApplicationWorkflowCompatibility(application).status === status)
        .filter((application) => !owner || deriveApplicationWorkflowCompatibility(application).currentOwner.toLowerCase() === owner)
        .filter((application) => !attentionOnly || !["Draft", "Approved", "Declined", "Withdrawn", "Cancelled"].includes(application.status))
        .slice(0, limit)
        .map((application) => {
          const standard = getApprenticeshipStandard(application.apprenticeshipStandardId);
          const workflow = deriveApplicationWorkflowCompatibility(application);
          return {
            id: application.id,
            employeeName: employees.get(application.employeeId)?.name ?? "Employee",
            programme: standard?.title ?? application.apprenticeshipStandardId,
            status: workflow.status,
            currentOwner: workflow.currentOwner,
            currentWorkflowStep: workflow.currentStepLabel,
            currentResponsibleRole: workflow.currentResponsibleRole,
            lastProgressedAt: workflow.lastProgressedAt,
            submittedAt: application.submittedAt,
            updatedAt: application.updatedAt,
            link: microsoftCopilotCanonicalUrl("/levytate/app", {
              module: actor.role === "Line Manager" ? "Approvals" : actor.role === "Employee" ? "My Application" : "Applications",
              application: application.id,
            }),
          };
        });
      return { count: applications.length, applications };
    }
    case "get_levy_summary": {
      requirePermission(actor, "finance:read");
      const state = await getOrganisationFinanceState(session);
      const totals = state.transactions.reduce((summary, transaction) => {
        summary.netMovementPence += transaction.amountPence;
        if (transaction.category === "levy_in") summary.levyInPence += transaction.amountPence;
        if (transaction.category === "apprenticeship_spend") summary.apprenticeshipSpendPence += Math.abs(transaction.amountPence);
        if (transaction.category === "levy_expiry") summary.expiredPence += Math.abs(transaction.amountPence);
        return summary;
      }, { netMovementPence: 0, levyInPence: 0, apprenticeshipSpendPence: 0, expiredPence: 0 });
      return {
        transactionCount: state.transactions.length,
        latestImportAt: state.imports[0]?.importedAt ?? null,
        manualBalancePence: state.manualBalancePence ?? null,
        manualBalanceConfirmedAt: state.manualBalanceConfirmedAt ?? null,
        ...totals,
        link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "Finance" }),
      };
    }
    case "list_my_providers": {
      requirePermission(actor, "providers:read");
      const limit = boundedLimit(args.limit, 20, 50);
      const { data } = await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
      const selections = new Map(data.organisationProviders.map((selection) => [selection.providerId, selection]));
      const providers = data.providers
        .filter((provider) => selections.has(provider.providerId))
        .slice(0, limit)
        .map((provider) => ({
          id: provider.providerId,
          name: provider.providerName,
          type: provider.providerType,
          deliveryModels: provider.deliveryModels,
          regions: provider.regions,
          relationshipStatus: selections.get(provider.providerId)?.status,
          lastVerified: provider.lastVerified,
          link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "My Providers", provider: provider.providerId }),
        }));
      return { count: providers.length, providers };
    }
    case "list_my_programmes": {
      requirePermission(actor, "providers:read");
      const limit = boundedLimit(args.limit, 20, 50);
      const { data } = await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
      const selections = new Map(data.organisationProgrammes.map((selection) => [selection.programmeId, selection]));
      const providers = new Map(data.providers.map((provider) => [provider.providerId, provider.providerName]));
      const programmes = data.providerProgrammes
        .filter((programme) => selections.has(programme.id))
        .slice(0, limit)
        .map((programme) => ({
          id: programme.id,
          name: programme.programmeName,
          providerId: programme.providerId,
          providerName: providers.get(programme.providerId) ?? "Provider",
          level: programme.level,
          deliveryModels: programme.deliveryModels,
          regions: programme.regions,
          status: selections.get(programme.id)?.status,
          link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "My Programmes", programme: programme.id }),
        }));
      return { count: programmes.length, programmes };
    }
    case "get_provider_summary": {
      requirePermission(actor, "providers:read");
      const providerId = requiredText(args.providerId, "providerId");
      const { data } = await getWorkspaceBootstrapForMicrosoftCopilotActor(actor);
      if (!data.organisationProviders.some((selection) => selection.providerId === providerId)) {
        throw new MicrosoftCopilotConnectorError("not_found", "The provider was not found in this organisation's provider portfolio.", 404);
      }
      const provider = data.providers.find((item) => item.providerId === providerId);
      if (!provider) throw new MicrosoftCopilotConnectorError("not_found", "The provider was not found.", 404);
      const programmes = data.providerProgrammes
        .filter((programme) => programme.providerId === providerId && data.organisationProgrammes.some((selection) => selection.programmeId === programme.id))
        .slice(0, 50)
        .map((programme) => ({ id: programme.id, name: programme.programmeName, level: programme.level, status: programme.status }));
      const learners = data.learnerRecords.filter((record) => record.providerId === providerId);
      const relationship = data.providerRelationships.find((item) => item.preferredProviderId === providerId || item.backupProviderIds.includes(providerId));
      return {
        id: provider.providerId,
        name: provider.providerName,
        type: provider.providerType,
        deliveryModels: provider.deliveryModels,
        regions: provider.regions,
        specialisms: provider.specialisms,
        verificationStatus: provider.verificationStatus,
        lastVerified: provider.lastVerified,
        relationship: relationship ? { category: relationship.category, status: relationship.status, reviewDate: relationship.reviewDate } : null,
        programmeCount: programmes.length,
        programmes,
        activeLearnerCount: learners.filter((learner) => learner.recordStatus === "Active").length,
        link: microsoftCopilotCanonicalUrl("/levytate/app", { module: "My Providers", provider: providerId }),
      };
    }
  }
}

function requireOrganisationOperationsRole(actor: MicrosoftCopilotActor) {
  if (actor.role !== "Employer Admin" && actor.role !== "Apprenticeship Lead") {
    throw new MicrosoftCopilotConnectorError("permission_denied", "This role cannot access organisation Operations Autopilot.", 403);
  }
}

function requirePermission(actor: MicrosoftCopilotActor, permission: Parameters<typeof hasMvpPermission>[1]) {
  if (!hasMvpPermission(actor.role, permission)) {
    throw new MicrosoftCopilotConnectorError("permission_denied", "This LevyTate role cannot access that information.", 403);
  }
}

function boundedLimit(value: unknown, fallback: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) ? Math.min(maximum, Math.max(1, value)) : fallback;
}

function optionalBoundedInteger(value: unknown, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) ? Math.min(maximum, Math.max(1, value)) : 0;
}

function dateAfterDays(days: number) {
  if (!days) return "";
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function requiredText(value: unknown, name: string) {
  const cleaned = optionalText(value);
  if (!cleaned) throw new MicrosoftCopilotConnectorError("invalid_request", `${name} is required.`, 400);
  return cleaned;
}

function resultCount(result: unknown) {
  if (!result || typeof result !== "object") return 1;
  const count = (result as { count?: unknown }).count;
  return typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.round(count)) : 1;
}

function normaliseToolError(error: unknown) {
  if (error instanceof MicrosoftCopilotConnectorError) return error;
  const message = error instanceof Error ? error.message : "The LevyTate tool could not be completed.";
  if (/not found/i.test(message)) return new MicrosoftCopilotConnectorError("not_found", "The requested LevyTate record was not found.", 404);
  if (/cannot|permission|access/i.test(message)) return new MicrosoftCopilotConnectorError("permission_denied", "This LevyTate role cannot access that information.", 403);
  return new MicrosoftCopilotConnectorError("configuration_unavailable", "The LevyTate tool is temporarily unavailable.", 503);
}
