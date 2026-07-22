import Link from "next/link";
import type { Assembly } from "@/lib/types";

// Green here is never decorative: it marks an assembly built from type material
// — the nomenclatural reference strain — which is the one a taxonomist would
// cite. Everything else stays neutral so that signal keeps its weight.
export default function GenomeCard({
  assembly,
  index = 0,
}: {
  assembly: Assembly;
  index?: number;
}) {
  const verified = assembly.isTypeMaterial;

  return (
    <Link
      href={{
        pathname: `/assembly/${encodeURIComponent(assembly.accession)}`,
        query: {
          taxid: String(assembly.taxid),
          organism: assembly.organism,
          name: assembly.name,
        },
      }}
      className="no-underline"
    >
      <article
        className={`rise rounded-lg border bg-surface p-4 transition-all hover:-translate-y-px ${
          verified
            ? "border-verified/35 hover:border-verified/60"
            : "border-rule hover:border-ink/25"
        }`}
        style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="data text-[13px] font-medium text-ink">
              {assembly.accession}
            </p>
            {assembly.name && assembly.name !== assembly.accession && (
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {assembly.name}
              </p>
            )}
          </div>
          {verified && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1 text-[11px] font-medium text-verified">
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2.5 6.2l2.3 2.3 4.7-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              type material
            </span>
          )}
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          {assembly.strain && (
            <div className="flex gap-1.5">
              <dt className="eyebrow leading-relaxed">strain</dt>
              <dd className="data text-muted">{assembly.strain}</dd>
            </div>
          )}
          {assembly.refseqCategory && (
            <div className="flex gap-1.5">
              <dt className="eyebrow leading-relaxed">category</dt>
              <dd className="text-muted">{assembly.refseqCategory}</dd>
            </div>
          )}
          {assembly.bioproject && (
            <div className="flex gap-1.5">
              <dt className="eyebrow leading-relaxed">bioproject</dt>
              <dd className="data text-muted">{assembly.bioproject}</dd>
            </div>
          )}
        </dl>
      </article>
    </Link>
  );
}
