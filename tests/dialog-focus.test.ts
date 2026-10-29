import { describe, expect, it } from "vitest";
import { dialogTabBoundary, dialogTabStops, isTopmostDialog } from "../lib/levytate/dialog-focus";

// Unit model for ordering/filtering only. Actual keyboard behaviour is separately
// exercised in the genuine-auth browser acceptance suite.
function fixture() {
  const dialogs: HTMLElement[] = [];
  const ownerDocument = {
    querySelectorAll: () => dialogs,
    defaultView: { getComputedStyle: (element: { style: object }) => element.style },
  };
  function element(options: { hidden?: boolean; disabled?: boolean; rendered?: boolean; visibility?: string; tabIndex?: number } = {}) {
    return {
      ownerDocument, tabIndex: options.tabIndex ?? 0,
      style: { display: "block", visibility: options.visibility ?? "visible" },
      closest: () => options.hidden ? {} : null,
      getClientRects: () => options.rendered === false ? [] : [{}],
      matches: () => options.disabled ?? false,
    } as unknown as HTMLElement;
  }
  function dialog(children: HTMLElement[] = [], visible = true) {
    const node = Object.assign(element({ rendered: visible }), {
      querySelectorAll: () => children,
      contains: (value: Element) => value === node || children.includes(value as HTMLElement),
    });
    dialogs.push(node);
    return node;
  }
  return { element, dialog };
}

describe("shared dialog focus contract", () => {
  it("excludes hidden, inert, unrendered, disabled and negative-tabindex controls", () => {
    const { element, dialog } = fixture();
    const active = element();
    const root = dialog([element({ hidden: true }), element({ rendered: false }), element({ disabled: true }), element({ visibility: "hidden" }), element({ visibility: "collapse" }), element({ tabIndex: -1 }), active]);
    expect(dialogTabStops(root)).toEqual([active]);
  });
  it("preserves ordinary DOM ordering and prioritises positive tabindex", () => {
    const { element, dialog } = fixture();
    const zeroA = element(), two = element({ tabIndex: 2 }), one = element({ tabIndex: 1 }), zeroB = element();
    expect(dialogTabStops(dialog([zeroA, two, one, zeroB]))).toEqual([one, two, zeroA, zeroB]);
  });
  it("gives only the top visible dialog document keyboard ownership", () => {
    const { dialog } = fixture();
    const outer = dialog(), inner = dialog();
    dialog([], false);
    expect(isTopmostDialog(outer)).toBe(false);
    expect(isTopmostDialog(inner)).toBe(true);
  });
  it("wraps only the visible first and last controls", () => {
    const { element, dialog } = fixture();
    const first = element(), middle = element(), last = element();
    const root = dialog([first, middle, last, element({ rendered: false })]);
    expect(dialogTabBoundary(root, first, true)).toBe(last);
    expect(dialogTabBoundary(root, last, false)).toBe(first);
    expect(dialogTabBoundary(root, middle, false)).toBeNull();
  });
  it("recovers outside or dialog-root focus in either direction", () => {
    const { element, dialog } = fixture();
    const first = element(), last = element(), outside = element();
    const root = dialog([first, last]);
    expect(dialogTabBoundary(root, outside, false)).toBe(first);
    expect(dialogTabBoundary(root, null, true)).toBe(last);
    expect(dialogTabBoundary(root, root, false)).toBe(first);
  });
  it("retains focus on an otherwise empty dialog", () => {
    const { dialog } = fixture();
    const root = dialog();
    expect(dialogTabBoundary(root, null, false)).toBe(root);
    expect(dialogTabBoundary(root, root, true)).toBe(root);
  });
});
