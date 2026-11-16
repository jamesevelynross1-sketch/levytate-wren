function isVisible(element: HTMLElement) {
  if (element.closest("[hidden], [inert], [aria-hidden='true']") || !element.getClientRects().length) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display !== "none" && style?.visibility !== "hidden" && style?.visibility !== "collapse";
}

/** Only the front-most modal owns document-level keyboard/focus events. */
export function isTopmostDialog(dialog: HTMLElement) {
  return topmostModalDialog(dialog.ownerDocument) === dialog;
}

export function topmostModalDialog(document: Document) {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(isVisible).at(-1) ?? null;
}

export function restoreDialogFocus(previousFocus: Pick<HTMLElement, "isConnected" | "focus"> | null) {
  if (!previousFocus?.isConnected) return false;
  previousFocus.focus();
  return true;
}

export function dialogTabStops(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, summary, [tabindex], [contenteditable='true']"))
    .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && isVisible(element))
    // Match browser ordering if a caller supplies positive tabindex values.
    .sort((left, right) => (left.tabIndex || Number.MAX_SAFE_INTEGER) - (right.tabIndex || Number.MAX_SAFE_INTEGER));
}

export function dialogTabBoundary(dialog: HTMLElement, activeElement: Element | null, backwards: boolean) {
  const elements = dialogTabStops(dialog);
  const first = elements[0] ?? dialog;
  const last = elements.at(-1) ?? dialog;
  if (!activeElement || !dialog.contains(activeElement) || activeElement === dialog) return backwards ? last : first;
  if (backwards && activeElement === first) return last;
  if (!backwards && activeElement === last) return first;
  return null;
}
