// Parses raw GenPept text into a structured ProteinRecord.
//
// The built-in TypeScript parser (lib/genpeptParser.ts) is the default, so the
// app works with zero Python setup and deploys as a plain Next.js app. The
// BioPython parser stays available as a local opt-in — set USE_PYTHON_PARSER=1
// to spawn scripts/parse_genpept.py. Any failure falls back to the TS parser so
// a misconfigured Python never produces a blank result.

import { spawn } from "node:child_process";
import path from "node:path";
import type { ProteinRecord } from "@/lib/types";
import { parseGenpeptTs } from "@/lib/genpeptParser";

// If PYTHON_BIN looks like a path (contains a separator), resolve it to an
// absolute path against the project root so it works regardless of the spawned
// process's cwd. A bare command like "python3" is left alone for PATH lookup.
function resolvePythonBin(): string {
  const bin = process.env.PYTHON_BIN || "python3";
  if (bin.includes("/") || bin.includes("\\")) {
    return path.resolve(process.cwd(), bin);
  }
  return bin;
}

const PYTHON_BIN = resolvePythonBin();
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "parse_genpept.py");

// If set (e.g. on Vercel), POST raw GenPept to this URL to use the Python
// serverless function. Opt-in.
const PARSER_ENDPOINT = process.env.PARSER_ENDPOINT;
// Opt-in to spawning the local BioPython subprocess.
const USE_PYTHON_PARSER = /^(1|true|yes)$/i.test(
  process.env.USE_PYTHON_PARSER ?? "",
);

export class ParseError extends Error {}

async function parseViaEndpoint(text: string): Promise<ProteinRecord> {
  const res = await fetch(PARSER_ENDPOINT as string, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  });
  const data = await res.json();
  if (!res.ok || (data && data.error)) {
    throw new ParseError(data?.error ?? `parser endpoint failed (${res.status})`);
  }
  return data as ProteinRecord;
}

function parseViaSubprocess(text: string): Promise<ProteinRecord> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("error", (err) =>
      reject(
        new ParseError(
          `could not start Python parser (${PYTHON_BIN}): ${err.message}. ` +
            `Set PYTHON_BIN in .env.local to a Python with biopython installed ` +
            `(e.g. ./.venv/bin/python).`,
        ),
      ),
    );

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(
          new ParseError(
            `parser exited with code ${code}: ${stderr.slice(0, 300)}`,
          ),
        );
        return;
      }
      try {
        const data = JSON.parse(stdout);
        if (data.error) {
          reject(new ParseError(data.error));
          return;
        }
        resolve(data as ProteinRecord);
      } catch {
        reject(
          new ParseError(
            `could not parse Python output: ${stdout.slice(0, 200)} ${stderr.slice(0, 200)}`,
          ),
        );
      }
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

export async function parseGenpept(text: string): Promise<ProteinRecord> {
  if (!text.trim()) throw new ParseError("empty GenPept text");

  // Try the opt-in Python path first, if configured. Fall back to the built-in
  // TS parser on any failure so a Python misconfiguration never breaks results.
  if (PARSER_ENDPOINT) {
    try {
      return await parseViaEndpoint(text);
    } catch {
      /* fall through to TS parser */
    }
  } else if (USE_PYTHON_PARSER) {
    try {
      return await parseViaSubprocess(text);
    } catch {
      /* fall through to TS parser */
    }
  }

  try {
    return parseGenpeptTs(text);
  } catch (err) {
    throw new ParseError(
      err instanceof Error ? err.message : "failed to parse GenPept record",
    );
  }
}
