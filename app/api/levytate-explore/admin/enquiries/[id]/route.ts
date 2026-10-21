import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EXPLORE_ENQUIRY_STATUSES, EXPLORE_REVENUE_ROUTES,
} from "@/lib/levytate/explore/policy";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { updateExploreEnquiry } from "@/lib/server/levytate-explore";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const schema = z.object({
  expectedUpdatedAt: z.string().min(15).max(64),
  status: z.enum(EXPLORE_ENQUIRY_STATUSES),
  commercialRoute: z.enum(EXPLORE_REVENUE_ROUTES),
  internalNotes: z.string().trim().max(2000),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionCookies = await cookies();
  const session = await readAuthorisedLevyTateBetaSession(
    sessionCookies.get(levytateBetaSessionCookie)?.value,
  );
  if (!session) return NextResponse.json({ message: "Unauthorised." }, { status: 401, headers: privateHeaders });
  if (session.accessLevel !== "beta_admin") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403, headers: privateHeaders });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ message: "Invalid origin." }, { status: 403, headers: privateHeaders });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ message: "Invalid enquiry." }, { status: 400, headers: privateHeaders });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 3500) throw new Error("too long");
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400, headers: privateHeaders });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid enquiry update." }, { status: 400, headers: privateHeaders });

  try {
    const result = await updateExploreEnquiry(
      id,
      parsed.data.expectedUpdatedAt,
      parsed.data.status,
      parsed.data.commercialRoute,
      parsed.data.internalNotes,
      session.email,
    );
    if (!result) return NextResponse.json({ message: "This enquiry has changed. Refresh it before saving." }, { status: 409, headers: privateHeaders });
    return NextResponse.json({ ok: true, enquiry: result }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ message: "Your change could not be saved. Try again." }, { status: 503, headers: privateHeaders });
  }
}
