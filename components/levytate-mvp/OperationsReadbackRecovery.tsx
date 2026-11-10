'use client';
import { useEffect, useId, useRef } from 'react';

/** A verified receipt is never resent just because the subsequent read failed. */
export function OperationsReadbackRecovery({ required, loading, retry }: { required: boolean; loading: boolean; retry: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    if (required && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!required && dialog.current?.open) dialog.current.close();
  }, [required]);
  return <dialog ref={dialog} aria-labelledby={heading} aria-busy={loading} onCancel={event => event.preventDefault()} onKeyDown={event => event.stopPropagation()} className="m-auto w-[min(36rem,calc(100vw_-_2rem))] rounded-2xl border border-[#102c3d]/15 bg-white p-5 text-sm leading-6 text-[#102c3d] shadow-2xl backdrop:bg-[#102c3d]/35">
    <h2 id={heading} className="text-lg font-semibold">Saved update confirmed</h2>
    <p role="status" className="mt-2">{loading ? 'Loading the latest saved Operations state.' : 'The update was confirmed, but the latest saved state could not be verified. Load it before making another change.'}</p>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={loading} onClick={retry} className="min-h-10 rounded-xl bg-[#102c3d] px-4 text-xs font-semibold text-white disabled:opacity-45">Load latest saved state</button><button type="button" disabled={loading} onClick={() => window.location.reload()} className="min-h-10 rounded-xl border border-[#102c3d]/15 px-4 text-xs font-semibold disabled:opacity-45">Reload workspace</button></div>
  </dialog>;
}
