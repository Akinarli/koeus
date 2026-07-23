"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "@/hooks/useCompare";
import { clearCompare } from "@/lib/compare";

// A floating bar that appears once the compare basket has anything in it, from
// any page. Hidden on /compare itself (you're already there).
export default function CompareBar() {
  const list = useCompare();
  const pathname = usePathname();

  if (list.length === 0 || pathname === "/compare") return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-rule bg-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-[13px] text-ink">
          <span className="data font-medium">{list.length}</span> in comparison
        </span>
        <button
          type="button"
          onClick={clearCompare}
          className="text-[12px] text-muted underline decoration-rule underline-offset-[3px] hover:text-ink"
        >
          clear
        </button>
        <Link
          href="/compare"
          className="rounded-full bg-petrol px-3.5 py-1.5 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Compare →
        </Link>
      </div>
    </div>
  );
}
