import type {
  AccommodationStay,
  Activity,
  InvariantViolation,
  LockedActivityRequest,
  LocalDate,
  PlanningAssumption,
  PlanningCatalog,
  PlanningConflict,
  Poi,
  TravelLeg,
  TravelTimeEntry,
  TravelTimeMatrix,
  TripDay,
  TripEdit,
  TripPlan,
  TripRequest,
} from '@global-travel-plans/domain';
import {
  createStableId,
  minutesToTime,
  timeToMinutes,
} from '@global-travel-plans/domain';

export interface PlannerInput {
  request: TripRequest;
  catalog: PlanningCatalog;
  travelTimeMatrix: TravelTimeMatrix;
  seed: number;
  plannerVersion: string;
  generatedAt: string;
}

interface PlanOptions {
  preferredDateByPoi?: Map<string, string>;
  previousPlanId?: string;
}

interface ScheduleResult {
  activities: Activity[];
  conflicts: PlanningConflict[];
}

interface LegResult {
  legs: TravelLeg[];
  conflicts: PlanningConflict[];
}

const DAY_MS = 86_400_000;
const TRANSFER_MINUTES = 255;
const TRAVEL_BUFFER_MINUTES = 20;

export function planTrip(input: PlannerInput): TripPlan {
  return planTripInternal(input, {});
}

export function replanTrip(
  input: PlannerInput,
  previousPlan: TripPlan,
  edits: TripEdit[],
): TripPlan {
  const lockById = new Map<string, boolean>();
  for (const day of previousPlan.days) {
    for (const activity of day.activities) lockById.set(activity.id, activity.locked);
  }

  const preferredDateByPoi = new Map<string, string>();
  for (const edit of edits) {
    if (edit.type === 'set-lock' && typeof edit.locked === 'boolean') {
      lockById.set(edit.activityId, edit.locked);
    }
    if (edit.type === 'move-activity' && edit.targetDayId) {
      const activity = previousPlan.days.flatMap((day) => day.activities).find((item) => item.id === edit.activityId);
      const targetDay = previousPlan.days.find((day) => day.id === edit.targetDayId);
      if (activity?.poiId && targetDay) preferredDateByPoi.set(activity.poiId, targetDay.localDate);
    }
  }

  const lockedActivities: LockedActivityRequest[] = previousPlan.days.flatMap((day) =>
    day.activities
      .filter((activity) => lockById.get(activity.id) === true)
      .map((activity) => ({
        id: activity.id,
        localDate: activity.localDate,
        startTime: activity.startTime,
        endTime: activity.endTime,
        timezoneId: activity.timezoneId,
        placeId: activity.placeId,
        ...(activity.poiId ? { poiId: activity.poiId } : {}),
        title: activity.title,
      })),
  );

  const request: TripRequest = { ...input.request, lockedActivities };
  return planTripInternal(
    { ...input, request },
    { preferredDateByPoi, previousPlanId: previousPlan.id },
  );
}

