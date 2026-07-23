"use client";

import { useState } from "react";

// FASTA-wrapped sequence with copy + download. A client island inside the
// otherwise-static result card, since it needs local expand/copy state.
function toFasta(header: string, seq: string): string {
  const wrapped = seq.match(/.{1,60}/g)?.join("\n") ?? seq;
  return `>${header}\n${wrapped}\n`;
}

export default function ProteinSequence({
  header,
  sequence,
}: {
  header: string;
  sequence: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyFasta() {
    try {
      await navigator.clipboard.writeText(toFasta(header, sequence));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the download button still works */
    }
  }

  function download() {
    const blob = new Blob([toFasta(header, sequence)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${header.split(/\s/)[0] || "protein"}.fasta`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="eyebrow flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
          aria-expanded={open}
        >
          <span
            className="inline-block transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "none" }}
            aria-hidden
          >
            ▸
          </span>
          sequence · {sequence.length} aa
        </button>
        <button
          type="button"
          onClick={copyFasta}
          className="data text-[11px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
        >
          {copied ? "copied ✓" : "copy FASTA"}
        </button>
        <button
          type="button"
          onClick={download}
          className="data text-[11px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
        >
          download .fasta
        </button>
      </div>

      {open && (
        <pre className="data mt-3 max-h-56 overflow-auto rounded-md bg-sunk p-3 text-[11px] leading-relaxed text-ink/90">
          {sequence.match(/.{1,10}/g)?.map((block, i) => (
            <span key={i}>
              {block}
              {(i + 1) % 6 === 0 ? "\n" : " "}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}
