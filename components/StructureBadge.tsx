"use client";

import { useEffect, useState } from "react";

// A small badge that tells you at a glance whether an AlphaFold 3D model exists
// for this protein, so you don't have to open each one. Uses the cheap
// ?check=1 path (no model download); results are cached server-side.
export default function StructureBadge({ accession }: { accession: string }) {
  const [state, setState] = useState<"loading" | "yes" | "no">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/structure?accession=${encodeURIComponent(accession)}&check=1`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState(d?.available ? "yes" : "no");
      })
      .catch(() => {
        if (!cancelled) setState("no");
      });
    return () => {
      cancelled = true;
    };
  }, [accession]);

  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rule px-2 py-0.5 text-[11px] text-muted/60">
        3D…
      </span>
    );
  }
  if (state === "no") {
    return (
      <span
        title="No AlphaFold model"
        className="inline-flex items-center gap-1 rounded-full border border-rule px-2 py-0.5 text-[11px] text-muted/70"
      >
        no 3D
      </span>
    );
  }
  return (
    <span
      title="AlphaFold 3D model available"
      className="inline-flex items-center gap-1 rounded-full border border-petrol/40 bg-petrol-soft/50 px-2 py-0.5 text-[11px] font-medium text-petrol"
    >
      <span aria-hidden>🧊</span> 3D
    </span>
  );
}
