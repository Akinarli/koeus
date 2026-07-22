import { NextResponse } from "next/server";
import { datasetsTaxonomy } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import type { TaxonResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TaxonomyNode {
  taxonomy?: {
    tax_id?: number;
    organism_name?: string;
    rank?: string;
    counts?: Array<{ type?: string; count?: number }>;
  };
}

// Resolve a species OR genus name (or a taxid) to its own taxid + rank via the
// Datasets taxonomy endpoint. Using the taxonomy service — rather than reading
// the organism off the first genome report — is what makes "Geobacillus"
// resolve to the genus (taxid 129337, 248 assemblies) instead of silently
// landing on whichever species happened to come back first.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "missing ?q=<taxon name or taxid>" }, { status: 400 });
  }

  try {
    const data = (await datasetsTaxonomy(query)) as {
      taxonomy_nodes?: TaxonomyNode[];
    };

    const node = data.taxonomy_nodes?.[0]?.taxonomy;
    if (!node?.tax_id) {
      return NextResponse.json(
        { error: `No NCBI taxon found for "${query}".` },
        { status: 404 },
      );
    }

    const assemblyCount = node.counts?.find(
      (c) => c.type === "COUNT_TYPE_ASSEMBLY",
    )?.count;

    const result: TaxonResult = {
      taxid: node.tax_id,
      organism: node.organism_name ?? query,
      rank: node.rank ?? "",
      ...(assemblyCount != null ? { assemblyCount } : {}),
    };
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
