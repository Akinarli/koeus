import type { ProteinRecord } from "@/lib/types";
import GoTermChip from "@/components/GoTermChip";

// The scale bar is the point of this card: a GenPept record tells you a protein
// is 419 aa, but that number means nothing on its own. Drawing every result on
// one shared scale — with a tick every 100 residues — makes the set instantly
// comparable, the way a domain diagram does in Pfam or InterPro.
function ScaleBar({ length, max }: { length: number; max: number }) {
  const pct = Math.max(2, (length / max) * 100);
  const ticks = Math.floor(length / 100);

  return (
    <div className="mt-4">
      <div className="relative h-2.5 w-full rounded-sm bg-sunk">
        <div
          className="absolute inset-y-0 left-0 rounded-sm bg-petrol/85"
          style={{ width: `${pct}%` }}
        >
          {Array.from({ length: ticks }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute inset-y-0 w-px bg-paper/45"
              style={{ left: `${((i + 1) * 100) / length * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="eyebrow">residues · ticks every 100</span>
        <span className="data text-[11px] text-ink">{length} aa</span>
      </div>
    </div>
  );
}

export default function ProteinResultCard({
  record,
  maxLength,
  index = 0,
}: {
  record: ProteinRecord;
  /** Longest protein in the current result set, so bars share one scale. */
  maxLength?: number;
  index?: number;
}) {
  const accessionUrl = `https://www.ncbi.nlm.nih.gov/protein/${record.version || record.accession}`;
  const genus = record.lineage.at(-1);

  return (
    <article
      className="rise rounded-lg border border-rule bg-surface p-5 transition-colors hover:border-ink/20"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <h3 className="display text-[22px] font-semibold text-ink">
        {record.title}
      </h3>

      <p className="mt-1 text-[13px] text-muted">
        <span className="italic">{record.organism}</span>
        {genus && genus !== record.organism && (
          <span className="data ml-2 text-[11px]">· {genus}</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <a
          href={accessionUrl}
          target="_blank"
          rel="noreferrer"
          className="data text-[12px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
        >
          {record.version || record.accession}
        </a>
        {record.molWt != null && (
          <span className="data text-[12px] text-muted">
            {record.molWt.toLocaleString("en-US")} Da
          </span>
        )}
      </div>

      {record.length != null && (
        <ScaleBar length={record.length} max={maxLength ?? record.length} />
      )}

      {record.goTerms.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {record.goTerms.map((term, i) => (
            <GoTermChip key={`${term.id}-${i}`} term={term} />
          ))}
        </div>
      )}

      {record.contextReference?.title && (
        <figure className="mt-4 border-t border-rule pt-3">
          <figcaption className="eyebrow mb-1">most relevant reference</figcaption>
          <blockquote className="text-[13px] leading-snug text-ink/85">
            {record.contextReference.title}
          </blockquote>
          {record.contextReference.pubmed && (
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${record.contextReference.pubmed}/`}
              target="_blank"
              rel="noreferrer"
              className="data mt-1.5 inline-block text-[11px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
            >
              PMID {record.contextReference.pubmed}
            </a>
          )}
        </figure>
      )}
    </article>
  );
}
