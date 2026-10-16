import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const scenarioDir = path.resolve(here, '../scenarios/tianbao_751');
const assetsDir = path.join(scenarioDir, 'assets');
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.svg']);
const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (IMAGE_EXT.has(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

/**
 * Dev-only: lets mock mode load the art agent's generated images straight from
 * scenarios/tianbao_751/assets without the engine. Builds an id → url index from
 * assets.yaml (if present) plus the file layout (portrait/li_linfu.default.webp →
 * portrait.li_linfu.default). Never answers 404 for ids — the app asks the index first.
 */
function scenarioAssets(): Plugin {
  const buildIndex = () => {
    const index: Record<string, string> = {};
    for (const file of walk(assetsDir)) {
      if (fs.statSync(file).size < 64) continue;
      const rel = path.relative(assetsDir, file).split(path.sep).join('/');
      const url = `/mock-assets/file/${rel}`;
      const base = path.basename(rel).replace(/\.[^.]+$/, '');
      // portrait/li_linfu.default.webp → portrait.li_linfu.default; portrait/portrait.x.webp → portrait.x
      index[rel.replace(/\.[^.]+$/, '').split('/').join('.')] = url;
      if (base.includes('.')) index[base] = url;
    }
    const manifestFile = path.join(scenarioDir, 'assets.yaml');
    if (fs.existsSync(manifestFile)) {
      try {
        const manifest = yaml.load(fs.readFileSync(manifestFile, 'utf-8')) as {
          entries?: { id?: string; path?: string }[];
        };
        for (const entry of manifest?.entries ?? []) {
          if (!entry.id || !entry.path) continue;
          const full = path.resolve(scenarioDir, entry.path);
          if (!full.startsWith(scenarioDir) || !fs.existsSync(full)) continue;
          const rel = path.relative(assetsDir, full).split(path.sep).join('/');
          if (rel.startsWith('..')) continue;
          index[entry.id] = `/mock-assets/file/${rel}`;
        }
      } catch {
        /* malformed manifest: fall back to file layout only */
      }
    }
    return index;
  };
  return {
    name: 'tianbao-scenario-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]);
        if (url === '/mock-assets/scenario.json') {
          const read = (name: string) => {
            const file = path.join(scenarioDir, name);
            if (!fs.existsSync(file)) return undefined;
            try {
              return yaml.load(fs.readFileSync(file, 'utf-8'));
            } catch {
              return undefined;
            }
          };
          const bundle = {
            scenario: read('scenario.yaml'),
            characters: read('characters.yaml'),
            regions: read('regions.yaml'),
            armies: read('armies.yaml'),
            factions: read('factions.yaml'),
            memorials: read('memorials.yaml'),
            events: read('events.yaml'),
            policy_cards: read('policy_cards.yaml'),
          };
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(bundle));
          return;
        }
        if (url === '/mock-assets/index.json') {
          let map: unknown = null;
          const mapFile = path.join(scenarioDir, 'map.json');
          if (fs.existsSync(mapFile)) {
            try {
              map = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
            } catch {
              map = null;
            }
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ assets: buildIndex(), map }));
          return;
        }
        if (url.startsWith('/mock-assets/file/')) {
          const rel = url.slice('/mock-assets/file/'.length);
          const full = path.resolve(assetsDir, rel);
          if (!full.startsWith(assetsDir) || !fs.existsSync(full)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream');
          fs.createReadStream(full).pipe(res);
          return;
        }
        next();
      });
    },
  };
}

/**
 * `virtual:tianbao-meta`: display names for every entity id in the scenario and a small event
 * index (kind, title, choices, illustration). The UI uses it to (a) never show a raw id — engine
 * text that still carries one is rewritten with the display name — and (b) decide which events
 * are player-facing and may be featured on the result scroll. Built from the YAML at dev/build
 * time, so it works the same against the mock and the real engine.
 */
const LEDGER_OPS = new Set(['add_ledger', 'remove_ledger', 'adjust_ledger']);
export function buildScenarioMeta(dir = scenarioDir) {
  const read = (name: string): unknown => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) return undefined;
    try {
      return yaml.load(fs.readFileSync(file, 'utf-8'));
    } catch {
      return undefined;
    }
  };
  type Row = Record<string, unknown>;
  const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : v && typeof v === 'object' ? Object.entries(v as Record<string, Row>).map(([id, r]) => ({ id, ...r })) : []);
  const scenario = (read('scenario.yaml') ?? {}) as Row;
  const names: Record<string, string> = {};
  const kinds: Record<string, string> = {};
  const add = (kind: string, list: Row[], label = 'name') => {
    for (const r of list) {
      const id = String(r.id ?? '');
      const name = r[label] ?? r.name ?? r.title;
      if (!id || typeof name !== 'string' || !name) continue;
      if (!(id in names)) {
        names[id] = name;
        kinds[id] = kind;
      }
    }
  };
  add('faction', rows(read('factions.yaml')));
  add('region', rows(read('regions.yaml')));
  add('character', rows(read('characters.yaml')));
  add('army', rows(read('armies.yaml')));
  add('office', rows(scenario.offices));
  add('resource', rows(scenario.resources));
  add('stat', rows(scenario.stats));
  add('ending', rows(scenario.endings), 'title');
  const settings = (scenario.settings ?? {}) as Row;
  for (const [id, name] of Object.entries((settings.bloc_names ?? {}) as Record<string, string>)) {
    if (!(id in names) && typeof name === 'string') {
      names[id] = name;
      kinds[id] = 'bloc';
    }
  }
  const events: Record<string, { title: string; kind: string; choices: boolean; bookkeeping: boolean; internal: boolean; illustration?: string }> = {};
  for (const e of rows(read('events.yaml'))) {
    const id = String(e.id ?? '');
    if (!id) continue;
    const effects = Array.isArray(e.effects) ? (e.effects as Row[]) : [];
    const kind = String(e.kind ?? 'conditional');
    events[id] = {
      title: String(e.title ?? ''),
      kind,
      choices: Array.isArray(e.choices) && e.choices.length > 0,
      bookkeeping: kind === 'system' && effects.length > 0 && effects.every((op) => LEDGER_OPS.has(String(op.op))),
      internal: Boolean(e.internal),
      ...(typeof e.illustration === 'string' && e.illustration ? { illustration: e.illustration } : {}),
    };
    if (!(id in names) && events[id].title) {
      names[id] = events[id].title;
      kinds[id] = 'event';
    }
  }
  const endings: Record<string, string> = {};
  for (const e of rows(scenario.endings)) if (typeof e.id === 'string' && typeof e.illustration === 'string') endings[e.id] = e.illustration;
  return { names, kinds, events, endings };
}

function scenarioMeta(): Plugin {
  const ID = 'virtual:tianbao-meta';
  return {
    name: 'tianbao-scenario-meta',
    resolveId: (id) => (id === ID ? ` ${ID}` : null),
    load: (id) => (id === ` ${ID}` ? `export default ${JSON.stringify(buildScenarioMeta())};` : null),
  };
}

export default defineConfig({
  plugins: [react(), scenarioAssets(), scenarioMeta()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
    fs: { allow: [path.resolve(here, '..')] },
  },
  build: {
    target: 'es2021',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
  },
});