function planTripInternal(input: PlannerInput, options: PlanOptions): TripPlan {
  const { request, catalog } = input;
  const dates = listDates(request.startDate, request.endDate);
  if (dates.length === 0) throw new Error('Trip date range is empty');

  const placeById = new Map(catalog.places.map((place) => [place.id, place]));
  const selectedPlaceIds = request.destinations.map((item) => item.placeId);
  const missingPlaces = selectedPlaceIds.filter((id) => !placeById.has(id));
  const conflicts: PlanningConflict[] = missingPlaces.map((id) =>
    conflict('UNKNOWN_DESTINATION', 'error', { 'zh-CN': `未知目的地：${id}`, en: `Unknown destination: ${id}` }, [id]),
  );

  const allocation = allocateDestinationDays(request, catalog, dates.length);
  const placeByDate = new Map<string, string>();
  let dateOffset = 0;
  for (const item of allocation) {
    for (let index = 0; index < item.days && dateOffset < dates.length; index += 1) {
      const date = dates[dateOffset];
      if (date) placeByDate.set(date, item.placeId);
      dateOffset += 1;
    }
  }
  while (dateOffset < dates.length) {
    const date = dates[dateOffset];
    const fallback = selectedPlaceIds.at(-1) ?? selectedPlaceIds[0];
    if (date && fallback) placeByDate.set(date, fallback);
    dateOffset += 1;
  }

  if (dates.length < request.destinations.length) {
    conflicts.push(
      conflict(
        'DESTINATION_DAYS_INSUFFICIENT',
        'error',
        { 'zh-CN': '旅行天数少于目的地数量。', en: 'Trip days are fewer than destinations.' },
        selectedPlaceIds,
      ),
    );
  }

  const assignedPois = assignPoisToDates(request, catalog, dates, placeByDate, input.seed, options);
  const days: TripDay[] = [];
  let previousPlaceId: string | undefined;

  for (const date of dates) {
    const placeId = placeByDate.get(date) ?? selectedPlaceIds[0] ?? 'place:unknown';
    const place = placeById.get(placeId);
    const timezoneId = place?.timezoneIds[0] ?? 'UTC';
    const transition = Boolean(previousPlaceId && previousPlaceId !== placeId);
    const schedule = scheduleDay(
      input,
      date,
      placeId,
      timezoneId,
      transition,
      assignedPois.get(date) ?? [],
    );
    const legResult = buildTravelLegs(
      schedule.activities,
      input.travelTimeMatrix,
      request,
    );
    conflicts.push(...schedule.conflicts, ...legResult.conflicts);
    days.push({
      id: createStableId('day', date, placeId),
      localDate: date,
      placeId,
      timezoneId,
      activities: schedule.activities,
      travelLegs: legResult.legs,
    });
    previousPlaceId = placeId;
  }

  const scheduledPoiIds = new Set(
    days.flatMap((day) => day.activities.flatMap((activity) => (activity.poiId ? [activity.poiId] : []))),
  );
  for (const poiId of request.mustVisitPoiIds) {
    if (!scheduledPoiIds.has(poiId)) {
      conflicts.push(
        conflict(
          'MUST_VISIT_UNSCHEDULED',
          'error',
          { 'zh-CN': `必去点未能排入行程：${poiId}`, en: `Must-visit POI could not be scheduled: ${poiId}` },
          [poiId],
        ),
      );
    }
  }

  const accommodationStays = buildAccommodationStays(days, catalog);
  const assumptions: PlanningAssumption[] = [
    {
      id: 'assumption:fixture-data',
      code: 'FIXTURE_DATA',
      message: {
        'zh-CN': '本闭环使用经过 Schema 校验的演示数据，开放时间和交通需在出行前复核。',
        en: 'This vertical slice uses schema-validated demo data; verify opening hours and transport before travel.',
      },
      sourceRefs: ['source:planner-estimate-fixture'],
    },
    {
      id: 'assumption:accommodation-area-only',
      code: 'ACCOMMODATION_AREA_ONLY',
      message: {
        'zh-CN': '当前仅推荐住宿区域，具体酒店价格、评分和库存需在预订平台复核。',
        en: 'Only accommodation areas are recommended; verify hotel prices, ratings and availability on booking platforms.',
      },
      sourceRefs: [],
    },
  ];

  const basePlan: TripPlan = {
    id: createStableId('plan', request.id, input.plannerVersion, catalog.version, input.seed),
    requestId: request.id,
    status: 'valid',
    plannerVersion: input.plannerVersion,
    inputSchemaVersion: request.schemaVersion,
    dataVersion: catalog.version,
    seed: input.seed,
    days,
    accommodationStays,
    unresolvedConflicts: [],
    assumptions,
    sourceRefs: uniqueStrings([
      ...days.flatMap((day) => day.activities.flatMap((activity) => activity.sourceRefs)),
      ...days.flatMap((day) => day.travelLegs.flatMap((leg) => leg.sourceRefs)),
      ...accommodationStays.flatMap((stay) => stay.sourceRefs),
    ]),
    freshness: { fresh: 0, stale: 0, unavailable: 1 },
    degradationMessages: [
      {
        'zh-CN': '外部 Provider 未启用；地图路线和交通时间均为演示估算。',
        en: 'External providers are disabled; map paths and travel durations are demo estimates.',
      },
    ],
    generatedAt: input.generatedAt,
    ...(options.previousPlanId ? { previousPlanId: options.previousPlanId } : {}),
  };

  const violations = validateTripPlan(basePlan, request, catalog);
  const violationConflicts = violations.map((violation) =>
    conflict(
      violation.code,
      violation.severity,
      { 'zh-CN': violation.message, en: violation.message },
      violation.relatedIds,
    ),
  );
  const allConflicts = dedupeConflicts([...conflicts, ...violationConflicts]);

  return {
    ...basePlan,
    status: allConflicts.some((item) => item.severity === 'error') ? 'conflicted' : 'valid',
    unresolvedConflicts: allConflicts,
  };
}

