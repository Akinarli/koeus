// A tiny client-side "compare basket" persisted in localStorage, so proteins
// picked on the assembly page or a protein page survive navigation to /compare.
// Same-tab listeners are notified via a custom event (the native `storage` event
// only fires in *other* tabs).

import type { ProteinRecord } from "@/lib/types";

const KEY = "geo:compare";
const EVENT = "geo:compare-change";
const MAX = 8; // side-by-side comparison stays readable up to a handful

export function recordKey(r: ProteinRecord): string {
  return (r.version || r.accession || "").toLowerCase();
}

export function getCompare(): ProteinRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProteinRecord[]) : [];
  } catch {
    return [];
  }
}

function save(list: ProteinRecord[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

export function isInCompare(r: ProteinRecord): boolean {
  const k = recordKey(r);
  return getCompare().some((x) => recordKey(x) === k);
}

/** Add/remove a record; returns true if it is now in the basket. Ignores adds
 *  past MAX. */
export function toggleCompare(r: ProteinRecord): boolean {
  const list = getCompare();
  const k = recordKey(r);
  const idx = list.findIndex((x) => recordKey(x) === k);
  if (idx >= 0) {
    list.splice(idx, 1);
    save(list);
    return false;
  }
  if (list.length >= MAX) {
    save(list); // no-op persist; count unchanged
    return false;
  }
  list.push(r);
  save(list);
  return true;
}

export function removeFromCompare(key: string): void {
  save(getCompare().filter((x) => recordKey(x) !== key.toLowerCase()));
}

export function clearCompare(): void {
  save([]);
}

/** Subscribe to basket changes (this tab + other tabs). Returns an unsubscribe. */
export function subscribeCompare(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export const COMPARE_MAX = MAX;
