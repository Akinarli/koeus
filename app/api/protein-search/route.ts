import { NextResponse } from "next/server";
import { esearch, esummary } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import type { ProteinHit, ProteinSuggestion } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUGGEST_SCAN = 60; // how many wildcard hits to summarize for suggestions
const MAX_SUGGESTIONS = 6;
const SUGGEST_CANDIDATES = 10; // validated down to MAX_SUGGESTIONS

function buildTerm(query: string, taxid: string) {
  return `${query}[Title] AND txid${taxid}[Organism]`;
}

async function searchIds(term: string, retmax: string): Promise<string[]> {
  const data = (await esearch("protein", term, { retmax })) as {
    esearchresult?: { idlist?: string[]; count?: string };
  };
  return data.esearchresult?.idlist ?? [];
}

/** How many records a term actually matches. Used to drop suggestions that
 *  would lead to an empty result page. */
async function searchCount(term: string): Promise<number> {
  const data = (await esearch("protein", term, { retmax: "0" })) as {
    esearchresult?: { count?: string };
  };
  return Number(data.esearchresult?.count ?? 0);
}

// NCBI titles come in several shapes:
//   "levansucrase [Geobacillus ...]"
//   "MULTISPECIES: levansucrase [Geobacillus]"
//   "RecName: Full=Inactive levansucrase; Flags: Precursor"
// Reduce each to a bare product name we can hand back as a search term.
function cleanTitle(raw: string): string {
  let t = raw.split(" [")[0].trim();
  t = t.replace(/^MULTISPECIES:\s*/i, "");
  const rec = /^RecName:\s*Full=([^;]+)/i.exec(t);
  if (rec) t = rec[1];
  t = t.replace(/;.*$/, "").trim();
  return t;
}

/** Group cleaned titles containing the query into ranked suggestions. */
function buildSuggestions(
  titles: string[],
  query: string,
): ProteinSuggestion[] {
  const needle = query.toLowerCase();
  const counts = new Map<string, { display: string; count: number }>();

  for (const raw of titles) {
    const name = cleanTitle(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    // Only suggest things that actually relate to what was typed.
    if (!key.includes(needle)) continue;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { display: name, count: 1 });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .slice(0, SUGGEST_CANDIDATES)
    .map((s) => ({ term: s.display, count: s.count }));
}

// Some esummary titles are display strings (SwissProt "RecName: Full=…",
// names with parentheses) that aren't in NCBI's [Title] index, so searching
// them returns nothing. Keep only candidates that actually match records, and
// report the real match count rather than the sampled one.
async function validateSuggestions(
  candidates: ProteinSuggestion[],
  taxid: string,
): Promise<ProteinSuggestion[]> {
  const checked = await Promise.all(
    candidates.map(async (c) => {
      try {
        const count = await searchCount(buildTerm(c.term, taxid));
        return count > 0 ? { term: c.term, count } : null;
      } catch {
        return null;
      }
    }),
  );
  return checked
    .filter((s): s is ProteinSuggestion => s !== null)
    .slice(0, MAX_SUGGESTIONS);
}

// esearch db=protein for a gene/protein name, scoped to an organism's taxid.
//
// NCBI's [Title] index matches whole words, so typing "levan" finds nothing even
// though "levansucrase" exists. When the exact term comes back empty we retry
// with a truncation wildcard ("levan*") and turn those hits into "did you mean"
// suggestions rather than silently returning nothing.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const taxid = (searchParams.get("taxid") ?? "").trim();
  const retmax = searchParams.get("retmax") ?? "20";

  if (!query || !taxid) {
    return NextResponse.json(
      { error: "missing ?q=<protein name>&taxid=<taxid>" },
      { status: 400 },
    );
  }

  try {
    const term = buildTerm(query, taxid);
    const idlist = await searchIds(term, retmax);

    if (idlist.length > 0) {
      const hits: ProteinHit[] = idlist.map((id) => ({ id }));
      return NextResponse.json({ hits, count: hits.length, term });
    }

    // Nothing matched the exact word. NCBI's [Title] index matches whole words,
    // so "levan" misses "levansucrase". Broaden to a truncation wildcard and
    // return those records DIRECTLY — the user shouldn't have to retype the full
    // name. We also summarize the distinct protein names matched so the UI can
    // offer to narrow (e.g. levansucrase vs levanase).
    const wildcardTerm = buildTerm(`${query}*`, taxid);
    const wildcardIds = await searchIds(wildcardTerm, String(SUGGEST_SCAN));

    if (wildcardIds.length === 0) {
      return NextResponse.json({ hits: [], count: 0, term, suggestions: [] });
    }

    const summary = (await esummary("protein", wildcardIds)) as {
      result?: Record<string, { title?: string }> & { uids?: string[] };
    };
    const result = summary.result;
    const orderedUids = result?.uids ?? wildcardIds;
    const titles = orderedUids
      .map((u) => result?.[u]?.title)
      .filter((t): t is string => typeof t === "string");
    const suggestions = await validateSuggestions(
      buildSuggestions(titles, query),
      taxid,
    );

    const hits: ProteinHit[] = orderedUids.map((id) => ({ id }));
    return NextResponse.json({
      hits,
      count: hits.length,
      term: wildcardTerm,
      broadenedFrom: query,
      suggestions,
    });
  } catch (err) {
    return handleError(err);
  }
}
