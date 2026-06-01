import type { Metadata } from "next";
import Link from "next/link";
import { getSegmentLabel, intelligenceSegments, isIntelligenceSegment } from "@/lib/segments";
import { getAdminPasswordConfigured, isAdminAuthenticated } from "@/lib/server/admin-auth";
import { getSubscribersForAdmin, SubscriberStoreError } from "@/lib/server/subscribers";
import { loginAdmin, logoutAdmin } from "./actions";

export const metadata: Metadata = {
  title: "Subscribers Admin",
  description: "Internal subscriber management for MPR Consulting.",
};

type AdminSubscribersPageProps = {
  searchParams: Promise<{
    error?: string;
    search?: string;
    segment?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminSubscribersPage({
  searchParams,
}: AdminSubscribersPageProps) {
  const params = await searchParams;
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    return <AdminLogin showError={params.error === "1"} />;
  }

  const search = params.search ?? "";
  const segment = params.segment && isIntelligenceSegment(params.segment) ? params.segment : "";
  const queryParts = new URLSearchParams();

  if (search) {
    queryParts.set("search", search);
  }

  if (segment) {
    queryParts.set("segment", segment);
  }

  const exportHref = `/admin/subscribers/export${
    queryParts.toString() ? `?${queryParts.toString()}` : ""
  }`;

  try {
    const subscribers = await getSubscribersForAdmin(search, segment);

    return (
      <section className="container-px mx-auto max-w-7xl pb-20 pt-12 lg:pb-28 lg:pt-16">
        <div className="mb-8 flex flex-col gap-5 border-b border-ink/10 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
              Internal admin
            </p>
            <h1 className="display-heading mt-3 text-4xl leading-[1.08] text-ink md:text-5xl">
              MPR subscribers
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/62">
              Server-side view of MPR Intelligence Briefing subscribers.
            </p>
          </div>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink/14 px-4 text-[13px] font-semibold text-ink transition hover:border-teal/45 hover:text-teal"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="premium-card mb-6 rounded-xl p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form className="flex flex-col gap-3 lg:flex-row lg:items-center" action="/admin/subscribers">
              <label className="sr-only" htmlFor="search">
                Search by email
              </label>
              <input
                id="search"
                name="search"
                defaultValue={search}
                placeholder="Search by email"
                className="min-h-11 w-full rounded-full border border-ink/12 bg-white/45 px-4 text-sm text-ink outline-none transition placeholder:text-ink/38 focus:border-teal/45 focus:bg-white/62 focus:ring-4 focus:ring-teal/10 sm:w-80"
              />
              <label className="sr-only" htmlFor="segment">
                Filter by segment
              </label>
              <select
                id="segment"
                name="segment"
                defaultValue={segment}
                className="min-h-11 rounded-full border border-ink/12 bg-white/45 px-4 text-sm text-ink outline-none transition focus:border-teal/45 focus:bg-white/62 focus:ring-4 focus:ring-teal/10"
              >
                <option value="">All segments</option>
                {intelligenceSegments.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[13px] font-semibold text-cream transition hover:bg-forest"
              >
                Search
              </button>
            </form>
            <Link
              href={exportHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/14 px-5 text-[13px] font-semibold text-ink transition hover:border-teal/45 hover:text-teal"
            >
              Export CSV
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white/30 shadow-[0_14px_36px_rgba(15,37,39,0.035)]">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-ink/10 text-[11px] uppercase tracking-[0.18em] text-ink/52">
                <tr>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Created</th>
                  <th className="px-5 py-4 font-semibold">Source page</th>
                  <th className="px-5 py-4 font-semibold">Segments</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((subscriber) => (
                  <tr key={subscriber.email} className="border-b border-ink/[0.06] last:border-0">
                    <td className="px-5 py-4 font-semibold text-ink">{subscriber.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                          subscriber.status === "active"
                            ? "bg-teal/[0.1] text-teal"
                            : "bg-ink/[0.06] text-ink/58"
                        }`}
                      >
                        {subscriber.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink/64">
                      {formatDate(subscriber.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-ink/64">
                      {subscriber.sourcePage ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-ink/64">
                      <div className="flex flex-wrap gap-2">
                        {subscriber.segments.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-ink/[0.055] px-2.5 py-1 text-[11px] font-semibold text-ink/62"
                          >
                            {getSegmentLabel(item)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subscribers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink/60">
              No subscribers found.
            </div>
          ) : null}
        </div>
      </section>
    );
  } catch (error) {
    const message =
      error instanceof SubscriberStoreError
        ? error.details ?? error.message
        : "Subscriber data could not be loaded.";

    return (
      <section className="container-px mx-auto max-w-3xl pb-20 pt-16 lg:pb-28 lg:pt-24">
        <div className="premium-card rounded-xl p-7 md:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
            Internal admin
          </p>
          <h1 className="display-heading mt-5 text-4xl leading-[1.08] text-ink">
            Subscriber data unavailable.
          </h1>
          <p className="mt-5 text-[16px] leading-8 text-ink/66">{message}</p>
        </div>
      </section>
    );
  }
}

function AdminLogin({ showError }: { showError: boolean }) {
  const passwordConfigured = getAdminPasswordConfigured();

  return (
    <section className="container-px mx-auto max-w-xl pb-20 pt-16 lg:pb-28 lg:pt-24">
      <div className="premium-card rounded-xl p-7 md:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
          Internal admin
        </p>
        <h1 className="display-heading mt-5 text-4xl leading-[1.08] text-ink">
          Subscriber access.
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink/64">
          Enter the admin password to view MPR Intelligence Briefing subscribers.
        </p>
        {!passwordConfigured ? (
          <p className="mt-6 rounded-lg border border-red-900/15 bg-red-900/[0.05] p-4 text-sm leading-6 text-red-900">
            Admin password is not configured. Add ADMIN_SUBSCRIBERS_PASSWORD in
            Vercel environment variables.
          </p>
        ) : (
          <form action={loginAdmin} className="mt-7 grid gap-4">
            <label className="sr-only" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              className="min-h-12 rounded-full border border-ink/12 bg-white/45 px-5 text-sm text-ink outline-none transition placeholder:text-ink/38 focus:border-teal/45 focus:bg-white/62 focus:ring-4 focus:ring-teal/10"
              required
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-[13px] font-semibold text-cream transition hover:bg-forest"
            >
              Sign in
            </button>
            {showError ? (
              <p className="text-sm leading-6 text-red-900" role="alert">
                That password was not recognised.
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
}
