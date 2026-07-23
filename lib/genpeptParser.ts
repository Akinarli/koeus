// Self-contained TypeScript parser for GenPept (GenBank flat file, rettype=gp)
// protein records. This is the default parser so the app works with zero Python
// setup. The BioPython parser (api/parse_genpept.py) remains available as an
// opt-in / Vercel serverless path, but is no longer required for the app to run.
//
// GenBank flat-file layout it relies on:
//   - Top-level keywords (LOCUS, DEFINITION, ACCESSION, VERSION, SOURCE,
//     REFERENCE, FEATURES, ORIGIN, //) start in column 0; continuation lines are
//     indented under a blank keyword field.
//   - ORGANISM is a sub-entry of SOURCE; its continuation lines are the lineage.
//   - FEATURES qualifiers look like `/key="value"` (value may span lines) or
//     `/key=number`.

import type {
  GoCategory,
  GoTerm,
  ProteinDomain,
  ProteinRecord,
  ProteinReference,
} from "@/lib/types";

const GO_QUALIFIERS: Record<string, GoCategory> = {
  GO_component: "component",
  GO_function: "function",
  GO_process: "process",
};

const GO_VALUE_RE = /^\s*(GO:\d+)\s*-\s*(.+?)\s*(?:\[Evidence\s+([^\]]+)\])?\s*$/;

// GenBank flat files have three column levels:
//   col 0  — top-level keyword (LOCUS, DEFINITION, SOURCE, REFERENCE, FEATURES…)
//   col 2  — sub-keyword (ORGANISM under SOURCE; AUTHORS/TITLE/JOURNAL/PUBMED
//            under REFERENCE)
//   col 12 — continuation of a value (keyword + sub-keyword field left blank)

function isTopLevel(line: string): boolean {
  return line.length > 0 && line[0] !== " " && line.slice(0, 12).trim() !== "";
}

function keywordOf(line: string): string {
  return line.slice(0, 12).trim();
}

/** Inside a top-level block: column 0 is blank but the line has content. */
function isBlockContent(line: string): boolean {
  return line.length > 0 && line[0] === " " && line.trim() !== "";
}

/** A pure value-continuation line: the whole keyword field (cols 0-11) is blank. */
function isContinuationLine(line: string): boolean {
  return line.trim() !== "" && line.slice(0, 12).trim() === "";
}

/** Split a multi-record flat file into single records (defensive; efetch by one
 *  id normally returns exactly one). */
function firstRecordLines(text: string): string[] {
  const all = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of all) {
    if (line.trim() === "//") break;
    out.push(line);
  }
  return out;
}

function collectValue(
  lines: string[],
  startIdx: number,
): { value: string; nextIdx: number } {
  // Value is everything from column 12 on, plus any continuation lines.
  let value = lines[startIdx].slice(12).trim();
  let i = startIdx + 1;
  while (i < lines.length && isContinuationLine(lines[i])) {
    value += " " + lines[i].trim();
    i++;
  }
  return { value, nextIdx: i };
}

function parseGoValue(raw: string, category: GoCategory): GoTerm {
  const m = GO_VALUE_RE.exec(raw);
  if (!m) return { id: "", label: raw.trim(), category };
  const term: GoTerm = { id: m[1], label: m[2].trim(), category };
  if (m[3]) term.evidence = m[3].trim();
  return term;
}

function productKeywords(title: string): Set<string> {
  const stop = new Set([
    "protein",
    "putative",
    "family",
    "domain",
    "containing",
    "multispecies",
    "the",
    "and",
    "of",
  ]);
  const words = (title.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 2 && !stop.has(w),
  );
  return new Set(words);
}

function pickContextReference(
  refs: ProteinReference[],
  title: string,
): ProteinReference | undefined {
  const keywords = productKeywords(title);
  let best: ProteinReference | undefined;
  let bestScore = -1;
  for (const ref of refs) {
    if (!ref.title) continue;
    const t = ref.title.toLowerCase();
    let score = 0;
    for (const kw of keywords) if (t.includes(kw)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = ref;
    }
  }
  if (best && bestScore > 0) return best;
  return refs.find((r) => r.title);
}

