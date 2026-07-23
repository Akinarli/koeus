import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenpeptTs } from "./genpeptParser.ts";

// A GenPept record exercising every field the parser extracts: DEFINITION with
// a MULTISPECIES prefix, GO qualifiers, a Region (domain), and an ORIGIN block.
const FIXTURE = `LOCUS       WP_231559878             456 aa            linear   BCT 06-APR-2026
DEFINITION  MULTISPECIES: oligosaccharide flippase family protein
            [Geobacillus].
ACCESSION   WP_231559878
VERSION     WP_231559878.1
SOURCE      Geobacillus
  ORGANISM  Geobacillus
            Bacteria; Bacillati; Bacillota; Bacilli; Caryophanales;
            Anoxybacillaceae.
REFERENCE   1  (residues 1 to 456)
  AUTHORS   Liu,D. and Reeves,P.R.
  TITLE     An O-antigen processing function for Wzx (RfbX): a promising
            candidate for O-unit flippase
  JOURNAL   J Bacteriol 178 (7), 2102-2107 (1996)
   PUBMED   8606190
FEATURES             Location/Qualifiers
     source          1..456
                     /organism="Geobacillus"
     Protein         1..456
                     /product="oligosaccharide flippase family protein"
                     /GO_component="GO:0016020 - membrane [Evidence IEA]"
                     /calculated_mol_wt=52368
     Region          1..331
                     /region_name="MATE_like"
ORIGIN
        1 mvssivtiis giflslvvpk ylgvvefgyf klfgfylglv
       41 gvgdlgirna llkfypmyaa
//
`;

test("parses core fields", () => {
  const r = parseGenpeptTs(FIXTURE);
  assert.equal(r.title, "oligosaccharide flippase family protein");
  assert.equal(r.accession, "WP_231559878");
  assert.equal(r.version, "WP_231559878.1");
  assert.equal(r.organism, "Geobacillus");
  assert.equal(r.molWt, 52368);
  assert.equal(r.length, 456);
  assert.deepEqual(r.lineage.slice(0, 3), ["Bacteria", "Bacillati", "Bacillota"]);
});

test("parses GO terms", () => {
  const r = parseGenpeptTs(FIXTURE);
  assert.equal(r.goTerms.length, 1);
  assert.deepEqual(r.goTerms[0], {
    id: "GO:0016020",
    label: "membrane",
    category: "component",
    evidence: "IEA",
  });
});

test("parses domains from Region features", () => {
  const r = parseGenpeptTs(FIXTURE);
  assert.deepEqual(r.domains, [{ name: "MATE_like", start: 1, end: 331 }]);
});

test("parses the ORIGIN sequence", () => {
  const r = parseGenpeptTs(FIXTURE);
  assert.equal(r.sequence?.startsWith("MVSSIVTIIS"), true);
  assert.equal(r.sequence?.includes(" "), false);
});

test("picks the most relevant reference", () => {
  const r = parseGenpeptTs(FIXTURE);
  assert.match(r.contextReference?.title ?? "", /flippase/i);
  assert.equal(r.contextReference?.pubmed, "8606190");
});
