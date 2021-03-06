import { Cell, Edge, createLevel } from './level';
import { Vector, vector } from '../lib/math';

class Failure extends Error {}

interface CellInfo {
  pos: Vector;
  edges: number;
}

function tc(x: number, y: number, edges: number) {
  return { pos: vector(x, y), edges };
}

interface Test {
  name: string;
  cells: CellInfo[];
  // NOTE: this can no longer be checked.
  bounds: number[]; // Top, left, bottom, right.
}

const tests: readonly Test[] = [
  {
    name: '1. basic',
    cells: [tc(0, 0, 4)],
    bounds: [1, 1, 1, 1],
  },
  {
    name: '2. horizontal',
    cells: [tc(0, 1, 4), tc(0, -1, 4)],
    bounds: [1, 2, 1, 2],
  },
  {
    name: '2. vertical',
    cells: [tc(1, 0, 4), tc(-1, 0, 4)],
    bounds: [2, 1, 2, 1],
  },
  {
    name: '2: corner',
    cells: [tc(0, 0, 5), tc(4, 4, 3)],
    bounds: [2, 1, 1, 2],
  },
  {
    name: '2. diagonal A',
    cells: [tc(-1, 1, 3), tc(1, -1, 3)],
    bounds: [1, 1, 1, 1],
  },
  {
    name: '2. diagonal B',
    cells: [tc(1, 1, 3), tc(-1, -1, 3)],
    bounds: [1, 1, 1, 1],
  },
  {
    name: '2. diagnonal C',
    cells: [tc(0, -1, 4), tc(1, 1, 4)],
    bounds: [1, 2, 1, 2],
  },
  {
    name: '3. wye',
    cells: [tc(0, -1, 5), tc(1, 1, 4), tc(-1, 1, 4)],
    bounds: [2, 2, 1, 2],
  },
  {
    name: '3. stack',
    cells: [tc(0, 0, 4), tc(0, 1, 4), tc(0, -1, 4)],
    bounds: [1, 3, 1, 3],
  },
  {
    name: '4: square',
    cells: [tc(1, 1, 4), tc(-1, -1, 4), tc(1, -1, 4), tc(-1, 1, 4)],
    bounds: [2, 2, 2, 2],
  },
  {
    // Four cells on the boundary plus an interior rectangle.
    name: '5: interior',
    cells: [tc(0, 4, 6), tc(2, 0, 4), tc(0, -3, 6), tc(-1, 0, 4), tc(0, 0, 4)],
    bounds: [1, 3, 1, 3],
  },
];

function winding(v1: Vector, v2: Vector, v3: Vector): number {
  const dx1 = v2.x - v1.x;
  const dx2 = v3.x - v1.x;
  const dy1 = v2.y - v1.y;
  const dy2 = v3.y - v1.y;
  return dx1 * dy2 - dx2 * dy1;
}

function pt(v: Vector): string {
  return `(${v.x},${v.y})`;
}

function pcell(c: Cell | null) {
  return c ? `cell[${c.index}]` : 'null';
}

function pedge(e: Edge | null) {
  return e ? `edge(${pt(e.vertex0)},${pt(e.vertex1)})` : 'null';
}

function checkEdge(
  cell: Cell,
  edge: Edge,
  next: Edge | null,
  prev: Edge | null,
): void {
  if (edge.cell != cell) {
    throw new Failure(`cell = ${pcell(edge.cell)}, want ${pcell(cell)}`);
  }
  if (edge.prev != prev) {
    throw new Failure(`prev = ${pedge(edge.prev)}, want ${pedge(prev)}`);
  }
  if (edge.next != next) {
    throw new Failure(`next = ${pedge(edge.next)}, want ${pedge(next)}`);
  }
  if (prev && edge.vertex0 != prev.vertex1) {
    throw new Failure(
      `vertex0 = ${pt(edge.vertex0)}, prev.vertex1 = ${pt(prev.vertex1)}`,
    );
  }
  if (next && edge.vertex1 != next.vertex0) {
    throw new Failure(
      `vertex1 = ${pt(edge.vertex1)}, next.vertex0 = ${pt(next.vertex0)}`,
    );
  }
}

function checkWinding(cell: Cell, edge: Edge) {
  const { center } = cell;
  let w: number;
  w = winding(center, edge.vertex0, edge.vertex1);
  if (w <= 0) {
    throw new Failure(
      `invalid winding: ` +
        `center=${pt(center)}, v0=${pt(edge.vertex0)}, v1=${pt(edge.vertex1)}`,
    );
  }
  const { prev } = edge;
  if (prev) {
    w = winding(prev.vertex0, edge.vertex0, edge.vertex1);
    if (w <= 0) {
      throw new Failure('not convex');
    }
  }
}

function getEdges(cell: Cell): Edge[] {
  let edge: Edge | null = cell.edge;
  let edges: Edge[] = [];
  while (edge != null && !edges.includes(edge)) {
    edges.push(edge);
    edge = edge.next;
  }
  edge = cell.edge.prev;
  while (edge != null && !edges.includes(edge)) {
    edges.unshift(edge);
    edge = edge.prev;
  }
  return edges;
}

function checkCell(cell: Cell, info: CellInfo): void {
  const edges = getEdges(cell);
  const n = edges.length;
  for (let i = 0; i < n; i++) {
    const edge = edges[i];
    const next = edges[(i + 1) % n];
    const prev = edges[(i + n - 1) % n];
    try {
      checkEdge(cell, edge, next, prev);
      checkWinding(cell, edge);
    } catch (e) {
      if (e instanceof Failure) {
        throw new Failure(`edge #${i}: ${e.message}`);
      }
      throw e;
    }
  }
  if (n != info.edges) {
    throw new Failure(`got ${n} edges, expect ${info.edges}`);
  }
}

function cellFailure(cell: Cell, e: Failure): never {
  const edges = getEdges(cell);
  console.log(`Cell #${cell.index}`);
  for (let i = 0; i < edges.length; i++) {
    const { vertex0, vertex1 } = edges[i];
    console.log(`  edge[${i}]: ${pt(vertex0)} => ${pt(vertex1)}`);
  }
  throw new Failure(`cell #${cell.index}: ${e.message}`);
}

function runTest(test: Test): void {
  const { name, cells } = test;
  const level = createLevel(5, cells.map(({ pos }) => pos));
  for (let i = 0; i < cells.length; i++) {
    const info = cells[i];
    const cell = level.cells[i];
    if (cell == null) {
      throw new Failure(`missing cell #${i}`);
    }
    try {
      checkCell(cell, cells[i]);
    } catch (e) {
      if (e instanceof Failure) {
        cellFailure(cell, e);
      }
      throw e;
    }
  }
}

describe('Level generation', () => {
  for (const test of tests) {
    it(test.name, () => runTest(test));
  }
});