function allocateDestinationDays(
  request: TripRequest,
  catalog: PlanningCatalog,
  totalDays: number,
): Array<{ placeId: string; days: number }> {
  const idealByPlace = new Map<string, number>();
  for (const destination of request.destinations) {
    const units = catalog.planningUnits.filter((unit) => unit.placeId === destination.placeId);
    const ideal = Math.max(1, ...units.map((unit) => unit.recommendedDays.ideal));
    idealByPlace.set(destination.placeId, ideal * (destination.weight ?? 1));
  }

  const result = request.destinations.map((destination, index) => ({
    placeId: destination.placeId,
    days: totalDays > index ? Math.max(1, destination.minDays ?? 1) : 0,
    maxDays: destination.maxDays ?? totalDays,
    score: idealByPlace.get(destination.placeId) ?? 1,
  }));
  let assigned = result.reduce((sum, item) => sum + item.days, 0);

  while (assigned < totalDays && result.length > 0) {
    const candidates = result
      .filter((item) => item.days < item.maxDays)
      .sort((a, b) => b.score / (b.days + 1) - a.score / (a.days + 1) || a.placeId.localeCompare(b.placeId));
    const candidate = candidates[0] ?? result[assigned % result.length];
    if (!candidate) break;
    candidate.days += 1;
    assigned += 1;
  }

  while (assigned > totalDays) {
    const candidate = [...result]
      .filter((item) => item.days > 1)
      .sort((a, b) => a.score / a.days - b.score / b.days || b.placeId.localeCompare(a.placeId))[0];
    if (!candidate) break;
    candidate.days -= 1;
    assigned -= 1;
  }

  return result.map(({ placeId, days }) => ({ placeId, days }));
}

function assignPoisToDates(
  request: TripRequest,
  catalog: PlanningCatalog,
  dates: string[],
  placeByDate: Map<string, string>,
  seed: number,
  options: PlanOptions,
): Map<string, Poi[]> {
  const result = new Map<string, Poi[]>(dates.map((date) => [date, []]));
  const excluded = new Set(request.excludedPoiIds);
  const lockedPoiIds = new Set(request.lockedActivities.flatMap((item) => (item.poiId ? [item.poiId] : [])));
  const maxPerDay = request.pace === 'relaxed' ? 1 : request.pace === 'balanced' ? 2 : 3;

  for (const destination of request.destinations) {
    const destinationDates = dates.filter((date) => placeByDate.get(date) === destination.placeId);
    const candidates = catalog.pois
      .filter((poi) => poi.placeId === destination.placeId && !excluded.has(poi.id) && !lockedPoiIds.has(poi.id))
      .sort((a, b) => scorePoi(b, request, seed) - scorePoi(a, request, seed) || a.id.localeCompare(b.id));

    for (const poi of candidates) {
      const preferredDate = options.preferredDateByPoi?.get(poi.id);
      const eligibleDates = preferredDate && destinationDates.includes(preferredDate)
        ? [preferredDate, ...destinationDates.filter((date) => date !== preferredDate)]
        : destinationDates;
      const target = [...eligibleDates]
        .sort((a, b) => (result.get(a)?.length ?? 0) - (result.get(b)?.length ?? 0) || a.localeCompare(b))
        .find((date) => (result.get(date)?.length ?? 0) < maxPerDay);
      if (target) result.get(target)?.push(poi);
    }
  }

  return result;
}

