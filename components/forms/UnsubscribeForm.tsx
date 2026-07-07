"use client";

import { useState } from "react";

type UnsubscribeState = "idle" | "loading" | "success" | "error";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UnsubscribeFormProps = {
  initialEmail?: string;
  token?: string;
};

export function UnsubscribeForm({ initialEmail = "", token = "" }: UnsubscribeFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<UnsubscribeState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalisedEmail = email.trim().toLowerCase();

    if (!token && !emailPattern.test(normalisedEmail)) {
      setState("error");
      setMessage("Please enter the email address you subscribed with.");
      return;
    }

    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(token ? { token } : { email: normalisedEmail }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unsubscribe failed.");
      }

      setState("success");
      setMessage(payload.message ?? "You’ve been unsubscribed from the MPR Intelligence Briefing.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete the unsubscribe request.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4" noValidate>
      {token ? null : (
        <>
          <label className="sr-only" htmlFor="unsubscribe-email">
            Email address
          </label>
          <input
            id="unsubscribe-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="min-h-12 rounded-full border border-ink/12 bg-white/45 px-5 text-sm text-ink shadow-[0_10px_24px_rgba(15,37,39,0.035)] outline-none transition placeholder:text-ink/38 focus:border-teal/45 focus:bg-white/62 focus:ring-4 focus:ring-teal/10"
            required
          />
        </>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={state === "loading"}
          className="button-pill button-pill--primary disabled:opacity-100"
        >
          {state === "loading" ? "Updating..." : "Unsubscribe"}
        </button>
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
