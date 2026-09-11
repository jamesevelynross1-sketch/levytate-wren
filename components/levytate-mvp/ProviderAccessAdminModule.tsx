"use client";

import { RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type ProviderMembershipRole = "Provider Admin" | "Provider User";

type ProviderAccessMembership = {
  id: string;
  providerId: string;
  email: string;
  displayName: string;
  role: ProviderMembershipRole;
  active: boolean;
  authBindingStatus: "pending" | "bound";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProviderAccessProvider = {
  providerId: string;
  providerName: string;
  status: string;
  memberships: ProviderAccessMembership[];
};

type ProviderAccessResponse = {
  ok?: boolean;
  providers?: ProviderAccessProvider[];
  membership?: ProviderAccessMembership;
  message?: string;
};

type Availability = "checking" | "available" | "hidden" | "error";

const providerAccessEndpoint = "/api/levytate-platform/provider-access";
const providerRoles: ProviderMembershipRole[] = ["Provider User", "Provider Admin"];

async function responseBody(response: Response) {
  return response.json().catch(() => null) as Promise<ProviderAccessResponse | null>;
}

export function ProviderAccessAdminModule() {
  const [availability, setAvailability] = useState<Availability>("checking");
  const [providers, setProviders] = useState<ProviderAccessProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProviderMembershipRole>("Provider User");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProviders = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(providerAccessEndpoint, { cache: "no-store", signal });
      if (response.status === 404) {
        setAvailability("hidden");
        return;
      }
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body?.message ?? "Provider access could not be loaded.");
      const nextProviders = Array.isArray(body?.providers) ? body.providers : [];
      setProviders(nextProviders);
      setSelectedProviderId((current) => (
        nextProviders.some((provider) => provider.providerId === current)
          ? current
          : nextProviders.find((provider) => provider.status === "Active")?.providerId ?? nextProviders[0]?.providerId ?? ""
      ));
      setAvailability("available");
      setError("");
    } catch (loadError) {
      if (signal?.aborted) return;
      setAvailability("error");
      setError(loadError instanceof Error ? loadError.message : "Provider access could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadProviders(controller.signal);
    return () => controller.abort();
  }, [loadProviders]);

  const selectedProvider = providers.find((provider) => provider.providerId === selectedProviderId) ?? null;

  function replaceMembership(membership: ProviderAccessMembership) {
    setProviders((current) => current.map((provider) => provider.providerId === membership.providerId
      ? {
          ...provider,
          memberships: provider.memberships.some((item) => item.id === membership.id)
            ? provider.memberships.map((item) => item.id === membership.id ? membership : item)
            : [...provider.memberships, membership],
        }
      : provider));
  }

  async function provision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider || selectedProvider.status !== "Active" || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(providerAccessEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProvider.providerId,
          displayName,
          email,
          role,
        }),
      });
      const body = await responseBody(response);
      if (!response.ok || !body?.membership) {
        throw new Error(body?.message ?? "Provider access could not be provisioned.");
      }
      replaceMembership(body.membership);
      setDisplayName("");
      setEmail("");
      setRole("Provider User");
      setMessage("Provider access is active and awaiting the user’s first secure sign-in.");
    } catch (provisionError) {
      setError(provisionError instanceof Error ? provisionError.message : "Provider access could not be provisioned.");
    } finally {
      setBusy(false);
    }
  }

  if (availability === "checking" || availability === "hidden") return null;

  if (availability === "error") {
    return (
      <section className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Provider access</p>
        <h2 className="mt-2 text-xl font-semibold">Provider user administration</h2>
        <p role="alert" className="mt-4 rounded-xl bg-[#fff4f5] p-3 text-sm text-[#ad344e]">{error}</p>
        <button type="button" onClick={() => { setAvailability("checking"); void loadProviders(); }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">
          <RefreshCw size={15} aria-hidden="true" /> Retry
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="provider-access-title" className="rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-6 shadow-[0_14px_34px_rgba(16,44,61,0.045)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf7f3] text-[#0b8e82]"><ShieldCheck size={21} aria-hidden="true" /></div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Access &amp; tenant support</p>
          <h2 id="provider-access-title" className="mt-2 text-xl font-semibold">Provider user administration</h2>
          <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">Provision passwordless access against a canonical Marketplace provider. Provider membership never grants access to an employer workspace.</p>
        </div>
        <button type="button" onClick={() => void loadProviders()} className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-[#f5f7f3] px-4 text-xs font-semibold text-[#102c3d]/70 ring-1 ring-[#102c3d]/[0.07] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p role="status" className="mt-5 rounded-xl bg-[#eef9f5] p-3 text-sm font-medium text-[#0b6f63]">{message}</p> : null}
        {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff4f5] p-3 text-sm text-[#ad344e]">{error}</p> : null}
      </div>

      {providers.length ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <form onSubmit={provision} className="grid content-start gap-4 rounded-2xl bg-[#f8fbfa] p-5 ring-1 ring-[#102c3d]/[0.06]">
            <div className="flex items-center gap-3"><UserPlus size={18} className="text-[#0b8e82]" aria-hidden="true" /><h3 className="font-semibold">Provision provider access</h3></div>
            <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/65">
              Canonical provider
              <select required value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
                {providers.map((provider) => <option key={provider.providerId} value={provider.providerId}>{provider.providerName}{provider.status === "Active" ? "" : ` — ${provider.status}`}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/65">
              Display name
              <input required maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" className="h-11 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/65">
              Work email
              <input required maxLength={254} type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/65">
              Provider role
              <select value={role} onChange={(event) => setRole(event.target.value as ProviderMembershipRole)} className="h-11 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
                {providerRoles.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <p className="text-xs leading-5 text-[#102c3d]/52">Provisioning prepares a secure Auth identity. The membership remains visibly pending until the first successful passwordless callback binds it.</p>
            <button disabled={busy || !selectedProvider || selectedProvider.status !== "Active"} className="min-h-11 rounded-full bg-[#102c3d] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 disabled:cursor-not-allowed disabled:opacity-55">
              {busy ? "Provisioning…" : "Provision access"}
            </button>
          </form>

          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">Selected provider</p><h3 className="mt-1 text-lg font-semibold">{selectedProvider?.providerName ?? "Provider access"}</h3></div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedProvider?.status === "Active" ? "bg-[#e4f5ee] text-[#0b6f63]" : "bg-[#fff3dc] text-[#7a5818]"}`}>{selectedProvider?.status ?? "Unavailable"}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {selectedProvider?.memberships.length ? selectedProvider.memberships.map((membership) => (
                <ProviderMembershipEditor key={`${membership.id}:${membership.updatedAt}`} membership={membership} onChanged={replaceMembership} />
              )) : (
                <p className="rounded-2xl border border-dashed border-[#102c3d]/[0.13] p-5 text-sm leading-6 text-[#102c3d]/55">No provider users have been provisioned for this provider.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-[#102c3d]/[0.13] p-5 text-sm leading-6 text-[#102c3d]/55">No canonical Marketplace providers are available for provider access.</p>
      )}
    </section>
  );
}

function ProviderMembershipEditor({ membership, onChanged }: { membership: ProviderAccessMembership; onChanged: (membership: ProviderAccessMembership) => void }) {
  const [displayName, setDisplayName] = useState(membership.displayName);
  const [role, setRole] = useState<ProviderMembershipRole>(membership.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const changed = displayName.trim() !== membership.displayName || role !== membership.role;
  const fieldId = `provider-member-${membership.id}`;

  async function mutate(operation: "update" | "revoke" | "reactivate") {
    if (busy) return;
    if ((operation === "revoke" || operation === "reactivate") && !window.confirm(
      operation === "revoke"
        ? `Revoke provider access for ${membership.displayName}?`
        : `Reactivate provider access for ${membership.displayName}?`,
    )) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(providerAccessEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: membership.id, operation, displayName, role }),
      });
      const body = await responseBody(response);
      if (!response.ok || !body?.membership) {
        throw new Error(body?.message ?? "Provider access could not be updated.");
      }
      setDisplayName(body.membership.displayName);
      setRole(body.membership.role);
      onChanged(body.membership);
      setMessage(operation === "update" ? "Access details saved." : operation === "revoke" ? "Access revoked." : "Access reactivated.");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Provider access could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><p className="break-all text-sm font-semibold">{membership.email}</p><p className="mt-1 text-xs text-[#102c3d]/48">Last sign-in: {membership.lastLoginAt ? new Date(membership.lastLoginAt).toLocaleString("en-GB") : "Not yet"}</p></div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${membership.active ? "bg-[#e4f5ee] text-[#0b6f63]" : "bg-[#f0f2f3] text-[#52677d]"}`}>{membership.active ? "Active" : "Inactive"}</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${membership.authBindingStatus === "bound" ? "bg-[#e7f1fa] text-[#315f84]" : "bg-[#fff3dc] text-[#7a5818]"}`}>{membership.authBindingStatus === "bound" ? "Auth bound" : "First sign-in pending"}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${fieldId}-name`} className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/65">Display name<input id={`${fieldId}-name`} maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={!membership.active || busy} className="h-10 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10 disabled:opacity-55" /></label>
        <label htmlFor={`${fieldId}-role`} className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/65">Role<select id={`${fieldId}-role`} value={role} onChange={(event) => setRole(event.target.value as ProviderMembershipRole)} disabled={!membership.active || busy} className="h-10 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10 disabled:opacity-55">{providerRoles.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {message ? <p role="status" className="mt-3 text-xs font-semibold text-[#0b6f63]">{message}</p> : null}
        {error ? <p role="alert" className="mt-3 text-xs font-semibold text-[#ad344e]">{error}</p> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {membership.active ? (
          <>
            <button type="button" disabled={busy || !changed || !displayName.trim()} onClick={() => void mutate("update")} className="min-h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 disabled:cursor-not-allowed disabled:opacity-50">Save changes</button>
            <button type="button" disabled={busy} onClick={() => void mutate("revoke")} className="min-h-10 rounded-full bg-[#fff4f5] px-4 text-xs font-semibold text-[#ad344e] ring-1 ring-[#ad344e]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ad344e]/15 disabled:opacity-50">Revoke access</button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => void mutate("reactivate")} className="min-h-10 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 disabled:opacity-50">Reactivate access</button>
        )}
      </div>
    </article>
  );
}
