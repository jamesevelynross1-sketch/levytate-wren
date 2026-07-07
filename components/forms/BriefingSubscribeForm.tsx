"use client";

import { useState } from "react";
import {
  defaultSegments,
  intelligenceSegments,
  type IntelligenceSegment,
} from "@/lib/segments";

type SubscribeState = "idle" | "loading" | "success" | "error";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BriefingSubscribeFormProps = {
  sourcePage?: string;
};

export function BriefingSubscribeForm({ sourcePage = "/insights" }: BriefingSubscribeFormProps) {
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
    const endpoint = "/api/subscribe";
    const requestPayload = {
      email: normalisedEmail,
      sourcePage,
      segments,
    };

    try {
      console.info("Submitting MPR Insights subscription", {
        endpoint,
        payload: {
          emailDomain: normalisedEmail.split("@").at(-1),
          sourcePage,
          segments,
        },
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      console.info("MPR Insights subscription response", {
        endpoint,
        status: response.status,
        ok: response.ok,
        payload,
      });

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
      console.error("MPR Insights subscription failed", {
        endpoint,
        payload: {
          emailDomain: normalisedEmail.split("@").at(-1),
          sourcePage,
          segments,
        },
        error,
      });
      setState("error");
      setMessage(getSubscriptionErrorMessage(error));
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
          className="button-pill button-pill--primary w-full disabled:opacity-100 sm:w-auto sm:min-w-44"
        >
          {state === "loading" ? "Subscribing..." : "Subscribe"}
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

function getSubscriptionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Subscription service is temporarily unavailable. Please try again or contact MPR Consulting directly.";
  }

  if (
    error.message.toLowerCase().includes("fetch failed") ||
    error.message.toLowerCase().includes("failed to fetch")
  ) {
    return "Unable to connect to subscription service. Please try again or contact MPR Consulting directly.";
  }

  return error.message || "Subscription service is temporarily unavailable. Please try again or contact MPR Consulting directly.";
}
