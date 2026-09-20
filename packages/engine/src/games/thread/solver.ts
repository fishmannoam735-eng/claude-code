import { type Walls } from './grid.js';

/**
 * Counts paths that visit every cell exactly once and meet the numbered
 * waypoints in order, stopping at `limit`.
 *
 * This is Hamiltonian path counting, which is exponential in the worst case,
 * so the pruning is the whole design:
 *
 *  - **Connectivity.** After each step the unvisited cells, plus the cell we
 *    stand on, must stay in one piece. Splitting the board strands one half.
 *  - **Degree.** Any unvisited cell with fewer than two open ways in or out
 *    can only ever be an endpoint, and there is only one endpoint left.
 *  - **Waypoint order.** Stepping onto a numbered cell out of turn is dead
 *    immediately, and so is passing the cell the next number sits on.
 *
 * Without these a 7x7 board does not finish; with them it is milliseconds.
 */
export function countPaths(
  n: number,
  open: readonly (readonly number[])[],
  waypoints: readonly number[],
  limit = 2,
): { count: number; first: number[] | null } {
  const cells = n * n;
  if (waypoints.length < 2) return { count: 0, first: null };

  /** waypointAt[cell] = its 1-based number, or 0. */
  const waypointAt = new Array<number>(cells).fill(0);
  waypoints.forEach((cell, k) => { waypointAt[cell] = k + 1; });

  const visited = new Array<boolean>(cells).fill(false);
  const path: number[] = [];
  let count = 0;
  let first: number[] | null = null;

  const start = waypoints[0]!;
  const end = waypoints[waypoints.length - 1]!;

  /** Are all unvisited cells reachable from `from`? */
  function reachableAll(from: number, remaining: number): boolean {
    if (remaining === 0) return true;
    const seen = new Array<boolean>(cells).fill(false);
    const stack = [from];
    seen[from] = true;
    let found = 0;
    while (stack.length) {
      const i = stack.pop()!;
      for (const j of open[i]!) {
        if (visited[j] || seen[j]) continue;
        seen[j] = true;
        found++;
        stack.push(j);
      }
    }
    return found === remaining;
  }

  /**
   * An unvisited cell needs two open neighbours to be passed through. With one
   * it must be an endpoint, and the only endpoint still available is the final
   * waypoint. Zero is always dead.
   */
  function degreesOk(current: number): boolean {
    for (let i = 0; i < cells; i++) {
      if (visited[i]) continue;
      let deg = 0;
      for (const j of open[i]!) {
        if (!visited[j] || j === current) deg++;
      }
      if (deg === 0) return false;
      // One way in and out means the cell can only be a terminus, and the
      // only terminus left is the final waypoint.
      if (deg === 1 && i !== end) return false;
    }
    return true;
  }

  function step(current: number, nextNumber: number, remaining: number): void {
    if (count >= limit) return;

    if (remaining === 0) {
      if (current === end && nextNumber > waypoints.length) {
        count++;
        if (!first) first = path.slice();
      }
      return;
    }

    if (!reachableAll(current, remaining)) return;
    if (!degreesOk(current)) return;

    for (const j of open[current]!) {
      if (visited[j]) continue;
      const w = waypointAt[j]!;
      // A numbered cell may only be entered when its number is next.
      if (w !== 0 && w !== nextNumber) continue;
      // Reaching the last waypoint early would strand the rest of the board.
      if (j === end && remaining > 1) continue;

      visited[j] = true;
      path.push(j);
      step(j, w === nextNumber ? nextNumber + 1 : nextNumber, remaining - 1);
      path.pop();
      visited[j] = false;
      if (count >= limit) return;
    }
  }

  visited[start] = true;
  path.push(start);
  step(start, 2, cells - 1);
  return { count, first };
}

/** Does this path obey every rule for the given board? */
export function pathIsValid(
  path: readonly number[],
  n: number,
  open: readonly (readonly number[])[],
  waypoints: readonly number[],
): boolean {
  const cells = n * n;
  if (path.length !== cells) return false;
  if (new Set(path).size !== cells) return false;
  for (let k = 1; k < path.length; k++) {
    if (!open[path[k - 1]!]!.includes(path[k]!)) return false;
  }
  // Waypoints appear in ascending order of their numbers.
  const positions = waypoints.map((cell) => path.indexOf(cell));
  if (positions.some((p) => p < 0)) return false;
  for (let k = 1; k < positions.length; k++) {
    if (positions[k]! <= positions[k - 1]!) return false;
  }
  return positions[0] === 0 && positions[positions.length - 1] === cells - 1;
}

export type { Walls };
