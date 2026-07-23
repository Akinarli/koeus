// Needleman-Wunsch global pairwise alignment for two protein sequences, used to
// report a % identity between compared proteins. Simple match/mismatch/gap
// scoring is enough for an identity figure; this isn't meant to replace EMBOSS.

export interface AlignmentResult {
  /** Identical columns / alignment length, as a percentage. */
  identity: number;
  /** Identical aligned residues. */
  matches: number;
  /** Total columns in the alignment (including gaps). */
  alignmentLength: number;
  lengthA: number;
  lengthB: number;
}

const MATCH = 1;
const MISMATCH = -1;
const GAP = -1;
// Guard against pathological sizes: a 3000×3000 matrix is ~9M cells, still fast,
// but bail beyond that rather than risk the tab.
const MAX_LEN = 3000;

export function alignPercentIdentity(
  a: string,
  b: string,
): AlignmentResult | null {
  if (!a || !b || a.length > MAX_LEN || b.length > MAX_LEN) return null;

  const n = a.length;
  const m = b.length;
  // Score matrix as a flat array; only need the current and previous row for the
  // score, but we backtrack, so keep a compact direction matrix instead.
  const prev = new Int32Array(m + 1);
  const curr = new Int32Array(m + 1);
  // direction: 0 diag, 1 up (gap in b), 2 left (gap in a)
  const dir = new Uint8Array((n + 1) * (m + 1));

  for (let j = 0; j <= m; j++) {
    prev[j] = j * GAP;
    dir[j] = 2;
  }
  dir[0] = 0;

  for (let i = 1; i <= n; i++) {
    curr[0] = i * GAP;
    dir[i * (m + 1)] = 1;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const diag = prev[j - 1] + (ai === b.charCodeAt(j - 1) ? MATCH : MISMATCH);
      const up = prev[j] + GAP;
      const left = curr[j - 1] + GAP;
      let best = diag;
      let d = 0;
      if (up > best) {
        best = up;
        d = 1;
      }
      if (left > best) {
        best = left;
        d = 2;
      }
      curr[j] = best;
      dir[i * (m + 1) + j] = d;
    }
    prev.set(curr);
  }

  // Backtrack to count matches and alignment length.
  let i = n;
  let j = m;
  let matches = 0;
  let alignmentLength = 0;
  while (i > 0 || j > 0) {
    const d = dir[i * (m + 1) + j];
    alignmentLength++;
    if (i > 0 && j > 0 && d === 0) {
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) matches++;
      i--;
      j--;
    } else if (i > 0 && d === 1) {
      i--;
    } else {
      j--;
    }
  }

  return {
    identity: alignmentLength ? (matches / alignmentLength) * 100 : 0,
    matches,
    alignmentLength,
    lengthA: n,
    lengthB: m,
  };
}
