// Neighbor-Joining tree from a pairwise distance matrix. Distances come from
// 1 - (percent identity / 100) over the compared proteins. Produces a rooted
// binary tree with branch lengths for a dendrogram; NJ itself is unrooted, so
// we root at the final join. Branch lengths can be slightly negative in NJ —
// clamp to 0 for display.

export interface TreeNode {
  name?: string; // leaf label (accession)
  length: number; // branch length to parent
  children?: TreeNode[];
}

interface Active {
  node: TreeNode;
}

export function neighborJoining(
  labels: string[],
  dist: number[][],
): TreeNode | null {
  const n = labels.length;
  if (n < 2) return null;
  if (n === 2) {
    return {
      length: 0,
      children: [
        { name: labels[0], length: dist[0][1] / 2 },
        { name: labels[1], length: dist[0][1] / 2 },
      ],
    };
  }

  // Working copies we shrink as we merge.
  let D = dist.map((row) => row.slice());
  let active: Active[] = labels.map((name) => ({ node: { name, length: 0 } }));

  while (active.length > 2) {
    const m = active.length;
    const r = D.map((row) => row.reduce((a, b) => a + b, 0));

    // Find the pair minimising the Q criterion.
    let bi = 0;
    let bj = 1;
    let best = Infinity;
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        const q = (m - 2) * D[i][j] - r[i] - r[j];
        if (q < best) {
          best = q;
          bi = i;
          bj = j;
        }
      }
    }

    const dij = D[bi][bj];
    const delta = (r[bi] - r[bj]) / (m - 2);
    const li = Math.max(0, (dij + delta) / 2);
    const lj = Math.max(0, (dij - delta) / 2);

    const merged: TreeNode = {
      length: 0,
      children: [
        { ...active[bi].node, length: li },
        { ...active[bj].node, length: lj },
      ],
    };

    // Distances from the new node to every remaining node.
    const newRow: number[] = [];
    for (let k = 0; k < m; k++) {
      if (k === bi || k === bj) continue;
      newRow.push((D[bi][k] + D[bj][k] - dij) / 2);
    }

    // Rebuild active list and distance matrix without bi, bj, plus the new node.
    const keep = active.filter((_, k) => k !== bi && k !== bj);
    const keepIdx = active.map((_, k) => k).filter((k) => k !== bi && k !== bj);
    const size = keep.length + 1;
    const nextD: number[][] = Array.from({ length: size }, () =>
      new Array(size).fill(0),
    );
    for (let a = 0; a < keep.length; a++) {
      for (let b = 0; b < keep.length; b++) {
        nextD[a][b] = D[keepIdx[a]][keepIdx[b]];
      }
      nextD[a][size - 1] = newRow[a];
      nextD[size - 1][a] = newRow[a];
    }

    active = [...keep, { node: merged }];
    D = nextD;
  }

  // Root at the final edge between the last two clusters.
  const d = D[0][1];
  return {
    length: 0,
    children: [
      { ...active[0].node, length: Math.max(0, d / 2) },
      { ...active[1].node, length: Math.max(0, d / 2) },
    ],
  };
}
