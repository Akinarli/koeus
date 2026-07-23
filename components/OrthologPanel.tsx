"use client";

import { useState } from "react";
import Link from "next/link";

interface OrthologGroup {
  organism: string;
  count: number;
  exampleAccession: string;
}

// "Where does this protein occur across the genus?" — an on-demand comparative
// view. Groups same-named proteins by species, scoped to the genus.
export default function OrthologPanel({
  product,
  genus,
}: {
  product: string;
  genus: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [groups, setGroups] = useState<OrthologGroup[]>([]);
  const [total, setTotal] = useState(0);

  async function scan() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/orthologs?product=${encodeURIComponent(product)}&genus=${encodeURIComponent(genus)}`,
      );
      const data = (await res.json()) as {
        groups?: OrthologGroup[];
        total?: number;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "Scan failed");
      setGroups(data.groups ?? []);
      setTotal(data.total ?? 0);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (!genus) return null;

  return (
    <section className="mt-4 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="eyebrow">across the genus</h3>
        {state === "idle" && (
          <button
            type="button"
            onClick={scan}
            className="rounded-full border border-rule bg-surface px-3 py-1 text-[12px] text-ink transition-colors hover:border-petrol"
          >
            find “{product}” in other{" "}
            <span className="italic">{genus}</span> species →
          </button>
        )}
        {state === "loading" && (
          <span className="eyebrow">scanning ncbi…</span>
        )}
      </div>

      {state === "loading" && <div className="thermal-track mt-3" />}

      {state === "error" && (
        <p className="mt-2 text-[13px] text-ember">Could not scan the genus.</p>
      )}

      {state === "done" && (
        <div className="mt-3">
          <p className="text-[12px] text-muted">
            {total} record{total === 1 ? "" : "s"} named “{product}” across{" "}
            <span className="data">{groups.length}</span>{" "}
            {groups.length === 1 ? "organism" : "organisms"}
          </p>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {groups.map((g) => (
              <li key={g.organism}>
                <Link
                  href={`/protein/${encodeURIComponent(g.exampleAccession)}`}
                  className="flex items-center justify-between gap-3 py-2 no-underline"
                >
                  <span className="text-[13px] italic text-ink hover:text-petrol">
                    {g.organism}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="data text-[11px] text-muted">
                      {g.exampleAccession}
                    </span>
                    <span className="data w-8 text-right text-[12px] text-muted">
                      {g.count}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
