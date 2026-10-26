import { NextResponse } from "next/server";
import { checkPublicSubmissionLimits, LevyTateRateLimitStoreError } from "@/lib/server/levytate-auth-rate-limit";

const noStore = { "Cache-Control": "private, no-store" };

export function isHoneypotTripped(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function clipText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function clipList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => clipText(item, maxLength))
    .filter(Boolean);
}

export function isReasonableEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function publicSubmissionLimitResponse(
  request: Request,
  email: string,
  route: "/api/levy-transfer-enquiry" | "/api/opportunity-review/submit",
) {
  try {
    const rateLimit = await checkPublicSubmissionLimits(request, email, route);
    if (rateLimit.allowed) return null;
    return NextResponse.json(
      { message: "Please wait a little while before submitting again." },
      { status: 429, headers: noStore },
    );
  } catch (error) {
    if (error instanceof LevyTateRateLimitStoreError) {
      return NextResponse.json({ message: "Please try again shortly." }, { status: 503, headers: noStore });
    }
    throw error;
  }
}
