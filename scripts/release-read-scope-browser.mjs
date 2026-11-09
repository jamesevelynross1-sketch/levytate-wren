/** Challenge real HTTP read boundaries using already-authenticated fictional
 * contexts. No sign-ins, mutations or provider configuration changes. */
import { localUrl } from "./release-local-fixtures.mjs";

export async function verifyReadScope({ app: value, contexts, check }) {
  const app = localUrl(value, "read-scope app");
  const lead = contexts.get("a:lead"), other = contexts.get("b:employee");
  if (lead?.user.role !== "Apprenticeship Lead" || other?.user.role !== "Employee" || lead.tenant.id === other.tenant.id) throw new Error("Two genuine fictional tenant contexts required");
  const paths = ["finance", "employer-insights", "learning-time", "requests", "lift", "assessments"];
  for (const name of paths) {
    const url = `${app}/api/levytate-${name}`;
    const base = await lead.context.request.get(url);
    check(`Read scope: ${name} has a current authorised or explicitly unavailable baseline`, [200,403,404].includes(base.status()));
    const correct = await lead.context.request.get(url, { headers: { "X-LevyTate-Account": lead.user.email, "X-LevyTate-Organisation": lead.tenant.id } });
    check(`Read scope: ${name} preserves current account and employer access`, correct.status() === base.status());
    const account = await lead.context.request.get(url, { headers: { "X-LevyTate-Account": other.user.email, "X-LevyTate-Organisation": lead.tenant.id } });
    check(`Read scope: ${name} denies a retained different-account read`, account.status() === 409);
    const tenant = await lead.context.request.get(url, { headers: { "X-LevyTate-Account": lead.user.email, "X-LevyTate-Organisation": other.tenant.id } });
    check(`Read scope: ${name} denies a retained different-employer read`, tenant.status() === 409);
  }
}
