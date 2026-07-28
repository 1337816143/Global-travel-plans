import type {
  PlanningCatalog,
  TripPlan,
  TripRequest,
} from '@global-travel-plans/domain';
import { z } from 'zod';

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const isoDateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: 'Expected ISO date-time',
});
const localizedText = z.record(z.string().min(1), z.string().min(1)).refine(
  (value) => Object.keys(value).length > 0,
  'At least one locale is required',
);
const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const sourceIds = z.array(z.string().min(1));

export const SourceRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  publisher: z.string().min(1).optional(),
  sourceType: z.enum(['official', 'map', 'booking-platform', 'social', 'manual-review']),
  retrievedAt: isoDateTime,
  reviewedAt: isoDateTime.optional(),
  reviewer: z.string().min(1).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  licenseNotes: z.string().optional(),
});

export const PlaceSchema = z.object({
  id: z.string().min(1),
  names: localizedText,
  type: z.enum([
    'continent',
    'country',
    'admin1',
    'admin2',
    'locality',
    'district',
    'island',
    'scenicArea',
    'customArea',
  ]),
  parentId: z.string().min(1).optional(),
  countryCode: z.string().length(2).optional(),
  adminLevel: z.number().int().nonnegative().optional(),
  coordinates: coordinate,
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  timezoneIds: z.array(z.string().min(1)).min(1),
  currencies: z.array(z.string().length(3)).min(1),
  languages: z.array(z.string().min(2)).min(1),
  sourceRefs: sourceIds,
  schemaVersion: z.number().int().positive(),
});

export const PlanningUnitSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  names: localizedText,
  recommendedDays: z
    .object({ min: z.number().nonnegative(), ideal: z.number().positive(), max: z.number().positive() })
    .refine((value) => value.min <= value.ideal && value.ideal <= value.max),
  poiIds: z.array(z.string().min(1)),
  transportNotes: localizedText,
  customs: z.array(localizedText),
  safetyNotes: z.array(localizedText),
  accommodationScore: z.number().optional(),
  sourceRefs: sourceIds,
});

const timeWindow = z.object({ start: localTime, end: localTime });
const openingHours = z.object({
  timezoneId: z.string().min(1),
  weekly: z.array(
    z.object({
      daysOfWeek: z.array(z.number().int().min(0).max(6)),
      windows: z.array(timeWindow),
    }),
  ),
  exceptions: z.record(localDate, z.array(timeWindow)).optional(),
  uncertainty: z.enum(['verified', 'reviewed', 'estimated', 'missing']),
});

const dynamicNumberObservation = z.object({
  value: z.number(),
  provider: z.string().min(1),
  observedAt: isoDateTime,
  expiresAt: isoDateTime.optional(),
  currency: z.string().length(3).optional(),
  sourceUrl: z.url().optional(),
  sourceRefs: sourceIds,
});

export const PoiSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  planningUnitId: z.string().min(1),
  names: localizedText,
  coordinates: coordinate,
  categories: z.array(z.string().min(1)).min(1),
  recommendedDurationMinutes: z
    .object({ min: z.number().positive(), ideal: z.number().positive(), max: z.number().positive() })
    .refine((value) => value.min <= value.ideal && value.ideal <= value.max),
  openingHours: openingHours.optional(),
  preferredWindows: z.array(timeWindow).optional(),
  reservationRequirement: z.enum(['required', 'recommended', 'not-required', 'unknown']),
  ticketPrice: dynamicNumberObservation.optional(),
  indoorLevel: z.enum(['indoor', 'mostly-indoor', 'mixed', 'mostly-outdoor', 'outdoor']),
  accessibility: z.enum(['accessible', 'partial', 'limited', 'unknown']),
  physicalIntensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  suitableWeather: z.array(z.enum(['clear', 'cloudy', 'rain', 'hot', 'cold', 'any'])),
  sourceRefs: sourceIds,
  updatedAt: isoDateTime,
  uncertainty: z.enum(['verified', 'reviewed', 'estimated', 'missing']),
});

