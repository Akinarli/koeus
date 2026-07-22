# Geobacillus / Parageobacillus NCBI Explorer

Pick a *Geobacillus* / *Parageobacillus* species, browse its genome assemblies
(type-material assemblies surfaced first), then look up a gene/protein by name.
The app queries NCBI, fetches the matching GenBank/GenPept protein record, parses
it with BioPython, and renders a clean academic-style result card.

See [`PROJECT_SPEC1.md`](./PROJECT_SPEC1.md) for the full spec.

## Stack

- **Next.js (App Router) + TypeScript**, Tailwind CSS v4, deployable on Vercel.
- NCBI calls + GenPept parsing run **server-side** (API key stays off the client).
- GenPept parsing uses a **built-in TypeScript parser** (`lib/genpeptParser.ts`),
  so the app runs with **zero Python setup**. A BioPython parser
  (`api/parse_genpept.py`) is available as an opt-in (see below) and the app
  falls back to the TS parser automatically if it fails.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000 — that's it
```

Optional: add an NCBI API key for higher rate limits (10 req/sec vs 3). Create
`.env.local` (see `.env.example`) with:

```
NCBI_API_KEY=your_key_here
```

Get a key from your NCBI account settings.

### Optional: use BioPython instead of the built-in parser

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

Then in `.env.local`:

```
USE_PYTHON_PARSER=1
PYTHON_BIN=./.venv/bin/python
```

If the Python parser fails for any reason, results fall back to the TS parser.

## Run

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Verifying the parser (no network needed)

The parser has a built-in self-test against the `WP_051985049` flippase record
from the spec:

```bash
./.venv/bin/python api/parse_genpept.py --selftest
```

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/taxon?q=<name>` | Resolve species name → taxid (NCBI Datasets) |
| `GET /api/genomes?taxid=<id>` | List assemblies, type material first |
| `GET /api/protein-search?q=<name>&taxid=<id>` | esearch db=protein → UIDs |
| `GET /api/protein-fetch?id=<uid>` | efetch GenPept → parsed JSON (`&raw=1` for the flat file) |
| `POST /api/parse_genpept` | (Vercel Python fn) raw GenPept → JSON |

## Deployment notes

On Vercel, `api/parse_genpept.py` is deployed as a Python serverless function
(see `vercel.json`) and `PARSER_ENDPOINT=/api/parse_genpept` routes parsing there
instead of spawning a local Python process. Set `NCBI_API_KEY` in the Vercel
project env.

## Out of scope (v1)

Bulk FTP proteome download/parsing — single gene/protein lookup only for now.
