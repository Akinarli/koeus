"use client";

import { useState } from "react";
import Link from "next/link";
import { useCompare } from "@/hooks/useCompare";
import { clearCompare, recordKey, removeFromCompare } from "@/lib/compare";
import { alignPercentIdentity } from "@/lib/align";
import type { ProteinDomain, ProteinRecord } from "@/lib/types";

function fasta(records: ProteinRecord[]): string {
  return records
    .filter((r) => r.sequence)
    .map((r) => {
      const header = `${r.version || r.accession} ${r.title} [${r.organism}]`;
      const wrapped = r.sequence!.match(/.{1,60}/g)?.join("\n") ?? r.sequence!;
      return `>${header}\n${wrapped}`;
    })
    .join("\n");
}

function csv(records: ProteinRecord[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = [
    "accession",
    "title",
    "organism",
    "length_aa",
    "mol_wt_da",
    "go_terms",
    "domains",
  ];
  const rows = records.map((r) =>
    [
      r.version || r.accession,
      r.title,
      r.organism,
      r.length ?? "",
      r.molWt ?? "",
      r.goTerms.map((g) => `${g.id} ${g.label}`).join("; "),
      (r.domains ?? []).map((d) => `${d.name} ${d.start}-${d.end}`).join("; "),
    ]
      .map((v) => esc(String(v)))
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// One protein's domain architecture on a shared scale, so stacked rows line up.
function DomainRow({
  length,
  max,
  domains,
}: {
  length?: number;
  max: number;
  domains?: ProteinDomain[];
}) {
  if (length == null) return <span className="text-[11px] text-muted">—</span>;
  const pct = Math.max(1.5, (length / max) * 100);
  return (
    <div className="relative h-3 w-full" title={`${length} aa`}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%` }}>
        <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-petrol/35" />
        {domains?.map((d, i) => (
          <span
            key={i}
            title={`${d.name} · ${d.start}–${d.end}`}
            className="absolute inset-y-0 rounded-sm bg-petrol/85"
            style={{
              left: `${((d.start - 1) / length) * 100}%`,
              width: `${Math.max(1, ((d.end - d.start + 1) / length) * 100)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const records = useCompare();
  const [identity, setIdentity] = useState<Record<string, number | null>>({});
  const [computing, setComputing] = useState(false);

  const maxLength = records.reduce((m, r) => Math.max(m, r.length ?? 0), 0) || 1;
  const withSeq = records.filter((r) => r.sequence);

  function computeIdentity() {
    setComputing(true);
    // Defer so the "computing…" state paints before the (sync) alignment work.
    setTimeout(() => {
      const out: Record<string, number | null> = {};
      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          const a = records[i].sequence;
          const b = records[j].sequence;
          const res = a && b ? alignPercentIdentity(a, b) : null;
          out[`${i}-${j}`] = res ? res.identity : null;
        }
      }
      setIdentity(out);
      setComputing(false);
    }, 20);
  }

  return (
    <div>
      <nav className="eyebrow flex items-center gap-2">
        <Link href="/" className="text-muted no-underline hover:text-ink">
          search
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">compare</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-[26px] font-semibold text-ink">
          Compare proteins
        </h1>
        {records.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <button
              type="button"
              onClick={() => download("proteins.fasta", fasta(records))}
              disabled={withSeq.length === 0}
              className="text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current disabled:opacity-40"
            >
              download FASTA ({withSeq.length})
            </button>
            <button
              type="button"
              onClick={() => download("proteins.csv", csv(records))}
              className="text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
            >
              download CSV
            </button>
            <button
              type="button"
              onClick={clearCompare}
              className="text-muted underline decoration-rule underline-offset-[3px] hover:text-ink"
            >
              clear all
            </button>
          </div>
        )}
      </header>

      {records.length === 0 && (
        <p className="mt-8 text-[14px] text-muted">
          Nothing to compare yet. Add proteins with the{" "}
          <span className="data">compare</span> button on any result, then come
          back here.
        </p>
      )}

      {records.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-rule text-left">
                  {["protein", "accession", "length", "mol. wt", "GO", "architecture"].map(
                    (h) => (
                      <th key={h} className="eyebrow py-2 pr-4 font-normal">
                        {h}
                      </th>
                    ),
                  )}
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={recordKey(r)} className="border-b border-rule align-top">
                    <td className="max-w-[220px] py-3 pr-4">
                      <Link
                        href={`/protein/${encodeURIComponent(r.version || r.accession)}`}
                        className="text-ink hover:text-petrol"
                      >
                        {r.title}
                      </Link>
                      <div className="text-[11px] italic text-muted">
                        {r.organism}
                      </div>
                    </td>
                    <td className="data py-3 pr-4 text-[12px] text-muted">
                      {r.version || r.accession}
                    </td>
                    <td className="data py-3 pr-4">{r.length ?? "—"}</td>
                    <td className="data py-3 pr-4">
                      {r.molWt != null ? r.molWt.toLocaleString("en-US") : "—"}
                    </td>
                    <td className="data py-3 pr-4">{r.goTerms.length || "—"}</td>
                    <td className="min-w-[160px] py-3 pr-4">
                      <DomainRow
                        length={r.length}
                        max={maxLength}
                        domains={r.domains}
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => removeFromCompare(recordKey(r))}
                        title="Remove"
                        className="text-[12px] text-muted hover:text-ember"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pairwise % identity */}
          {records.length >= 2 && (
            <section className="mt-8">
              <div className="flex items-center gap-3">
                <h2 className="eyebrow">pairwise % identity</h2>
                <button
                  type="button"
                  onClick={computeIdentity}
                  disabled={computing || withSeq.length < 2}
                  className="rounded-full border border-rule bg-surface px-3 py-1 text-[12px] text-ink transition-colors hover:border-petrol disabled:opacity-40"
                >
                  {computing ? "aligning…" : "compute"}
                </button>
              </div>
              {withSeq.length < 2 && (
                <p className="mt-2 text-[12px] text-muted">
                  Needs at least two proteins with sequences.
                </p>
              )}
              {Object.keys(identity).length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="border-collapse text-[12px]">
                    <tbody>
                      {records.map((ri, i) => (
                        <tr key={i}>
                          <td className="data py-1 pr-3 text-muted">
                            {ri.version || ri.accession}
                          </td>
                          {records.map((_, j) => {
                            if (i === j)
                              return (
                                <td key={j} className="px-2 py-1 text-center text-muted">
                                  —
                                </td>
                              );
                            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                            const v = identity[key];
                            return (
                              <td
                                key={j}
                                className="data px-2 py-1 text-center"
                                style={{
                                  color:
                                    v == null
                                      ? undefined
                                      : v >= 60
                                        ? "var(--petrol)"
                                        : "var(--muted)",
                                }}
                              >
                                {v == null ? "·" : `${v.toFixed(0)}%`}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
