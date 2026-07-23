"use client";

import { useEffect, useState } from "react";
import type { ProteinRecord } from "@/lib/types";
import {
  COMPARE_MAX,
  getCompare,
  isInCompare,
  recordKey,
  subscribeCompare,
  toggleCompare,
} from "@/lib/compare";

// Small client island on each result card: adds/removes the protein from the
// compare basket. Reflects live state so the same protein shown twice stays in
// sync, and disables adding once the basket is full.
export default function CompareToggle({ record }: { record: ProteinRecord }) {
  const [inBasket, setInBasket] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInBasket(isInCompare(record));
      setFull(getCompare().length >= COMPARE_MAX);
    };
    sync();
    return subscribeCompare(sync);
  }, [record]);

  const disabled = !inBasket && full;

  return (
    <button
      type="button"
      onClick={() => setInBasket(toggleCompare(record))}
      disabled={disabled}
      aria-pressed={inBasket}
      title={
        disabled
          ? `Compare basket is full (${COMPARE_MAX})`
          : inBasket
            ? "Remove from comparison"
            : "Add to comparison"
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
        inBasket
          ? "border-petrol/50 bg-petrol-soft/60 text-petrol"
          : "border-rule bg-surface text-muted hover:border-petrol hover:text-ink"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      // Not a recordKey call at render — kept stable for React key elsewhere.
      data-key={recordKey(record)}
    >
      <span aria-hidden>{inBasket ? "✓" : "+"}</span>
      {inBasket ? "in comparison" : "compare"}
    </button>
  );
}