export function parseGenpeptTs(text: string): ProteinRecord {
  const lines = firstRecordLines(text);
  if (lines.length === 0) throw new Error("empty GenPept text");

  let definition = "";
  let accession = "";
  let version = "";
  let organism = "";
  let lineage: string[] = [];
  let length: number | undefined;
  const references: ProteinReference[] = [];
  const goTerms: GoTerm[] = [];
  let product: string | undefined;
  let molWt: number | undefined;
  let domains: ProteinDomain[] = [];
  let sequence: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kw = keywordOf(line);

    if (kw === "LOCUS") {
      const m = /(\d+)\s+aa/.exec(line);
      if (m) length = Number(m[1]);
      i++;
    } else if (kw === "DEFINITION") {
      const { value, nextIdx } = collectValue(lines, i);
      definition = value.replace(/\.\s*$/, "");
      i = nextIdx;
    } else if (kw === "ACCESSION") {
      accession = line.slice(12).trim().split(/\s+/)[0] ?? "";
      i++;
    } else if (kw === "VERSION") {
      version = line.slice(12).trim().split(/\s+/)[0] ?? "";
      i++;
    } else if (kw === "SOURCE") {
      // Walk the block, looking for the ORGANISM sub-entry + its lineage.
      i++;
      while (i < lines.length && isBlockContent(lines[i])) {
        if (keywordOf(lines[i]) === "ORGANISM") {
          organism = lines[i].slice(12).trim();
          i++;
          // Continuation lines (col 12) are the taxonomy lineage.
          let lin = "";
          while (i < lines.length && isContinuationLine(lines[i])) {
            lin += " " + lines[i].trim();
            i++;
          }
          lineage = lin
            .replace(/\.\s*$/, "")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          i++;
        }
      }
    } else if (kw === "REFERENCE") {
      i++;
      const ref: ProteinReference = { title: "" };
      while (i < lines.length && isBlockContent(lines[i])) {
        const sub = keywordOf(lines[i]);
        if (sub === "TITLE") {
          const { value, nextIdx } = collectValue(lines, i);
          ref.title = value;
          i = nextIdx;
        } else if (sub === "JOURNAL") {
          const { value, nextIdx } = collectValue(lines, i);
          ref.journal = value;
          i = nextIdx;
        } else if (sub === "PUBMED") {
          ref.pubmed = lines[i].slice(12).trim();
          i++;
        } else {
          i++;
        }
      }
      if (ref.title || ref.journal) references.push(ref);
    } else if (kw === "FEATURES") {
      i++;
      const { data, nextIdx } = parseFeatures(lines, i);
      if (data.product && !product) product = data.product;
      if (data.molWt != null) molWt = data.molWt;
      for (const t of data.go) goTerms.push(t);
      domains = data.domains;
      i = nextIdx;
    } else if (kw === "ORIGIN") {
      i++;
      // ORIGIN lines are "   61 mkl..." — strip positions/spaces to the residues.
      let seq = "";
      while (i < lines.length && !isTopLevel(lines[i])) {
        seq += lines[i].replace(/[^A-Za-z]/g, "");
        i++;
      }
      if (seq) sequence = seq.toUpperCase();
    } else {
      i++;
    }
  }

  const title =
    product ||
    definition.replace(/^MULTISPECIES:\s*/i, "").replace(/\s*\[.*\]\s*$/, "").trim() ||
    definition;

  const record: ProteinRecord = {
    definition,
    title,
    accession: accession || version.split(".")[0],
    version,
    organism,
    lineage,
    goTerms,
    references,
  };
  if (molWt != null) record.molWt = molWt;
  if (length != null) record.length = length;
  else if (sequence) record.length = sequence.length;
  if (sequence) record.sequence = sequence;
  if (domains.length > 0) record.domains = domains;
  const ctx = pickContextReference(references, title);
  if (ctx) record.contextReference = ctx;
  return record;
}

interface FeatureData {
  product?: string;
  molWt?: number;
  go: GoTerm[];
  domains: ProteinDomain[];
}

// Walk the FEATURES block. Qualifiers belong to whichever feature currently
// applies: product / GO_* / calculated_mol_wt off the Protein feature, and
// /region_name off each Region feature (drawn later as domains on the scale
// bar). Returns the parsed data + the index just past the block.
function parseFeatures(
  lines: string[],
  start: number,
): { data: FeatureData; nextIdx: number } {
  let i = start;
  let curType = "";
  let curStart: number | undefined;
  let curEnd: number | undefined;
  const data: FeatureData = { go: [], domains: [] };

  while (i < lines.length) {
    const line = lines[i];
    // FEATURES ends when a new top-level keyword (col 0) appears.
    if (line.length > 0 && line[0] !== " ") break;

    const featureKey = line.slice(5, 21).trim();
    const isFeatureLine = line.slice(0, 21).trim() !== "" && featureKey !== "";

    if (isFeatureLine) {
      // A new feature key (source, Protein, Region, Site, CDS, ...). Parse its
      // location — "1..331", "<1..331", "23" — into a residue span.
      curType = featureKey;
      const loc = line.slice(21).trim();
      const range = /(\d+)\.\.[<>]?(\d+)/.exec(loc);
      const single = /^[<>]?(\d+)$/.exec(loc);
      if (range) {
        curStart = Number(range[1]);
        curEnd = Number(range[2]);
      } else if (single) {
        curStart = curEnd = Number(single[1]);
      } else {
        curStart = curEnd = undefined;
      }
      i++;
      continue;
    }

    const qual = line.trim();
    if (qual.startsWith("/")) {
      // Accumulate the (possibly multi-line, quoted) qualifier value.
      let buf = qual;
      let j = i + 1;
      const opensQuote = buf.includes('="') && (buf.match(/"/g)?.length ?? 0) < 2;
      if (opensQuote) {
        while (j < lines.length) {
          const t = lines[j].trim();
          if (t.startsWith("/") || lines[j][0] !== " ") break;
          buf += " " + t;
          if ((buf.match(/"/g)?.length ?? 0) >= 2) {
            j++;
            break;
          }
          j++;
        }
      }
      i = j > i + 1 ? j : i + 1;

      const eq = buf.indexOf("=");
      if (eq === -1) continue;
      const key = buf.slice(1, eq).trim();
      const value = buf.slice(eq + 1).trim().replace(/^"/, "").replace(/"$/, "").trim();

      if (curType === "Protein") {
        if (key === "product") data.product = value;
        else if (key === "calculated_mol_wt") {
          const n = Number(value);
          if (!Number.isNaN(n)) data.molWt = n;
        } else if (key in GO_QUALIFIERS) {
          data.go.push(parseGoValue(value, GO_QUALIFIERS[key]));
        }
      } else if (
        curType === "Region" &&
        key === "region_name" &&
        curStart != null &&
        curEnd != null &&
        value.toLowerCase() !== "n/a"
      ) {
        data.domains.push({ name: value, start: curStart, end: curEnd });
      }
      continue;
    }
    i++;
  }

  return { data, nextIdx: i };
}
