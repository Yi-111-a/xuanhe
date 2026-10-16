// Asset resolution. Images are text-free art from the scenario; every consumer passes a
// list of candidate ids and gets back a URL only when a *real* image exists, otherwise
// null so the component can draw its CSS/SVG fallback. Never a broken image, never the
// engine's labelled SVG placeholder.
import { useEffect, useState } from 'react';
import { IS_MOCK, SCENARIO_ID, getApiBase } from './client';

export interface MapRegionShape {
  id: string;
  name?: string;
  polygon?: number[][];
  polygons?: number[][][];
  center?: number[];
  label?: number[];
  capital?: number[];
  foreign?: boolean;
  seat?: number[] | { x: number; y: number; name?: string };
}

export interface MapData {
  width: number;
  height: number;
  regions: MapRegionShape[];
  routes?: Record<string, number[][] | { points: number[][] }>;
  rivers?: unknown;
  [key: string]: unknown;
}

interface MockIndex {
  assets: Record<string, string>;
  map: unknown;
}

let mockIndex: Promise<MockIndex> | null = null;
function loadMockIndex(): Promise<MockIndex> {
  if (!mockIndex) {
    mockIndex = fetch('/mock-assets/index.json')
      .then((r) => (r.ok ? (r.json() as Promise<MockIndex>) : { assets: {}, map: null }))
      .catch(() => ({ assets: {}, map: null }));
  }
  return mockIndex;
}

const resolved = new Map<string, Promise<string | null>>();

// At most 3 concurrent asset downloads, so API calls keep free connections to the engine.
let active = 0;
const queue: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((r) => queue.push(r));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

function resolveOne(id: string): Promise<string | null> {
  let hit = resolved.get(id);
  if (hit) return hit;
  hit = (async () => {
    if (IS_MOCK) {
      const index = await loadMockIndex();
      return index.assets[id] ?? null;
    }
    try {
      const base = await getApiBase();
      return await withSlot(async () => {
        const res = await fetch(`${base}/api/assets/${SCENARIO_ID}/${id}`);
        const type = res.headers.get('content-type') ?? '';
        // The engine answers missing art with a labelled SVG placeholder: treat as absent.
        if (!res.ok || type.includes('svg')) {
          await res.body?.cancel().catch(() => undefined);
          return null;
        }
        const blob = await res.blob();
        return blob.size < 64 ? null : URL.createObjectURL(blob);
      });
    } catch {
      return null;
    }
  })();
  resolved.set(id, hit);
  return hit;
}

export async function resolveAsset(candidates: string[]): Promise<string | null> {
  for (const id of candidates) {
    const url = await resolveOne(id);
    if (url) return url;
  }
  return null;
}

/** Returns [url | null, settled]. */
export function useAsset(candidates: string[] | string | null | undefined): [string | null, boolean] {
  const list = candidates == null ? [] : Array.isArray(candidates) ? candidates : [candidates];
  const key = list.join('|');
  const [state, setState] = useState<{ key: string; url: string | null; settled: boolean }>({
    key: '',
    url: null,
    settled: false,
  });
  useEffect(() => {
    let alive = true;
    if (!key) {
      setState({ key, url: null, settled: true });
      return;
    }
    resolveAsset(key.split('|')).then((url) => {
      if (alive) setState({ key, url, settled: true });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return state.key === key ? [state.url, state.settled] : [null, false];
}

// map.json bundled at build time when the art agent has produced it.
const bundledMaps = import.meta.glob('../../../scenarios/tianbao_751/map.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function normaliseMap(raw: unknown): MapData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const image = (obj.image ?? {}) as Record<string, unknown>;
  const width = Number(obj.width ?? image.width ?? (obj.size as number[] | undefined)?.[0] ?? 0);
  const height = Number(obj.height ?? image.height ?? (obj.size as number[] | undefined)?.[1] ?? 0);
  let regions: MapRegionShape[] = [];
  if (Array.isArray(obj.regions)) regions = obj.regions as MapRegionShape[];
  else if (obj.regions && typeof obj.regions === 'object')
    regions = Object.entries(obj.regions as Record<string, MapRegionShape>).map(([id, r]) => ({ ...r, id }));
  if (!width || !height || regions.length === 0) return null;
  return { ...obj, width, height, regions } as MapData;
}

let mapPromise: Promise<MapData | null> | null = null;
export function loadMapData(): Promise<MapData | null> {
  if (!mapPromise) {
    mapPromise = (async () => {
      if (IS_MOCK) {
        const index = await loadMockIndex();
        const live = normaliseMap(index.map);
        if (live) return live;
      }
      const bundled = Object.values(bundledMaps)[0];
      return normaliseMap(bundled);
    })();
  }
  return mapPromise;
}

export function useMapData(): [MapData | null, boolean] {
  const [state, setState] = useState<[MapData | null, boolean]>([null, false]);
  useEffect(() => {
    let alive = true;
    loadMapData().then((m) => alive && setState([m, true]));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
