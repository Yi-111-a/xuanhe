// Travel routes over the region adjacency graph (weights = seasons of travel). Shared by the
// mock engine (ETAs for /armies) and the 兵部 overlay on the map (the path drawn to a destination).
import type { Region } from '../api/types';

/** Seasons of travel from `from` to every reachable region (Dijkstra over adjacency weights). */
export function travelTimes(regions: Record<string, Region>, from: string): Record<string, number> {
  const dist: Record<string, number> = { [from]: 0 };
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [id, d] of Object.entries(dist)) if (!done.has(id) && (cur === null || d < dist[cur])) cur = id;
    if (cur === null) break;
    done.add(cur);
    for (const [to, w] of Object.entries(regions[cur]?.adjacency ?? {})) {
      if (!regions[to]) continue;
      const nd = dist[cur] + Math.max(0, Number(w) || 1);
      if (dist[to] === undefined || nd < dist[to]) dist[to] = nd;
    }
  }
  return dist;
}

/** The region-by-region path of the quickest route, or null when unreachable. */
export function travelPath(regions: Record<string, Region>, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [id, d] of Object.entries(dist)) if (!done.has(id) && (cur === null || d < dist[cur])) cur = id;
    if (cur === null || cur === to) break;
    done.add(cur);
    for (const [next, w] of Object.entries(regions[cur]?.adjacency ?? {})) {
      if (!regions[next]) continue;
      const nd = dist[cur] + Math.max(0, Number(w) || 1);
      if (dist[next] === undefined || nd < dist[next]) {
        dist[next] = nd;
        prev[next] = cur;
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}
