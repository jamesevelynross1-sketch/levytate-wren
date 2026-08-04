"use client";

import { useState } from "react";

export function EarlyAccessTermsAcceptanceForm() {
  const [acknowledged, setAcknowledged] = useState(false);
  return <form method="post" action="/api/levytate-terms-acceptance" className="rounded-[1.25rem] border border-[#159b8f]/20 bg-[#eef9f5] p-5 sm:p-7">
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#102c3d]">
      <input type="checkbox" name="acknowledged" value="yes" required checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#087c73] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/25" />
      <span>I am authorised to accept these Early Access Terms on behalf of this organisation, and I explicitly accept version shown above.</span>
    </label>
    <button type="submit" disabled={!acknowledged} className="mt-5 min-h-12 w-full rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-[#159b8f]/25 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">Accept Early Access Terms</button>
  </form>;
}
