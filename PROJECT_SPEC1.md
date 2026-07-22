# Geobacillus / Parageobacillus NCBI Explorer — Project Spec

## 1. Purpose

An autonomous, web-based tool focused on **Geobacillus** (~248 genomes on NCBI) and
**Parageobacillus** (~68 genomes on NCBI). The user picks a species/strain, then a
gene/protein of interest (e.g. "flippase"), and the app autonomously queries NCBI,
fetches the matching GenBank protein record, parses it, and renders a clean,
academic-style result card (definition, GO terms, key reference, metadata).

This is a **new standalone project** (not a module of the existing BioLab Portal app,
though it shares the same general pattern: NCBI-integrated bioinformatics web tool).

Priority for v1: **single gene/protein lookup via E-utilities (esearch + efetch)**.
Bulk proteome download/analysis (FTP + gunzip) is explicitly **out of scope for v1** —
do not build that pipeline yet.

## 2. User flow

1. User types a species name, e.g. `Geobacillus icigianus`.
2. App resolves it to a NCBI Taxonomy ID (taxid) and lists the genome assemblies for
   that taxon, using the NCBI Datasets API.
3. Assemblies are sorted so that **type material / reference genome** assemblies
   appear **first**, based on `assembly_info.refseq_category` and
   `assembly_info.biosample.attributes` / type material indicators in the Datasets
   API response. This top assembly must also be **visually distinguished** from
   the rest — not just first in list order, but rendered with a distinct accent
   color / colored badge (e.g. a green "type material" chip, or a colored left
   border on the card) so it's immediately obvious at a glance which assembly is
   the type strain, matching the reference visual in NCBI's own UI (green
   checkmark badge next to `ASM75000v2` in the example screenshots). Both
   assemblies remain clickable regardless of rank — the styling is a visual cue,
   not a restriction.
4. User selects an assembly, then types a gene/protein name of interest, e.g.
   `flippase`.
5. App runs an NCBI `esearch` against the `protein` database, scoped to the
   organism's taxid (and optionally the specific assembly's BioProject/BioSample
   if the user wants results scoped to *that* genome specifically rather than the
   whole species).
6. For each hit (e.g. `WP_051985049`), app runs `efetch` (db=protein, rettype=gp,
   retmode=text) to retrieve the full GenBank flat file (GenPept format).
7. Backend parses the flat file and extracts:
   - `DEFINITION` → title (e.g. "flippase [Geobacillus icigianus]")
   - `ACCESSION` / `VERSION`
   - `GO_component`, `GO_function`, `GO_process` qualifiers → GO term chips
   - `REFERENCE` blocks → at minimum the `TITLE` field of the most relevant
     reference(s), shown as a small caption/context line under the GO terms
   - `calculated_mol_wt`
   - `ORGANISM` / taxonomy lineage
8. Frontend renders this as a clean, minimal, academic-style card (not a raw dump —
   this is the whole point of the tool: turn a GenBank flat file into something
   readable at a glance).

## 3. Example reference data (already validated against NCBI, use as ground truth)

Genome search example:
- `Geobacillus icigianus` → 2 assemblies:
  - `GCF_000750005.2` / `ASM75000v2` — **reference genome, assembly from type
    material**, strain G1w1, BioProject PRJNA246135. This one should rank first.
  - `GCA_050274015.1` / "Geobacillus icigianus ID-2" — non-type, ranks second.

Example GenPept record to validate the parser against (protein: flippase):

```
LOCUS       WP_051985049             419 aa            linear   BCT 09-JAN-2025
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
```

Expected rendered output (conceptually):
- Title: **flippase** — *Geobacillus icigianus*
- Accession: WP_051985049.1 · MW: 46,670 Da
- GO chips: `GO:0016020 membrane` (component) · `GO:0140327 flippase activity`
  (function)
- Context caption (from the most relevant REFERENCE's TITLE): "An O-antigen
  processing function for Wzx (RfbX): a promising candidate for O-unit flippase"

## 4. Architecture

- **Framework**: Next.js (App Router), deployed on Vercel — same general pattern as
  the existing BioLab Portal project, for consistency.
- **Backend logic lives in API routes**, not the client, because:
  - NCBI E-utilities calls should be rate-limited and keyed server-side.
  - GenBank flat-file parsing is more reliable in Python (BioPython) than
    hand-rolled JS regex.
- **Parsing service**: a Python serverless function (Vercel Python runtime, e.g.
  `api/parse_genpept.py`) that takes raw GenPept text and returns structured JSON
  using `Bio.SeqIO` (`SeqIO.read(handle, "genbank")`) — this handles multi-line
  REFERENCE blocks, multiple GO qualifiers, etc. without brittle regex.
- **NCBI API key required.** Without a key, E-utilities is capped at 3 req/sec;
  with a key, 10 req/sec. Store as `NCBI_API_KEY` env var, always send as
  `api_key` param on esearch/efetch/Datasets calls. Get key from NCBI account
  settings.

### 4.1 Suggested folder structure

```
/app
  /page.tsx                     -- species search UI
  /species/[taxid]/page.tsx     -- assembly list for a taxon
  /assembly/[accession]/page.tsx-- gene/protein search UI for a chosen assembly
  /api
    /taxon/route.ts             -- resolve species name -> taxid (Datasets API)
    /genomes/route.ts           -- list assemblies for a taxid, sorted by type material
    /protein-search/route.ts    -- esearch db=protein, term + taxid -> list of protein IDs
    /protein-fetch/route.ts     -- efetch db=protein, id -> raw GenPept text
    /parse_genpept.py           -- Python serverless fn: raw GenPept text -> structured JSON
/lib
  /ncbi.ts                       -- shared fetch helpers, api_key injection, rate limiting
  /types.ts                      -- TypeScript types for assemblies, protein records, GO terms
/components
  /GenomeCard.tsx
  /ProteinResultCard.tsx         -- the "academic-style" render target described in §3
  /GoTermChip.tsx
```

### 4.2 Key NCBI endpoints to wire up

- Taxon resolution / genome listing:
  `GET https://api.ncbi.nlm.nih.gov/datasets/v2/genome/taxon/{taxon}`
  (browser-callable, CORS-open, but proxy through our own API route anyway to
  inject the API key and normalize the response shape for the frontend)

- Protein search:
  `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`
  `?db=protein&term={query}[Title]+AND+txid{taxid}[Organism]&retmode=json&api_key=...`

- Protein fetch (raw GenPept):
  `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi`
  `?db=protein&id={id}&rettype=gp&retmode=text&api_key=...`

## 5. Non-goals for v1 (explicitly deferred)

- Bulk FTP download of whole proteomes (`*_protein.gpff.gz`) and local parsing —
  not needed while the tool stays single-gene-lookup focused. Revisit only if/when
  the user wants full-proteome scans (e.g. "find every CAZy/EPS gene in this
  genome").
- Any module integration with the existing BioLab Portal app — this is a fully
  separate project/repo.

## 6. Open questions to resolve during implementation

- When a species has multiple assemblies, should protein search be scoped to the
  single selected assembly (via BioProject/BioSample filter in the `esearch`
  term) or to the whole species/taxid? Current assumption: scope to taxid by
  default (matches how RefSeq protein records are shared across strains anyway,
  per the `COMMENT` field in the example record), but surface assembly context
  in the UI.
- UI styling/theme — not specified yet, default to a clean minimal academic look
  (whitespace-heavy, serif or clean sans headings, GO terms as small pill/chip
  components) unless told otherwise.
