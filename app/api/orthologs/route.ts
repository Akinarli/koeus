import { NextResponse } from "next/server";
import { esearch, esummary } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCAN = 200;

interface OrthologGroup {
  organism: string;
  count: number;
  exampleAccession: string;
}

// Extract the organism from an esummary title's trailing "[...]".
function organismOf(title: string): string {
  const m = /\[([^\]]+)\]\s*$/.exec(title);
  return m ? m[1].trim() : "unclassified";
}

// "Orthologs" by shared product annotation: find proteins with the same product
// name across every species of a genus, grouped by organism. Not a phylogenetic
// orthology call, but a fast comparative-genomics view of where an annotation
// occurs. Scoped by the genus name in the Organism field (which explodes to all
// its species).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product = (searchParams.get("product") ?? "").trim();
  const genus = (searchParams.get("genus") ?? "").trim();
  if (!product || !genus) {
    return NextResponse.json(
      { error: "missing ?product=<name>&genus=<genus name>" },
      { status: 400 },
    );
  }

  const term = `${product}[Title] AND ${genus}[Organism]`;

  try {
    const search = (await esearch("protein", term, {
      retmax: String(SCAN),
    })) as { esearchresult?: { idlist?: string[]; count?: string } };
    const ids = search.esearchresult?.idlist ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ groups: [], total: 0, term });
    }

    const summary = (await esummary("protein", ids)) as {
      result?: Record<string, { title?: string; accessionversion?: string; caption?: string }> & {
        uids?: string[];
      };
    };
    const result = summary.result;
    const uids = result?.uids ?? [];

    const byOrg = new Map<string, OrthologGroup>();
    for (const uid of uids) {
      const row = result?.[uid];
      if (!row?.title) continue;
      const organism = organismOf(row.title);
      const acc = row.accessionversion || row.caption || uid;
      const existing = byOrg.get(organism);
      if (existing) existing.count++;
      else byOrg.set(organism, { organism, count: 1, exampleAccession: acc });
    }

    const groups = [...byOrg.values()].sort(
      (a, b) => b.count - a.count || a.organism.localeCompare(b.organism),
    );

    return NextResponse.json({
      groups,
      total: Number(search.esearchresult?.count ?? uids.length),
      term,
    });
  } catch (err) {
    return handleError(err);
  }
}
