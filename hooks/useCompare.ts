"use client";

import { useEffect, useState } from "react";
import type { ProteinRecord } from "@/lib/types";
import { getCompare, subscribeCompare } from "@/lib/compare";

// Reactive view of the compare basket. Starts empty on the server / first paint
// (localStorage isn't available during SSR) and fills in after mount, avoiding
// a hydration mismatch.
export function useCompare(): ProteinRecord[] {
  const [list, setList] = useState<ProteinRecord[]>([]);

  useEffect(() => {
    const sync = () => setList(getCompare());
    sync();
    return subscribeCompare(sync);
  }, []);

  return list;
}