function scorePoi(poi: Poi, request: TripRequest, seed: number): number {
  const must = request.mustVisitPoiIds.includes(poi.id) ? 10_000 : 0;
  const interest = poi.categories.filter((category) => request.interests.includes(category)).length * 100;
  const physicalLimit = request.physicalLevel === 'low' ? 2 : request.physicalLevel === 'medium' ? 4 : 5;
  const physicalPenalty = Math.max(0, poi.physicalIntensity - physicalLimit) * 500;
  const accessibilityPenalty = request.accessibilityRequired && poi.accessibility !== 'accessible' ? 2_000 : 0;
  return must + interest - physicalPenalty - accessibilityPenalty + seededTie(poi.id, seed);
}

function scheduleDay(
  input: PlannerInput,
  localDate: LocalDate,
  placeId: string,
  timezoneId: string,
  transition: boolean,
  candidates: Poi[],
): ScheduleResult {
  const { request } = input;
  const dayStart = timeToMinutes(request.dailyStartTime);
  const dayEnd = timeToMinutes(request.dailyEndTime);
  const conflicts: PlanningConflict[] = [];
  const activities: Activity[] = request.lockedActivities
    .filter((item) => item.localDate === localDate)
    .map((item) => ({
      id: item.id,
      kind: item.poiId ? 'poi' : 'transfer',
      title: item.title,
      localDate,
      timezoneId: item.timezoneId,
      startTime: item.startTime,
      endTime: item.endTime,
      placeId: item.placeId,
      ...(item.poiId ? { poiId: item.poiId } : {}),
      locked: true,
      sourceRefs: [],
      reasonCodes: ['USER_LOCKED'],
    }));

  if (transition) {
    const start = dayStart;
    const end = Math.min(dayEnd, start + TRANSFER_MINUTES);
    activities.push({
      id: createStableId('activity', localDate, 'cross-region-transfer'),
      kind: 'transfer',
      title: { 'zh-CN': '跨区域转场（演示估算）', en: 'Cross-region transfer (demo estimate)' },
      localDate,
      timezoneId,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      placeId,
      locked: false,
      sourceRefs: ['source:planner-estimate-fixture'],
      reasonCodes: ['DESTINATION_TRANSITION', 'ESTIMATED_TRANSFER'],
      estimate: true,
    });
  }

  const transferEnd = activities
    .filter((activity) => activity.kind === 'transfer' && !activity.locked)
    .map((activity) => timeToMinutes(activity.endTime))
    .sort((a, b) => b - a)[0];
  const mealDesired = transferEnd ? transferEnd + 15 : 12 * 60;
  const mealStart = findSlot(activities, mealDesired, request.mealDurationMinutes, dayStart, dayEnd, 0);
  if (mealStart !== null) {
    activities.push({
      id: createStableId('activity', localDate, 'meal'),
      kind: 'meal',
      title: { 'zh-CN': '用餐', en: 'Meal' },
      localDate,
      timezoneId,
      startTime: minutesToTime(mealStart),
      endTime: minutesToTime(mealStart + request.mealDurationMinutes),
      placeId,
      locked: false,
      sourceRefs: [],
      reasonCodes: ['USER_MEAL_REQUIREMENT'],
    });
  } else {
    conflicts.push(conflict('MEAL_SLOT_UNAVAILABLE', 'warning', { 'zh-CN': '没有可用的完整用餐时段。', en: 'No complete meal slot was available.' }, [localDate], localDate));
  }

  if (request.restDurationMinutes > 0) {
    const restDesired = mealStart === null ? 13 * 60 : mealStart + request.mealDurationMinutes;
    const restStart = findSlot(activities, restDesired, request.restDurationMinutes, dayStart, dayEnd, 0);
    if (restStart !== null) {
      activities.push({
        id: createStableId('activity', localDate, 'rest'),
        kind: 'rest',
        title: { 'zh-CN': '休息', en: 'Rest' },
        localDate,
        timezoneId,
        startTime: minutesToTime(restStart),
        endTime: minutesToTime(restStart + request.restDurationMinutes),
        placeId,
        locked: false,
        sourceRefs: [],
        reasonCodes: ['USER_REST_REQUIREMENT'],
      });
    } else {
      conflicts.push(conflict('REST_SLOT_UNAVAILABLE', 'warning', { 'zh-CN': '没有可用的完整休息时段。', en: 'No complete rest slot was available.' }, [localDate], localDate));
    }
  }

  const lockedPoiIds = new Set(activities.flatMap((activity) => (activity.poiId ? [activity.poiId] : [])));
  for (const poi of candidates) {
    if (lockedPoiIds.has(poi.id)) continue;
    const duration = activityDuration(poi, request);
    const windows = poiWindowsForDate(poi, localDate, dayStart, dayEnd);
    const preferred = poi.preferredWindows?.[0] ? timeToMinutes(poi.preferredWindows[0].start) : dayStart;
    const start = findSlotInWindows(activities, windows, duration, preferred, TRAVEL_BUFFER_MINUTES);
    if (start === null) {
      conflicts.push(
        conflict(
          'POI_UNSCHEDULED',
          request.mustVisitPoiIds.includes(poi.id) ? 'error' : 'warning',
          { 'zh-CN': `无法在开放时间和每日预算内安排：${poi.names['zh-CN'] ?? poi.id}`, en: `Could not schedule within opening hours and daily budget: ${poi.names.en ?? poi.id}` },
          [poi.id],
          localDate,
        ),
      );
      continue;
    }
    activities.push({
      id: createStableId('activity', localDate, poi.id),
      kind: 'poi',
      title: poi.names,
      localDate,
      timezoneId,
      startTime: minutesToTime(start),
      endTime: minutesToTime(start + duration),
      placeId,
      poiId: poi.id,
      planningUnitId: poi.planningUnitId,
      locked: false,
      sourceRefs: poi.sourceRefs,
      reasonCodes: [
        request.mustVisitPoiIds.includes(poi.id) ? 'MUST_VISIT' : 'INTEREST_MATCH',
        poi.uncertainty === 'estimated' ? 'ESTIMATED_FIXTURE' : 'REVIEWED_DATA',
      ],
    });
  }

  activities.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.id.localeCompare(b.id));
  return { activities, conflicts };
}

