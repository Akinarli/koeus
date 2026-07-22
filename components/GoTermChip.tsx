import type { GoTerm } from "@/lib/types";

// The three GO aspects answer different questions, so each gets a one-letter
// marker rather than three competing colours: F = molecular function (what it
// does), C = cellular component (where it is), P = biological process (what it
// takes part in). Function is the one researchers scan for, so it alone carries
// the petrol accent.
const ASPECT: Record<GoTerm["category"], { mark: string; title: string }> = {
  function: { mark: "F", title: "molecular function" },
  component: { mark: "C", title: "cellular component" },
  process: { mark: "P", title: "biological process" },
};

export default function GoTermChip({ term }: { term: GoTerm }) {
  const aspect = ASPECT[term.category];
  const isFunction = term.category === "function";
  const href = term.id
    ? `https://www.ebi.ac.uk/QuickGO/term/${term.id}`
    : undefined;

  const body = (
    <span
      className={`group inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 transition-colors ${
        isFunction
          ? "border-petrol/25 bg-petrol-soft/50 hover:border-petrol/50"
          : "border-rule bg-surface hover:border-ink/25"
      }`}
    >
      <span
        title={aspect.title}
        className={`data flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
          isFunction ? "bg-petrol text-paper" : "bg-sunk text-muted"
        }`}
      >
        {aspect.mark}
      </span>
      <span className="text-[13px] text-ink">{term.label}</span>
      {term.id && (
        <span className="data text-[10px] text-muted">
          {term.id.replace("GO:", "")}
        </span>
      )}
    </span>
  );

  if (!href) return body;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="no-underline"
      title={`${term.id} — ${aspect.title}${term.evidence ? ` · evidence ${term.evidence}` : ""}`}
    >
      {body}
    </a>
  );
}