const lockedActivity = z.object({
  id: z.string().min(1),
  localDate,
  startTime: localTime,
  endTime: localTime,
  timezoneId: z.string().min(1),
  placeId: z.string().min(1),
  poiId: z.string().min(1).optional(),
  title: localizedText,
});

export const TripRequestSchema = z
  .object({
    id: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    destinations: z
      .array(
        z.object({
          placeId: z.string().min(1),
          weight: z.number().positive().optional(),
          minDays: z.number().int().positive().optional(),
          maxDays: z.number().int().positive().optional(),
        }),
      )
      .min(1),
    startDate: localDate,
    endDate: localDate,
    pace: z.enum(['relaxed', 'balanced', 'intensive']),
    budget: z.enum(['economy', 'standard', 'comfort', 'premium']),
    interests: z.array(z.string().min(1)),
    physicalLevel: z.enum(['low', 'medium', 'high']),
    accessibilityRequired: z.boolean(),
    dailyStartTime: localTime,
    dailyEndTime: localTime,
    mealDurationMinutes: z.number().int().min(20).max(180),
    restDurationMinutes: z.number().int().min(0).max(180),
    transportPreferences: z.array(
      z.enum(['walk', 'bike', 'drive', 'taxi', 'transit', 'rail', 'flight', 'ferry', 'mixed']),
    ),
    accommodationPreference: z.enum(['single-base', 'minimize-transfers', 'flexible']),
    mustVisitPoiIds: z.array(z.string().min(1)),
    excludedPoiIds: z.array(z.string().min(1)),
    lockedActivities: z.array(lockedActivity),
    language: z.string().min(2),
    currency: z.string().length(3),
  })
  .superRefine((value, context) => {
    if (value.startDate > value.endDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate must not precede startDate' });
    }
    const destinations = value.destinations.map((item) => item.placeId);
    if (new Set(destinations).size !== destinations.length) {
      context.addIssue({ code: 'custom', path: ['destinations'], message: 'Duplicate destinations are not allowed' });
    }
    const excluded = new Set(value.excludedPoiIds);
    const conflict = value.mustVisitPoiIds.find((id) => excluded.has(id));
    if (conflict) {
      context.addIssue({ code: 'custom', path: ['mustVisitPoiIds'], message: `${conflict} is also excluded` });
    }
  });

const activity = z.object({
  id: z.string().min(1),
  kind: z.enum(['poi', 'meal', 'rest', 'transfer', 'check-in', 'check-out']),
  title: localizedText,
  localDate,
  timezoneId: z.string().min(1),
  startTime: localTime,
  endTime: localTime,
  placeId: z.string().min(1),
  poiId: z.string().min(1).optional(),
  planningUnitId: z.string().min(1).optional(),
  locked: z.boolean(),
  sourceRefs: sourceIds,
  reasonCodes: z.array(z.string().min(1)),
  estimate: z.boolean().optional(),
});

const travelLeg = z.object({
  id: z.string().min(1),
  localDate,
  timezoneId: z.string().min(1),
  originActivityId: z.string().min(1),
  destinationActivityId: z.string().min(1),
  originPlaceId: z.string().min(1),
  destinationPlaceId: z.string().min(1),
  mode: z.enum(['walk', 'bike', 'drive', 'taxi', 'transit', 'rail', 'flight', 'ferry', 'mixed']),
  startTime: localTime,
  endTime: localTime,
  durationMinutes: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative().optional(),
  method: z.enum(['matrix', 'schedule', 'estimate', 'unavailable']),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceRefs: sourceIds,
  crossRegion: z.boolean(),
});

const conflict = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  severity: z.enum(['error', 'warning']),
  message: localizedText,
  localDate: localDate.optional(),
  relatedIds: z.array(z.string()),
  resolved: z.boolean(),
});