function buildTravelLegs(
  activities: Activity[],
  matrix: TravelTimeMatrix,
  request: TripRequest,
): LegResult {
  const legs: TravelLeg[] = [];
  const conflicts: PlanningConflict[] = [];
  for (let index = 0; index < activities.length - 1; index += 1) {
    const origin = activities[index];
    const destination = activities[index + 1];
    if (!origin || !destination) continue;
    const matrixEntry = origin.poiId && destination.poiId
      ? findMatrixEntry(matrix, origin.poiId, destination.poiId, request.transportPreferences)
      : undefined;
    const stationarySamePlace =
    origin.placeId === destination.placeId &&
    !origin.poiId &&
    !destination.poiId &&
    origin.kind !== 'transfer' &&
    destination.kind !== 'transfer';
  const durationMinutes =
    matrixEntry?.durationMinutes ??
    (stationarySamePlace ? 0 : origin.placeId === destination.placeId ? 10 : 60);
    const method = matrixEntry?.method ?? 'estimate';
    const start = timeToMinutes(origin.endTime);
    const end = start + durationMinutes;
    const destinationStart = timeToMinutes(destination.startTime);
    if (end > destinationStart) {
      conflicts.push(
        conflict(
          'INSUFFICIENT_TRAVEL_TIME',
          'error',
          { 'zh-CN': '相邻活动之间预留的交通时间不足。', en: 'Insufficient travel time between adjacent activities.' },
          [origin.id, destination.id],
          origin.localDate,
        ),
      );
    }
    legs.push({
      id: createStableId('leg', origin.id, destination.id),
      localDate: origin.localDate,
      timezoneId: origin.timezoneId,
      originActivityId: origin.id,
      destinationActivityId: destination.id,
      originPlaceId: origin.placeId,
      destinationPlaceId: destination.placeId,
      mode: matrixEntry?.mode ?? request.transportPreferences[0] ?? 'walk',
      startTime: minutesToTime(start),
      endTime: minutesToTime(Math.min(end, 24 * 60 - 1)),
      durationMinutes,
      ...(matrixEntry?.distanceMeters !== undefined ? { distanceMeters: matrixEntry.distanceMeters } : {}),
      method,
      confidence: matrixEntry?.confidence ?? 'low',
      sourceRefs: matrixEntry?.sourceRefs ?? ['source:planner-estimate-fixture'],
      crossRegion: origin.placeId !== destination.placeId,
    });
  }
  return { legs, conflicts };
}

