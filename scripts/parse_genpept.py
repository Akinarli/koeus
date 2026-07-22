"""Parse a raw GenPept (GenBank flat file, rettype=gp) protein record into the
structured JSON shape the frontend renders.

Uses BioPython's SeqIO so multi-line REFERENCE blocks, multiple GO qualifiers,
etc. are handled robustly instead of with brittle regex.

Three ways to run it:

  * CLI / subprocess (what the Next.js dev server uses locally):
        echo "<genpept text>" | python3 scripts/parse_genpept.py
    reads GenPept from stdin, writes JSON to stdout.

  * Self-test against the WP_051985049 ground-truth fixture from the spec:
        python3 scripts/parse_genpept.py --selftest

  * Vercel Python serverless function: the `handler` class below is picked up by
    Vercel's Python runtime; POST the raw GenPept text as the request body.
"""

from __future__ import annotations

import json
import re
import sys
from io import StringIO
from typing import Any

from Bio import SeqIO

# "GO:0016020 - membrane [Evidence IEA]"
_GO_RE = re.compile(
    r"^\s*(GO:\d+)\s*-\s*(.+?)\s*(?:\[Evidence\s+([^\]]+)\])?\s*$"
)

_GO_QUALIFIERS = {
    "GO_component": "component",
    "GO_function": "function",
    "GO_process": "process",
}


def _first(qualifiers: dict, key: str) -> str | None:
    val = qualifiers.get(key)
    if not val:
        return None
    return val[0]


def _parse_go(qualifiers: dict) -> list[dict[str, str]]:
    terms: list[dict[str, str]] = []
    for qual, category in _GO_QUALIFIERS.items():
        for raw in qualifiers.get(qual, []) or []:
            m = _GO_RE.match(raw)
            if not m:
                # Keep something rather than silently dropping an unparsed term.
                terms.append({"id": "", "label": raw.strip(), "category": category})
                continue
            term = {
                "id": m.group(1),
                "label": m.group(2).strip(),
                "category": category,
            }
            if m.group(3):
                term["evidence"] = m.group(3).strip()
            terms.append(term)
    return terms


