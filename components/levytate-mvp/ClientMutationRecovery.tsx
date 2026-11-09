"use client";

import { useEffect, useId, useRef } from "react";

export function ClientMutationRecovery({ mutation }: { mutation: { working: boolean; pending: boolean; error: string; retry: () => void } }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    if (mutation.pending && element && !element.open) element.showModal();
    if (!mutation.pending && element?.open) element.close();
  }, [mutation.pending]);
  // Native top-layer modality keeps recovery accessible above an existing edit
  // dialog, outside the disabled fieldset. No private draft enters storage.
  return <>
    {!mutation.pending && mutation.error ? <p role="alert" className="rounded-xl bg-[#fff4f5] p-4 text-sm text-[#8f3042]">{mutation.error}</p> : null}
    <dialog ref={dialog} aria-labelledby={heading} aria-busy={mutation.working} onCancel={(event) => event.preventDefault()} onKeyDown={(event) => event.stopPropagation()}
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100vw_-_2rem))] overflow-y-auto rounded-2xl border border-[#c95568]/20 bg-white p-5 text-sm leading-6 text-[#102c3d] shadow-2xl backdrop:bg-[#102c3d]/35">
      <h2 id={heading} className="text-lg font-semibold">Update awaiting confirmation</h2>
      <p role="alert" className="mt-2 text-[#8f3042]">{mutation.error || "The update is awaiting confirmation."}</p>
      <p className="mt-2">Retry sends the original update unchanged. Reload saved state to check what was recorded before making another change.</p><div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={mutation.working} onClick={mutation.retry} className="min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white disabled:opacity-45">Retry original update</button>
      <button type="button" disabled={mutation.working} onClick={() => window.location.reload()} className="min-h-10 rounded-xl border border-[#102c3d]/15 px-4 text-xs font-semibold disabled:opacity-45">Reload saved state</button>
      </div>
    </dialog>
  </>;
}