function buildAccommodationStays(days: TripDay[], catalog: PlanningCatalog): AccommodationStay[] {
  const stays: AccommodationStay[] = [];
  let start = 0;
  while (start < days.length) {
    const first = days[start];
    if (!first) break;
    let end = start;
    while (end + 1 < days.length && days[end + 1]?.placeId === first.placeId) end += 1;
    const unit = catalog.planningUnits
      .filter((item) => item.placeId === first.placeId)
      .sort((a, b) => (b.accommodationScore ?? 0) - (a.accommodationScore ?? 0) || a.id.localeCompare(b.id))[0];
    if (unit) {
      const last = days[end];
      if (last) {
        stays.push({
          id: createStableId('stay', first.placeId, first.localDate, last.localDate),
          placeId: first.placeId,
          planningUnitId: unit.id,
          checkInDate: first.localDate,
          checkOutDate: addDays(last.localDate, 1),
          reasonCodes: ['MINIMIZE_DAILY_TRAVEL', 'NO_LIVE_HOTEL_PROVIDER'],
          sourceRefs: unit.sourceRefs,
        });
      }
    }
    start = end + 1;
  }
  return stays;
}

export function validateTripPlan(
  plan: TripPlan,
  request: TripRequest,
  catalog: PlanningCatalog,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const ids = new Set<string>();
  const selectedPlaces = new Set(request.destinations.map((item) => item.placeId));
  const poiById = new Map(catalog.pois.map((poi) => [poi.id, poi]));
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const dayStart = timeToMinutes(request.dailyStartTime);
  const dayEnd = timeToMinutes(request.dailyEndTime);

  for (const day of plan.days) {
    if (day.localDate < request.startDate || day.localDate > request.endDate) {
      pushViolation(violations, 'DATE_OUT_OF_RANGE', 'error', `days.${day.id}`, 'Travel date is outside the request range.', [day.id]);
    }
    if (!day.timezoneId) pushViolation(violations, 'TIMEZONE_MISSING', 'error', `days.${day.id}`, 'Day timezone is missing.', [day.id]);
    if (!selectedPlaces.has(day.placeId)) pushViolation(violations, 'DAY_DESTINATION_INVALID', 'error', `days.${day.id}`, 'Day belongs to an unselected destination.', [day.id]);

    const activities = [...day.activities].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    for (let index = 0; index < activities.length; index += 1) {
      const activity = activities[index];
      if (!activity) continue;
      if (ids.has(activity.id)) pushViolation(violations, 'DUPLICATE_ID', 'error', `activities.${activity.id}`, 'Activity ID is duplicated.', [activity.id]);
      ids.add(activity.id);
      const start = timeToMinutes(activity.startTime);
      const end = timeToMinutes(activity.endTime);
      if (end <= start) pushViolation(violations, 'ACTIVITY_DURATION_INVALID', 'error', `activities.${activity.id}`, 'Activity end must follow start.', [activity.id]);
      if (start < dayStart || end > dayEnd) pushViolation(violations, 'DAILY_BUDGET_EXCEEDED', 'error', `activities.${activity.id}`, 'Activity is outside the daily availability window.', [activity.id]);
      if (activity.localDate !== day.localDate || activity.timezoneId !== day.timezoneId) pushViolation(violations, 'LOCAL_DATE_TIMEZONE_MISMATCH', 'error', `activities.${activity.id}`, 'Activity lost day or timezone context.', [activity.id]);
      if (activity.poiId) {
        const poi = poiById.get(activity.poiId);
        if (!poi || poi.placeId !== day.placeId) pushViolation(violations, 'POI_DESTINATION_INVALID', 'error', `activities.${activity.id}`, 'POI is not part of the selected day destination.', [activity.id, activity.poiId]);
      }
      for (const sourceRef of activity.sourceRefs) if (!sourceIds.has(sourceRef)) pushViolation(violations, 'SOURCE_REF_MISSING', 'error', `activities.${activity.id}`, 'Activity source cannot be resolved.', [activity.id, sourceRef]);
      const previous = activities[index - 1];
      if (previous && timeToMinutes(previous.endTime) > start) pushViolation(violations, 'ACTIVITY_OVERLAP', 'error', `days.${day.id}`, 'Activities overlap.', [previous.id, activity.id]);
    }

    for (let index = 0; index < activities.length - 1; index += 1) {
      const origin = activities[index];
      const destination = activities[index + 1];
      if (!origin || !destination) continue;
      const leg = day.travelLegs.find((item) => item.originActivityId === origin.id && item.destinationActivityId === destination.id);
      if (!leg) {
        pushViolation(violations, 'TRAVEL_LEG_MISSING', 'error', `days.${day.id}`, 'Adjacent activities require a TravelLeg.', [origin.id, destination.id]);
        continue;
      }
      if (leg.originPlaceId !== origin.placeId || leg.destinationPlaceId !== destination.placeId) pushViolation(violations, 'TRAVEL_LEG_ENDPOINT_MISMATCH', 'error', `legs.${leg.id}`, 'TravelLeg endpoints do not match adjacent activities.', [leg.id]);
      if (timeToMinutes(leg.endTime) > timeToMinutes(destination.startTime)) pushViolation(violations, 'TRAVEL_LEG_OVERLAP', 'error', `legs.${leg.id}`, 'TravelLeg overlaps the destination activity.', [leg.id, destination.id]);
      if (leg.method === 'estimate' && leg.confidence === 'high') pushViolation(violations, 'ESTIMATE_CONFIDENCE_INVALID', 'warning', `legs.${leg.id}`, 'Estimated travel must not be labelled high confidence.', [leg.id]);
    }
  }

  for (let index = 1; index < plan.days.length; index += 1) {
    const previous = plan.days[index - 1];
    const current = plan.days[index];
    if (previous && current && previous.placeId !== current.placeId && !current.activities.some((activity) => activity.kind === 'transfer')) {
      pushViolation(violations, 'CROSS_REGION_TRANSFER_MISSING', 'error', `days.${current.id}`, 'Destination change requires an explicit transfer activity.', [previous.id, current.id]);
    }
  }

  for (const locked of request.lockedActivities) {
    const activity = plan.days.flatMap((day) => day.activities).find((item) => item.id === locked.id);
    if (!activity || !activity.locked || activity.localDate !== locked.localDate || activity.startTime !== locked.startTime || activity.endTime !== locked.endTime) {
      pushViolation(violations, 'LOCKED_ACTIVITY_CHANGED', 'error', `locked.${locked.id}`, 'Locked activity was removed or moved.', [locked.id]);
    }
  }

  for (const day of plan.days) {
    const covered = plan.accommodationStays.some(
      (stay) => stay.placeId === day.placeId && stay.checkInDate <= day.localDate && day.localDate < stay.checkOutDate,
    );
    if (!covered) pushViolation(violations, 'ACCOMMODATION_DATE_MISMATCH', 'error', `days.${day.id}`, 'No accommodation stay covers this destination date.', [day.id]);
  }

  return violations;
}