def _product_keywords(title: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", title.lower())
    stop = {"protein", "putative", "family", "domain", "containing", "the", "of", "a"}
    return {w for w in words if len(w) > 2 and w not in stop}


def _pick_context_reference(
    references: list[dict[str, Any]], title: str
) -> dict[str, Any] | None:
    """Choose the single most relevant reference for the caption: the one whose
    title overlaps most with the product/gene name. Falls back to the first
    reference that actually has a title."""
    keywords = _product_keywords(title)
    best = None
    best_score = -1
    for ref in references:
        rtitle = (ref.get("title") or "").lower()
        if not rtitle:
            continue
        score = sum(1 for kw in keywords if kw in rtitle)
        if score > best_score:
            best_score = score
            best = ref
    if best is not None and best_score > 0:
        return best
    # No keyword overlap: first titled reference, if any.
    for ref in references:
        if ref.get("title"):
            return ref
    return None


def parse_genpept(text: str) -> dict[str, Any]:
    record = SeqIO.read(StringIO(text), "genbank")
    ann = record.annotations

    definition = (record.description or "").rstrip(".")

    # Product title: prefer the Protein feature /product, else the DEFINITION up
    # to the organism bracket, e.g. "flippase [Geobacillus icigianus]".
    title = None
    mol_wt = None
    length = None
    for feat in record.features:
        if feat.type == "Protein":
            title = title or _first(feat.qualifiers, "product")
            mw = _first(feat.qualifiers, "calculated_mol_wt")
            if mw is not None:
                try:
                    mol_wt = int(mw)
                except ValueError:
                    mol_wt = None
            try:
                length = int(feat.location.end)
            except Exception:  # noqa: BLE001
                pass
    if not title:
        title = re.sub(r"\s*\[.*\]\s*$", "", definition).strip() or definition

    if length is None:
        try:
            length = len(record.seq)
        except Exception:  # noqa: BLE001
            length = None

    version = record.id or ""
    accessions = ann.get("accessions") or []
    accession = accessions[0] if accessions else (record.name or version.split(".")[0])

    references: list[dict[str, Any]] = []
    for ref in ann.get("references", []) or []:
        entry: dict[str, Any] = {}
        if ref.title:
            entry["title"] = ref.title.strip()
        if ref.journal:
            entry["journal"] = ref.journal.strip()
        if ref.pubmed_id:
            entry["pubmed"] = ref.pubmed_id.strip()
        if entry:
            references.append(entry)

    context_ref = _pick_context_reference(references, title)

    result: dict[str, Any] = {
        "definition": definition,
        "title": title,
        "accession": accession,
        "version": version,
        "organism": ann.get("organism", ""),
        "lineage": ann.get("taxonomy", []) or [],
        "goTerms": _parse_go_from_record(record),
        "references": references,
    }
    if mol_wt is not None:
        result["molWt"] = mol_wt
    if length is not None:
        result["length"] = length
    if context_ref is not None:
        result["contextReference"] = context_ref
    return result


def _parse_go_from_record(record) -> list[dict[str, str]]:
    for feat in record.features:
        if feat.type == "Protein":
            terms = _parse_go(feat.qualifiers)
            if terms:
                return terms
    # Some records carry GO on the source/CDS feature instead.
    terms: list[dict[str, str]] = []
    for feat in record.features:
        terms.extend(_parse_go(feat.qualifiers))
    return terms


# --- Vercel Python serverless handler ---------------------------------------
try:
    from http.server import BaseHTTPRequestHandler

    class handler(BaseHTTPRequestHandler):  # noqa: N801 (Vercel requires this name)
        def do_POST(self):  # noqa: N802
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8", "replace")
            self._respond(body)

        def do_GET(self):  # noqa: N802
            self._send_json(200, {"ok": True, "usage": "POST raw GenPept text"})

        def _respond(self, body: str):
            try:
                data = parse_genpept(body)
                self._send_json(200, data)
            except Exception as exc:  # noqa: BLE001
                self._send_json(400, {"error": f"parse failed: {exc}"})

        def _send_json(self, status: int, payload: dict):
            raw = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def log_message(self, *_args):  # silence default logging
            return

except Exception:  # noqa: BLE001 - http.server always available, but be safe
    handler = None  # type: ignore[assignment]


# --- CLI / subprocess entrypoint --------------------------------------------
def _selftest() -> int:
    fixture = """LOCUS       WP_051985049             419 aa            linear   BCT 09-JAN-2025
DEFINITION  flippase [Geobacillus icigianus].
ACCESSION   WP_051985049
VERSION     WP_051985049.1
KEYWORDS    RefSeq.
SOURCE      Geobacillus icigianus
  ORGANISM  Geobacillus icigianus
            Bacteria; Bacillati; Bacillota; Bacilli; Bacillales;
            Anoxybacillaceae; Geobacillus.
REFERENCE   1  (residues 1 to 419)
  AUTHORS   Samuel,G. and Reeves,P.
  TITLE     Biosynthesis of O-antigens: genes and pathways involved in
            nucleotide sugar precursor synthesis and O-antigen assembly
  JOURNAL   Carbohydr Res 338 (23), 2503-2519 (2003)
   PUBMED   14670712
REFERENCE   2  (residues 1 to 419)
  AUTHORS   Liu,D., Cole,R.A. and Reeves,P.R.
  TITLE     An O-antigen processing function for Wzx (RfbX): a promising
            candidate for O-unit flippase
  JOURNAL   J Bacteriol 178 (7), 2102-2107 (1996)
   PUBMED   8606190
FEATURES             Location/Qualifiers
     source          1..419
                     /organism="Geobacillus icigianus"
                     /db_xref="taxon:1430331"
     Protein         1..419
                     /product="flippase"
                     /GO_component="GO:0016020 - membrane [Evidence IEA]"
                     /GO_function="GO:0140327 - flippase activity [Evidence IEA]"
                     /calculated_mol_wt=46670
ORIGIN
//
"""
    result = parse_genpept(fixture)
    print(json.dumps(result, indent=2))
    ok = True

    def check(label: str, cond: bool):
        nonlocal ok
        ok = ok and cond
        print(("PASS " if cond else "FAIL ") + label, file=sys.stderr)

    check("title == flippase", result["title"] == "flippase")
    check("accession == WP_051985049", result["accession"] == "WP_051985049")
    check("version == WP_051985049.1", result["version"] == "WP_051985049.1")
    check("molWt == 46670", result.get("molWt") == 46670)
    check("length == 419", result.get("length") == 419)
    check("organism == Geobacillus icigianus", result["organism"] == "Geobacillus icigianus")
    check("2 GO terms", len(result["goTerms"]) == 2)
    go_ids = {t["id"] for t in result["goTerms"]}
    check("GO ids present", go_ids == {"GO:0016020", "GO:0140327"})
    ctx = result.get("contextReference") or {}
    check(
        "context ref is the flippase paper",
        "flippase" in (ctx.get("title") or "").lower(),
    )
    return 0 if ok else 1


def main() -> int:
    if "--selftest" in sys.argv[1:]:
        return _selftest()
    text = sys.stdin.read()
    if not text.strip():
        print(json.dumps({"error": "empty input"}))
        return 1
    try:
        print(json.dumps(parse_genpept(text)))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"parse failed: {exc}"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
