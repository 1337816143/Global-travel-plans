import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

export interface LegacyQingdaoSnapshot {
  source: {
    repository: string;
    version: string;
    sourceRoot: string;
  };
  points: Array<Record<string, unknown>>;
  schedules: Array<Record<string, unknown>>;
  hotels: unknown[];
  bookings: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  recommendedPoiIds: string[];
  wishlist: Record<string, unknown>;
}

interface BindingDefinition {
  file: string;
  variable: string;
}

const bindings = {
  points: { file: 'points.js', variable: 'POINTS' },
  schedules: { file: 'schedules.js', variable: 'SCHEDULES' },
  hotels: { file: 'hotels.js', variable: 'HOTELS' },
  bookings: { file: 'bookings.js', variable: 'BOOKINGS' },
  sources: { file: 'sources.js', variable: 'SOURCES' },
  recommendedPoiIds: { file: 'recommendations.js', variable: 'RECOMMENDED' },
  wishlist: { file: 'wishlist.js', variable: 'GIRLFRIEND_WISHLIST' },
} satisfies Record<string, BindingDefinition>;

function evaluateBinding(source: string, variable: string, filename: string): unknown {
  const context = vm.createContext({});
  const script = new vm.Script(`${source}\n;globalThis.__legacyValue = ${variable};`, {
    filename,
  });
  script.runInContext(context, { timeout: 2_000 });
  return (context as { __legacyValue?: unknown }).__legacyValue;
}

function readBinding(sourceRoot: string, binding: BindingDefinition): unknown {
  const path = resolve(sourceRoot, 'src-v2', 'data', 'generated', binding.file);
  const source = readFileSync(path, 'utf8');
  return evaluateBinding(source, binding.variable, path);
}

function asRecordArray(value: unknown, name: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'object' || item === null)) {
    throw new TypeError(`${name} must be an array of objects.`);
  }
  return value as Array<Record<string, unknown>>;
}

function asUnknownArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array.`);
  return value;
}

function asStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError(`${name} must be an array of strings.`);
  }
  return value;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function loadLegacyQingdaoSnapshot(sourceRoot: string): LegacyQingdaoSnapshot {
  const points = asRecordArray(readBinding(sourceRoot, bindings.points), 'POINTS');
  const schedules = asRecordArray(readBinding(sourceRoot, bindings.schedules), 'SCHEDULES');
  const hotels = asUnknownArray(readBinding(sourceRoot, bindings.hotels), 'HOTELS');
  const bookings = asRecordArray(readBinding(sourceRoot, bindings.bookings), 'BOOKINGS');
  const sources = asRecordArray(readBinding(sourceRoot, bindings.sources), 'SOURCES');
  const recommendedPoiIds = asStringArray(
    readBinding(sourceRoot, bindings.recommendedPoiIds),
    'RECOMMENDED',
  );
  const wishlist = asRecord(readBinding(sourceRoot, bindings.wishlist), 'GIRLFRIEND_WISHLIST');
  const version = typeof wishlist.version === 'string' ? wishlist.version : 'unknown';

  if (points.length === 0 || schedules.length === 0 || sources.length === 0) {
    throw new Error('The Qingdao source snapshot is incomplete.');
  }

  return {
    source: {
      repository: '1337816143/travel-plans',
      version,
      sourceRoot: resolve(sourceRoot),
    },
    points,
    schedules,
    hotels,
    bookings,
    sources,
    recommendedPoiIds,
    wishlist,
  };
}

function parseCliArguments(argv: string[]): { sourceRoot: string; output?: string } {
  const args = [...argv];
  const sourceRoot = args.shift();
  if (!sourceRoot) {
    throw new Error(
      'Usage: tsx scripts/global/import-qingdao-legacy.ts <travel-plans-root> [output.json]',
    );
  }
  return { sourceRoot, output: args.shift() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { sourceRoot, output } = parseCliArguments(process.argv.slice(2));
  const snapshot = loadLegacyQingdaoSnapshot(sourceRoot);
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (output) {
    writeFileSync(resolve(output), json, 'utf8');
  } else {
    process.stdout.write(json);
  }
}
