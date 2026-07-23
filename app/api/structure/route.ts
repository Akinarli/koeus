import { NextResponse } from "next/server";
import { handleError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400;

// Resolve a protein accession to a UniProt entry, then fetch its AlphaFold model
// and return the PDB text (proxied to avoid CORS in the browser viewer). 404
// when no UniProt mapping or no AlphaFold model exists.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accession = (searchParams.get("accession") ?? "").trim();
  // ?check=1 asks only whether a model exists (for the card badge), skipping the
  // ~100 KB PDB download so it can run for a whole page of results cheaply.
  const checkOnly = searchParams.get("check") === "1";
  if (!accession) {
    return NextResponse.json({ error: "missing ?accession=" }, { status: 400 });
  }

  try {
    // 1. accession -> UniProt primary accession
    const uniprotSearch = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(
      `xref:${accession}`,
    )}&fields=accession&format=json&size=1`;
    const uRes = await fetch(uniprotSearch, {
      headers: { Accept: "application/json" },
      next: { revalidate: DAY },
    });
    if (!uRes.ok) {
      return NextResponse.json(
        { error: `UniProt lookup failed (${uRes.status})` },
        { status: 502 },
      );
    }
    const uData = (await uRes.json()) as {
      results?: Array<{ primaryAccession?: string }>;
    };
    const uniprot = uData.results?.[0]?.primaryAccession;
    if (!uniprot) {
      if (checkOnly) return NextResponse.json({ available: false });
      return NextResponse.json(
        { error: `No UniProt entry maps to ${accession}.` },
        { status: 404 },
      );
    }

    // 2. UniProt -> AlphaFold model. Ask the API for the current model URL rather
    //    than hardcoding a file version (AlphaFold DB is on v6 now, not v4).
    const afRes = await fetch(
      `https://alphafold.ebi.ac.uk/api/prediction/${encodeURIComponent(uniprot)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "geobacillus-ncbi-explorer",
        },
        cache: "no-store",
      },
    );
    if (!afRes.ok) {
      if (checkOnly) return NextResponse.json({ available: false, uniprot });
      return NextResponse.json(
        { error: `No AlphaFold model for ${uniprot}.`, uniprot },
        { status: 404 },
      );
    }
    const afData = (await afRes.json()) as Array<{
      pdbUrl?: string;
      cifUrl?: string;
    }>;
    const pdbUrl = afData[0]?.pdbUrl;
    if (!pdbUrl) {
      if (checkOnly) return NextResponse.json({ available: false, uniprot });
      return NextResponse.json(
        { error: `No AlphaFold model for ${uniprot}.`, uniprot },
        { status: 404 },
      );
    }

    // Availability confirmed — the badge doesn't need the model bytes.
    if (checkOnly) return NextResponse.json({ available: true, uniprot });

    const mRes = await fetch(pdbUrl, { next: { revalidate: DAY } });
    if (!mRes.ok) {
      return NextResponse.json(
        { error: `AlphaFold model fetch failed (${mRes.status}).`, uniprot },
        { status: 502 },
      );
    }
    const pdb = await mRes.text();

    return NextResponse.json({ uniprot, format: "pdb", data: pdb });
  } catch (err) {
    return handleError(err);
  }
}
