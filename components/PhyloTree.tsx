"use client";

import Link from "next/link";
import type { TreeNode } from "@/lib/tree";

interface Positioned {
  node: TreeNode;
  x: number; // cumulative distance from root
  y: number; // row position
  parentX: number;
}

const ROW_H = 24;
const BRANCH_W = 240; // px reserved for the branches
const LABEL_W = 170;

// Lay the tree out: leaves get sequential rows, internal nodes sit at the mean
// of their children, x is the distance from the root.
function layout(root: TreeNode): { placed: Positioned[]; maxX: number; leaves: number } {
  const placed: Positioned[] = [];
  let leafRow = 0;
  let maxX = 0;

  function walk(node: TreeNode, parentX: number): number {
    const x = parentX + (node.length || 0);
    maxX = Math.max(maxX, x);
    if (!node.children || node.children.length === 0) {
      const y = leafRow++ + 0.5;
      placed.push({ node, x, y, parentX });
      return y;
    }
    const ys = node.children.map((c) => walk(c, x));
    const y = ys.reduce((a, b) => a + b, 0) / ys.length;
    placed.push({ node, x, y, parentX });
    return y;
  }

  walk(root, 0);
  return { placed, maxX, leaves: leafRow };
}

export default function PhyloTree({ root }: { root: TreeNode }) {
  const { placed, maxX, leaves } = layout(root);
  const xScale = maxX > 0 ? BRANCH_W / maxX : 0;
  const height = leaves * ROW_H + 16;
  const width = BRANCH_W + LABEL_W;

  const px = (x: number) => 4 + x * xScale;
  const py = (y: number) => 8 + y * ROW_H;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="text-ink">
        {placed.map((p, i) => {
          const isLeaf = !p.node.children;
          return (
            <g key={i}>
              {/* horizontal branch from parent to this node */}
              <line
                x1={px(p.parentX)}
                y1={py(p.y)}
                x2={px(p.x)}
                y2={py(p.y)}
                stroke="var(--petrol)"
                strokeWidth={1.4}
              />
              {/* vertical connector spanning this node's children */}
              {p.node.children && (
                <line
                  x1={px(p.x)}
                  y1={py(Math.min(...childYs(p.node, placed)))}
                  x2={px(p.x)}
                  y2={py(Math.max(...childYs(p.node, placed)))}
                  stroke="var(--petrol)"
                  strokeWidth={1.4}
                />
              )}
              {isLeaf && p.node.name && (
                <Link href={`/protein/${encodeURIComponent(p.node.name)}`}>
                  <text
                    x={px(p.x) + 6}
                    y={py(p.y) + 4}
                    className="data fill-[var(--ink)] text-[11px] hover:fill-[var(--petrol)]"
                  >
                    {p.node.name}
                  </text>
                </Link>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// The y-positions of a node's direct children (already placed).
function childYs(node: TreeNode, placed: Positioned[]): number[] {
  return (node.children ?? [])
    .map((c) => placed.find((p) => p.node === c)?.y)
    .filter((y): y is number => y != null);
}