function findMatrixEntry(
  matrix: TravelTimeMatrix,
  fromPoiId: string,
  toPoiId: string,
  preferences: TripRequest['transportPreferences'],
): TravelTimeEntry | undefined {
  const candidates = matrix.entries.filter((entry) => entry.fromPoiId === fromPoiId && entry.toPoiId === toPoiId);
  return [...candidates].sort((a, b) => {
    const aRank = preferences.indexOf(a.mode);
    const bRank = preferences.indexOf(b.mode);
    return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank) || a.durationMinutes - b.durationMinutes;
  })[0];
}

function poiWindowsForDate(poi: Poi, localDate: string, dayStart: number, dayEnd: number): Array<[number, number]> {
  const exception = poi.openingHours?.exceptions?.[localDate];
  const windows = exception ?? poi.openingHours?.weekly.find((rule) => rule.daysOfWeek.includes(dayOfWeek(localDate)))?.windows;
  if (!windows || windows.length === 0) return [[dayStart, dayEnd]];
  return windows
    .map((window) => [Math.max(dayStart, timeToMinutes(window.start)), Math.min(dayEnd, timeToMinutes(window.end))] as [number, number])
    .filter(([start, end]) => end > start);
}

function findSlotInWindows(
  activities: Activity[],
  windows: Array<[number, number]>,
  duration: number,
  preferredStart: number,
  buffer: number,
): number | null {
  const ordered = [...windows].sort((a, b) => {
    const aDistance = Math.abs(Math.max(a[0], preferredStart) - preferredStart);
    const bDistance = Math.abs(Math.max(b[0], preferredStart) - preferredStart);
    return aDistance - bDistance || a[0] - b[0];
  });
  for (const [windowStart, windowEnd] of ordered) {
    const preferred = Math.max(windowStart, preferredStart);
    const first = findSlot(activities, preferred, duration, windowStart, windowEnd, buffer);
    if (first !== null) return first;
    const fallback = findSlot(activities, windowStart, duration, windowStart, windowEnd, buffer);
    if (fallback !== null) return fallback;
  }
  return null;
}

