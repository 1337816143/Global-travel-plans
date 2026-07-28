import { parsePlanningCatalog, parseTripPlan, parseTripRequest } from '@global-travel-plans/data-schema';
import { demoCatalogRaw, demoTravelTimeMatrix, demoTripRequestRaw } from '../../../fixtures';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planTrip, replanTrip, validateTripPlan, type PlannerInput } from './index';

const catalog = parsePlanningCatalog(demoCatalogRaw);
const request = parseTripRequest(demoTripRequestRaw);

function plannerInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    request,
    catalog,
    travelTimeMatrix: demoTravelTimeMatrix,
    seed: 42,
    plannerVersion: 'planner-0.1.0',
    generatedAt: '2026-07-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('deterministic global planner', () => {
  it('creates a schema-valid cross-country, multi-timezone plan', () => {
    const plan = planTrip(plannerInput());
    const parsed = parseTripPlan(plan);

    expect(parsed.days).toHaveLength(6);
    expect(new Set(parsed.days.map((day) => day.placeId))).toEqual(
      new Set(['place:cn-qingdao', 'place:sg-singapore']),
    );
    expect(new Set(parsed.days.map((day) => day.timezoneId))).toEqual(
      new Set(['Asia/Shanghai', 'Asia/Singapore']),
    );
    expect(parsed.days.some((day) => day.activities.some((item) => item.kind === 'transfer'))).toBe(
      true,
    );
    expect(parsed.accommodationStays).toHaveLength(2);
    expect(parsed.unresolvedConflicts.filter((item) => item.severity === 'error')).toEqual([]);
    expect(validateTripPlan(parsed, request, catalog)).toEqual([]);
  });

  it('is deeply deterministic for identical input, version and seed', () => {
    const first = planTrip(plannerInput());
    const second = planTrip(plannerInput());
    expect(second).toEqual(first);
  });

  it('preserves user-locked activities during replanning', () => {
    const original = planTrip(plannerInput());
    const activity = original.days
      .flatMap((day) => day.activities)
      .find((item) => item.kind === 'poi' && item.poiId === 'poi:qingdao-beer-museum');
    expect(activity).toBeDefined();
    if (!activity) return;

    const replanned = replanTrip(plannerInput(), original, [
      { type: 'set-lock', activityId: activity.id, locked: true },
    ]);
    const preserved = replanned.days
      .flatMap((day) => day.activities)
      .find((item) => item.id === activity.id);

    expect(preserved).toMatchObject({
      id: activity.id,
      localDate: activity.localDate,
      startTime: activity.startTime,
      endTime: activity.endTime,
      locked: true,
    });
    expect(
      replanned.unresolvedConflicts.find((item) => item.code === 'LOCKED_ACTIVITY_CHANGED'),
    ).toBeUndefined();
  });

  it('reports unschedulable must-visit overload instead of silently deleting it', () => {
    const shortRequest = parseTripRequest({
      ...demoTripRequestRaw,
      id: 'request:one-day-overload',
      endDate: demoTripRequestRaw.startDate,
      destinations: [{ placeId: 'place:cn-qingdao' }],
      pace: 'relaxed',
      mustVisitPoiIds: [
        'poi:qingdao-may-fourth-square',
        'poi:qingdao-beer-museum',
        'poi:qingdao-badaguan',
      ],
    });
    const plan = planTrip(plannerInput({ request: shortRequest }));

    expect(parseTripPlan(plan).status).toBe('conflicted');
    expect(plan.unresolvedConflicts.some((item) => item.code === 'MUST_VISIT_UNSCHEDULED')).toBe(
      true,
    );
  });
});

describe('planner properties', () => {
  it('remains deterministic and schema-valid for arbitrary seeds', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const first = planTrip(plannerInput({ seed }));
        const second = planTrip(plannerInput({ seed }));
        expect(second).toEqual(first);
        expect(() => parseTripPlan(first)).not.toThrow();
      }),
      { numRuns: 75 },
    );
  });

  it('never overlaps activities when pace and daily bounds vary within valid ranges', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('relaxed' as const, 'balanced' as const, 'intensive' as const),
        fc.integer({ min: 8, max: 10 }),
        fc.integer({ min: 18, max: 22 }),
        (pace, startHour, endHour) => {
          fc.pre(startHour < endHour);
          const variedRequest = parseTripRequest({
            ...demoTripRequestRaw,
            id: `request:property:${pace}:${startHour}:${endHour}`,
            pace,
            dailyStartTime: `${String(startHour).padStart(2, '0')}:00`,
            dailyEndTime: `${String(endHour).padStart(2, '0')}:00`,
          });
          const plan = planTrip(plannerInput({ request: variedRequest }));
          const violations = validateTripPlan(plan, variedRequest, catalog);
          expect(violations.filter((item) => item.code === 'ACTIVITY_OVERLAP')).toEqual([]);
          expect(() => parseTripPlan(plan)).not.toThrow();
        },
      ),
      { numRuns: 75 },
    );
  });
});
