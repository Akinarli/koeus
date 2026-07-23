import type { AssemblyStats } from "@/lib/types";

function mb(bp?: number): string | null {
  if (bp == null) return null;
  return `${(bp / 1_000_000).toFixed(2)} Mb`;
}

function num(n?: number): string | null {
  return n == null ? null : n.toLocaleString("en-US");
}

// A compact strip of the genome's headline numbers. Each cell is only rendered
// when NCBI provides that stat, so draft assemblies without annotation degrade
// gracefully.
export default function AssemblyStatsStrip({ stats }: { stats: AssemblyStats }) {
  const cells: Array<{ label: string; value: string | null }> = [
    { label: "genome", value: mb(stats.genomeSize) },
    { label: "GC", value: stats.gcPercent != null ? `${stats.gcPercent}%` : null },
    { label: "contig N50", value: mb(stats.contigN50) },
    { label: "genes", value: num(stats.geneTotal) },
    { label: "proteins", value: num(stats.proteinCoding) },
    { label: "pseudogenes", value: num(stats.pseudogene) },
  ].filter((c) => c.value !== null);

  const tax = stats.taxonomyCheckStatus;
  const hasAni = stats.bestAni != null;
  const taxOk = tax?.toUpperCase() === "OK";

  if (cells.length === 0 && !tax && !hasAni) return null;

  return (
    <div className="mt-5 rounded-lg border border-rule bg-surface p-4">
      {cells.length > 0 && (
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
          {cells.map((c) => (
            <div key={c.label}>
              <dt className="eyebrow">{c.label}</dt>
              <dd className="data mt-0.5 text-[15px] text-ink">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {(tax || hasAni) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3">
          {tax && (
            <div className="flex items-center gap-2">
              <span className="eyebrow">taxonomy check</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                  taxOk
                    ? "bg-verified-soft text-verified"
                    : "bg-ember-soft text-ember"
                }`}
              >
                {taxOk && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M2.5 6.2l2.3 2.3 4.7-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {tax}
              </span>
            </div>
          )}

          {hasAni && (
            <div className="flex items-baseline gap-2">
              <span className="eyebrow">best ANI</span>
              <span className="data text-[15px] text-ink">
                {stats.bestAni!.toFixed(1)}%
              </span>
              {stats.bestAniOrganism && (
                <span className="text-[12px] italic text-muted">
                  vs {stats.bestAniOrganism}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {stats.annotationName && (
        <p className="mt-3 text-[11px] text-muted">{stats.annotationName}</p>
      )}
    </div>
  );
}