function findSlot(
  activities: Activity[],
  desiredStart: number,
  duration: number,
  minStart: number,
  maxEnd: number,
  buffer: number,
): number | null {
  for (let start = Math.max(desiredStart, minStart); start + duration <= maxEnd; start += 5) {
    const end = start + duration;
    const overlaps = activities.some((activity) => {
      const activityStart = timeToMinutes(activity.startTime);
      const activityEnd = timeToMinutes(activity.endTime);
      return start < activityEnd + buffer && end + buffer > activityStart;
    });
    if (!overlaps) return start;
  }
  return null;
}

function activityDuration(poi: Poi, request: TripRequest): number {
  const base = request.pace === 'intensive' ? poi.recommendedDurationMinutes.min : poi.recommendedDurationMinutes.ideal;
  if (request.physicalLevel === 'low') return Math.min(base, Math.max(poi.recommendedDurationMinutes.min, 120));
  return base;
}

function listDates(startDate: string, endDate: string): string[] {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const dates: string[] = [];
  for (let value = start; value <= end; value += DAY_MS) dates.push(new Date(value).toISOString().slice(0, 10));
  return dates;
}

function addDays(localDate: string, days: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function dayOfWeek(localDate: string): number {
  return new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
}

function seededTie(value: string, seed: number): number {
  let hash = seed | 0;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  return (hash >>> 0) / 0xffffffff;
}

function conflict(
  code: string,
  severity: 'error' | 'warning',
  message: PlanningConflict['message'],
  relatedIds: string[],
  localDate?: string,
): PlanningConflict {
  return {
    id: createStableId('conflict', code, localDate ?? 'global', ...relatedIds),
    code,
    severity,
    message,
    ...(localDate ? { localDate } : {}),
    relatedIds,
    resolved: false,
  };
}

function pushViolation(
  target: InvariantViolation[],
  code: string,
  severity: 'error' | 'warning',
  path: string,
  message: string,
  relatedIds: string[],
): void {
  target.push({ code, severity, path, message, relatedIds });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function dedupeConflicts(values: PlanningConflict[]): PlanningConflict[] {
  return [...new Map(values.map((item) => [item.id, item])).values()].sort(
    (a, b) => (a.localDate ?? '').localeCompare(b.localDate ?? '') || a.code.localeCompare(b.code),
  );
}