export const TripPlanSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  status: z.enum(['valid', 'conflicted']),
  plannerVersion: z.string().min(1),
  inputSchemaVersion: z.number().int().positive(),
  dataVersion: z.string().min(1),
  seed: z.number().int(),
  days: z.array(
    z.object({
      id: z.string().min(1),
      localDate,
      placeId: z.string().min(1),
      timezoneId: z.string().min(1),
      activities: z.array(activity),
      travelLegs: z.array(travelLeg),
    }),
  ),
  accommodationStays: z.array(
    z.object({
      id: z.string().min(1),
      placeId: z.string().min(1),
      planningUnitId: z.string().min(1),
      checkInDate: localDate,
      checkOutDate: localDate,
      reasonCodes: z.array(z.string()),
      sourceRefs: sourceIds,
      specificProperty: z
        .object({
          value: z.object({ name: z.string().min(1), rating: z.number().optional(), price: z.number().optional() }),
          provider: z.string().min(1),
          observedAt: isoDateTime,
          expiresAt: isoDateTime.optional(),
          currency: z.string().length(3).optional(),
          sourceUrl: z.url().optional(),
          sourceRefs: sourceIds,
        })
        .optional(),
    }),
  ),
  unresolvedConflicts: z.array(conflict),
  assumptions: z.array(
    z.object({ id: z.string().min(1), code: z.string().min(1), message: localizedText, sourceRefs: sourceIds }),
  ),
  sourceRefs: sourceIds,
  freshness: z.object({
    fresh: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    latestObservedAt: isoDateTime.optional(),
  }),
  degradationMessages: z.array(localizedText),
  generatedAt: isoDateTime,
  previousPlanId: z.string().min(1).optional(),
});

export const PlanningCatalogSchema = z
  .object({
    version: z.string().min(1),
    places: z.array(PlaceSchema),
    planningUnits: z.array(PlanningUnitSchema),
    pois: z.array(PoiSchema),
    sources: z.array(SourceRefSchema),
  })
  .superRefine((catalog, context) => {
    const unique = (items: Array<{ id: string }>, path: string) => {
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item.id)) context.addIssue({ code: 'custom', path: [path], message: `Duplicate id: ${item.id}` });
        seen.add(item.id);
      }
      return seen;
    };
    const placeIds = unique(catalog.places, 'places');
    const unitIds = unique(catalog.planningUnits, 'planningUnits');
    const poiIds = unique(catalog.pois, 'pois');
    const sourceRefSet = unique(catalog.sources, 'sources');
    for (const unit of catalog.planningUnits) {
      if (!placeIds.has(unit.placeId)) context.addIssue({ code: 'custom', path: ['planningUnits'], message: `Unknown place: ${unit.placeId}` });
      for (const poiId of unit.poiIds) if (!poiIds.has(poiId)) context.addIssue({ code: 'custom', path: ['planningUnits'], message: `Unknown POI: ${poiId}` });
    }
    for (const poi of catalog.pois) {
      if (!placeIds.has(poi.placeId)) context.addIssue({ code: 'custom', path: ['pois'], message: `Unknown place: ${poi.placeId}` });
      if (!unitIds.has(poi.planningUnitId)) context.addIssue({ code: 'custom', path: ['pois'], message: `Unknown planning unit: ${poi.planningUnitId}` });
      for (const sourceRef of poi.sourceRefs) if (!sourceRefSet.has(sourceRef)) context.addIssue({ code: 'custom', path: ['pois'], message: `Unknown source: ${sourceRef}` });
    }
  });

export function parseTripRequest(input: unknown): TripRequest {
  return TripRequestSchema.parse(input) as TripRequest;
}

export function parseTripPlan(input: unknown): TripPlan {
  return TripPlanSchema.parse(input) as TripPlan;
}

export function parsePlanningCatalog(input: unknown): PlanningCatalog {
  return PlanningCatalogSchema.parse(input) as PlanningCatalog;
}

export function exportJsonSchemas(): Record<string, unknown> {
  return {
    place: z.toJSONSchema(PlaceSchema),
    poi: z.toJSONSchema(PoiSchema),
    tripRequest: z.toJSONSchema(TripRequestSchema),
    tripPlan: z.toJSONSchema(TripPlanSchema),
    sourceRef: z.toJSONSchema(SourceRefSchema),
    planningCatalog: z.toJSONSchema(PlanningCatalogSchema),
  };
}
