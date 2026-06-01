"use client";

import { useState } from "react";
import {
  defaultSegments,
  intelligenceSegments,
  type IntelligenceSegment,
} from "@/lib/segments";

type SubscribeState = "idle" | "loading" | "success" | "error";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BriefingSubscribeForm() {
  const [email, setEmail] = useState("");
  const [segments, setSegments] = useState<IntelligenceSegment[]>(defaultSegments);
  const [state, setState] = useState<SubscribeState>("idle");
  const [message, setMessage] = useState("");

  function toggleSegment(segment: IntelligenceSegment) {
    if (segment === "all") {
      setSegments(defaultSegments);
      return;
    }

    setSegments((currentSegments) => {
      const withoutAll = currentSegments.filter((item) => item !== "all");
      const nextSegments = withoutAll.includes(segment)
        ? withoutAll.filter((item) => item !== segment)
        : [...withoutAll, segment];

      return nextSegments.length > 0 ? nextSegments : defaultSegments;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalisedEmail = email.trim().toLowerCase();

    if (!emailPattern.test(normalisedEmail)) {
      setState("error");
      setMessage("Please enter a valid work email address.");
      return;
    }

    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalisedEmail,
          sourcePage: "/insights",
          segments,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Subscription failed.");
      }

      setState("success");
      setMessage(
        payload.message ??
          "You're subscribed. We'll send useful apprenticeship market signals, not noise.",
      );
      setEmail("");
      setSegments(defaultSegments);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete the subscription. Please try again.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
      <fieldset className="grid gap-3">
        <legend className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink/52">
          Choose your briefing focus
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {intelligenceSegments.map((segment) => {
            const checked = segments.includes(segment.value);

            return (
              <label
                key={segment.value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm leading-5 transition ${
                  checked
                    ? "border-teal/35 bg-teal/[0.08] text-ink"
                    : "border-ink/10 bg-white/[0.26] text-ink/66"
                } hover:border-teal/25 hover:text-ink`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSegment(segment.value)}
                  className="h-4 w-4 rounded border-ink/20 accent-teal"
                />
                <span>{segment.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="sr-only" htmlFor="briefing-email">
          Email address
        </label>
        <input
          id="briefing-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Work email address"
          className="min-h-12 w-full rounded-full border border-ink/12 bg-white/45 px-5 text-sm text-ink shadow-[0_10px_24px_rgba(15,37,39,0.035)] outline-none transition placeholder:text-ink/38 focus:border-teal/45 focus:bg-white/62 focus:ring-4 focus:ring-teal/10"
          required
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 text-[13px] font-semibold text-cream shadow-[0_14px_28px_rgba(15,37,39,0.12)] transition hover:-translate-y-0.5 hover:bg-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto sm:min-w-44"
        >
          {state === "loading" ? "Subscribing..." : "Subscribe to updates"}
        </button>
      </div>

      <div className="min-h-6">
        {message ? (
          <p
            className={`text-sm leading-6 ${
              state === "success" ? "text-forest" : "text-red-900"
            }`}
            role={state === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
