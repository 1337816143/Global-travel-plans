import { parseTripPlan, parseTripRequest } from '@global-travel-plans/data-schema';
import type {
  PlanningCatalog,
  TripEdit,
  TripPlan,
  TripRequest,
  Wgs84Coordinate,
} from '@global-travel-plans/domain';
import type { MapMarker, MapPath, MapRenderModel } from '@global-travel-plans/map-adapters';
import type { PlannerInput } from '@global-travel-plans/planner';

export interface PlannerFormState {
  destinationIds: string[];
  totalDays: number;
  startDate: string;
  pace: TripRequest['pace'];
  budget: TripRequest['budget'];
  physicalLevel: TripRequest['physicalLevel'];
  interests: string[];
  language: string;
  currency: string;
}

export interface TripShareEnvelope {
  schemaVersion: 1;
  appVersion: string;
  createdAt: string;
  request: TripRequest;
  plan: TripPlan;
  edits: TripEdit[];
}

export function buildTripRequest(
  base: TripRequest,
  form: PlannerFormState,
  catalog: PlanningCatalog,
): TripRequest {
  const selectedPlaces = new Set(form.destinationIds);
  const selectedPoiIds = new Set(
    catalog.pois.filter((poi) => selectedPlaces.has(poi.placeId)).map((poi) => poi.id),
  );
  return parseTripRequest({
    ...base,
    id: `request:${form.destinationIds.join('+')}:${form.startDate}:${form.totalDays}`,
    destinations: form.destinationIds.map((placeId) => ({ placeId, weight: 1 })),
    startDate: form.startDate,
    endDate: addDays(form.startDate, Math.max(1, form.totalDays) - 1),
    pace: form.pace,
    budget: form.budget,
    physicalLevel: form.physicalLevel,
    interests: form.interests,
    mustVisitPoiIds: base.mustVisitPoiIds.filter((poiId) => selectedPoiIds.has(poiId)),
    excludedPoiIds: base.excludedPoiIds.filter((poiId) => selectedPoiIds.has(poiId)),
    lockedActivities: [],
    language: form.language,
    currency: form.currency,
  });
}

export function createPlannerInput(
  request: TripRequest,
  catalog: PlanningCatalog,
  travelTimeMatrix: PlannerInput['travelTimeMatrix'],
  generatedAt = new Date().toISOString(),
): PlannerInput {
  return {
    request,
    catalog,
    travelTimeMatrix,
    seed: 42,
    plannerVersion: `planner-${__APP_VERSION__}`,
    generatedAt,
  };
}

export function buildMapRenderModel(
  plan: TripPlan,
  catalog: PlanningCatalog,
  selectedId?: string,
): MapRenderModel {
  const poiById = new Map(catalog.pois.map((poi) => [poi.id, poi]));
  const placeById = new Map(catalog.places.map((place) => [place.id, place]));
  const markers: MapMarker[] = [];
  const paths: MapPath[] = [];
  const coordinates: Wgs84Coordinate[] = [];

  for (const day of plan.days) {
    const dayPoints: Wgs84Coordinate[] = [];
    for (const activity of day.activities) {
      const position = activity.poiId
        ? poiById.get(activity.poiId)?.coordinates
        : placeById.get(activity.placeId)?.coordinates;
      if (!position) continue;
      dayPoints.push(position);
      coordinates.push(position);
      if (activity.kind === 'poi') {
        markers.push({
          id: activity.id,
          position,
          label: activity.title,
          kind: 'activity',
          selected: activity.id === selectedId,
        });
      }
    }
    if (dayPoints.length >= 2) {
      paths.push({
        id: `path:${day.id}`,
        points: dayPoints,
        kind: 'day-route',
        estimated: true,
        label: { 'zh-CN': `${day.localDate} 估算连线`, en: `${day.localDate} estimated path` },
      });
    }
  }

  for (let index = 1; index < plan.days.length; index += 1) {
    const previous = plan.days[index - 1];
    const current = plan.days[index];
    if (!previous || !current || previous.placeId === current.placeId) continue;
    const from = placeById.get(previous.placeId)?.coordinates;
    const to = placeById.get(current.placeId)?.coordinates;
    if (!from || !to) continue;
    coordinates.push(from, to);
    paths.push({
      id: `transfer:${previous.id}:${current.id}`,
      points: [from, to],
      kind: 'transfer',
      estimated: true,
      label: { 'zh-CN': '跨区域转场示意，不是实际航线', en: 'Transfer illustration, not an actual route' },
    });
  }

  for (const stay of plan.accommodationStays) {
    const position = placeById.get(stay.placeId)?.coordinates;
    if (!position) continue;
    coordinates.push(position);
    markers.push({
      id: stay.id,
      position,
      label: {
        'zh-CN': `住宿区域：${stay.planningUnitId}`,
        en: `Accommodation area: ${stay.planningUnitId}`,
      },
      kind: 'accommodation',
      selected: stay.id === selectedId,
    });
  }

  return {
    markers,
    paths,
    ...(selectedId ? { selectedId } : {}),
    ...(coordinates.length > 0 ? { bounds: boundsFor(coordinates) } : {}),
  };
}

export function createShareEnvelope(
  request: TripRequest,
  plan: TripPlan,
  edits: TripEdit[],
): TripShareEnvelope {
  return {
    schemaVersion: 1,
    appVersion: __APP_VERSION__,
    createdAt: new Date().toISOString(),
    request,
    plan,
    edits,
  };
}

export function parseShareEnvelope(input: unknown): TripShareEnvelope {
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.edits)) {
    throw new Error('Unsupported share envelope.');
  }
  const request = parseTripRequest(input.request);
  const plan = parseTripPlan(input.plan);
  const edits = input.edits.map(parseTripEdit);
  return {
    schemaVersion: 1,
    appVersion: typeof input.appVersion === 'string' ? input.appVersion : 'unknown',
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date(0).toISOString(),
    request,
    plan,
    edits,
  };
}

export function serializeShareEnvelope(envelope: TripShareEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function reorder<T>(values: T[], sourceIndex: number, targetIndex: number): T[] {
  if (sourceIndex === targetIndex) return [...values];
  const copy = [...values];
  const [removed] = copy.splice(sourceIndex, 1);
  if (removed === undefined) return copy;
  copy.splice(targetIndex, 0, removed);
  return copy;
}

function parseTripEdit(input: unknown): TripEdit {
  if (!isRecord(input) || typeof input.activityId !== 'string') {
    throw new Error('Invalid trip edit.');
  }
  if (input.type === 'set-lock' && typeof input.locked === 'boolean') {
    return { type: 'set-lock', activityId: input.activityId, locked: input.locked };
  }
  if (
    input.type === 'move-activity' &&
    typeof input.targetDayId === 'string' &&
    (input.targetIndex === undefined || typeof input.targetIndex === 'number')
  ) {
    return {
      type: 'move-activity',
      activityId: input.activityId,
      targetDayId: input.targetDayId,
      ...(typeof input.targetIndex === 'number' ? { targetIndex: input.targetIndex } : {}),
    };
  }
  throw new Error('Invalid trip edit.');
}

function boundsFor(coordinates: Wgs84Coordinate[]): [number, number, number, number] {
  const lngs = coordinates.map((coordinate) => coordinate.lng);
  const lats = coordinates.map((coordinate) => coordinate.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function addDays(localDate: string, days: number): string {
  const value = Date.parse(`${localDate}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(value).toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
